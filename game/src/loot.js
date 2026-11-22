// Loot: gold bars and gems are grabbed by walking over them; a safe and
// the vault diamond need the thief to stand close and hold E to pick the
// lock. The laser grid on the Vault floor is here too — it is loot-adjacent
// danger, a timed barrier rather than a watcher.

import { TOOLS, ALARM } from './config.js';
import { dist } from './geom.js';

export const LOOT_GOLD = 'gold';
export const LOOT_GEM = 'gem';
export const LOOT_SAFE = 'safe';
export const LOOT_VAULT = 'vault';

export function createLoot(def) {
  return {
    kind: def.kind,
    x: def.x,
    y: def.y,
    value: def.value,
    taken: false,
    // Lockpick progress 0..1 for safe / vault; instant loot never uses it.
    progress: 0,
    bob: Math.random() * Math.PI * 2,
  };
}

export function lockSecondsFor(kind) {
  return kind === LOOT_VAULT ? TOOLS.vaultSeconds : TOOLS.lockpickSeconds;
}

export function isLockpickLoot(kind) {
  return kind === LOOT_SAFE || kind === LOOT_VAULT;
}

/**
 * Walk-over pickups and lockpicking. Returns the value of loot taken this
 * step (0 when nothing was taken) and fills `events` with 'pickup' /
 * 'lockpick-done' for sound effects.
 */
export function updateLoot(loots, player, interactHeld, dt, events) {
  let gained = 0;
  for (const loot of loots) {
    if (loot.taken) continue;
    const d = dist(loot.x, loot.y, player.x, player.y);
    if (isLockpickLoot(loot.kind)) {
      if (d < 46 && interactHeld) {
        loot.progress += dt / lockSecondsFor(loot.kind);
        if (loot.progress >= 1) {
          loot.taken = true;
          gained += loot.value;
          events.push('lockpick-done');
        }
      } else if (d >= 46) {
        // Walking away drops the half-picked lock.
        loot.progress = Math.max(0, loot.progress - dt * 2);
      }
      continue;
    }
    if (d < 30) {
      loot.taken = true;
      gained += loot.value;
      events.push('pickup');
    }
  }
  return gained;
}

/** A laser beam: on for half its period, off for half, offset by `offset`. */
export function createLaser(def) {
  return {
    x1: def.x1,
    y1: def.y1,
    x2: def.x2,
    y2: def.y2,
    period: def.period,
    offset: def.offset,
    cooldown: 0,
  };
}

export function laserIsOn(laser, time) {
  const phase = ((time + laser.offset) % laser.period) / laser.period;
  return phase < 0.5;
}

/**
 * Crossing a live beam zaps the alarm. The beam is a thin horizontal line;
 * the thief trips it by standing within 10px of it while it is on.
 */
export function updateLasers(lasers, player, dt, time, world) {
  for (const laser of lasers) {
    laser.cooldown = Math.max(0, laser.cooldown - dt);
    if (!laserIsOn(laser, time) || laser.cooldown > 0) continue;
    const minX = Math.min(laser.x1, laser.x2) - 10;
    const maxX = Math.max(laser.x1, laser.x2) + 10;
    const y = laser.y1;
    if (player.x > minX && player.x < maxX && Math.abs(player.y - y) < 12) {
      world.addAlarm(ALARM.laserHit, 'laser');
      laser.cooldown = ALARM.laserCooldown;
    }
  }
}
