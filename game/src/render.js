// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred. Nothing
// here changes the world; it only reads it.

import { FIELD, ROOM, PALETTE, FONT, PLAYER } from './config.js';
import { laserIsOn } from './loot.js';
import { formatTime } from './alarm.js';
import { pointInRect } from './geom.js';
import { GUARD_PATROL, GUARD_ALERTED } from './guards.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_OVER = 'over';
export const SCREEN_FINALE = 'finale';

const CARPET = ['#5a1f2b', '#1f4d3a', '#3a3f4d'];

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let view = { scale: 1, ox: 0, oy: 0, w: 1280, h: 720 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = canvas.clientWidth || 1280;
    const ch = canvas.clientHeight || 720;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view = {
      scale,
      ox: (canvas.width - FIELD.width * scale) / 2,
      oy: (canvas.height - FIELD.height * scale) / 2,
      w: canvas.width,
      h: canvas.height,
    };
  }

  function worldFromClient(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = (clientX - rect.left) * dpr;
    const py = (clientY - rect.top) * dpr;
    return { x: (px - view.ox) / view.scale, y: (py - view.oy) / view.scale };
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function cone(x, y, angle, range, half, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, range, angle - half, angle + half);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawFloor(world) {
    const level = world.level;
    // Checkerboard stone floor, with a faint grout line and a speckle of
    // darker stone in each tile so the floor reads as texture, not flat.
    const tile = 64;
    for (let y = ROOM.y; y < ROOM.y + ROOM.height; y += tile) {
      for (let x = ROOM.x; x < ROOM.x + ROOM.width; x += tile) {
        const even = ((x - ROOM.x) / tile + (y - ROOM.y) / tile) % 2 === 0;
        ctx.fillStyle = even ? PALETTE.floor : PALETTE.floorAlt;
        ctx.fillRect(x, y, tile, tile);
        const h = ((x * 31 + y * 17) % 97) / 97;
        ctx.fillStyle = `rgba(0,0,0,${0.05 + h * 0.08})`;
        ctx.fillRect(x + 8 + h * 30, y + 10 + ((x * 13 + y * 7) % 40), 14, 9);
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, tile, tile);
      }
    }
    // A carpet runner down the middle of the room.
    ctx.fillStyle = CARPET[world.levelIndex % CARPET.length];
    ctx.fillRect(ROOM.x + 40, 332, ROOM.width - 80, 56);
    ctx.strokeStyle = 'rgba(255,217,74,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(ROOM.x + 40, 332, ROOM.width - 80, 56);
    // Lamp pools: warm light on the floor, bright at the bulb and fading
    // out — the warm pools are what make the dark shadow lanes read as
    // safe by contrast.
    for (const lamp of level.lamps) {
      const g = ctx.createRadialGradient(lamp.x, lamp.y, 4, lamp.x, lamp.y, lamp.r);
      g.addColorStop(0, 'rgba(255,214,110,0.55)');
      g.addColorStop(0.45, 'rgba(245,201,92,0.30)');
      g.addColorStop(1, 'rgba(245,201,92,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, lamp.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.lamp;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Shadow patches: the safe lanes, dark and obvious.
    for (const s of level.shadows) {
      ctx.fillStyle = 'rgba(5,7,15,0.35)';
      rr(s.x - 6, s.y - 6, s.w + 12, s.h + 12, 14);
      ctx.fill();
      ctx.fillStyle = 'rgba(5,7,15,0.55)';
      rr(s.x, s.y, s.w, s.h, 10);
      ctx.fill();
    }
  }

  function drawExit(world) {
    const exit = world.level.exit;
    const open = world.lootValue >= world.level.target;
    ctx.fillStyle = open ? PALETTE.exit : '#3a2a2a';
    rr(exit.x, exit.y, exit.w, exit.h, 8);
    ctx.fill();
    ctx.strokeStyle = open ? '#a9f5b8' : '#7a4a4a';
    ctx.lineWidth = 2;
    ctx.stroke();
    // The getaway van, parked in the zone.
    const vx = exit.x + 10;
    const vy = exit.y + 14;
    ctx.fillStyle = open ? PALETTE.van : '#8a8f9a';
    rr(vx, vy, 62, 26, 6);
    ctx.fill();
    ctx.fillStyle = open ? '#2b6cb0' : '#5a5f6a';
    ctx.fillRect(vx + 44, vy + 4, 16, 18);
    ctx.fillStyle = '#11141b';
    ctx.beginPath();
    ctx.arc(vx + 14, vy + 28, 6, 0, Math.PI * 2);
    ctx.arc(vx + 48, vy + 28, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = open ? '#0b3d1e' : '#c9a0a0';
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(open ? 'GETAWAY' : 'LOCKED', exit.x + exit.w / 2, exit.y + exit.h - 6);
    if (open) {
      // A pulsing arrow pointing at the van once the loot is yours.
      const pulse = 0.6 + 0.4 * Math.sin(world.time * 5);
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = PALETTE.exit;
      ctx.font = `bold 22px ${FONT}`;
      ctx.fillText('▼', exit.x + exit.w / 2, exit.y - 6);
      ctx.restore();
    }
  }

  function drawLoot(world) {
    for (const loot of world.loots) {
      if (loot.taken) continue;
      const bob = Math.sin(world.time * 2 + loot.bob) * 2;
      const x = loot.x;
      const y = loot.y + bob;
      // A soft glow under the loot so gold, gems and the vault read as
      // the goal from across the room.
      const glowColor = loot.kind === 'vault' ? '155,232,255' : loot.kind === 'gem' ? '92,225,230' : '255,217,74';
      const glow = ctx.createRadialGradient(x, y, 4, x, y, 34);
      glow.addColorStop(0, `rgba(${glowColor},0.35)`);
      glow.addColorStop(1, `rgba(${glowColor},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 34, 0, Math.PI * 2);
      ctx.fill();
      if (loot.kind === 'gold') {
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.moveTo(x - 13, y + 7);
        ctx.lineTo(x - 9, y - 7);
        ctx.lineTo(x + 9, y - 7);
        ctx.lineTo(x + 13, y + 7);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff3b0';
        ctx.fillRect(x - 6, y - 4, 12, 3);
        ctx.fillStyle = PALETTE.gold;
        ctx.font = `bold 11px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('$500', x, y + 20);
      } else if (loot.kind === 'gem') {
        ctx.fillStyle = PALETTE.gem;
        ctx.beginPath();
        ctx.moveTo(x, y - 12);
        ctx.lineTo(x + 11, y);
        ctx.lineTo(x, y + 12);
        ctx.lineTo(x - 11, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#e6fbff';
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x + 5, y);
        ctx.lineTo(x, y + 6);
        ctx.lineTo(x - 5, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = PALETTE.gem;
        ctx.font = `bold 11px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('$1000', x, y + 24);
      } else if (loot.kind === 'safe') {
        ctx.fillStyle = '#3d4458';
        rr(x - 18, y - 18, 36, 36, 5);
        ctx.fill();
        ctx.strokeStyle = PALETTE.gold;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.gold;
        ctx.font = `bold 11px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('SAFE · E', x, y + 32);
      } else if (loot.kind === 'vault') {
        ctx.fillStyle = PALETTE.diamond;
        ctx.beginPath();
        ctx.moveTo(x, y - 18);
        ctx.lineTo(x + 16, y);
        ctx.lineTo(x, y + 18);
        ctx.lineTo(x - 16, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x + 7, y);
        ctx.lineTo(x, y + 8);
        ctx.lineTo(x - 7, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = PALETTE.diamond;
        ctx.font = `bold 12px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('VAULT · E $2500', x, y + 34);
      }
      // Lockpick progress ring around a safe or the vault.
      if ((loot.kind === 'safe' || loot.kind === 'vault') && loot.progress > 0 && loot.progress < 1) {
        ctx.strokeStyle = PALETTE.gold;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y, 28, -Math.PI / 2, -Math.PI / 2 + loot.progress * Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawLasers(world) {
    for (const laser of world.lasers) {
      const on = laserIsOn(laser, world.time);
      ctx.strokeStyle = on ? PALETTE.laser : 'rgba(255,59,92,0.25)';
      ctx.lineWidth = on ? 3 : 1.5;
      if (!on) ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(laser.x1, laser.y1);
      ctx.lineTo(laser.x2, laser.y2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (on) {
        ctx.fillStyle = 'rgba(255,59,92,0.5)';
        ctx.beginPath();
        ctx.arc(laser.x1, laser.y1, 5, 0, Math.PI * 2);
        ctx.arc(laser.x2, laser.y2, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#3d4458';
      ctx.fillRect(laser.x1 - 5, laser.y1 - 7, 10, 14);
      ctx.fillRect(laser.x2 - 5, laser.y2 - 7, 10, 14);
    }
  }

  function drawWalls(world) {
    for (const w of world.level.walls) {
      // A deeper drop shadow lifts the walls off the floor.
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(w.x + 6, w.y + 8, w.w, w.h);
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = PALETTE.wallTop;
      ctx.fillRect(w.x, w.y, w.w, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(w.x, w.y + w.h - 3, w.w, 3);
    }
    // The room's outer walls.
    ctx.strokeStyle = PALETTE.wallTop;
    ctx.lineWidth = 4;
    ctx.strokeRect(ROOM.x, ROOM.y, ROOM.width, ROOM.height);
  }

  function drawWatchers(world) {
    // Camera cones first (under the guards), then guard cones. Each cone
    // gets a brighter core near the watcher so the dangerous half of the
    // cone reads at a glance, not just its edge.
    for (const camera of world.cameras) {
      if (camera.frozen > 0) {
        cone(camera.x, camera.y, camera.angle, 215, 0.42, '#8b93a3', 0.12);
      } else {
        cone(camera.x, camera.y, camera.angle, 215, 0.42, PALETTE.cameraCone, 0.22);
        cone(camera.x, camera.y, camera.angle, 118, 0.42, PALETTE.cameraCone, 0.30);
      }
      ctx.fillStyle = '#22283c';
      ctx.fillRect(camera.x - 9, camera.y - 7, 18, 14);
      ctx.fillStyle = camera.frozen > 0 ? '#8b93a3' : (Math.sin(camera.blink * 6) > 0 ? '#ff3b3b' : '#5a1f1f');
      ctx.beginPath();
      ctx.arc(camera.x, camera.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const guard of world.guards) {
      const alerted = guard.state === GUARD_ALERTED;
      const color = alerted ? PALETTE.coneAlert : PALETTE.cone;
      cone(guard.x, guard.y, guard.angle, 185, 0.55, color, alerted ? 0.34 : 0.22);
      cone(guard.x, guard.y, guard.angle, 102, 0.55, color, alerted ? 0.30 : 0.20);
      // The guard: navy uniform, cap, facing wedge, pale outline so the
      // figure reads against the dark floor and its own cone.
      ctx.fillStyle = PALETTE.guard;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8fa3d9';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = PALETTE.guardDark;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 14, guard.angle - 0.9, guard.angle + 0.9);
      ctx.lineTo(guard.x, guard.y);
      ctx.fill();
      ctx.fillStyle = '#dfe6f5';
      const ex = guard.x + Math.cos(guard.angle) * 7;
      const ey = guard.y + Math.sin(guard.angle) * 7;
      ctx.beginPath();
      ctx.arc(ex - 3, ey - 2, 1.8, 0, Math.PI * 2);
      ctx.arc(ex + 3, ey + 2, 1.8, 0, Math.PI * 2);
      ctx.fill();
      // Suspicion: a "?" over a curious guard, "!" over an alarmed one.
      ctx.font = `bold 18px ${FONT}`;
      ctx.textAlign = 'center';
      if (alerted) {
        ctx.fillStyle = PALETTE.coneAlert;
        ctx.fillText('!', guard.x, guard.y - 20);
      } else if (guard.state !== GUARD_PATROL) {
        ctx.fillStyle = PALETTE.cone;
        ctx.fillText('?', guard.x, guard.y - 20);
      }
    }
    // The patrol dog.
    const dog = world.dog;
    if (dog) {
      cone(dog.x, dog.y, dog.angle, 130, 0.7, '#d98a3d', 0.22);
      cone(dog.x, dog.y, dog.angle, 72, 0.7, '#d98a3d', 0.20);
      ctx.fillStyle = PALETTE.dog;
      ctx.beginPath();
      ctx.arc(dog.x, dog.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e8b07a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(dog.x - 7, dog.y - 7, 4, 0, Math.PI * 2);
      ctx.arc(dog.x + 7, dog.y - 7, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1210';
      ctx.beginPath();
      ctx.arc(dog.x + Math.cos(dog.angle) * 8, dog.y + Math.sin(dog.angle) * 8, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayer(world) {
    const p = world.player;
    const hidden = world.level.shadows.some((s) => pointInRect(p.x, p.y, s));
    // Noise pucks: a thrown distraction, ringing where it lands.
    for (const puck of world.noisePucks) {
      const t = 1 - puck.ttl / 1.4;
      ctx.strokeStyle = `rgba(255,217,74,${1 - t})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(puck.x, puck.y, 8 + t * 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `bold 16px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('♪', puck.x, puck.y - 12);
    }
    // The thief: a hooded figure in bright teal, bigger than before and
    // ringed in pale light so he is the first thing the eye finds, even
    // in shadow. A pointed hood in the facing direction, dark visor slit.
    const R = PLAYER.radius;
    ctx.save();
    if (p.sneak) ctx.globalAlpha = 0.92;
    ctx.shadowColor = 'rgba(45,212,167,0.55)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#d9fff2';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = PALETTE.playerDark;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R, p.angle - 1.0, p.angle + 1.0);
    ctx.lineTo(p.x, p.y);
    ctx.fill();
    // Hood peak pointing where he moves.
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    const hx = p.x + Math.cos(p.angle) * (R + 4);
    const hy = p.y + Math.sin(p.angle) * (R + 4);
    const px = -Math.sin(p.angle);
    const py = Math.cos(p.angle);
    ctx.moveTo(hx, hy);
    ctx.lineTo(p.x + px * (R - 4), p.y + py * (R - 4));
    ctx.lineTo(p.x - px * (R - 4), p.y - py * (R - 4));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0b0e1a';
    ctx.fillRect(p.x - 9, p.y - 3, 18, 5);
    ctx.restore();
    if (hidden) {
      ctx.fillStyle = '#9be8ff';
      ctx.font = `bold 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('HIDDEN', p.x, p.y - R - 8);
    }
    if (p.sneak) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('sneaking', p.x, p.y + R + 12);
    }
  }

  function drawHud(world, ui) {
    ctx.fillStyle = PALETTE.hud;
    ctx.fillRect(0, 0, FIELD.width, 64);
    ctx.strokeStyle = PALETTE.hudLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 64);
    ctx.lineTo(FIELD.width, 64);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText(world.level.name, 18, 26);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.fillText(world.level.sub, 18, 46);

    // Loot: stolen value against the target.
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillText(`LOOT $${world.lootValue} / $${world.level.target}`, 330, 27);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.fillText(world.lootValue >= world.level.target ? 'Get to the green van!' : 'Steal it all, then run', 330, 46);

    // The alarm meter: the heart of the HUD.
    const ax = 620;
    const ay = 16;
    const aw = 250;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillText('ALARM', ax, ay + 10);
    ctx.fillStyle = '#0b0e1a';
    rr(ax, ay + 16, aw, 16, 8);
    ctx.fill();
    const frac = world.alarm.value / 100;
    const alarmColor = frac < 0.4 ? '#39d353' : frac < 0.75 ? '#f2c94c' : '#e5534b';
    if (frac > 0) {
      ctx.fillStyle = alarmColor;
      rr(ax, ay + 16, Math.max(16, aw * frac), 16, 8);
      ctx.fill();
    }
    if (world.alarm.value >= 55) {
      ctx.fillStyle = '#ff5a5a';
      ctx.font = `bold 13px ${FONT}`;
      ctx.fillText('SPOTTED!', ax, ay + 48);
    }

    // Hearts, tools, timer.
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillText('♥'.repeat(Math.max(0, world.hearts)) + '♡'.repeat(Math.max(0, 2 - world.hearts)), 920, 27);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.fillText(`Q noise ×${world.noiseCharges}   F EMP ×${world.empCharges}`, 920, 46);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 16px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(world.timer), FIELD.width - 18, 27);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    const best = ui.best[world.levelIndex];
    ctx.fillText(best ? `Best ${best.rank} ${best.time}` : 'No best yet', FIELD.width - 18, 46);
    if (ui.muted) {
      ctx.fillStyle = PALETTE.danger;
      ctx.font = `bold 12px ${FONT}`;
      ctx.fillText('MUTED', FIELD.width - 18, 62 - 2);
    }
    ctx.textAlign = 'left';
  }

  function drawMinimap(world) {
    const mw = 200;
    const mh = 112;
    const mx = FIELD.width - mw - 14;
    const my = FIELD.height - mh - 14;
    const sx = mw / FIELD.width;
    const sy = mh / FIELD.height;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#0b0e1a';
    rr(mx - 6, my - 6, mw + 12, mh + 12, 8);
    ctx.fill();
    ctx.strokeStyle = PALETTE.hudLine;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#2c3552';
    for (const w of world.level.walls) ctx.fillRect(mx + w.x * sx, my + w.y * sy, Math.max(2, w.w * sx), Math.max(2, w.h * sy));
    ctx.fillStyle = PALETTE.exit;
    const e = world.level.exit;
    ctx.fillRect(mx + e.x * sx, my + e.y * sy, e.w * sx, e.h * sy);
    for (const loot of world.loots) {
      if (loot.taken) continue;
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(mx + loot.x * sx, my + loot.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const guard of world.guards) {
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath();
      ctx.arc(mx + guard.x * sx, my + guard.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (world.dog) {
      ctx.fillStyle = '#d98a3d';
      ctx.beginPath();
      ctx.arc(mx + world.dog.x * sx, my + world.dog.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mx + world.player.x * sx, my + world.player.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function panel(title, lines, accent) {
    ctx.save();
    ctx.fillStyle = 'rgba(5,7,15,0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = PALETTE.hud;
    rr(FIELD.width / 2 - 330, 140, 660, 450, 14);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = `bold 44px ${FONT}`;
    ctx.fillText(title, FIELD.width / 2, 212);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `17px ${FONT}`;
    let y = 260;
    for (const line of lines) {
      ctx.fillText(line, FIELD.width / 2, y);
      y += 30;
    }
    ctx.restore();
  }

  function draw(world, screen, ui) {
    resize();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);

    drawFloor(world);
    drawExit(world);
    drawLoot(world);
    drawLasers(world);
    drawWalls(world);
    drawWatchers(world);
    drawPlayer(world);
    drawHud(world, ui);
    drawMinimap(world);

    // Caught flash: the moment the alarm busts you.
    if (world.caughtFlash > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.3 * Math.sin(world.time * 12);
      ctx.fillStyle = '#e5534b';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 56px ${FONT}`;
      ctx.fillText('SPOTTED!', FIELD.width / 2, FIELD.height / 2 - 10);
      ctx.font = `20px ${FONT}`;
      ctx.fillText('Back to the entry — one heart lost', FIELD.width / 2, FIELD.height / 2 + 30);
    }

    if (screen === SCREEN_TITLE) {
      panel('VAULTBREAK', [
        'You are the thief. Cross the room, steal the loot,',
        'slip past the guards and cameras — and reach the van.',
        '',
        'WASD / arrows — move      Shift — sneak (slow, hidden)',
        'E — pick a lock (hold)      Q / click — noise-maker',
        'F — EMP freeze cameras      P — pause      M — mute',
        '',
        'Shadow hides you. A cone that sees you fills the ALARM.',
        'At 100 you are caught. Steal the target, then run.',
        '',
        'Press Enter or click to start the first heist.',
      ], PALETTE.gold);
      // Best ranks on the title screen.
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `14px ${FONT}`;
      const bests = ui.best.map((b, i) => (b ? `Level ${i + 1}: ${b.rank} ${b.time}` : `Level ${i + 1}: —`)).join('    ');
      ctx.fillText(bests, FIELD.width / 2, 530);
    } else if (screen === SCREEN_PAUSED) {
      panel('PAUSED', [
        'The guards wait for no one — except right now.',
        '',
        'P / Esc — resume      R — restart the level      M — mute',
      ], PALETTE.muted);
    } else if (screen === SCREEN_CLEAR) {
      const c = ui.clear;
      panel(c.finale ? 'THE VAULT IS YOURS' : 'HEIST COMPLETE', [
        `${c.levelName} — loot $${c.loot} in ${c.time}`,
        `Rank: ${c.rank}`,
        c.best ? `Best: ${c.best.rank} ${c.best.time}` : 'First clear of this floor!',
        '',
        c.finale ? 'All three heists done. The crew eats tonight.' : 'Press Enter for the next heist.',
      ], c.rank === 'GHOST' ? PALETTE.gold : PALETTE.exit);
    } else if (screen === SCREEN_OVER) {
      panel('BUSTED', [
        'The crew got made. The loot stays in the vault.',
        '',
        'Press R to retry this floor, or Enter for the title screen.',
      ], PALETTE.danger);
    } else if (screen === SCREEN_FINALE) {
      const lines = [`Total loot: $${ui.totalLoot}`, ''];
      ui.best.forEach((b, i) => {
        lines.push(b ? `Level ${i + 1}: ${b.rank} — ${b.time}` : `Level ${i + 1}: not cleared`);
      });
      lines.push('', 'Press Enter to play again.');
      panel('THE VAULT IS YOURS', lines, PALETTE.gold);
    }
    ctx.textAlign = 'left';
  }

  return { draw, worldFromClient };
}
