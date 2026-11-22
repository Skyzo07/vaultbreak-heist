// VAULTBREAK — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// fit the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

// The room lives inside this inset: the top strip is the HUD bar.
export const ROOM = { x: 16, y: 76, width: 1248, height: 628 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  walkSpeed: 175,
  sneakSpeed: 98,
  // Running footsteps are heard this far away by guards and the dog.
  hearRadius: 230,
};

export const HEARTS = 2;

export const GUARD = {
  range: 185,
  halfAngle: 0.55, // ~31 degrees each side
  patrolSpeed: 72,
  suspiciousSpeed: 105,
  chaseSpeed: 152,
  // Alarm points per second of full exposure, standing in the light.
  alarmRate: 72,
  touchRadius: 24,
};

export const CAMERA = {
  range: 215,
  halfAngle: 0.42,
  alarmRate: 58,
};

export const DOG = {
  range: 130,
  halfAngle: 0.7,
  patrolSpeed: 128,
  chaseSpeed: 190,
  alarmRate: 95,
  hearRadius: 280,
  touchRadius: 22,
};

// Visibility multipliers on the exposure a guard/camera/dog gets.
export const VIS = {
  sneak: 0.45, // sneaking, in the light
  shadow: 0.35, // standing in a shadow patch
  sneakShadow: 0.18, // sneaking inside shadow: nearly invisible
  far: 0.6, // beyond 65% of the cone's range
};

export const TOOLS = {
  noiseStart: 3, // noise-maker charges per level
  noiseHear: 340, // guards this far away investigate the noise
  empStart: 2, // EMP charges per level
  empSeconds: 6, // cameras frozen this long
  lockpickSeconds: 2.5, // a safe takes this long, holding E
  vaultSeconds: 4, // the L3 vault diamond takes this long
};

export const ALARM = {
  decayPerSecond: 15, // alarm falls this fast while nobody sees you
  suspiciousAt: 0.35, // guard suspicion that turns a guard curious
  alertAt: 0.85, // guard suspicion that turns a guard into a chaser
  alertAlarm: 55, // alarm level that also alerts every guard
  laserHit: 34, // alarm points for crossing a live laser beam
  laserCooldown: 0.6, // seconds before the same beam can zap again
};

// Rank bands for a finished level, from the highest alarm reached.
export const RANK = {
  ghostMaxAlarm: 25, // GHOST: never really spotted
  shadowMaxAlarm: 75, // SHADOW: seen, but never caught
  // anything else (or a heart lost) is ALARMS.
};

export const PALETTE = {
  backdrop: '#0b0e1a',
  floor: '#1a2036',
  floorAlt: '#1e2540',
  carpet: '#5a1f2b',
  carpetEdge: '#7a2a38',
  wall: '#2c3552',
  wallTop: '#46537e',
  shadow: '#05070f',
  lamp: '#f5c95c',
  cone: '#f2c94c',
  coneAlert: '#e5534b',
  cameraCone: '#ff8a3d',
  laser: '#ff3b5c',
  gold: '#ffd94a',
  gem: '#5ce1e6',
  painting: '#c98bf5',
  diamond: '#9be8ff',
  player: '#2dd4a7',
  playerDark: '#0f7a5c',
  guard: '#4a5a8a',
  guardDark: '#2c3552',
  dog: '#a9713f',
  exit: '#39d353',
  exitDark: '#1d7a30',
  van: '#e8eef7',
  hud: '#12162a',
  hudLine: '#2c3552',
  text: '#eef1f5',
  muted: '#9aa3b8',
  danger: '#ff5a5a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where best rank + time per level are kept between visits. */
export const BEST_KEY = 'vaultbreak.best.v1';
