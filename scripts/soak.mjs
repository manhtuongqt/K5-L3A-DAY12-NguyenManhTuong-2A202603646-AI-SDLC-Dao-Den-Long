import { readFile, writeFile } from 'node:fs/promises';
import { createGame } from '../src/sim/game.js';
import { mulberry32 } from '../src/sim/rng.js';

const ACTIONS = [['jump', 0.05], ['dash', 0.03], ['pulse', 0.02], ['interact', 0.1]];

function parseArguments(args) {
  const options = { seed: '7', nights: '10', out: 'soak.json' };
  const seen = new Set();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].startsWith('--') ? args[i].slice(2) : '';
    if (!Object.hasOwn(options, key)) throw new Error(`Unknown argument: ${args[i]}`);
    if (seen.has(key)) throw new Error(`Duplicate argument: ${args[i]}`);
    const value = args[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${args[i]}`);
    options[key] = value;
    seen.add(key);
  }
  for (const key of ['seed', 'nights']) {
    if (!/^[+-]?\d+$/.test(options[key]) || !Number.isSafeInteger(Number(options[key]))) {
      throw new Error(`--${key} must be a safe integer`);
    }
    options[key] = Number(options[key]);
  }
  if (options.nights < 1) throw new Error('--nights must be >= 1');
  if (!Number.isSafeInteger(options.seed + options.nights - 1)) throw new Error('Seed range exceeds safe integers');
  return options;
}

async function main() {
  const startedAt = performance.now();
  const options = parseArguments(process.argv.slice(2));
  const { tuning } = JSON.parse(await readFile(new URL('../game.contract.json', import.meta.url), 'utf8'));
  const results = [];
  let crashes = 0, memStart;
  for (let i = 0; i < options.nights; i += 1) {
    let game;
    try {
      const night = i % 3 + 1;
      const seed = options.seed + i;
      game = createGame({ seed, night, tuning });
      if (i === 0) {
        globalThis.gc?.();
        memStart = process.memoryUsage().rss / 1024 ** 2;
      }
      const random = mulberry32(seed);
      const input = { move: [0, 0], jump: false, dash: false, pulse: false, interact: false };
      const maxTicks = Math.round(tuning[`night${night}_duration_s`] * 60);
      for (let tick = 0; tick < maxTicks && !game.ended; tick += 1) {
        if (tick % 30 === 0) {
          const angle = random() * Math.PI * 2;
          input.move = [Math.cos(angle), Math.sin(angle)];
        }
        for (const [button, chance] of ACTIONS) {
          const pressed = random() < chance;
          // Release on the following tick, even if the next draw also succeeds.
          input[button] = !input[button] && pressed;
        }
        game.step(input);
      }
      results.push(game.state === 'won' ? 'won' : 'lost');
    } catch (error) {
      crashes += 1;
      results.push('crash');
      process.stderr.write(`Night ${i + 1}: ${error.message}\n`);
    } finally {
      game = null;
    }
  }
  globalThis.gc?.();
  const report = {
    nights: options.nights,
    crashes,
    results,
    mem_start_mb: memStart ?? process.memoryUsage().rss / 1024 ** 2,
    mem_end_mb: process.memoryUsage().rss / 1024 ** 2,
    duration_s: Math.round((performance.now() - startedAt) / 100) / 10,
  };
  await writeFile(options.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
