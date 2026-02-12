import { TILE_SIZE, clamp } from "./utils.js";

const ZONES = {
  plain: { color: "#8fcf6a", label: "Plaine" },
  forest: { color: "#4f9851", label: "Forêt" },
  village: { color: "#b79d76", label: "Village" },
  dungeon: { color: "#4b4b62", label: "Donjon" },
  water: { color: "#4f8dd6", label: "Eau" },
  cliff: { color: "#6b665d", label: "Falaise" },
};

export class World {
  constructor(cols = 90, rows = 70) {
    this.cols = cols;
    this.rows = rows;
    this.width = cols * TILE_SIZE;
    this.height = rows * TILE_SIZE;
    this.tiles = new Array(cols * rows).fill("plain");
    this.solidColliders = new Set();
    this.resourceNodes = [];
    this.loreSpots = [];
    this.objectiveMarkers = [];
    this.minimapCache = document.createElement("canvas");
    this.minimapCache.width = 180;
    this.minimapCache.height = 120;
    this._generate();
    this._buildMinimapCache();
  }

  _index(tx, ty) { return ty * this.cols + tx; }
  _key(tx, ty) { return `${tx},${ty}`; }

  _noise(tx, ty) {
    const n = Math.sin(tx * 12.9898 + ty * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  _setTile(tx, ty, type) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return;
    this.tiles[this._index(tx, ty)] = type;
  }

  _setSolid(tx, ty, solid = true) {
    const key = this._key(tx, ty);
    if (solid) this.solidColliders.add(key);
    else this.solidColliders.delete(key);
  }

  _generate() {
    for (let ty = 0; ty < this.rows; ty += 1) {
      for (let tx = 0; tx < this.cols; tx += 1) {
        const nx = tx / this.cols;
        const ny = ty / this.rows;
        const n = this._noise(tx * 0.8, ty * 0.8) + this._noise(tx * 0.17, ty * 0.15) * 0.6;
        let type = "plain";
        if (n > 1.12 || nx < 0.18) type = "forest";
        if (ny > 0.68 && n < 0.72) type = "water";
        if (nx > 0.72 && ny < 0.32) type = "village";
        if (nx > 0.76 && ny > 0.42) type = "dungeon";
        if (n < 0.28 && ny > 0.4 && ny < 0.62) type = "cliff";
        this._setTile(tx, ty, type);
        if (type === "water" || type === "cliff") this._setSolid(tx, ty, true);
      }
    }

    for (let tx = 0; tx < this.cols; tx += 1) {
      this._setSolid(tx, 0, true);
      this._setSolid(tx, this.rows - 1, true);
    }
    for (let ty = 0; ty < this.rows; ty += 1) {
      this._setSolid(0, ty, true);
      this._setSolid(this.cols - 1, ty, true);
    }

    const bridgeTiles = [[42, 48], [43, 48], [44, 48], [45, 48], [46, 48], [47, 48]];
    for (const [tx, ty] of bridgeTiles) {
      this._setTile(tx, ty, "plain");
      this._setSolid(tx, ty, false);
    }

    this.resourceNodes = [
      { x: 880, y: 820, kind: "Herbe", collected: false },
      { x: 1260, y: 640, kind: "Minerai", collected: false },
      { x: 1750, y: 1020, kind: "Herbe", collected: false },
      { x: 2130, y: 780, kind: "Relique", collected: false },
    ];
    this.loreSpots = [
      { x: 2300, y: 560, text: "Une stèle évoque un ancien roi déchu." },
      { x: 1480, y: 1240, text: "Des runes parlent d'un pont des âmes." },
    ];
    this.objectiveMarkers = [{ x: 2300, y: 560, label: "Stèle ancienne" }];
  }

  getTileAt(x, y) {
    const tx = clamp(Math.floor(x / TILE_SIZE), 0, this.cols - 1);
    const ty = clamp(Math.floor(y / TILE_SIZE), 0, this.rows - 1);
    return this.tiles[this._index(tx, ty)];
  }

  getZoneLabelAt(x, y) {
    return ZONES[this.getTileAt(x, y)]?.label ?? "Inconnu";
  }

  collidesRect(rect) {
    const startX = clamp(Math.floor(rect.x / TILE_SIZE), 0, this.cols - 1);
    const endX = clamp(Math.floor((rect.x + rect.w) / TILE_SIZE), 0, this.cols - 1);
    const startY = clamp(Math.floor(rect.y / TILE_SIZE), 0, this.rows - 1);
    const endY = clamp(Math.floor((rect.y + rect.h) / TILE_SIZE), 0, this.rows - 1);
    for (let ty = startY; ty <= endY; ty += 1) {
      for (let tx = startX; tx <= endX; tx += 1) {
        if (this.solidColliders.has(this._key(tx, ty))) return true;
      }
    }
    return false;
  }

  render(ctx, camera, screenW, screenH, highContrast = false) {
    const startX = clamp(Math.floor(camera.x / TILE_SIZE), 0, this.cols - 1);
    const startY = clamp(Math.floor(camera.y / TILE_SIZE), 0, this.rows - 1);
    const endX = clamp(Math.ceil((camera.x + screenW) / TILE_SIZE), 0, this.cols - 1);
    const endY = clamp(Math.ceil((camera.y + screenH) / TILE_SIZE), 0, this.rows - 1);

    for (let ty = startY; ty <= endY; ty += 1) {
      for (let tx = startX; tx <= endX; tx += 1) {
        const type = this.tiles[this._index(tx, ty)];
        const zone = ZONES[type];
        ctx.fillStyle = highContrast ? (type === "water" || type === "cliff" ? "#111" : "#ddd") : zone.color;
        ctx.fillRect(tx * TILE_SIZE - camera.x, ty * TILE_SIZE - camera.y, TILE_SIZE, TILE_SIZE);
        if (type === "forest") {
          ctx.fillStyle = "rgba(25, 40, 25, 0.2)";
          ctx.fillRect(tx * TILE_SIZE - camera.x + 8, ty * TILE_SIZE - camera.y + 8, 12, 12);
        }
      }
    }
  }

  _buildMinimapCache() {
    const ctx = this.minimapCache.getContext("2d");
    const sx = this.minimapCache.width / this.width;
    const sy = this.minimapCache.height / this.height;
    for (let ty = 0; ty < this.rows; ty += 1) {
      for (let tx = 0; tx < this.cols; tx += 1) {
        const type = this.tiles[this._index(tx, ty)];
        ctx.fillStyle = ZONES[type].color;
        ctx.fillRect(tx * TILE_SIZE * sx, ty * TILE_SIZE * sy, Math.ceil(TILE_SIZE * sx), Math.ceil(TILE_SIZE * sy));
      }
    }
  }

  renderMinimap(ctx, player, interactables, hostiles) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.minimapCache, 0, 0);
    const sx = w / this.width;
    const sy = h / this.height;

    for (const npc of interactables) {
      ctx.fillStyle = "#f2f2f2";
      ctx.fillRect(npc.x * sx, npc.y * sy, 2, 2);
    }
    for (const enemy of hostiles) {
      if (!enemy.alive) continue;
      ctx.fillStyle = "#df5d5d";
      ctx.fillRect(enemy.x * sx, enemy.y * sy, 2, 2);
    }
    ctx.fillStyle = "#69a7ff";
    ctx.fillRect(player.x * sx - 2, player.y * sy - 2, 4, 4);
  }
}
