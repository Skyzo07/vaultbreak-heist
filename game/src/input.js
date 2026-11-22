// Keyboard and pointer input. Held keys give a steering vector; one-shot
// presses (confirm, pause, tools, restart, mute) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost and
// never counted twice. Clicks land as a world position for the noise-maker.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_NOISE = 4;
export const ACTION_EMP = 8;
export const ACTION_RESTART = 16;
export const ACTION_MUTE = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SNEAK = new Set(['ShiftLeft', 'ShiftRight', 'KeyC']);
const INTERACT = new Set(['KeyE']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const NOISE = new Set(['KeyQ']);
const EMP = new Set(['KeyF']);
const RESTART = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas, toWorld) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let sneak = false;
  let interact = false;
  let actions = 0;
  // Latest click, in world coordinates; null until the first click.
  let click = null;

  function releaseAll() {
    up = false;
    down = false;
    left = false;
    right = false;
    sneak = false;
    interact = false;
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (SNEAK.has(event.code)) sneak = true;
    else if (INTERACT.has(event.code)) interact = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (NOISE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_NOISE;
    } else if (EMP.has(event.code)) {
      if (!event.repeat) actions |= ACTION_EMP;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (SNEAK.has(event.code)) sneak = false;
    else if (INTERACT.has(event.code)) interact = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of
  // everything on blur so the thief never keeps walking on his own.
  window.addEventListener('blur', releaseAll);
  canvas.addEventListener('pointerdown', (event) => {
    click = toWorld(event.clientX, event.clientY);
    actions |= ACTION_CONFIRM;
  });

  return {
    /** Normalised steering vector {x, y} from the held movement keys. */
    steer() {
      const x = (right ? 1 : 0) - (left ? 1 : 0);
      const y = (down ? 1 : 0) - (up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    sneakHeld() {
      return sneak;
    },
    interactHeld() {
      return interact;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The latest click in world coordinates, or null. */
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
  };
}
