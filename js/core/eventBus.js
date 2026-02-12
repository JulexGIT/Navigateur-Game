export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  emit(event, payload = {}) {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const fn of handlers) fn(payload);
  }
}

export const EVENTS = {
  PLAYER_DAMAGED: "PLAYER_DAMAGED",
  PLAYER_ATTACKED: "PLAYER_ATTACKED",
  ENEMY_DAMAGED: "ENEMY_DAMAGED",
  ENEMY_KILLED: "ENEMY_KILLED",
  INVENTORY_UPDATED: "INVENTORY_UPDATED",
  NPC_INTERACTED: "NPC_INTERACTED",
  PLAYER_DIED: "PLAYER_DIED",
  OBJECTIVE_UPDATED: "OBJECTIVE_UPDATED",
  RESOURCE_COLLECTED: "RESOURCE_COLLECTED",
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
};
