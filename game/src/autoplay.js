// The autopilot: a cautious thief that proves each level is winnable. It
// always sneaks, plans a route around the walls with A* on a coarse grid,
// walks toward the nearest loot (then the van), waits out any cone covering
// its next step (preferably from shadow), retreats to a safe shadow when it
// is being watched, flees when a guard is on top of it, freezes a blocking
// camera with the EMP, and lures a stubborn guard away with a noise-maker.
// It never teleports and never reads the future — it only sees what a
// player standing there would see.

import { ROOM } from './config.js';
import { dist, inCone, pointInRect } from './geom.js';
import { GUARD } from './config.js';
import { CAMERA, DOG } from './config.js';
import { laserIsOn, isLockpickLoot } from './loot.js';

// The route planner works on 40px cells over the 1280x720 field.
const CELL = 40;
const COLS = 32;
const ROWS = 18;

export function createAutopilot(world) {
  const state = {
    lastDecision: 'start',
    target: null,
    path: null,
    pathKey: '',
    pathIndex: 0,
    lastDist: Infinity,
    stuckTimer: 0,
    lastNoiseAt: -100,
    lastEmpAt: -100,
  };

  function cellBlocked(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return true;
    const r = { x: cx * CELL, y: cy * CELL, w: CELL, h: CELL };
    if (r.x + r.w < ROOM.x || r.x > ROOM.x + ROOM.width) return true;
    if (r.y + r.h < ROOM.y || r.y > ROOM.y + ROOM.height) return true;
    for (const w of world.state.level.walls) {
      if (r.x < w.x + w.w + 14 && r.x + r.w > w.x - 14 && r.y < w.y + w.h + 14 && r.y + r.h > w.y - 14) return true;
    }
    return false;
  }

  /** The nearest free cell to (cx,cy), searching outward in rings. */
  function nearestFreeCell(cx, cy) {
    for (let ring = 0; ring <= 6; ring += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        for (let dy = -ring; dy <= ring; dy += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          if (!cellBlocked(cx + dx, cy + dy)) return { cx: cx + dx, cy: cy + dy };
        }
      }
    }
    return { cx, cy };
  }

  /** A* over the grid; returns waypoints (cell centres) or null. */
  function findPath(sx, sy, tx, ty) {
    const start = nearestFreeCell(sx, sy);
    const goal = nearestFreeCell(tx, ty);
    const key = (x, y) => y * COLS + x;
    const h = (x, y) => Math.hypot(x - goal.cx, y - goal.cy);
    const open = [{ x: start.cx, y: start.cy, g: 0, f: h(start.cx, start.cy), parent: null }];
    const gScore = new Map([[key(start.cx, start.cy), 0]]);
    const closed = new Set();
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (open.length > 0) {
      let best = 0;
      for (let i = 1; i < open.length; i += 1) {
        if (open[i].f < open[best].f) best = i;
      }
      const cur = open.splice(best, 1)[0];
      if (cur.x === goal.cx && cur.y === goal.cy) {
        const cells = [];
        let n = cur;
        while (n) {
          cells.push(n);
          n = n.parent;
        }
        cells.reverse();
        return cells.slice(1).map((c) => ({ x: c.x * CELL + CELL / 2, y: c.y * CELL + CELL / 2 }));
      }
      closed.add(key(cur.x, cur.y));
      for (const [dx, dy] of DIRS) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if (cellBlocked(nx, ny)) continue;
        if (dx !== 0 && dy !== 0 && (cellBlocked(cur.x + dx, cur.y) || cellBlocked(cur.x, cur.y + dy))) continue;
        const nk = key(nx, ny);
        if (closed.has(nk)) continue;
        const ng = cur.g + (dx !== 0 && dy !== 0 ? 1.414 : 1);
        if (gScore.has(nk) && gScore.get(nk) <= ng) continue;
        gScore.set(nk, ng);
        open.push({ x: nx, y: ny, g: ng, f: ng + h(nx, ny), parent: cur });
      }
    }
    return null;
  }

  function dangerAt(x, y) {
    const w = world.state;
    for (const guard of w.guards) {
      if (inCone(guard.x, guard.y, guard.angle, GUARD.range, GUARD.halfAngle, x, y, w.level.walls)) return 'guard';
    }
    for (const camera of w.cameras) {
      if (camera.frozen > 0) continue;
      if (inCone(camera.x, camera.y, camera.angle, CAMERA.range, CAMERA.halfAngle, x, y, w.level.walls)) return 'camera';
    }
    if (w.dog && inCone(w.dog.x, w.dog.y, w.dog.angle, DOG.range, DOG.halfAngle, x, y, w.level.walls)) return 'dog';
    for (const laser of w.lasers) {
      if (!laserIsOn(laser, w.time)) continue;
      const minX = Math.min(laser.x1, laser.x2) - 10;
      const maxX = Math.max(laser.x1, laser.x2) + 10;
      if (x > minX && x < maxX && Math.abs(y - laser.y1) < 14) return 'laser';
    }
    return null;
  }

  /**
   * The nearest shadow that is safe to hide in right now: its centre is
   * outside every cone and laser, and no guard or dog is close to it. A
   * shadow on a patrol lane is a trap, not a refuge.
   */
  function nearestSafeShadow(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const s of world.state.level.shadows) {
      const cx = s.x + s.w / 2;
      const cy = s.y + s.h / 2;
      if (dangerAt(cx, cy)) continue;
      let close = false;
      for (const g of world.state.guards) {
        if (dist(g.x, g.y, cx, cy) < 110) { close = true; break; }
      }
      if (!close && world.state.dog && dist(world.state.dog.x, world.state.dog.y, cx, cy) < 110) close = true;
      if (close) continue;
      const d = dist(x, y, cx, cy);
      if (d < bestD) {
        bestD = d;
        best = { x: cx, y: cy };
      }
    }
    return best;
  }

  function nearestThreat(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const g of world.state.guards) {
      const d = dist(x, y, g.x, g.y);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    if (world.state.dog) {
      const d = dist(x, y, world.state.dog.x, world.state.dog.y);
      if (d < bestD) {
        bestD = d;
        best = world.state.dog;
      }
    }
    return { threat: best, dist: bestD };
  }

  function pickTarget() {
    const w = world.state;
    let best = null;
    let bestD = Infinity;
    for (const loot of w.loots) {
      if (loot.taken) continue;
      const d = dist(w.player.x, w.player.y, loot.x, loot.y);
      if (d < bestD) {
        bestD = d;
        best = loot;
      }
    }
    if (best) return { x: best.x, y: best.y, loot: best };
    const e = w.level.exit;
    return { x: e.x + e.w / 2, y: e.y + e.h / 2, loot: null };
  }

  function dirTo(tx, ty) {
    const p = world.state.player;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return { x: 0, y: 0, d };
    return { x: dx / d, y: dy / d, d };
  }

  function fleeCmd(threat) {
    const p = world.state.player;
    const dx = p.x - threat.x;
    const dy = p.y - threat.y;
    const len = Math.hypot(dx, dy) || 1;
    return { steer: { x: dx / len, y: dy / len }, sneak: false, interact: false, noiseAt: null, emp: false };
  }

  function decide(dt) {
    const w = world.state;
    const p = w.player;
    const now = w.time;
    const target = pickTarget();
    state.target = target;

    // Lockpicking: stand still on the safe or vault and hold E — unless a
    // cone is on us, in which case break off and come back later.
    if (target.loot && isLockpickLoot(target.loot.kind)) {
      const d = dist(p.x, p.y, target.loot.x, target.loot.y);
      if (d < 40) {
        if (dangerAt(p.x, p.y)) {
          state.lastDecision = 'break-off-lockpick';
          const { threat, dist: td } = nearestThreat(p.x, p.y);
          if (threat && td < 85) return fleeCmd(threat);
          const sh = nearestSafeShadow(p.x, p.y);
          if (sh) {
            const dir = dirTo(sh.x, sh.y);
            return { steer: { x: dir.x, y: dir.y }, sneak: true, interact: false, noiseAt: null, emp: false };
          }
          return { steer: { x: 0, y: 0 }, sneak: true, interact: false, noiseAt: null, emp: false };
        }
        state.lastDecision = 'lockpicking';
        return { steer: { x: 0, y: 0 }, sneak: true, interact: true, noiseAt: null, emp: false };
      }
    }

    // Being watched right now: get out of the cone. A guard right on top
    // of us means run, not hide; otherwise retreat to a safe shadow.
    const here = dangerAt(p.x, p.y);
    if (here) {
      const { threat, dist: td } = nearestThreat(p.x, p.y);
      if (threat && td < 85) {
        state.lastDecision = 'flee';
        return fleeCmd(threat);
      }
      const sh = nearestSafeShadow(p.x, p.y);
      if (sh && dist(p.x, p.y, sh.x, sh.y) > 30) {
        state.lastDecision = 'retreat-to-shadow';
        const dir = dirTo(sh.x, sh.y);
        return { steer: { x: dir.x, y: dir.y }, sneak: true, interact: false, noiseAt: null, emp: false };
      }
      if (sh) {
        state.lastDecision = 'hold-in-shadow';
        return { steer: { x: 0, y: 0 }, sneak: true, interact: false, noiseAt: null, emp: false };
      }
      if (threat) {
        state.lastDecision = 'flee-no-shadow';
        return fleeCmd(threat);
      }
      return { steer: { x: 0, y: 0 }, sneak: true, interact: false, noiseAt: null, emp: false };
    }

    // Route to the target along the planned path, replanning when the
    // target changes or the path runs out.
    const key = target.loot ? `loot-${target.loot.x}-${target.loot.y}` : 'exit';
    if (!state.path || state.pathKey !== key || state.pathIndex >= state.path.length) {
      const sx = Math.floor(p.x / CELL);
      const sy = Math.floor(p.y / CELL);
      const tx = Math.floor(target.x / CELL);
      const ty = Math.floor(target.y / CELL);
      const planned = findPath(sx, sy, tx, ty);
      state.path = planned && planned.length > 0 ? planned : [{ x: target.x, y: target.y }];
      state.pathKey = key;
      state.pathIndex = 0;
      state.lastDist = Infinity;
    }
    let wp = state.path[state.pathIndex];
    let dir = dirTo(wp.x, wp.y);
    while (dir.d < 22 && state.pathIndex < state.path.length - 1) {
      state.pathIndex += 1;
      wp = state.path[state.pathIndex];
      dir = dirTo(wp.x, wp.y);
    }
    const rawDist = dist(p.x, p.y, target.x, target.y);
    if (rawDist < 20 && target.loot && !isLockpickLoot(target.loot.kind)) {
      state.lastDecision = 'at-loot';
      return { steer: { x: dir.x, y: dir.y }, sneak: true, interact: false, noiseAt: null, emp: false };
    }

    // Is the next step dangerous? Wait for the patrol to pass.
    const probeX = p.x + dir.x * 48;
    const probeY = p.y + dir.y * 48;
    const threat = dangerAt(probeX, probeY);
    if (threat) {
      state.lastDecision = `wait-${threat}`;
      // Don't wait in the open: slip into a nearby shadow while the
      // patrol passes, so the alarm drains instead of building.
      if (!world.inShadow(p.x, p.y)) {
        const sh = nearestSafeShadow(p.x, p.y);
        if (sh && dist(p.x, p.y, sh.x, sh.y) < 170) {
          const sdir = dirTo(sh.x, sh.y);
          state.lastDecision = 'wait-in-shadow';
          return { steer: { x: sdir.x, y: sdir.y }, sneak: true, interact: false, noiseAt: null, emp: false };
        }
      }
      // A frozen camera never blocks us: EMP it if it is close.
      if (threat === 'camera' && w.empCharges > 0 && now - state.lastEmpAt > 8) {
        state.lastEmpAt = now;
        state.lastDecision = 'emp-camera';
        return { steer: { x: 0, y: 0 }, sneak: true, interact: false, noiseAt: null, emp: true };
      }
      // A guard that will not move on: throw a noise behind it.
      if (threat === 'guard' && w.noiseCharges > 0 && now - state.lastNoiseAt > 8) {
        state.lastNoiseAt = now;
        const { threat: g } = nearestThreat(p.x, p.y);
        if (g) {
          const nx = Math.max(ROOM.x + 20, Math.min(ROOM.x + ROOM.width - 20, g.x - 220));
          const ny = Math.max(ROOM.y + 20, Math.min(ROOM.y + ROOM.height - 20, g.y - 120));
          state.lastDecision = 'noise-lure';
          return { steer: { x: 0, y: 0 }, sneak: true, interact: false, noiseAt: { x: nx, y: ny }, emp: false };
        }
      }
      return { steer: { x: 0, y: 0 }, sneak: true, interact: false, noiseAt: null, emp: false };
    }

    // No progress along the path for a while: the plan is stale (a guard
    // pushed us off it) — replan from where we stand.
    if (dir.d < state.lastDist - 0.5) {
      state.stuckTimer = 0;
    } else {
      state.stuckTimer += dt;
    }
    state.lastDist = dir.d;
    if (state.stuckTimer > 3.5) {
      state.stuckTimer = 0;
      state.path = null;
      state.lastDecision = 'replan';
      return { steer: { x: 0, y: 0 }, sneak: true, interact: false, noiseAt: null, emp: false };
    }

    state.lastDecision = target.loot ? `to-${target.loot.kind}` : 'to-exit';
    return { steer: { x: dir.x, y: dir.y }, sneak: true, interact: false, noiseAt: null, emp: false };
  }

  return {
    decide,
    dangerAt,
    debug() {
      return {
        lastDecision: state.lastDecision,
        target: state.target ? { x: Math.round(state.target.x), y: Math.round(state.target.y) } : null,
      };
    },
  };
}
