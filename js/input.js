const PRESETS = {
  azerty: {
    up: ["KeyZ", "ArrowUp"],
    down: ["KeyS", "ArrowDown"],
    left: ["KeyQ", "ArrowLeft"],
    right: ["KeyD", "ArrowRight"],
  },
  qwerty: {
    up: ["KeyW", "ArrowUp"],
    down: ["KeyS", "ArrowDown"],
    left: ["KeyA", "ArrowLeft"],
    right: ["KeyD", "ArrowRight"],
  },
};

export class Input {
  constructor(preset = "azerty") {
    this.states = { up: false, down: false, left: false, right: false, run: false };
    this.pressedThisFrame = new Set();
    this.bindings = this._buildBindings(preset);
    this._setupListeners();
  }

  _buildBindings(presetName) {
    const base = PRESETS[presetName] ?? PRESETS.azerty;
    const map = new Map();
    for (const [action, codes] of Object.entries(base)) {
      for (const code of codes) map.set(code, action);
    }
    map.set("ShiftLeft", "run");
    map.set("ShiftRight", "run");
    map.set("KeyE", "interact");
    map.set("KeyF", "attack");
    map.set("KeyI", "inventory");
    map.set("Escape", "pause");
    map.set("Enter", "continue");
    map.set("Space", "continue");
    return map;
  }

  rebind(action, codes) {
    for (const [code, mapped] of this.bindings.entries()) {
      if (mapped === action) this.bindings.delete(code);
    }
    for (const code of codes) this.bindings.set(code, action);
  }

  _setupListeners() {
    const held = new Set(["up", "down", "left", "right", "run"]);

    window.addEventListener("keydown", (e) => {
      const action = this.bindings.get(e.code);
      if (!action) return;
      if (held.has(action)) {
        this.states[action] = true;
      } else if (!e.repeat) {
        this.pressedThisFrame.add(action);
      }
      e.preventDefault();
    });

    window.addEventListener("keyup", (e) => {
      const action = this.bindings.get(e.code);
      if (!action) return;
      if (held.has(action)) this.states[action] = false;
      e.preventDefault();
    });
  }

  consume(action) {
    if (!this.pressedThisFrame.has(action)) return false;
    this.pressedThisFrame.delete(action);
    return true;
  }

  endFrame() {
    this.pressedThisFrame.clear();
  }
}
