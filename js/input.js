const keyMap = {
  z: "up",
  s: "down",
  q: "left",
  d: "right",
  Shift: "run",
  e: "interact",
  i: "inventory",
  Escape: "pause",
  f: "attack",
};

export class Input {
  constructor() {
    this.states = {
      up: false,
      down: false,
      left: false,
      right: false,
      run: false,
      interact: false,
      inventory: false,
      pause: false,
      attack: false,
    };

    this.pressedThisFrame = new Set();

    window.addEventListener("keydown", (e) => {
      const action = keyMap[e.key];
      if (!action) return;
      if (["up", "down", "left", "right", "run"].includes(action)) {
        this.states[action] = true;
      } else if (!e.repeat) {
        this.pressedThisFrame.add(action);
      }
      if (["up", "down", "left", "right", "run", "interact", "inventory", "pause", "attack"].includes(action)) {
        e.preventDefault();
      }
    });

    window.addEventListener("keyup", (e) => {
      const action = keyMap[e.key];
      if (!action) return;
      if (["up", "down", "left", "right", "run"].includes(action)) {
        this.states[action] = false;
      }
      e.preventDefault();
    });
  }

  consume(action) {
    if (this.pressedThisFrame.has(action)) {
      this.pressedThisFrame.delete(action);
      return true;
    }
    return false;
  }

  endFrame() {
    this.pressedThisFrame.clear();
  }
}
