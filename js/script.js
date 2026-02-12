import { Input } from "./input.js";
import { World } from "./world.js";
import { Enemy, Npc, Player } from "./entities.js";
import { UI } from "./ui.js";
import { EventBus, EVENTS } from "./core/eventBus.js";
import { GameStateManager, GAME_STATES } from "./core/gameStateManager.js";
import { AISystem, CameraSystem, CombatSystem, InteractionSystem, SaveSystem, resolveStateFromUI } from "./systems/gameSystems.js";

function mustCanvas(id) {
  const c = document.getElementById(id);
  if (!c) throw new Error(`Missing canvas #${id}`);
  return c;
}

const canvas = mustCanvas("gameCanvas");
const minimapCanvas = mustCanvas("minimapCanvas");
const ctx = canvas.getContext("2d");
const minimapCtx = minimapCanvas.getContext("2d");
if (!ctx || !minimapCtx) throw new Error("Unable to initialize canvas context.");

const eventBus = new EventBus();
const world = new World();
const player = new Player(960, 480);
const input = new Input("azerty");
const gameState = new GameStateManager();
const ui = new UI(player, eventBus);
const interactionSystem = new InteractionSystem(eventBus);
const combatSystem = new CombatSystem(eventBus);
const aiSystem = new AISystem();
const cameraSystem = new CameraSystem(canvas, world);
const saveSystem = new SaveSystem();

const interactables = [
  new Npc({ x: 1200, y: 520, name: "Garde", dialogue: "Le village est à l'est. Les ruines sont dangereuses." }),
  new Npc({ x: 2000, y: 900, name: "Marchande", dialogue: "Reviens avec plus de trésors.", mobile: true }),
  new Npc({ x: 2450, y: 680, name: "Ermite", dialogue: "Le donjon cache un ancien boss...", narrative: true }),
  new Npc({ x: 1780, y: 760, name: "Voyageur", dialogue: "Des ressources poussent près du pont." }),
];

const hostiles = [
  new Enemy(820, 300, "scout"),
  new Enemy(1020, 240),
  new Enemy(1400, 1120, "brute"),
  new Enemy(1750, 820),
  new Enemy(2700, 720, "brute"),
  new Enemy(2800, 360),
  new Enemy(2500, 1300, "scout"),
  new Enemy(2280, 620),
  new Enemy(2380, 590),
];

const bootSave = saveSystem.load(player);
if (bootSave?.settings) eventBus.emit(EVENTS.SETTINGS_UPDATED, { settings: bootSave.settings });

eventBus.on(EVENTS.NPC_INTERACTED, ({ npc }) => {
  ui.showDialogue(npc.name, npc.dialogue, npc.narrative ? 999 : 3, npc.narrative);
  gameState.setState(npc.narrative ? GAME_STATES.DIALOGUE : GAME_STATES.PLAYING);
});

eventBus.on(EVENTS.RESOURCE_COLLECTED, ({ node }) => {
  player.inventory.push({ id: `resource-${node.kind}`, name: node.kind, description: "Ressource artisanale", count: 1 });
  eventBus.emit(EVENTS.INVENTORY_UPDATED);
  ui.showDialogue("Récolte", `${node.kind} collecté.`);
});

eventBus.on(EVENTS.ENEMY_KILLED, ({ xp }) => {
  player.gainXp(xp);
  if (player.level >= 2) eventBus.emit(EVENTS.OBJECTIVE_UPDATED, { text: "Explorer le donjon et trouver la relique." });
});

eventBus.on(EVENTS.PLAYER_DAMAGED, ({ amount }) => {
  ui.showDialogue("Combat", `Vous subissez ${amount} dégâts !`, 0.9);
});

let camera = cameraSystem.camera;
let accumulator = 0;
let last = performance.now();
const fixedDt = 1 / 60;

function updateGameplay(dt) {
  resolveStateFromUI(gameState, ui, input);

  if (gameState.is(GAME_STATES.DEAD)) {
    if (input.consume("continue")) {
      player.respawnAtStart();
      ui.hideDeathRecap();
      gameState.setState(GAME_STATES.PLAYING);
    }
    return;
  }

  if (gameState.is(GAME_STATES.PAUSED) || gameState.is(GAME_STATES.INVENTORY) || gameState.is(GAME_STATES.DIALOGUE)) {
    return;
  }

  if (input.consume("interact")) interactionSystem.interact(player, interactables, world);

  if (input.consume("attack")) {
    const ok = player.beginAttack();
    if (!ok) ui.showDialogue("Combat", "Pas assez d'endurance ou arme en récupération.", 0.9);
    else eventBus.emit(EVENTS.PLAYER_ATTACKED, { facing: player.facing });
  }

  player.update(dt, input, world);
  for (const npc of interactables) npc.update(dt, world);

  aiSystem.update(dt, hostiles, world, player, camera, { w: canvas.width, h: canvas.height });

  const attackResult = player.resolveAttack(hostiles, eventBus);
  if (player.attack.pending && attackResult.hit === false && player.attack.windup <= 0) {
    ui.showDialogue("Combat", "Aucune cible dans le cône.", 0.8);
  }

  for (const enemy of hostiles) {
    if (!enemy.alive) continue;
    if (enemy.attackTimer > 0 && enemy.attackTimer < 0.89 && enemy.attackTimer > 0.84) {
      const gotHit = player.takeDamage(enemy.archetype === "brute" ? 16 : 11);
      if (gotHit) eventBus.emit(EVENTS.PLAYER_DAMAGED, { amount: enemy.archetype === "brute" ? 16 : 11, player });
    }
  }

  if (player.isDead()) {
    gameState.setState(GAME_STATES.DEAD);
    ui.markDead(player.recentDamage);
    eventBus.emit(EVENTS.PLAYER_DIED, { player });
  }

  camera = cameraSystem.update(dt, player);

  if (Math.random() < 0.003) saveSystem.save(player, ui.settings);
}

function updateUI(dt) {
  ui.setZone(world.getZoneLabelAt(player.x, player.y));
  ui.update(dt, gameState.current);
  ui.renderInventory();
  combatSystem.update(dt);
}

function renderAttackTelegraph() {
  if (player.attack.cooldown <= 0.35) return;
  ctx.strokeStyle = "#fff4a4";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(player.x - camera.x, player.y - camera.y);
  ctx.arc(player.x - camera.x, player.y - camera.y, player.attack.range, player.facing - player.attack.cone / 2, player.facing + player.attack.cone / 2);
  ctx.closePath();
  ctx.stroke();
}

function renderWorldHints() {
  for (const node of world.resourceNodes) {
    if (node.collected) continue;
    ctx.fillStyle = "#ffe38f";
    ctx.fillRect(node.x - camera.x - 5, node.y - camera.y - 5, 10, 10);
  }
  for (const marker of world.objectiveMarkers) {
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(marker.x - camera.x - 7, marker.y - camera.y - 7, 14, 14);
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  world.render(ctx, camera, canvas.width, canvas.height, ui.settings.highContrast);

  for (const npc of interactables) npc.render(ctx, camera);
  for (const enemy of hostiles) enemy.render(ctx, camera);
  player.render(ctx, camera);
  renderWorldHints();
  renderAttackTelegraph();
  combatSystem.render(ctx, camera);

  world.renderMinimap(minimapCtx, player, interactables, hostiles);
}

function frame(now) {
  const frameDt = Math.min((now - last) / 1000, 0.05);
  last = now;
  accumulator += frameDt;

  while (accumulator >= fixedDt) {
    const simDt = combatSystem.hitstop > 0 ? fixedDt * 0.1 : fixedDt;
    updateGameplay(simDt);
    updateUI(simDt);
    input.endFrame();
    accumulator -= fixedDt;
  }

  render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
