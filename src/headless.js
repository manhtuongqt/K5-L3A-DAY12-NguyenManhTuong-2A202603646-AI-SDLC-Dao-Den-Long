import { readFile, writeFile } from 'node:fs/promises';
import { createGame, validateInputs, validateScenario } from './sim/game.js';

function parseArguments(args) {
  const allowed = new Set(['seed', 'night', 'scenario', 'inputs', 'ticks', 'out', 'snapshot-every']);
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const name = flag.startsWith('--') ? flag.slice(2) : '';
    if (!allowed.has(name)) throw new Error(`Unknown argument: ${flag}`);
    if (Object.hasOwn(options, name)) throw new Error(`Duplicate argument: ${flag}`);
    const value = args[index + 1];
    if (value === undefined || value.startsWith('--') || value.length === 0) {
      throw new Error(`Missing value for ${flag}`);
    }
    options[name] = value;
  }
  for (const name of ['seed', 'night', 'ticks', 'out']) {
    if (!Object.hasOwn(options, name)) throw new Error(`Missing --${name}`);
  }
  function integer(name, minimum) {
    const value = options[name];
    if (!/^[+-]?\d+$/.test(value) || !Number.isSafeInteger(Number(value))
      || Number(value) < minimum) throw new Error(`--${name} must be an integer >= ${minimum}`);
    return Number(value);
  }
  options.seed = integer('seed', Number.MIN_SAFE_INTEGER);
  options.night = integer('night', 1);
  if (options.night > 3) throw new Error('--night must be 1, 2 or 3');
  options.ticks = integer('ticks', 0);
  options['snapshot-every'] = Object.hasOwn(options, 'snapshot-every')
    ? integer('snapshot-every', 1) : 10;
  return options;
}

async function readScenarioOrInputs(path, validate) {
  try {
    const object = JSON.parse(await readFile(path, 'utf8'));
    return validate(object);
  } catch (cause) {
    const error = new Error(`${path}: ${cause.message}`);
    error.code = 2;
    throw error;
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const contract = JSON.parse(await readFile(new URL('../game.contract.json', import.meta.url), 'utf8'));
  const scenario = options.scenario === undefined ? undefined
    : await readScenarioOrInputs(options.scenario, (value) => validateScenario(value, options.night));
  const inputs = options.inputs === undefined ? { frames: [] }
    : await readScenarioOrInputs(options.inputs, validateInputs);
  const game = createGame({ seed: options.seed, night: options.night, tuning: contract.tuning, scenario });
  const lines = [JSON.stringify(game.snapshot()),
    JSON.stringify({ type: 'event', tick: 0, name: 'night_start', data: { night: options.night } })];
  const input = { move: [0, 0], cam_yaw_deg: 0, jump: false, dash: false, interact: false, pulse: false, pause: false };
  let frameIndex = 0;
  while (game.steps < options.ticks && !game.ended) {
    const frame = inputs.frames[frameIndex];
    if (frame && frame.tick === game.steps) {
      for (const field of ['move', 'cam_yaw_deg', 'jump', 'dash', 'interact', 'pulse', 'pause']) {
        if (Object.hasOwn(frame, field)) input[field] = frame[field];
      }
      frameIndex += 1;
    }
    for (const event of game.step(input)) lines.push(JSON.stringify(event));
    if (game.steps % options['snapshot-every'] === 0) lines.push(JSON.stringify(game.snapshot()));
  }
  lines.push(JSON.stringify({ type: 'end', ticks: game.steps, state: game.state, score: game.snapshot().score }));
  await writeFile(options.out, `${lines.join('\n')}\n`, 'utf8');
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = error.code === 2 ? 2 : 1;
});
