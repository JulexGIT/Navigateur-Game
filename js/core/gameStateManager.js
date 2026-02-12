export const GAME_STATES = {
  PLAYING: "playing",
  PAUSED: "paused",
  DIALOGUE: "dialogue",
  INVENTORY: "inventory",
  DEAD: "dead",
};

const INPUT_POLICY = {
  [GAME_STATES.PLAYING]: new Set(["move", "run", "interact", "attack", "pause", "inventory", "continue"]),
  [GAME_STATES.PAUSED]: new Set(["pause"]),
  [GAME_STATES.DIALOGUE]: new Set(["continue", "pause"]),
  [GAME_STATES.INVENTORY]: new Set(["inventory", "pause"]),
  [GAME_STATES.DEAD]: new Set(["continue"]),
};

export class GameStateManager {
  constructor() {
    this.current = GAME_STATES.PLAYING;
  }

  setState(next) {
    this.current = next;
  }

  can(action) {
    if (action === "move") return INPUT_POLICY[this.current].has("move");
    return INPUT_POLICY[this.current].has(action);
  }

  is(state) {
    return this.current === state;
  }
}
