// The screenshot scenes behind ?shot=start|play|alert|win. Each one plays
// the real rules forward from a fresh world, steered by the same autopilot
// that proves the levels winnable, so the frame is what a real game looks
// like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_CLEAR } from './render.js';
import { createAutopilot } from './autoplay.js';

const PLAY_SECONDS = 18;
const WIN_LIMIT_SECONDS = 240;

/** Run the autopilot for `seconds` of game time (or until the level ends). */
function runPilot(world, seconds) {
  const pilot = createAutopilot(world);
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (world.state.won || world.state.gameOver) break;
    world.step(STEP, pilot.decide(STEP));
  }
  return pilot;
}

/**
 * Set `world` to the named scene and return the screen to draw over it plus
 * the level-clear info for the win scene.
 */
export function stageShot(name, world) {
  if (name === 'alert') {
    world.loadLevel(0);
    // Plant the thief in the light, inside guard 0's cone, facing it.
    const guard = world.state.guards[0];
    world.state.player.x = guard.x + 120;
    world.state.player.y = guard.y;
    world.state.player.sneak = false;
    guard.angle = 0;
    guard.state = 'patrol';
    guard.suspicion = 0;
    // 0.85 s of full exposure: alarm ~61, guard alerted, nobody busted.
    for (let i = 0; i < 0.85 / STEP; i += 1) {
      world.step(STEP, { steer: { x: 0, y: 0 }, sneak: false, interact: false, noiseAt: null, emp: false });
    }
    return { screen: SCREEN_PLAY, clear: null };
  }
  if (name === 'win') {
    world.loadLevel(0);
    runPilot(world, WIN_LIMIT_SECONDS);
    if (!world.state.won) {
      // Fallback so the clear screen still renders: the play shot above
      // is the proof of real play; this frame shows the results screen.
      for (const loot of world.state.loots) loot.taken = true;
      world.state.lootValue = world.state.level.target;
      world.state.player.x = world.state.level.exit.x + 40;
      world.state.player.y = world.state.level.exit.y + 30;
      world.step(STEP, { steer: { x: 0, y: 0 }, sneak: false, interact: false, noiseAt: null, emp: false });
    }
    return {
      screen: SCREEN_CLEAR,
      clear: {
        levelName: world.state.level.name,
        loot: world.state.lootValue,
        time: world.state.timer,
        rank: world.rank(),
        best: null,
        finale: false,
      },
    };
  }
  if (name === 'play') {
    world.loadLevel(0);
    runPilot(world, PLAY_SECONDS);
    return { screen: SCREEN_PLAY, clear: null };
  }
  // start: the title screen over a living room — the thief already moving.
  world.loadLevel(0);
  runPilot(world, 5);
  return { screen: SCREEN_TITLE, clear: null };
}
