// Guards: patrol waypoints, get curious when they half-see you, chase when
// they are sure, search the last place they saw you, and go look at noises.
// A guard never knows where you are unless it (or the alarm) has seen you.

import { GUARD, ALARM } from './config.js';
import { angleDiff, clamp, dist, inCone, losClear } from './geom.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALERTED = 'alerted';
export const GUARD_SEARCHING = 'searching';

export function createGuard(def, random) {
  const start = def.waypoints[0];
  const second = def.waypoints[1] ?? def.waypoints[0];
  return {
    x: start.x,
    y: start.y,
    angle: Math.atan2(second.y - start.y, second.x - start.x),
    waypoints: def.waypoints,
    wpIndex: 1 % def.waypoints.length,
    pauseAt: def.pause ?? 1.2,
    pauseTimer: 0,
    state: GUARD_PATROL,
    suspicion: 0,
    lastSeen: null,
    searchTimer: 0,
    investigate: null,
    lostTimer: 0,
    random,
  };
}

function turnToward(guard, targetAngle, dt, rate) {
  let d = targetAngle - guard.angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const step = clamp(d, -rate * dt, rate * dt);
  guard.angle += step;
}

function moveToward(guard, tx, ty, speed, dt, walls, room) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return true;
  const step = Math.min(d, speed * dt);
  const nx = guard.x + (dx / d) * step;
  const ny = guard.y + (dy / d) * step;
  // Guards walk around walls by sliding: try x then y, like the player.
  const r = 14;
  let blocked = false;
  for (let i = 0; i < walls.length; i += 1) {
    const w = walls[i];
    if (nx + r > w.x && nx - r < w.x + w.w && guard.y + r > w.y && guard.y - r < w.y + w.h) { blocked = true; break; }
  }
  if (!blocked && nx - r >= room.x && nx + r <= room.x + room.width) guard.x = nx;
  blocked = false;
  for (let i = 0; i < walls.length; i += 1) {
    const w = walls[i];
    if (guard.x + r > w.x && guard.x - r < w.x + w.w && ny + r > w.y && ny - r < w.y + w.h) { blocked = true; break; }
  }
  if (!blocked && ny - r >= room.y && ny + r <= room.y + room.height) guard.y = ny;
  guard.angle = Math.atan2(dy, dx);
  return d <= step + 1;
}

/**
 * How strongly this guard sees the player right now, 0..1. Zero outside
 * the cone, behind a wall, or (mostly) hidden in shadow while sneaking.
 */
export function guardExposure(guard, px, py, walls, visFactor) {
  if (!inCone(guard.x, guard.y, guard.angle, GUARD.range, GUARD.halfAngle, px, py, walls)) return 0;
  const d = dist(guard.x, guard.y, px, py);
  let f = visFactor;
  if (d > GUARD.range * 0.65) f *= 0.6;
  return f;
}

export function updateGuard(guard, dt, world) {
  const { player, walls, room } = world;
  const seen = guardExposure(guard, player.x, player.y, walls, world.visFactor());
  if (seen > 0) {
    guard.suspicion = clamp(guard.suspicion + seen * dt * 1.5, 0, 1);
    guard.lastSeen = { x: player.x, y: player.y };
    guard.lostTimer = 0;
  } else {
    guard.suspicion = clamp(guard.suspicion - dt * 0.25, 0, 1);
    guard.lostTimer += dt;
  }

  // The alarm going up puts every guard on alert.
  if (world.alarm.value >= ALARM.alertAlarm && guard.state !== GUARD_ALERTED) {
    guard.state = GUARD_ALERTED;
    guard.investigate = null;
  }

  switch (guard.state) {
    case GUARD_PATROL: {
      if (guard.suspicion >= ALARM.alertAt) {
        guard.state = GUARD_ALERTED;
        break;
      }
      if (guard.suspicion >= ALARM.suspiciousAt || guard.investigate) {
        guard.state = GUARD_SUSPICIOUS;
        break;
      }
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
        // Look around slowly while waiting at a waypoint.
        guard.angle += dt * 0.5;
        break;
      }
      const wp = guard.waypoints[guard.wpIndex];
      if (moveToward(guard, wp.x, wp.y, GUARD.patrolSpeed, dt, walls, room)) {
        guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
        guard.pauseTimer = guard.pauseAt * (0.8 + guard.random() * 0.4);
      }
      break;
    }
    case GUARD_SUSPICIOUS: {
      if (guard.suspicion >= ALARM.alertAt) {
        guard.state = GUARD_ALERTED;
        break;
      }
      const target = guard.investigate ?? guard.lastSeen;
      if (!target) {
        guard.state = GUARD_PATROL;
        guard.investigate = null;
        break;
      }
      turnToward(guard, Math.atan2(target.y - guard.y, target.x - guard.x), dt, 4);
      if (moveToward(guard, target.x, target.y, GUARD.suspiciousSpeed, dt, walls, room)) {
        guard.state = GUARD_SEARCHING;
        guard.searchTimer = 2.2;
        guard.investigate = null;
      }
      if (guard.suspicion < 0.05 && guard.lostTimer > 2) {
        guard.state = GUARD_PATROL;
        guard.investigate = null;
      }
      break;
    }
    case GUARD_ALERTED: {
      // Chase the thief while visible; otherwise hunt the last-seen spot.
      const target = seen > 0 ? { x: player.x, y: player.y } : guard.lastSeen;
      if (target) {
        turnToward(guard, Math.atan2(target.y - guard.y, target.x - guard.x), dt, 6);
        moveToward(guard, target.x, target.y, GUARD.chaseSpeed, dt, walls, room);
      }
      if (guard.lostTimer > 2.5) {
        guard.state = GUARD_SEARCHING;
        guard.searchTimer = 3.5;
      }
      break;
    }
    case GUARD_SEARCHING: {
      guard.searchTimer -= dt;
      guard.angle += dt * 1.6; // scan the room while searching
      if (guard.suspicion >= ALARM.alertAt) {
        guard.state = GUARD_ALERTED;
        break;
      }
      if (guard.searchTimer <= 0) {
        guard.state = GUARD_PATROL;
        guard.lastSeen = null;
      }
      break;
    }
    default:
      guard.state = GUARD_PATROL;
  }

  // Touching an alerted guard gets you caught on the spot.
  if (guard.state === GUARD_ALERTED && dist(guard.x, guard.y, player.x, player.y) < GUARD.touchRadius) {
    world.caughtBy('guard');
  }
}

/** A noise somewhere pulls the nearest guards off patrol to look at it. */
export function sendNoise(guards, x, y, hearRadius) {
  for (const guard of guards) {
    if (guard.state === GUARD_ALERTED) continue;
    if (dist(guard.x, guard.y, x, y) <= hearRadius) {
      guard.investigate = { x, y };
      if (guard.state === GUARD_PATROL) guard.state = GUARD_SUSPICIOUS;
    }
  }
}

/** Reset every guard to its first waypoint, calm and unknowing. */
export function resetGuards(guards, defs) {
  for (let i = 0; i < guards.length; i += 1) {
    const g = guards[i];
    const start = defs[i].waypoints[0];
    const second = defs[i].waypoints[1] ?? defs[i].waypoints[0];
    g.x = start.x;
    g.y = start.y;
    g.angle = Math.atan2(second.y - start.y, second.x - start.x);
    g.wpIndex = 1 % defs[i].waypoints.length;
    g.pauseTimer = 0;
    g.state = GUARD_PATROL;
    g.suspicion = 0;
    g.lastSeen = null;
    g.searchTimer = 0;
    g.investigate = null;
    g.lostTimer = 0;
  }
}
