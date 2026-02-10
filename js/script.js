import { Input } from "./input.js";
import { World } from "./world.js";
import { Enemy, Npc, Player } from "./entities.js";
import { clamp, distance } from "./utils.js";
import { UI } from "./ui.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const minimapCanvas = document.getElementById("minimapCanvas");
const minimapCtx = minimapCanvas.getContext("2d");

const world = new World();
const player = new Player(960, 480);
const input = new Input();
const ui = new UI(player);

const npcs = [
  new Npc({ x: 1200, y: 520, name: "Garde", dialogue: "Le village est à l'est. Les ruines sont dangereuses." }),
  new Npc({ x: 2000, y: 900, name: "Marchande", dialogue: "Reviens avec plus de trésors.", mobile: true }),
  new Npc({ x: 2450, y: 680, name: "Ermite", dialogue: "Le donjon cache un ancien boss..." }),
];

const enemies = [
  new Enemy(820, 300),
  new Enemy(1020, 240),
  new Enemy(1400, 1120),
  new Enemy(1750, 820),
  new Enemy(2700, 720),
  new Enemy(2800, 360),
  new Enemy(2500, 1300),
];

const entities = { npcs, enemies };

const camera = { x: 0, y: 0 };
let paused = false;
let last = performance.now();

function interact() {
  const allNpcs = npcs;
  let closest = null;
  let closestDistance = 72;

  for (const npc of allNpcs) {
    const d = distance(player, npc);
    if (d < closestDistance) {
      closestDistance = d;
      closest = npc;
    }
  }

  if (closest) {
    ui.showDialogue(closest.name, closest.dialogue);
  } else {
    ui.showDialogue("Système", "Personne à proximité.", 1.5);
  }
}

function update(dt) {
  if (input.consume("pause")) {
    paused = !paused;
    ui.setPaused(paused);
  }
  if (paused) return;

  if (input.consume("inventory")) {
    ui.toggleInventory();
  }

  if (input.consume("interact")) {
    interact();
  }

  if (input.consume("attack")) {
    const hit = player.tryAttack(enemies);
    if (!hit) ui.showDialogue("Combat", "Aucune cible à portée.", 1);
  }

  if (!ui.isInventoryOpen()) {
    player.update(dt, input, world);
  }

  for (const npc of npcs) npc.update(dt, world);
  for (const enemy of enemies) enemy.update(dt, world, player);

  if (player.isDead()) {
    ui.showDialogue("Système", "Vous êtes mort... Respawn.", 2);
    player.respawnAtStart();
  }

  camera.x = clamp(player.x - canvas.width / 2, 0, world.width - canvas.width);
  camera.y = clamp(player.y - canvas.height / 2, 0, world.height - canvas.height);

  ui.setZone(world.getZoneLabelAt(player.x, player.y));
  ui.update(dt);
  ui.renderInventory();
}

function renderAttackIndicator() {
  if (player.attackCooldown > 0.22) {
    ctx.strokeStyle = "#fff4a4";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x - camera.x, player.y - camera.y, 42, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  world.render(ctx, camera, canvas.width, canvas.height);

  for (const npc of npcs) npc.render(ctx, camera);
  for (const enemy of enemies) enemy.render(ctx, camera);
  player.render(ctx, camera);
  renderAttackIndicator();

  world.renderMinimap(minimapCtx, player, entities);
}

function gameLoop(now) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;

  update(dt);
  render();
  input.endFrame();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
