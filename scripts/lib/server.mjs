import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEntry, sortEntries } from '../../src/leaderboard.js';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const DIST = path.join(ROOT, 'dist');
export const leaderboardFile = () => process.env.LEADERBOARD_FILE || path.join(ROOT, 'data/leaderboard.json');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm',
};

export async function readLeaderboard(file = leaderboardFile()) {
  let data;
  try { data = JSON.parse(await readFile(file, 'utf8')); }
  catch (err) { if (err.code === 'ENOENT') return []; throw err; }
  if (!Array.isArray(data.entries)) throw new Error('Invalid leaderboard file: entries must be an array');
  const entries = data.entries.map((entry) => {
    if (typeof entry?.achieved_at !== 'string' ||
        !/(?:Z|[+-]\d{2}:\d{2})$/.test(entry.achieved_at)) throw new Error('Invalid leaderboard achievement time');
    const valid = makeEntry({ ...entry, date: entry.achieved_at });
    // Export must retain the persisted ISO representation, including UTC Z.
    return { ...valid, achieved_at: entry.achieved_at };
  });
  return sortEntries(entries).slice(0, 10);
}

export async function requireDist(dist = DIST) {
  try { if ((await stat(path.join(dist, 'index.html'))).isFile()) return; } catch { /* report below */ }
  throw new Error('Chưa có dist/. Hãy chạy npm run build trước.');
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let size = 0;
  const parts = [];
  for await (const part of req) {
    size += part.length;
    if (size > 16384) { const err = new Error('Request body too large'); err.status = 413; throw err; }
    parts.push(part);
  }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch { const err = new Error('Invalid JSON'); err.status = 400; throw err; }
}

export function createServer({ dist = DIST, file = leaderboardFile() } = {}) {
  const base = path.resolve(dist);
  let writes = Promise.resolve();
  let serial = 0;
  return http.createServer(async (req, res) => {
    try {
      // Check before URL parsing (which would silently normalize ../ away).
      let pathname;
      try { pathname = decodeURIComponent(req.url.split('?')[0]); }
      catch { return json(res, 400, { error: 'Invalid URL encoding' }); }
      if (!pathname.startsWith('/') || pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').includes('..')) {
        return json(res, 403, { error: 'Forbidden path' });
      }
      if (pathname === '/api/leaderboard') {
        if (req.method === 'GET') {
          await writes;
          return json(res, 200, { entries: await readLeaderboard(file) });
        }
        if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return json(res, 405, { error: 'Method not allowed' }); }
        const body = await readBody(req);
        let entry;
        try {
          if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid entry');
          if (body.achieved_at !== undefined && (typeof body.achieved_at !== 'string' ||
              !/(?:Z|[+-]\d{2}:\d{2})$/.test(body.achieved_at))) throw new Error('Achievement time needs an ISO timezone');
          entry = makeEntry({ ...body, date: body.achieved_at ?? new Date() });
        } catch (err) { return json(res, 400, { error: err.message }); }
        const task = writes.then(async () => {
          const entries = sortEntries([...(await readLeaderboard(file)), entry]).slice(0, 10);
          await mkdir(path.dirname(file), { recursive: true });
          const temp = `${file}.${process.pid}.${serial++}.tmp`;
          await writeFile(temp, JSON.stringify({ entries }, null, 2) + '\n');
          await rename(temp, file);
          return entries;
        });
        writes = task.catch(() => {});
        return json(res, 201, { entries: await task });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); return json(res, 405, { error: 'Method not allowed' }); }
      const candidate = path.resolve(base, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!candidate.startsWith(base + path.sep)) return json(res, 403, { error: 'Forbidden path' });
      let target;
      let info;
      try {
        target = await realpath(candidate);
        const realBase = await realpath(base);
        if (!target.startsWith(realBase + path.sep)) return json(res, 403, { error: 'Forbidden path' });
        info = await stat(target);
      } catch (err) { if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return json(res, 404, { error: 'Not found' }); throw err; }
      if (!info.isFile()) return json(res, 404, { error: 'Not found' });
      res.writeHead(200, { 'Content-Type': MIME[path.extname(target)] || 'application/octet-stream',
        'Content-Length': info.size, 'X-Content-Type-Options': 'nosniff' });
      if (req.method === 'HEAD') return res.end();
      const stream = createReadStream(target);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } catch (err) {
      if (res.headersSent) res.destroy();
      else json(res, err.status || 500, { error: err.status ? err.message : 'Server error' });
    }
  });
}

export async function startServer({ port = 0, host = '127.0.0.1', ...options } = {}) {
  const server = createServer(options);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.off('error', reject); resolve(); });
  });
  return server;
}
