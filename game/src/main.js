// VAULTBREAK — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// The game moves between six screens: title, play, paused, level-clear,
// game over and the finale after the third heist.
//
// ?seed=N fixes the run. ?shot=start|play|alert|win (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot. ?autoplay=1&level=N lets the pilot
// play the level itself and reports window.__vaultbreak.autoplayResult.

import { BEST_KEY, STEP } from './config.js';
import { LEVELS } from './levels.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_NOISE, ACTION_EMP, ACTION_RESTART, ACTION_MUTE, createInput } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_CLEAR, SCREEN_OVER, SCREEN_FINALE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { createAutopilot } from './autoplay.js';
import { formatTime } from './alarm.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;
/** The pilot gets this long, in game seconds, to finish a level. */
const AUTOPLAY_LIMIT = 240;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const autoplay = params.get('autoplay') === '1';
const levelParam = Number.parseInt(params.get('level') ?? '', 10);
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

/** Rank order for comparing bests: GHOST beats SHADOW beats ALARMS. */
const RANK_ORDER = { GHOST: 0, SHADOW: 1, ALARMS: 2 };

function readBest() {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    if (!raw) return [null, null, null];
    const parsed = JSON.parse(raw);
    const levels = Array.isArray(parsed.levels) ? parsed.levels : [];
    return [0, 1, 2].map((i) => levels[i] ?? null);
  } catch {
    return [null, null, null];
  }
}

function saveBest(levelIndex, rank, time) {
  const best = readBest();
  const current = best[levelIndex];
  const better =
    !current ||
    RANK_ORDER[rank] < RANK_ORDER[current.rank] ||
    (RANK_ORDER[rank] === RANK_ORDER[current.rank] && time < current.seconds);
  if (better) {
    best[levelIndex] = { rank, time: formatTime(time), seconds: time };
    try {
      window.localStorage.setItem(BEST_KEY, JSON.stringify({ levels: best }));
    } catch {
      // Storage can be off: the best then lasts this visit only.
    }
  }
  return best;
}

function totalLoot(best) {
  return best.reduce((sum, b, i) => sum + (b ? LEVELS[i].target : 0), 0);
}

function runShot(name) {
  const scene = stageShot(name, world);
  const ui = { best: readBest(), muted: false, clear: scene.clear, totalLoot: 0 };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  window.__vaultbreak = {
    world, screen: scene.screen, autoplayResult: null,
    startLevel: (i) => world.loadLevel(i),
    ui: () => ({ muted: audio.muted }),
  };
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (cx, cy) => renderer.worldFromClient(cx, cy));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let clear = null;
  let accumulator = 0;
  let last = performance.now();
  let autopilot = null;
  let autoplayResult = null;
  let autoplayStart = 0;
  // One-shot presses taken by handleActions and handed to step() in the
  // same frame, so step() never takes them twice and never misses them.
  let pendingActions = 0;

  if (autoplay) {
    const levelIndex = Number.isInteger(levelParam) && levelParam >= 0 && levelParam < LEVELS.length ? levelParam : 0;
    world.loadLevel(levelIndex);
    autopilot = createAutopilot(world);
    screen = SCREEN_PLAY;
    autoplayStart = performance.now();
  }

  function announce(message) {
    status.textContent = message;
  }

  function startLevel(index) {
    world.loadLevel(index);
    accumulator = 0;
    clear = null;
    screen = SCREEN_PLAY;
    announce(`Playing. ${world.state.level.name}. Steal $${world.state.level.target}, then reach the van.`);
  }

  function finishLevel() {
    const rank = world.rank();
    const time = world.state.timer;
    const levelIndex = world.state.levelIndex;
    best = saveBest(levelIndex, rank, time);
    const finale = levelIndex >= LEVELS.length - 1;
    clear = {
      levelName: world.state.level.name,
      loot: world.state.lootValue,
      time: formatTime(time),
      rank,
      best: best[levelIndex],
      finale,
    };
    audio.levelClear();
    screen = finale ? SCREEN_FINALE : SCREEN_CLEAR;
    announce(`Heist complete. Rank ${rank}. Loot $${world.state.lootValue} in ${formatTime(time)}.`);
  }

  function bust() {
    audio.caught();
    screen = SCREEN_OVER;
    announce('Busted. Game over.');
  }

  function playEventSounds() {
    const events = world.state.events;
    if (events.length === 0) return;
    for (const event of events) {
      if (event === 'pickup') audio.pickup();
      else if (event === 'lockpick-done') audio.lockDone();
      else if (event === 'lock-tick') audio.lockTick();
      else if (event === 'noise') audio.noise();
      else if (event === 'emp') audio.emp();
      else if (event === 'spotted') audio.spotted();
      else if (event === 'laser') audio.laser();
      else if (event === 'caught') audio.caught();
      else if (event === 'win') audio.win();
    }
    world.state.events.length = 0;
  }

  function handleActions() {
    const actions = input.takeActions();
    // OR-accumulate: a frame that runs no fixed step must not wipe a press
    // the next step has not consumed yet.
    pendingActions |= actions;
    if (actions & ACTION_MUTE) {
      audio.toggleMute();
    }
    if (autoplay) return;
    if (actions & ACTION_RESTART && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_OVER)) {
      if (screen === SCREEN_OVER) startLevel(world.state.levelIndex);
      else startLevel(world.state.levelIndex);
      return;
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        audio.click();
        if (screen === SCREEN_TITLE) startLevel(0);
        else startLevel(0);
        input.takeClick(); // the starting click is not a noise-maker throw
      }
      return;
    }
    if (screen === SCREEN_CLEAR || screen === SCREEN_FINALE) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        audio.click();
        if (screen === SCREEN_FINALE) {
          screen = SCREEN_TITLE;
          world.loadLevel(0);
        } else {
          startLevel(world.state.levelIndex + 1);
        }
        input.takeClick();
      }
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
        input.takeClick();
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The title screen's backdrop: the room idles, guards patrol.
      world.step(STEP, { steer: { x: 0, y: 0 }, sneak: false, interact: false, noiseAt: null, emp: false });
      world.state.events.length = 0;
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    let cmd;
    if (autopilot) {
      cmd = autopilot.decide(STEP);
    } else {
      const click = input.takeClick();
      const actions = pendingActions;
      pendingActions = 0;
      // A click during play throws the noise-maker where you clicked.
      cmd = {
        steer: input.steer(),
        sneak: input.sneakHeld(),
        interact: input.interactHeld(),
        noiseAt: click,
        emp: Boolean(actions & ACTION_EMP),
      };
      if (actions & ACTION_NOISE) {
        const p = world.state.player;
        cmd.noiseAt = { x: p.x + Math.cos(p.angle) * 130, y: p.y + Math.sin(p.angle) * 130 };
      }
    }
    const wasWon = world.state.won;
    const wasOver = world.state.gameOver;
    world.step(STEP, cmd);
    playEventSounds();
    if (!wasWon && world.state.won) {
      if (autopilot) {
        autoplayResult = {
          won: true,
          level: world.state.levelIndex,
          time: +world.state.timer.toFixed(1),
          rank: world.rank(),
          hearts: world.state.hearts,
          maxAlarm: Math.round(world.state.alarm.max),
          loot: world.state.lootValue,
        };
      } else {
        finishLevel();
      }
    } else if (!wasOver && world.state.gameOver) {
      if (autopilot) {
        autoplayResult = {
          won: false,
          reason: 'busted',
          level: world.state.levelIndex,
          time: +world.state.timer.toFixed(1),
          hearts: 0,
          maxAlarm: Math.round(world.state.alarm.max),
        };
      } else {
        bust();
      }
    }
    if (autopilot && !autoplayResult && world.state.timer > AUTOPLAY_LIMIT) {
      autoplayResult = {
        won: false,
        reason: 'timeout',
        level: world.state.levelIndex,
        time: +world.state.timer.toFixed(1),
        hearts: world.state.hearts,
        maxAlarm: Math.round(world.state.alarm.max),
      };
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, {
      best,
      muted: audio.muted,
      clear,
      totalLoot: totalLoot(best),
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  window.__vaultbreak = {
    world,
    get screen() {
      return screen;
    },
    get autoplayResult() {
      return autoplayResult;
    },
    autopilot,
    startLevel,
    ui: () => ({ muted: audio.muted }),
  };

  announce(autoplay ? 'Autoplay pilot running.' : 'VAULTBREAK. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
