import { spawn, execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { requireDist, startServer } from './lib/server.mjs';
import { calculateMetrics } from './lib/bench-metrics.mjs';
import { connectCDP } from './lib/cdp.mjs';

const t0 = Date.now();
const exec = promisify(execFile);

function parseArgs() {
  const opts = { seed: 42, duration: 30, out: 'bench.json' };
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].slice(2);
    if (!['--seed', '--duration', '--out'].includes(args[i]) || args[i + 1] === undefined) {
      throw new Error('Usage: node scripts/bench.mjs --seed 42 --duration 30 --out bench.json');
    }
    opts[key] = key === 'out' ? args[i + 1] : Number(args[i + 1]);
  }
  if (!Number.isInteger(opts.seed) || opts.seed < 0 || opts.seed > 0xffffffff) throw new Error('Invalid seed');
  if (!Number.isFinite(opts.duration) || opts.duration <= 0) throw new Error('Invalid duration');
  return opts;
}

async function findChrome() {
  const candidates = process.env.CHROME_PATH ? [process.env.CHROME_PATH] : [
    ...(process.env.PATH || '').split(path.delimiter).flatMap((dir) =>
      ['google-chrome', 'chromium', 'chromium-browser'].map((name) => path.join(dir, name))),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  for (const candidate of candidates) {
    try { await access(candidate, constants.X_OK); return candidate; } catch { /* next */ }
  }
  throw new Error('Không tìm thấy Chrome/Chromium. Đặt CHROME_PATH tới trình duyệt.');
}

async function chromeRss(pid, profile) {
  const { stdout } = await exec('ps', ['-eo', 'pid=,ppid=,rss=,args='], { timeout: 2000, maxBuffer: 8 * 1024 * 1024 });
  const rows = stdout.split('\n').map((line) => {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/);
    return m && { pid: Number(m[1]), ppid: Number(m[2]), rss: Number(m[3]), args: m[4] };
  }).filter(Boolean);
  const owned = new Set([pid, ...rows.filter((r) => r.args.includes(`--user-data-dir=${profile}`)).map((r) => r.pid)]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) if (owned.has(row.ppid) && !owned.has(row.pid)) { owned.add(row.pid); changed = true; }
  }
  return rows.filter((r) => owned.has(r.pid)).reduce((sum, r) => sum + r.rss, 0) / 1024;
}

async function main() {
  const opts = parseArgs();
  await requireDist();
  const chrome = await findChrome();
  const timeout = Number(process.env.BENCH_TIMEOUT_MS ?? (opts.duration + 40) * 1000);
  if (!Number.isFinite(timeout) || timeout <= 0) throw new Error('Invalid BENCH_TIMEOUT_MS');
  const deadline = t0 + timeout;
  let server;
  let profile;
  let child;
  let cdp;
  let watchdog;
  let stderr = '';
  let launchError;
  let expired = false;
  let interrupted = false;
  const stop = () => { interrupted = true; child?.kill('SIGTERM'); };
  const check = () => {
    if (expired || Date.now() >= deadline) throw new Error(`Benchmark timeout after ${timeout} ms`);
    if (interrupted) throw new Error('Benchmark interrupted');
    if (launchError) throw launchError;
    if (child && (child.exitCode !== null || child.signalCode !== null)) {
      throw new Error(`Chrome exited before benchmark completed (${child.exitCode ?? child.signalCode}). ${stderr.trim()}`);
    }
  };
  try {
    server = await startServer();
    profile = await mkdtemp(path.join(os.tmpdir(), 'ddl-bench-'));
    child = spawn(chrome, [
      `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
      '--window-size=1280,720', ...(process.env.BENCH_FLAGS ? process.env.BENCH_FLAGS.split(' ') : ['--disable-gpu-vsync', '--disable-frame-rate-limit']),
      // Không để Chrome giảm tốc khi cửa sổ bị che/mất focus (gây khung khựng giả).
      '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
      'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-6000); });
    child.once('error', (err) => { launchError = new Error(`Cannot start Chrome: ${err.message}`); });
    watchdog = setTimeout(() => { expired = true; child.kill('SIGKILL'); }, Math.max(1, deadline - Date.now()));
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    let port;
    const startupDeadline = Math.min(deadline, Date.now() + 15000);
    while (!port) {
      check();
      if (Date.now() >= startupDeadline) throw new Error(`Chrome CDP startup timeout. ${stderr.trim()}`);
      try {
        const lines = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n');
        if (/^\d+$/.test(lines[0])) port = Number(lines[0]);
      } catch (err) { if (err.code !== 'ENOENT') throw err; }
      if (!port) await delay(100);
    }
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Chrome CDP target lookup: HTTP ${response.status}`);
    const targets = await response.json();
    const target = targets.find((item) => item.type === 'page');
    if (!target?.webSocketDebuggerUrl) throw new Error('Chrome did not expose a CDP page');
    cdp = await connectCDP(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    const url = `http://127.0.0.1:${server.address().port}/bench.html?seed=${opts.seed}&duration=${opts.duration}`;
    const navigation = await cdp.send('Page.navigate', { url });
    if (navigation.errorText) throw new Error(`Chrome navigation: ${navigation.errorText}`);
    console.error('bench: CDP connected; viewport 1280×720; waiting for WebGL frames.');
    let state;
    let peak = 0;
    let lastSample = -Infinity;
    const firstFrameDeadline = Math.min(deadline, Date.now() + 15000);
    while (true) {
      check();
      const result = await cdp.send('Runtime.evaluate', {
        expression: `window.__bench ? { firstFrameAt: window.__bench.firstFrameAt, done: window.__bench.done,
          error: window.__bench.error, renderer: window.__bench.renderer } : null`, returnByValue: true,
      });
      if (result.exceptionDetails) throw new Error(`CDP evaluation failed: ${result.exceptionDetails.text}`);
      state = result.result?.value;
      if (state?.error) throw new Error(`Benchmark page/WebGL: ${state.error}`);
      if (!state?.firstFrameAt && Date.now() >= firstFrameDeadline) {
        throw new Error('No first benchmark frame within 15 s; check WebGL and browser console.');
      }
      const now = Date.now();
      if (!process.env.BENCH_NO_RSS && state?.firstFrameAt && now >= state.firstFrameAt + 3000 && now - lastSample >= 500) {
        peak = Math.max(peak, await chromeRss(child.pid, profile));
        lastSample = now;
      }
      if (state?.done) break;
      await delay(100);
    }
    const raw = await cdp.send('Runtime.evaluate', { expression: 'window.__bench.dts', returnByValue: true });
    // BENCH_DUMP=<file>: ghi thêm toàn bộ dt (ms) để phân tích khung hình chậm.
    if (process.env.BENCH_DUMP) await writeFile(process.env.BENCH_DUMP, JSON.stringify(raw.result?.value ?? []));
    const metrics = calculateMetrics(raw.result?.value);
    if (!peak && !process.env.BENCH_NO_RSS) throw new Error('Could not measure Chrome RSS with ps');
    const output = {
      contract_version: '1.3', ...metrics, load_ms: state.firstFrameAt - t0,
      peak_mem_mb: Math.round(peak * 10) / 10, vsync_off: true, renderer: state.renderer,
      os: `${os.type()} ${os.release()} ${os.arch()}; ${os.cpus()[0]?.model || 'unknown CPU'}`,
    };
    await writeFile(opts.out, JSON.stringify(output, null, 2) + '\n');
    console.log(`Benchmark saved: ${opts.out}`);
  } finally {
    clearTimeout(watchdog);
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    cdp?.close();
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.kill('SIGTERM');
      let force;
      await Promise.race([exited, new Promise((resolve) => {
        force = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 1500);
      })]);
      clearTimeout(force);
    }
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

main().catch((err) => { console.error(`bench: ${err.message}`); process.exitCode = 1; });
