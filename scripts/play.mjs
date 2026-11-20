import { writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { readLeaderboard, requireDist, startServer } from './lib/server.mjs';

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--export-leaderboard' && args.length === 2) {
    await writeFile(args[1], JSON.stringify({ entries: await readLeaderboard() }, null, 2) + '\n');
    return;
  }
  if (args.length) throw new Error('Usage: node scripts/play.mjs [--export-leaderboard out.json]');
  await requireDist();
  const port = Number(process.env.PORT || 5173);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PORT');
  const server = await startServer({ port });
  const url = `http://localhost:${server.address().port}`;
  console.log(`Đảo Đèn Lồng: ${url}`);
  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
  const child = spawn(opener, [url], { detached: true, stdio: 'ignore' });
  child.on('error', () => {});
  child.unref();
  const close = () => { server.close(); server.closeAllConnections(); };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

main().catch((err) => { console.error(`play: ${err.message}`); process.exitCode = 1; });
