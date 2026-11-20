import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, mkdir, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createServer } from '../scripts/lib/server.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const make = (name, score, achieved_at = '2026-11-20T09:00:00+07:00') => ({ name, score, achieved_at, nights_won: 1, seed: 42 });

test('play export: LEADERBOARD_FILE, đúng thứ tự điểm/thời gian và top 10, không mở server', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ddl-export-'));
  try {
    const file = path.join(dir, 'data.json');
    const out = path.join(dir, 'out.json');
    const entries = [make('late', 100, '2026-11-20T10:00:00+07:00'),
      make('early', 100, '2026-11-20T02:00:00Z'), make('best', 200),
      ...Array.from({ length: 10 }, (_, i) => make(`user${i}`, i))];
    await writeFile(file, JSON.stringify({ entries }));
    const result = spawnSync(process.execPath, ['scripts/play.mjs', '--export-leaderboard', out], {
      cwd: root, env: { ...process.env, LEADERBOARD_FILE: file, PORT: 'invalid' }, encoding: 'utf8', timeout: 5000,
    });
    assert.equal(result.status, 0, result.stderr || String(result.error));
    const actual = JSON.parse(await readFile(out, 'utf8'));
    assert.deepEqual(Object.keys(actual), ['entries']);
    assert.deepEqual(actual.entries.map((e) => e.name), ['best', 'early', 'late', 'user9', 'user8', 'user7', 'user6', 'user5', 'user4', 'user3']);
    assert.equal(actual.entries[1].achieved_at, '2026-11-20T02:00:00Z');
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { entries });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('play export: chưa có dữ liệu thì xuất entries rỗng', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ddl-export-'));
  try {
    const out = path.join(dir, 'out.json');
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/play.mjs'), '--export-leaderboard', out], {
      cwd: dir, env: { ...process.env, LEADERBOARD_FILE: path.join(dir, 'absent.json') }, encoding: 'utf8', timeout: 5000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(await readFile(out, 'utf8')), { entries: [] });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

// Exercise the actual HTTP handler without binding a TCP port (restricted in
// the worker sandbox). Streaming and persistence still use the real server.
function request(server, pathname, method = 'GET', body) {
  return new Promise((resolve, reject) => {
    const req = Readable.from(body ? [Buffer.from(body)] : []);
    req.method = method;
    req.url = pathname;
    let text = '';
    const headers = {};
    const res = new Writable({ write(chunk, encoding, callback) { text += chunk.toString(); callback(); } });
    res.setHeader = (key, value) => { headers[key.toLowerCase()] = value; };
    res.writeHead = (status, values) => {
      res.statusCode = status;
      for (const [key, value] of Object.entries(values)) res.setHeader(key, value);
      res.headersSent = true;
    };
    res.on('finish', () => {
      resolve({ status: res.statusCode, type: headers['content-type'], text });
    });
    res.on('error', reject);
    server.emit('request', req, res);
  });
}

test('local server: MIME, traversal, API validate, concurrent insert và lưu qua restart', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ddl-server-'));
  let server;
  try {
    const dist = path.join(dir, 'dist');
    const file = path.join(dir, 'data/leaderboard.json');
    await mkdir(dist);
    const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json',
      png: 'image/png', svg: 'image/svg+xml', wasm: 'application/wasm' };
    for (const ext of Object.keys(types)) await writeFile(path.join(dist, `index.${ext}`), 'fixture');
    await writeFile(path.join(dir, 'secret.txt'), 'secret');
    await symlink(path.join(dir, 'secret.txt'), path.join(dist, 'escape.txt'));
    server = createServer({ dist, file });
    for (const [ext, type] of Object.entries(types)) {
      const res = await request(server, `/index.${ext}`);
      assert.equal(res.status, 200);
      assert.ok(res.type.startsWith(type));
    }
    assert.equal((await request(server, '/')).text, 'fixture');
    for (const traversal of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%5csecret.txt', '/escape.txt']) {
      assert.equal((await request(server, traversal)).status, 403, traversal);
    }
    assert.equal((await request(server, '/%ZZ')).status, 400);
    assert.equal((await request(server, '/missing.js')).status, 404);
    assert.deepEqual(JSON.parse((await request(server, '/api/leaderboard')).text), { entries: [] });
    for (const body of ['{', JSON.stringify(make('ab', 10)), JSON.stringify({ ...make('bad', 1), nights_won: 4 }),
      JSON.stringify({ ...make('bad', 1), achieved_at: 'yesterday' })]) {
      assert.equal((await request(server, '/api/leaderboard', 'POST', body)).status, 400);
    }
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) =>
      request(server, '/api/leaderboard', 'POST', JSON.stringify(make(`user${i}`, i)))));
    for (const result of results) assert.equal(result.status, 201, result.text);
    const expected = Array.from({ length: 10 }, (_, i) => 11 - i);
    assert.deepEqual(JSON.parse((await request(server, '/api/leaderboard')).text).entries.map((e) => e.score), expected);
    server = createServer({ dist, file });
    assert.deepEqual(JSON.parse((await request(server, '/api/leaderboard')).text).entries.map((e) => e.score), expected);
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')).entries.map((e) => e.score), expected);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
