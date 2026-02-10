import { clamp, distance, normalize, rectsOverlap } from "./utils.js";

class BaseEntity {
  constructor(x, y, w = 24, h = 24) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }

  get rect() {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }

  tryMove(dx, dy, world) {
    const next = { x: this.rect.x + dx, y: this.rect.y + dy, w: this.w, h: this.h };
    if (next.x < 0 || next.y < 0 || next.x + next.w > world.width || next.y + next.h > world.height) return;
    for (const o of world.obstacles) {
      if (rectsOverlap(next, o)) return;
    }
    this.x += dx;
    this.y += dy;
  }

  drawBody(ctx, camera, color, flash = false) {
    ctx.fillStyle = flash ? "#ffffff" : color;
    ctx.fillRect(this.rect.x - camera.x, this.rect.y - camera.y, this.w, this.h);
  }
}

export class Player extends BaseEntity {
  constructor(x, y) {
    super(x, y, 24, 24);
    this.maxHp = 100;
    this.hp = this.maxHp;
    this.walkSpeed = 130;
    this.runSpeed = 215;
    this.invulnerable = 0;
    this.attackCooldown = 0;
    this.respawn = { x, y };
    this.inventory = [
      { id: "potion", name: "Potion de soin", description: "+35 PV", count: 3 },
      { id: "key", name: "Clé rouillée", description: "Ouvre une porte ancienne", count: 1 },
    ];
  }

  update(dt, input, world) {
    const dirX = (input.states.right ? 1 : 0) - (input.states.left ? 1 : 0);
    const dirY = (input.states.down ? 1 : 0) - (input.states.up ? 1 : 0);
    const norm = normalize(dirX, dirY);
    const speed = input.states.run ? this.runSpeed : this.walkSpeed;

    this.tryMove(norm.x * speed * dt, 0, world);
    this.tryMove(0, norm.y * speed * dt, world);

    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
  }

  tryAttack(enemies) {
    if (this.attackCooldown > 0) return false;
    this.attackCooldown = 0.35;

    const attackRange = 42;
    let hit = false;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (distance(this, e) <= attackRange) {
        e.takeDamage(24);
        hit = true;
      }
    }
    return hit;
  }

  takeDamage(amount) {
    if (this.invulnerable > 0) return;
    this.hp = clamp(this.hp - amount, 0, this.maxHp);
    this.invulnerable = 0.5;
  }

  useItem(index) {
    const item = this.inventory[index];
    if (!item || item.count <= 0) return false;
    if (item.id === "potion") {
      this.hp = clamp(this.hp + 35, 0, this.maxHp);
      item.count -= 1;
      return true;
    }
    return false;
  }

  isDead() {
    return this.hp <= 0;
  }

  respawnAtStart() {
    this.x = this.respawn.x;
    this.y = this.respawn.y;
    this.hp = this.maxHp;
    this.invulnerable = 1;
  }

  render(ctx, camera) {
    const blinking = this.invulnerable > 0 && Math.floor(this.invulnerable * 16) % 2 === 0;
    this.drawBody(ctx, camera, "#69a7ff", blinking);
  }
}

export class Npc extends BaseEntity {
  constructor({ x, y, name, dialogue, mobile = false }) {
    super(x, y, 24, 24);
    this.name = name;
    this.dialogue = dialogue;
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
    const speed = 35;
    this.tryMove(Math.cos(this.direction) * speed * dt, 0, world);
    this.tryMove(0, Math.sin(this.direction) * speed * dt, world);
  }

  render(ctx, camera) {
    this.drawBody(ctx, camera, "#f5e9a7");
  }
}

export class Enemy extends BaseEntity {
  constructor(x, y) {
    super(x, y, 24, 24);
    this.maxHp = 55;
    this.hp = this.maxHp;
    this.alive = true;
    this.roamDir = Math.random() * Math.PI * 2;
    this.roamTimer = Math.random() * 2;
    this.hitFlash = 0;
    this.damageCooldown = 0;
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.hitFlash = 0.2;
    if (this.hp <= 0) {
      this.alive = false;
    }
  }

  update(dt, world, player) {
    if (!this.alive) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.damageCooldown = Math.max(0, this.damageCooldown - dt);

    const d = distance(this, player);
    let dir;
    let speed;

    if (d < 180) {
      dir = normalize(player.x - this.x, player.y - this.y);
      speed = 85;
    } else {
      this.roamTimer -= dt;
      if (this.roamTimer <= 0) {
        this.roamTimer = 1.5 + Math.random() * 2;
        this.roamDir = Math.random() * Math.PI * 2;
      }
      dir = { x: Math.cos(this.roamDir), y: Math.sin(this.roamDir) };
      speed = 48;
    }

    this.tryMove(dir.x * speed * dt, 0, world);
    this.tryMove(0, dir.y * speed * dt, world);

    if (distance(this, player) < 25 && this.damageCooldown <= 0) {
      player.takeDamage(12);
      this.damageCooldown = 0.8;
    }
  }

  render(ctx, camera) {
    if (!this.alive) return;
    this.drawBody(ctx, camera, "#c94747", this.hitFlash > 0);

    const bw = this.w;
    const x = this.rect.x - camera.x;
    const y = this.rect.y - camera.y - 8;
    ctx.fillStyle = "#231e1e";
    ctx.fillRect(x, y, bw, 4);
    ctx.fillStyle = "#73cf73";
    ctx.fillRect(x, y, (bw * this.hp) / this.maxHp, 4);
  }
}
