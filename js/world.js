import { TILE_SIZE, clamp } from "./utils.js";

const ZONES = {
  plain: { color: "#8fcf6a", label: "Plaine" },
  forest: { color: "#4f9851", label: "Forêt" },
  village: { color: "#b79d76", label: "Village" },
  dungeon: { color: "#4b4b62", label: "Donjon" },
  water: { color: "#4f8dd6", label: "Eau" },
  wall: { color: "#707d8d", label: "Mur" },
};

export class World {
  constructor(cols = 90, rows = 70) {
    this.cols = cols;
    this.rows = rows;
    this.width = cols * TILE_SIZE;
    this.height = rows * TILE_SIZE;
    this.tiles = new Array(cols * rows).fill("plain");
    this.obstacles = [];
    this._generate();
  }

  _index(tx, ty) {
    return ty * this.cols + tx;
  }

  _setTile(tx, ty, type) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return;
    this.tiles[this._index(tx, ty)] = type;
  }

  _fillRect(tx, ty, tw, th, type) {
    for (let y = ty; y < ty + th; y += 1) {
      for (let x = tx; x < tx + tw; x += 1) {
        this._setTile(x, y, type);
      }
    }
  }

  _addObstacle(tx, ty, tw = 1, th = 1) {
    this.obstacles.push({ x: tx * TILE_SIZE, y: ty * TILE_SIZE, w: tw * TILE_SIZE, h: th * TILE_SIZE });
  }

  _generate() {
    this._fillRect(0, 0, 27, this.rows, "forest");
    this._fillRect(27, 0, 30, this.rows, "plain");
    this._fillRect(57, 0, 18, this.rows, "village");
    this._fillRect(75, 0, 15, this.rows, "dungeon");

    this._fillRect(0, 27, 55, 5, "water");
    for (let x = 0; x < 55; x += 1) {
      this._addObstacle(x, 27);
      this._addObstacle(x, 31);
    }

    for (let i = 0; i < 140; i += 1) {
      const tx = Math.floor(Math.random() * 24) + 2;
      const ty = Math.floor(Math.random() * (this.rows - 4)) + 2;
      this._addObstacle(tx, ty);
    }

    this._fillRect(57, 20, 12, 12, "wall");
    for (let x = 57; x < 69; x += 1) {
      this._addObstacle(x, 20);
      this._addObstacle(x, 31);
    }
    for (let y = 20; y < 32; y += 1) {
      this._addObstacle(57, y);
      this._addObstacle(68, y);
    }

    for (let y = 0; y < this.rows; y += 1) {
      this._addObstacle(75, y);
    }
    for (let x = 75; x < this.cols; x += 1) {
      this._addObstacle(x, 15);
      this._addObstacle(x, 45);
    }
  }

  getTileAt(x, y) {
    const tx = clamp(Math.floor(x / TILE_SIZE), 0, this.cols - 1);
    const ty = clamp(Math.floor(y / TILE_SIZE), 0, this.rows - 1);
    return this.tiles[this._index(tx, ty)];
  }

  getZoneLabelAt(x, y) {
    return ZONES[this.getTileAt(x, y)].label;
  }

  render(ctx, camera, screenW, screenH) {
    const startX = clamp(Math.floor(camera.x / TILE_SIZE), 0, this.cols - 1);
    const startY = clamp(Math.floor(camera.y / TILE_SIZE), 0, this.rows - 1);
    const endX = clamp(Math.ceil((camera.x + screenW) / TILE_SIZE), 0, this.cols - 1);
    const endY = clamp(Math.ceil((camera.y + screenH) / TILE_SIZE), 0, this.rows - 1);

    for (let ty = startY; ty <= endY; ty += 1) {
      for (let tx = startX; tx <= endX; tx += 1) {
        const type = this.tiles[this._index(tx, ty)];
        ctx.fillStyle = ZONES[type].color;
        ctx.fillRect(tx * TILE_SIZE - camera.x, ty * TILE_SIZE - camera.y, TILE_SIZE, TILE_SIZE);
      }
    }

    ctx.fillStyle = "#2f3f50";
    for (const o of this.obstacles) {
      if (o.x + o.w < camera.x || o.y + o.h < camera.y || o.x > camera.x + screenW || o.y > camera.y + screenH) continue;
      ctx.fillRect(o.x - camera.x, o.y - camera.y, o.w, o.h);
    }
  }

  renderMinimap(ctx, player, entities) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const sx = w / this.width;
    const sy = h / this.height;

    const zones = [
      { type: "forest", x: 0, y: 0, w: 27, h: this.rows },
      { type: "plain", x: 27, y: 0, w: 30, h: this.rows },
      { type: "village", x: 57, y: 0, w: 18, h: this.rows },
      { type: "dungeon", x: 75, y: 0, w: 15, h: this.rows },
    ];

    for (const zone of zones) {
      ctx.fillStyle = ZONES[zone.type].color;
      ctx.fillRect(zone.x * TILE_SIZE * sx, zone.y * TILE_SIZE * sy, zone.w * TILE_SIZE * sx, zone.h * TILE_SIZE * sy);
    }

    for (const npc of entities.npcs) {
      ctx.fillStyle = "#f2f2f2";
      ctx.fillRect(npc.x * sx, npc.y * sy, 2, 2);
    }
    for (const enemy of entities.enemies) {
      if (!enemy.alive) continue;
      ctx.fillStyle = "#df5d5d";
      ctx.fillRect(enemy.x * sx, enemy.y * sy, 2, 2);
    }

    ctx.fillStyle = "#69a7ff";
    ctx.fillRect(player.x * sx - 2, player.y * sy - 2, 4, 4);
  }
}
