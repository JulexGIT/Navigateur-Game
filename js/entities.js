import { angleFromVector, clamp, distance, isInCone, normalize } from "./utils.js";

class HealthComponent {
  constructor(max) {
    this.max = max;
    this.current = max;
    this.invulnerable = 0;
  }
  tick(dt) { this.invulnerable = Math.max(0, this.invulnerable - dt); }
}

class MoverComponent {
  constructor() {
    this.vx = 0;
    this.vy = 0;
  }
}

class ColliderComponent {
  constructor(w, h) {
    this.w = w;
    this.h = h;
  }
}

class BrainComponent {
  constructor() {
    this.state = "idle";
    this.timer = 0;
  }
}

class BaseEntity {
  constructor(x, y, w = 24, h = 24) {
    this.x = x;
    this.y = y;
    this.collider = new ColliderComponent(w, h);
    this.mover = new MoverComponent();
    this.wallSlide = 0.2;
  }

  get w() { return this.collider.w; }
  get h() { return this.collider.h; }

  get rect() {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }

  tryMove(dx, dy, world) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8));
    const sx = dx / steps;
    const sy = dy / steps;
    for (let i = 0; i < steps; i += 1) {
      const nextX = { ...this.rect, x: this.rect.x + sx };
      if (!world.collidesRect(nextX)) this.x += sx;
      else this.mover.vx *= this.wallSlide;

      const nextY = { ...this.rect, y: this.rect.y + sy };
      if (!world.collidesRect(nextY)) this.y += sy;
      else this.mover.vy *= this.wallSlide;
    }
  }

  drawBody(ctx, camera, color, flash = false) {
    ctx.fillStyle = flash ? "#ffffff" : color;
    ctx.fillRect(this.rect.x - camera.x, this.rect.y - camera.y, this.w, this.h);
  }
}

export class Player extends BaseEntity {
  constructor(x, y) {
    super(x, y, 24, 24);
    this.health = new HealthComponent(100);
    this.walkSpeed = 155;
    this.runSpeed = 235;
    this.acceleration = 980;
    this.friction = 860;
    this.respawn = { x, y };
    this.inventory = [
      { id: "potion", name: "Potion de soin", description: "+35 PV", count: 3 },
      { id: "key", name: "Clé rouillée", description: "Ouvre une porte ancienne", count: 1 },
    ];
    this.facing = 0;
    this.attack = { cooldown: 0, windup: 0, range: 62, cone: Math.PI / 2.5, pending: false };
    this.stamina = { max: 100, current: 100, regen: 24 };
    this.xp = 0;
    this.level = 1;
    this.skillPoints = 0;
    this.recentDamage = 0;
  }

  get maxHp() { return this.health.max; }
  get hp() { return this.health.current; }

  update(dt, input, world) {
    const dirX = (input.states.right ? 1 : 0) - (input.states.left ? 1 : 0);
    const dirY = (input.states.down ? 1 : 0) - (input.states.up ? 1 : 0);
    const dir = normalize(dirX, dirY);
    const running = input.states.run && this.stamina.current > 1;
    const maxSpeed = running ? this.runSpeed : this.walkSpeed;

    const targetVx = dir.x * maxSpeed;
    const targetVy = dir.y * maxSpeed;

    const approach = (current, target, accel) => {
      if (current < target) return Math.min(target, current + accel * dt);
      if (current > target) return Math.max(target, current - accel * dt);
      return current;
    };

    this.mover.vx = approach(this.mover.vx, targetVx, dirX === 0 ? this.friction : this.acceleration);
    this.mover.vy = approach(this.mover.vy, targetVy, dirY === 0 ? this.friction : this.acceleration);
    if (dirX !== 0 || dirY !== 0) this.facing = angleFromVector(dir.x, dir.y);

    this.tryMove(this.mover.vx * dt, this.mover.vy * dt, world);

    this.health.tick(dt);
    this.attack.cooldown = Math.max(0, this.attack.cooldown - dt);
    this.attack.windup = Math.max(0, this.attack.windup - dt);

    if (running) this.stamina.current = Math.max(0, this.stamina.current - 28 * dt);
    else this.stamina.current = Math.min(this.stamina.max, this.stamina.current + this.stamina.regen * dt);
  }

  beginAttack() {
    if (this.attack.cooldown > 0 || this.stamina.current < 18) return false;
    this.attack.pending = true;
    this.attack.windup = 0.09;
    this.attack.cooldown = 0.45;
    this.stamina.current = Math.max(0, this.stamina.current - 18);
    return true;
  }

  resolveAttack(hostiles, eventBus) {
    if (!this.attack.pending || this.attack.windup > 0) return { hit: false, total: 0 };
    this.attack.pending = false;
    let hits = 0;
    for (const enemy of hostiles) {
      if (!enemy.alive || enemy.iframes > 0) continue;
      if (!isInCone(this, enemy, this.facing, this.attack.cone, this.attack.range)) continue;
      enemy.takeDamage(24 + this.level * 2, eventBus);
      const kb = normalize(enemy.x - this.x, enemy.y - this.y);
      enemy.applyKnockback(kb.x * 120, kb.y * 120);
      hits += 1;
      if (hits >= 2) break;
    }
    return { hit: hits > 0, total: hits };
  }

  gainXp(amount) {
    this.xp += amount;
    const needed = 30 + (this.level - 1) * 25;
    if (this.xp >= needed) {
      this.xp -= needed;
      this.level += 1;
      this.skillPoints += 1;
      this.health.max += 12;
      this.health.current = this.health.max;
      this.walkSpeed += 4;
    }
  }

  takeDamage(amount) {
    if (this.health.invulnerable > 0) return false;
    this.health.current = clamp(this.health.current - amount, 0, this.health.max);
    this.health.invulnerable = 0.5;
    this.recentDamage = amount;
    return true;
  }

  useItem(index) {
    const item = this.inventory[index];
    if (!item || item.count <= 0) return false;
    if (item.id === "potion") {
      this.health.current = clamp(this.health.current + 35, 0, this.health.max);
      item.count -= 1;
      return true;
    }
    return false;
  }

  isDead() { return this.health.current <= 0; }

  respawnAtStart() {
    this.x = this.respawn.x;
    this.y = this.respawn.y;
    this.health.current = this.health.max;
    this.health.invulnerable = 1.5;
    this.stamina.current = this.stamina.max;
  }

  render(ctx, camera) {
    const blinking = this.health.invulnerable > 0 && Math.floor(this.health.invulnerable * 16) % 2 === 0;
    this.drawBody(ctx, camera, "#69a7ff", blinking);
    const fx = this.x - camera.x;
    const fy = this.y - camera.y;
    ctx.strokeStyle = "#cde2ff";
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + Math.cos(this.facing) * 15, fy + Math.sin(this.facing) * 15);
    ctx.stroke();
  }
}

export class Npc extends BaseEntity {
  constructor({ x, y, name, dialogue, mobile = false, narrative = false }) {
    super(x, y, 24, 24);
    this.name = name;
    this.dialogue = dialogue;
    this.narrative = narrative;
    this.mobile = mobile;
    this.direction = Math.random() * Math.PI * 2;
    this.wanderTimer = Math.random() * 3;
  }

  update(dt, world) {
    if (!this.mobile) return;
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = 2 + Math.random() * 2;
      this.direction = Math.random() * Math.PI * 2;
    }
    const speed = 32;
    this.tryMove(Math.cos(this.direction) * speed * dt, Math.sin(this.direction) * speed * dt, world);
  }

  render(ctx, camera) {
    this.drawBody(ctx, camera, "#f5e9a7");
  }
}

export class Enemy extends BaseEntity {
  constructor(x, y, archetype = "raider") {
    super(x, y, 24, 24);
    this.maxHp = archetype === "brute" ? 80 : 55;
    this.hp = this.maxHp;
    this.alive = true;
    this.hitFlash = 0;
    this.iframes = 0;
    this.brain = new BrainComponent();
    this.roamDir = Math.random() * Math.PI * 2;
    this.archetype = archetype;
    this.attackTimer = 0;
  }

  applyKnockback(x, y) {
    this.mover.vx += x;
    this.mover.vy += y;
  }

  takeDamage(amount, eventBus) {
    this.hp = Math.max(0, this.hp - amount);
    this.hitFlash = 0.18;
    this.iframes = 0.15;
    eventBus?.emit("ENEMY_DAMAGED", { enemy: this, amount });
    if (this.hp <= 0) {
      this.alive = false;
      eventBus?.emit("ENEMY_KILLED", { enemy: this, xp: this.archetype === "brute" ? 24 : 16 });
    }
  }

  update(dt, world, player, shouldThink = true) {
    if (!this.alive) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.iframes = Math.max(0, this.iframes - dt);
    this.attackTimer = Math.max(0, this.attackTimer - dt);

    if (shouldThink) {
      const d = distance(this, player);
      if (d > 360) this.brain.state = "patrol";
      else if (d > 42) this.brain.state = "chase";
      else if (this.attackTimer <= 0) this.brain.state = "attack";
      else this.brain.state = "recover";
    }

    if (this.brain.state === "patrol") {
      this.brain.timer -= dt;
      if (this.brain.timer <= 0) {
        this.brain.timer = 1 + Math.random() * 2;
        this.roamDir = Math.random() * Math.PI * 2;
      }
      this.mover.vx = Math.cos(this.roamDir) * 45;
      this.mover.vy = Math.sin(this.roamDir) * 45;
    } else if (this.brain.state === "chase") {
      const dir = normalize(player.x - this.x, player.y - this.y);
      const speed = this.archetype === "scout" ? 105 : 82;
      this.mover.vx = dir.x * speed;
      this.mover.vy = dir.y * speed;
    } else if (this.brain.state === "attack") {
      this.mover.vx = 0;
      this.mover.vy = 0;
      if (distance(this, player) < 28) {
        const dealt = player.takeDamage(this.archetype === "brute" ? 16 : 11);
        if (dealt) player.health.invulnerable = 0.45;
      }
      this.attackTimer = this.archetype === "scout" ? 0.65 : 0.9;
    } else {
      this.mover.vx *= 0.82;
      this.mover.vy *= 0.82;
    }

    this.tryMove(this.mover.vx * dt, this.mover.vy * dt, world);
  }

  render(ctx, camera) {
    if (!this.alive) return;
    this.drawBody(ctx, camera, this.archetype === "brute" ? "#9f3b3b" : "#c94747", this.hitFlash > 0);
    const bw = this.w;
    const x = this.rect.x - camera.x;
    const y = this.rect.y - camera.y - 8;
    ctx.fillStyle = "#231e1e";
    ctx.fillRect(x, y, bw, 4);
    ctx.fillStyle = "#73cf73";
    ctx.fillRect(x, y, (bw * this.hp) / this.maxHp, 4);
  }
}
