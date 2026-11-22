// The three handcrafted heists. Each level is one room the thief crosses:
// entry bottom-left, getaway van top-right. Walls make cover and several
// routes; shadow patches are the safe lanes; loot is spread so no single
// straight line collects it all; guards patrol the lanes between.
//
// Coordinates are in the 1280x720 field; the room is x 16..1264, y 76..704.
// A wall is {x, y, w, h}; a shadow is {x, y, w, h}; a guard is a waypoint
// list walked in order; a camera sits on a wall and sweeps; a loot item is
// {kind, x, y} where kind is gold | gem | safe | vault; a laser is a beam
// across a corridor that blinks on and off in a cycle.

export const LEVELS = [
  {
    name: '1 · THE GALLERY',
    sub: 'Two guards, one camera — learn the ropes.',
    target: 1500,
    entry: { x: 70, y: 640 },
    exit: { x: 1150, y: 92, w: 98, h: 64 },
    walls: [
      { x: 420, y: 200, w: 28, h: 320 },
      { x: 700, y: 380, w: 300, h: 28 },
      { x: 640, y: 180, w: 56, h: 56 },
      { x: 900, y: 560, w: 56, h: 56 },
    ],
    shadows: [
      { x: 16, y: 480, w: 200, h: 224 },
      { x: 560, y: 76, w: 220, h: 96 },
      { x: 1050, y: 480, w: 214, h: 224 },
      { x: 300, y: 76, w: 160, h: 96 },
    ],
    lamps: [
      { x: 640, y: 300, r: 130 },
      { x: 980, y: 200, r: 120 },
      { x: 300, y: 560, r: 120 },
    ],
    guards: [
      { waypoints: [{ x: 500, y: 300 }, { x: 920, y: 300 }], pause: 1.4 },
      { waypoints: [{ x: 1050, y: 250 }, { x: 1050, y: 560 }], pause: 1.2 },
    ],
    cameras: [
      { x: 640, y: 80, baseAngle: Math.PI / 2, sweep: 0.65, speed: 0.55 },
    ],
    loot: [
      { kind: 'gold', x: 240, y: 150, value: 500 },
      { kind: 'gold', x: 1150, y: 640, value: 500 },
      { kind: 'gold', x: 700, y: 650, value: 500 },
    ],
    lasers: [],
    dog: null,
  },
  {
    name: '2 · BANK FLOOR',
    sub: 'Three guards, two cameras, a safe to crack.',
    target: 4000,
    entry: { x: 70, y: 640 },
    exit: { x: 1150, y: 92, w: 98, h: 64 },
    walls: [
      { x: 380, y: 150, w: 28, h: 410 },
      { x: 840, y: 160, w: 28, h: 440 },
      { x: 500, y: 300, w: 260, h: 28 },
      { x: 1080, y: 420, w: 56, h: 56 },
    ],
    shadows: [
      { x: 16, y: 76, w: 180, h: 130 },
      { x: 440, y: 560, w: 260, h: 144 },
      { x: 940, y: 76, w: 200, h: 110 },
      { x: 1080, y: 520, w: 184, h: 184 },
      { x: 500, y: 76, w: 140, h: 96 },
    ],
    lamps: [
      { x: 620, y: 200, r: 130 },
      { x: 980, y: 320, r: 120 },
      { x: 240, y: 480, r: 120 },
      { x: 1120, y: 300, r: 110 },
    ],
    guards: [
      { waypoints: [{ x: 460, y: 220 }, { x: 800, y: 220 }], pause: 1.1 },
      { waypoints: [{ x: 950, y: 200 }, { x: 950, y: 600 }], pause: 1.3 },
      { waypoints: [{ x: 500, y: 560 }, { x: 780, y: 560 }], pause: 1.0 },
    ],
    cameras: [
      { x: 300, y: 80, baseAngle: Math.PI / 2 + 0.3, sweep: 0.6, speed: 0.6 },
      { x: 1000, y: 80, baseAngle: Math.PI / 2 - 0.2, sweep: 0.6, speed: 0.5 },
    ],
    loot: [
      { kind: 'gold', x: 220, y: 640, value: 500 },
      { kind: 'gold', x: 1180, y: 620, value: 500 },
      { kind: 'gem', x: 620, y: 130, value: 1000 },
      { kind: 'safe', x: 200, y: 300, value: 1000 },
      { kind: 'gem', x: 850, y: 420, value: 1000 },
    ],
    lasers: [],
    dog: null,
  },
  {
    name: '3 · THE VAULT',
    sub: 'Four guards, three cameras, lasers and a patrol dog.',
    target: 4500,
    entry: { x: 70, y: 640 },
    exit: { x: 1150, y: 92, w: 98, h: 64 },
    walls: [
      { x: 320, y: 150, w: 28, h: 350 },
      { x: 640, y: 220, w: 28, h: 430 },
      { x: 960, y: 150, w: 28, h: 350 },
      { x: 380, y: 480, w: 220, h: 28 },
    ],
    shadows: [
      { x: 16, y: 76, w: 170, h: 120 },
      { x: 400, y: 580, w: 200, h: 124 },
      { x: 720, y: 76, w: 180, h: 100 },
      { x: 1040, y: 560, w: 224, h: 144 },
      { x: 1040, y: 76, w: 120, h: 90 },
    ],
    lamps: [
      { x: 500, y: 300, r: 130 },
      { x: 820, y: 420, r: 130 },
      { x: 1140, y: 300, r: 120 },
      { x: 200, y: 400, r: 120 },
    ],
    guards: [
      { waypoints: [{ x: 380, y: 200 }, { x: 600, y: 200 }], pause: 1.0 },
      { waypoints: [{ x: 1020, y: 350 }, { x: 1020, y: 600 }], pause: 1.2 },
      { waypoints: [{ x: 380, y: 560 }, { x: 600, y: 560 }], pause: 1.1 },
      { waypoints: [{ x: 1120, y: 200 }, { x: 1120, y: 400 }], pause: 1.4 },
    ],
    cameras: [
      { x: 480, y: 80, baseAngle: Math.PI / 2, sweep: 0.6, speed: 0.6 },
      { x: 800, y: 80, baseAngle: Math.PI / 2, sweep: 0.6, speed: 0.5 },
      { x: 1120, y: 80, baseAngle: Math.PI / 2, sweep: 0.55, speed: 0.65 },
    ],
    loot: [
      { kind: 'gold', x: 120, y: 150, value: 500 },
      { kind: 'gold', x: 120, y: 640, value: 500 },
      { kind: 'gem', x: 520, y: 640, value: 1000 },
      { kind: 'vault', x: 1220, y: 360, value: 2500 },
    ],
    // Three beams across the middle corridor, blinking in turn: cross
    // while your beam is dark. The top and bottom lanes stay open.
    lasers: [
      { x1: 700, y1: 300, x2: 940, y2: 300, period: 2.4, offset: 0.0 },
      { x1: 700, y1: 380, x2: 940, y2: 380, period: 2.4, offset: 0.8 },
      { x1: 700, y1: 460, x2: 940, y2: 460, period: 2.4, offset: 1.6 },
    ],
    dog: { waypoints: [{ x: 700, y: 640 }, { x: 1100, y: 640 }], pause: 0.6 },
  },
];
