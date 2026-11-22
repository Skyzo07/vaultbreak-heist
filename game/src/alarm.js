// The alarm meter: the single number that decides whether a heist is a
// ghost run or a mess. Exposure from guards, cameras, the dog and lasers
// fills it; hiding lets it drain. It never fails you instantly — reaching
// 100 is what gets you caught, so a short flash of a cone is survivable
// and a long stare is not. The rank of a finished level comes from the
// highest alarm it ever reached and whether a heart was lost.

import { ALARM, RANK } from './config.js';
import { clamp } from './geom.js';

export function createAlarm() {
  return {
    value: 0,
    max: 0,
    // How long the player has been visible without a break (for the HUD's
    // "SPOTTED" flash); resets the moment nobody sees them.
    spottedFor: 0,
  };
}

/** Add alarm points from any source; the meter caps at 100. */
export function addAlarm(alarm, points) {
  alarm.value = clamp(alarm.value + points, 0, 100);
  alarm.max = Math.max(alarm.max, alarm.value);
}

/**
 * One step of the meter. `exposureRate` is alarm points per second from all
 * watchers combined right now; with no exposure the meter drains.
 * Returns true the moment the meter hits 100 (the bust).
 */
export function stepAlarm(alarm, dt, exposureRate) {
  if (exposureRate > 0) {
    alarm.value = clamp(alarm.value + exposureRate * dt, 0, 100);
    alarm.max = Math.max(alarm.max, alarm.value);
    alarm.spottedFor += dt;
  } else {
    alarm.value = clamp(alarm.value - ALARM.decayPerSecond * dt, 0, 100);
    alarm.spottedFor = 0;
  }
  return alarm.value >= 100;
}

/** The rank a finished level earns. `lostHeart` forces ALARMS. */
export function rankFor(maxAlarm, lostHeart) {
  if (lostHeart) return 'ALARMS';
  if (maxAlarm < RANK.ghostMaxAlarm) return 'GHOST';
  if (maxAlarm < RANK.shadowMaxAlarm) return 'SHADOW';
  return 'ALARMS';
}

/** Format seconds as mm:ss for the HUD and the results screens. */
export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
