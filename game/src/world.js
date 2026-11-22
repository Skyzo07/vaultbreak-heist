// The world: one level's live state and its rules, with no drawing and no
// browser in it. step() advances one fixed step from a command
// { steer, sneak, interact, noiseAt, emp } and returns nothing — the caller
// reads state (alarm, hearts, loot, won) and drains `events` for sounds.

import { FIELD, ROOM, PLAYER, HEARTS, GUARD, CAMERA, DOG, TOOLS, ALARM } from './config.js';
import { LEVELS } from './levels.js';
import { clamp, dist, inCone, losClear, moveCircle, pointInRect } from './geom.js';
import { createGuard, updateGuard, sendNoise, resetGuards, guardExposure } from './guards.js';
import { createCamera, updateCamera, cameraExposure, freezeCameras } from './cameras.js';
import { createLoot, updateLoot, createLaser, updateLasers, isLockpickLoot } from './loot.js';
import { createAlarm, addAlarm, stepAlarm, rankFor } from './alarm.js';

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    level: LEVELS[0],
    player: { x: 70, y: 640, angle: -Math.PI / 2, sneak: false, moving: false },
    guards: [],
    cameras: [],
    loots: [],
    lasers: [],
    dog: null,
    alarm: createAlarm(),
    hearts: HEARTS,
    lootValue: 0,
    timer: 0,
    time: 0,
    noiseCharges: TOOLS.noiseStart,
    empCharges: TOOLS.empStart,
    noisePucks: [],
    caughtFlash: 0,
    caughtCount: 0,
    won: false,
    gameOver: false,
    lostHeart: false,
    events: [],
    stepTimer: 0,
    lockTickTimer: 0,
  };

  function loadLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    state.player.x = level.entry.x;
    state.player.y = level.entry.y;
    state.player.angle = -Math.PI / 2;
    state.player.sneak = false;
    state.player.moving = false;
    state.guards = level.guards.map((def) => createGuard(def, random));
    state.cameras = level.cameras.map((def) => createCamera(def));
    state.loots = level.loot.map((def) => createLoot(def));
    state.lasers = level.lasers.map((def) => createLaser(def));
    state.dog = level.dog
      ? {
          x: level.dog.waypoints[0].x,
          y: level.dog.waypoints[0].y,
          angle: 0,
          waypoints: level.dog.waypoints,
          wpIndex: 1 % level.dog.waypoints.length,
          pauseTimer: 0,
          pauseAt: level.dog.pause ?? 0.6,
          state: 'patrol',
          chase: null,
          lostTimer: 0,
        }
      : null;
    state.alarm = createAlarm();
    state.hearts = HEARTS;
    state.lootValue = 0;
    state.timer = 0;
    state.noiseCharges = TOOLS.noiseStart;
    state.empCharges = TOOLS.empStart;
    state.noisePucks = [];
    state.caughtFlash = 0;
    state.caughtCount = 0;
    state.won = false;
    state.gameOver = false;
    state.lostHeart = false;
    state.events = [];
    state.stepTimer = 0;
    state.lockTickTimer = 0;
  }

  function inShadow(x, y) {
    const shadows = state.level.shadows;
    for (let i = 0; i < shadows.length; i += 1) {
      if (pointInRect(x, y, shadows[i])) return true;
    }
    return false;
  }

  function visFactor() {
    const shadow = inShadow(state.player.x, state.player.y);
    if (state.player.sneak && shadow) return 0.18;
    if (state.player.sneak) return 0.45;
    if (shadow) return 0.35;
    return 1;
  }

  function addAlarmPoints(points, source) {
    addAlarm(state.alarm, points);
    if (source === 'laser') state.events.push('laser');
  }

  function caughtBy(source) {
    if (state.caughtFlash > 0 || state.won || state.gameOver) return;
    state.hearts -= 1;
    state.caughtCount += 1;
    state.lostHeart = true;
    state.events.push('caught');
    if (state.hearts <= 0) {
      state.gameOver = true;
      return;
    }
    // Bust, but not out: back to the entry, guards forget you, alarm drops.
    state.player.x = state.level.entry.x;
    state.player.y = state.level.entry.y;
    state.player.angle = -Math.PI / 2;
    resetGuards(state.guards, state.level.guards);
    for (const camera of state.cameras) camera.frozen = 0;
    if (state.dog) {
      state.dog.x = state.level.dog.waypoints[0].x;
      state.dog.y = state.level.dog.waypoints[0].y;
      state.dog.state = 'patrol';
      state.dog.chase = null;
      state.dog.wpIndex = 1 % state.level.dog.waypoints.length;
    }
    state.alarm.value = 0;
    state.alarm.spottedFor = 0;
    state.caughtFlash = 1.5;
  }

  function useNoise(x, y) {
    if (state.noiseCharges <= 0) return false;
    // ROOM carries width/height, not w/h — check its bounds directly.
    if (x < ROOM.x || x > ROOM.x + ROOM.width || y < ROOM.y || y > ROOM.y + ROOM.height) return false;
    state.noiseCharges -= 1;
    state.noisePucks.push({ x, y, ttl: 1.4 });
    state.events.push('noise');
    sendNoise(state.guards, x, y, TOOLS.noiseHear);
    if (state.dog && dist(state.dog.x, state.dog.y, x, y) <= TOOLS.noiseHear) {
      state.dog.chase = { x, y };
      state.dog.state = 'chase';
      state.dog.lostTimer = 0;
    }
    return true;
  }

  function useEmp() {
    if (state.empCharges <= 0) return false;
    state.empCharges -= 1;
    freezeCameras(state.cameras, TOOLS.empSeconds);
    state.events.push('emp');
    return true;
  }

  function updateDog(dt) {
    const dog = state.dog;
    if (!dog) return;
    const { player } = state;
    const seen = inCone(dog.x, dog.y, dog.angle, DOG.range, DOG.halfAngle, player.x, player.y, state.level.walls)
      ? visFactor()
      : 0;
    if (seen > 0.4) {
      dog.chase = { x: player.x, y: player.y };
      dog.state = 'chase';
      dog.lostTimer = 0;
    }
    // Running footsteps carry to the dog's ears.
    if (player.moving && !player.sneak && dist(dog.x, dog.y, player.x, player.y) < DOG.hearRadius) {
      dog.chase = { x: player.x, y: player.y };
      dog.state = 'chase';
      dog.lostTimer = 0;
    }
    if (dog.state === 'chase' && dog.chase) {
      const dx = dog.chase.x - dog.x;
      const dy = dog.chase.y - dog.y;
      const d = Math.hypot(dx, dy);
      if (d > 6) {
        const step = Math.min(d, DOG.chaseSpeed * dt);
        dog.x += (dx / d) * step;
        dog.y += (dy / d) * step;
        dog.angle = Math.atan2(dy, dx);
      }
      if (seen === 0) {
        dog.lostTimer += dt;
        if (dog.lostTimer > 2 || d <= 6) {
          dog.state = 'patrol';
          dog.chase = null;
        }
      }
      if (dist(dog.x, dog.y, player.x, player.y) < DOG.touchRadius) caughtBy('dog');
      return;
    }
    // Patrol the waypoints, pausing briefly at each end.
    if (dog.pauseTimer > 0) {
      dog.pauseTimer -= dt;
      return;
    }
    const wp = dog.waypoints[dog.wpIndex];
    const dx = wp.x - dog.x;
    const dy = wp.y - dog.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) {
      dog.wpIndex = (dog.wpIndex + 1) % dog.waypoints.length;
      dog.pauseTimer = dog.pauseAt;
      return;
    }
    const step = Math.min(d, DOG.patrolSpeed * dt);
    dog.x += (dx / d) * step;
    dog.y += (dy / d) * step;
    dog.angle = Math.atan2(dy, dx);
  }

  function step(dt, cmd) {
    if (state.won || state.gameOver) return;
    // Tools land even during the caught flash — a throw is a throw.
    if (cmd.noiseAt) useNoise(cmd.noiseAt.x, cmd.noiseAt.y);
    if (cmd.emp) useEmp();
    if (state.caughtFlash > 0) {
      state.caughtFlash -= dt;
      return;
    }
    state.time += dt;
    state.timer += dt;
    const { player } = state;

    // Movement, with wall sliding; sneak is slower and quieter.
    const speed = cmd.sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const moved = moveCircle(
      player.x, player.y,
      cmd.steer.x * speed * dt, cmd.steer.y * speed * dt,
      PLAYER.radius, state.level.walls, ROOM,
    );
    player.moving = moved.x !== player.x || moved.y !== player.y;
    player.x = moved.x;
    player.y = moved.y;
    player.sneak = cmd.sneak;
    if (player.moving) player.angle = Math.atan2(cmd.steer.y, cmd.steer.x);

    // Running footsteps: nearby guards come to look.
    if (player.moving && !player.sneak) {
      state.stepTimer += dt;
      if (state.stepTimer >= 0.4) {
        state.stepTimer = 0;
        sendNoise(state.guards, player.x, player.y, PLAYER.hearRadius);
      }
    } else {
      state.stepTimer = 0.4;
    }

    // Loot: walk-overs and lockpicking (hold E next to a safe or the vault).
    const events = [];
    const gained = updateLoot(state.loots, player, cmd.interact, dt, events);
    if (gained > 0) {
      state.lootValue += gained;
      for (const e of events) state.events.push(e);
    }
    const picking = state.loots.some(
      (l) => !l.taken && isLockpickLoot(l.kind) && dist(l.x, l.y, player.x, player.y) < 46 && cmd.interact,
    );
    if (picking) {
      state.lockTickTimer += dt;
      if (state.lockTickTimer >= 0.45) {
        state.lockTickTimer = 0;
        state.events.push('lock-tick');
      }
    } else {
      state.lockTickTimer = 0.4;
    }

    // Noise pucks fade out.
    for (let i = state.noisePucks.length - 1; i >= 0; i -= 1) {
      state.noisePucks[i].ttl -= dt;
      if (state.noisePucks[i].ttl <= 0) state.noisePucks.splice(i, 1);
    }

    // Watchers: guards, cameras, the dog, and the lasers.
    const vf = visFactor();
    let exposureRate = 0;
    for (const guard of state.guards) {
      exposureRate += guardExposure(guard, player.x, player.y, state.level.walls, vf) * GUARD.alarmRate;
    }
    for (const camera of state.cameras) {
      updateCamera(camera, dt, state.time);
      exposureRate += cameraExposure(camera, player.x, player.y, state.level.walls, vf) * CAMERA.alarmRate;
    }
    if (state.dog) {
      const dogSeen = inCone(state.dog.x, state.dog.y, state.dog.angle, DOG.range, DOG.halfAngle, player.x, player.y, state.level.walls)
        ? vf
        : 0;
      exposureRate += dogSeen * DOG.alarmRate;
    }
    updateLasers(state.lasers, player, dt, state.time, {
      addAlarm: addAlarmPoints,
    });

    // The alarm meter: fill while seen, drain while hidden. Hitting 100
    // is the bust — but only after that grace of being fully exposed.
    if (stepAlarm(state.alarm, dt, exposureRate)) {
      caughtBy('alarm');
      return;
    }
    if (exposureRate > 0 && state.alarm.spottedFor > 0.6 && !state._spottedSound) {
      state._spottedSound = true;
      state.events.push('spotted');
    }
    if (exposureRate === 0) state._spottedSound = false;

    for (const guard of state.guards) {
      updateGuard(guard, dt, {
        player, walls: state.level.walls, room: ROOM,
        visFactor, alarm: state.alarm, caughtBy,
      });
      if (state.caughtFlash > 0 || state.gameOver) return;
    }
    updateDog(dt);
    if (state.caughtFlash > 0 || state.gameOver) return;

    // The getaway: once the target value is stolen, reach the van.
    const exit = state.level.exit;
    if (state.lootValue >= state.level.target && pointInRect(player.x, player.y, exit)) {
      state.won = true;
      state.events.push('win');
    }
  }

  function rank() {
    return rankFor(state.alarm.max, state.lostHeart);
  }

  loadLevel(0);

  return {
    state,
    loadLevel,
    step,
    inShadow,
    visFactor,
    addAlarm: addAlarmPoints,
    caughtBy,
    useNoise,
    useEmp,
    rank,
    reset: () => loadLevel(state.levelIndex),
  };
}
