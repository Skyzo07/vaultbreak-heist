// Wall cameras: they sweep back and forth on a fixed mount, watching their
// cone. An EMP freezes them for a few seconds — the cone goes grey and the
// camera stops sweeping. Cameras never move and never chase; they just see.

import { CAMERA } from './config.js';
import { dist, inCone } from './geom.js';

export function createCamera(def) {
  return {
    x: def.x,
    y: def.y,
    baseAngle: def.baseAngle,
    sweep: def.sweep,
    speed: def.speed,
    phase: Math.random() * Math.PI * 2,
    angle: def.baseAngle,
    frozen: 0,
    // Blinking red dot on the mount.
    blink: 0,
  };
}

/** Advance the sweep; a frozen camera holds its angle. */
export function updateCamera(camera, dt, time) {
  if (camera.frozen > 0) {
    camera.frozen = Math.max(0, camera.frozen - dt);
  } else {
    camera.angle = camera.baseAngle + Math.sin(time * camera.speed + camera.phase) * camera.sweep;
  }
  camera.blink += dt;
}

/** How strongly this camera sees the player right now, 0..1. */
export function cameraExposure(camera, px, py, walls, visFactor) {
  if (camera.frozen > 0) return 0;
  if (!inCone(camera.x, camera.y, camera.angle, CAMERA.range, CAMERA.halfAngle, px, py, walls)) return 0;
  const d = dist(camera.x, camera.y, px, py);
  let f = visFactor;
  if (d > CAMERA.range * 0.65) f *= 0.6;
  return f;
}

/** Freeze every camera for `seconds` (the EMP tool). */
export function freezeCameras(cameras, seconds) {
  for (const camera of cameras) camera.frozen = seconds;
}
