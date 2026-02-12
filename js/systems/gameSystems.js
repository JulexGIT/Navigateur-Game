import { GAME_STATES } from "../core/gameStateManager.js";
import { clamp, distance } from "../utils.js";

export class CameraSystem {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.world = world;
    this.camera = { x: 0, y: 0 };
    this.deadZone = { x: 120, y: 80 };
  }

  update(dt, player) {
    const targetX = player.x - this.canvas.width / 2;
    const targetY = player.y - this.canvas.height / 2;
    const dx = targetX - this.camera.x;
    const dy = targetY - this.camera.y;
    if (Math.abs(dx) > this.deadZone.x) this.camera.x += dx * Math.min(1, dt * 7);
    if (Math.abs(dy) > this.deadZone.y) this.camera.y += dy * Math.min(1, dt * 7);
    this.camera.x = clamp(this.camera.x, 0, this.world.width - this.canvas.width);
    this.camera.y = clamp(this.camera.y, 0, this.world.height - this.canvas.height);
    return this.camera;
  }
}

export class InteractionSystem {
  constructor(eventBus) {
    this.eventBus = eventBus;
  }

  interact(player, interactables, world) {
    let closest = null;
    let closestDistance = 82;
    for (const npc of interactables) {
      const d = distance(player, npc);
      if (d < closestDistance) {
        closestDistance = d;
        closest = npc;
      }
    }

    if (closest) {
      this.eventBus.emit("NPC_INTERACTED", { npc: closest });
      return;
    }

    const node = world.resourceNodes.find((n) => !n.collected && distance(player, n) < 52);
    if (node) {
      node.collected = true;
      this.eventBus.emit("RESOURCE_COLLECTED", { node });
      return;
    }

    const lore = world.loreSpots.find((spot) => distance(player, spot) < 56);
    if (lore) {
      this.eventBus.emit("OBJECTIVE_UPDATED", { text: "Récupérer une relique et vaincre 3 ennemis." });
      this.eventBus.emit("NPC_INTERACTED", { npc: { name: "Stèle", dialogue: lore.text, narrative: true } });
      return;
    }

    this.eventBus.emit("NPC_INTERACTED", { npc: { name: "Système", dialogue: "Personne à proximité.", narrative: false } });
  }
}

export class CombatSystem {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.damageNumbers = [];
    this.particles = [];
    this.hitstop = 0;
    this.audio = new (window.AudioContext || window.webkitAudioContext)();

    this.eventBus.on("ENEMY_DAMAGED", ({ enemy, amount }) => {
      this.damageNumbers.push({ x: enemy.x, y: enemy.y - 16, amount, ttl: 0.6 });
      this._spawnParticles(enemy.x, enemy.y, "#f7b0a1");
      this.playTone(440, 0.05);
      this.hitstop = 0.035;
    });
    this.eventBus.on("PLAYER_DAMAGED", ({ amount, player }) => {
      this.damageNumbers.push({ x: player.x, y: player.y - 20, amount, ttl: 0.7, player: true });
      this.playTone(180, 0.06);
    });
  }

  _spawnParticles(x, y, color) {
    for (let i = 0; i < 7; i += 1) {
      this.particles.push({ x, y, vx: (Math.random() - 0.5) * 110, vy: (Math.random() - 0.5) * 110, ttl: 0.35, color });
    }
  }

  playTone(freq, dur) {
    const o = this.audio.createOscillator();
    const g = this.audio.createGain();
    o.frequency.value = freq;
    o.type = "square";
    o.connect(g);
    g.connect(this.audio.destination);
    g.gain.value = 0.02;
    o.start();
    o.stop(this.audio.currentTime + dur);
  }

  update(dt) {
    this.hitstop = Math.max(0, this.hitstop - dt);
    for (const d of this.damageNumbers) {
      d.y -= 16 * dt;
      d.ttl -= dt;
    }
    this.damageNumbers = this.damageNumbers.filter((d) => d.ttl > 0);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.ttl -= dt;
    }
    this.particles = this.particles.filter((p) => p.ttl > 0);
  }

  render(ctx, camera) {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.ttl / 0.35);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - camera.x, p.y - camera.y, 3, 3);
    }
    ctx.restore();

    ctx.fillStyle = "#fff";
    ctx.font = "12px Arial";
    for (const d of this.damageNumbers) {
      ctx.fillStyle = d.player ? "#8cc7ff" : "#ffe197";
      ctx.fillText(`${Math.floor(d.amount)}`, d.x - camera.x, d.y - camera.y);
    }
  }
}

export class AISystem {
  constructor() {
    this.tickRate = 1 / 12;
    this.acc = 0;
  }

  update(dt, hostiles, world, player, camera, viewport) {
    this.acc += dt;
    const shouldThink = this.acc >= this.tickRate;
    if (shouldThink) this.acc = 0;

    for (const enemy of hostiles) {
      const onScreen = enemy.x > camera.x - 120 && enemy.y > camera.y - 120 && enemy.x < camera.x + viewport.w + 120 && enemy.y < camera.y + viewport.h + 120;
      const nearPlayer = distance(enemy, player) < 420;
      if (!onScreen && !nearPlayer) continue;
      enemy.update(dt, world, player, shouldThink);
    }
  }
}

export class SaveSystem {
  constructor(key = "navigateur-game-save-v1") {
    this.key = key;
  }

  save(player, settings) {
    const payload = { version: 1, player: { x: player.x, y: player.y, hp: player.hp, level: player.level, xp: player.xp }, settings };
    localStorage.setItem(this.key, JSON.stringify(payload));
  }

  load(player) {
    const raw = localStorage.getItem(this.key);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      if (data.version !== 1 || !data.player) return null;
      player.x = Number(data.player.x) || player.x;
      player.y = Number(data.player.y) || player.y;
      player.health.current = Number(data.player.hp) || player.health.current;
      player.level = Number(data.player.level) || player.level;
      player.xp = Number(data.player.xp) || player.xp;
      return data;
    } catch {
      localStorage.removeItem(this.key);
      return null;
    }
  }
}

export function resolveStateFromUI(gameState, ui, input) {
  if (input.consume("pause")) {
    if (gameState.is(GAME_STATES.PAUSED)) gameState.setState(GAME_STATES.PLAYING);
    else gameState.setState(GAME_STATES.PAUSED);
  }

  if (input.consume("inventory") && gameState.is(GAME_STATES.PLAYING)) gameState.setState(GAME_STATES.INVENTORY);
  else if (input.consume("inventory") && gameState.is(GAME_STATES.INVENTORY)) gameState.setState(GAME_STATES.PLAYING);

  if (input.consume("continue") && gameState.is(GAME_STATES.DIALOGUE)) {
    ui.continueDialogue();
    gameState.setState(GAME_STATES.PLAYING);
  }
}
