import { GAME_STATES } from "./core/gameStateManager.js";

function mustElement(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`UI bootstrap failed: missing #${id}`);
  return el;
}

export class UI {
  constructor(player, eventBus) {
    this.zoneName = mustElement("zoneName");
    this.healthFill = mustElement("healthFill");
    this.healthText = mustElement("healthText");
    this.staminaFill = mustElement("staminaFill");
    this.staminaText = mustElement("staminaText");
    this.cooldownText = mustElement("cooldownText");
    this.levelText = mustElement("levelText");
    this.objectiveText = mustElement("objectiveText");
    this.deathRecap = mustElement("deathRecap");

    this.dialogueBox = mustElement("dialogueBox");
    this.dialogueSpeaker = mustElement("dialogueSpeaker");
    this.dialogueText = mustElement("dialogueText");
    this.inventoryPanel = mustElement("inventoryPanel");
    this.inventoryList = mustElement("inventoryList");
    this.pauseMenu = mustElement("pauseMenu");
    this.optionsPanel = mustElement("optionsPanel");

    this.player = player;
    this.eventBus = eventBus;
    this.dialogueTimer = 0;
    this.dialogueHold = false;
    this.dialogueHistory = [];
    this.inventoryDirty = true;
    this.currentObjective = "Parler au garde puis explorer la stèle ancienne.";
    this.settings = { highContrast: false, uiScale: 1, keyboardPreset: "azerty" };

    this._bindInventoryDelegation();
    this._bindOptions();
    this._bindBus();
    this.renderInventory();
  }

  _bindBus() {
    this.eventBus.on("INVENTORY_UPDATED", () => { this.inventoryDirty = true; });
    this.eventBus.on("OBJECTIVE_UPDATED", ({ text }) => { if (text) this.currentObjective = text; });
    this.eventBus.on("SETTINGS_UPDATED", ({ settings }) => { this.settings = { ...this.settings, ...settings }; });
  }

  _bindInventoryDelegation() {
    this.inventoryList.addEventListener("click", (e) => {
      const li = e.target.closest("li[data-index]");
      if (!li) return;
      const index = Number(li.dataset.index);
      const item = this.player.inventory[index];
      if (!item) return;
      if (this.player.useItem(index)) {
        this.eventBus.emit("INVENTORY_UPDATED");
        this.showDialogue("Inventaire", `${item.name} utilisé.`);
      }
    });
  }

  _bindOptions() {
    mustElement("toggleContrast").addEventListener("click", () => {
      this.settings.highContrast = !this.settings.highContrast;
      this.eventBus.emit("SETTINGS_UPDATED", { settings: this.settings });
    });
    mustElement("increaseText").addEventListener("click", () => {
      this.settings.uiScale = Math.min(1.5, this.settings.uiScale + 0.1);
      document.documentElement.style.setProperty("--ui-scale", this.settings.uiScale.toFixed(2));
      this.eventBus.emit("SETTINGS_UPDATED", { settings: this.settings });
    });
    mustElement("decreaseText").addEventListener("click", () => {
      this.settings.uiScale = Math.max(0.8, this.settings.uiScale - 0.1);
      document.documentElement.style.setProperty("--ui-scale", this.settings.uiScale.toFixed(2));
      this.eventBus.emit("SETTINGS_UPDATED", { settings: this.settings });
    });
  }

  setZone(name) { this.zoneName.textContent = name; }

  update(dt, gameState) {
    const hpPct = (this.player.hp / this.player.maxHp) * 100;
    const stPct = (this.player.stamina.current / this.player.stamina.max) * 100;
    this.healthFill.style.width = `${hpPct}%`;
    this.healthText.textContent = `${Math.floor(this.player.hp)} / ${this.player.maxHp}`;
    this.staminaFill.style.width = `${stPct}%`;
    this.staminaText.textContent = `${Math.floor(this.player.stamina.current)} / ${this.player.stamina.max}`;
    this.cooldownText.textContent = this.player.attack.cooldown > 0 ? `${this.player.attack.cooldown.toFixed(2)}s` : "prêt";
    this.levelText.textContent = `Niv ${this.player.level} · XP ${this.player.xp}`;
    this.objectiveText.textContent = this.currentObjective;

    if (!this.dialogueHold) this.dialogueTimer -= dt;
    if (this.dialogueTimer <= 0 && !this.dialogueHold) this.dialogueBox.classList.add("hidden");

    this.pauseMenu.classList.toggle("hidden", gameState !== GAME_STATES.PAUSED);
    this.inventoryPanel.classList.toggle("hidden", gameState !== GAME_STATES.INVENTORY);
    this.optionsPanel.classList.toggle("hidden", gameState !== GAME_STATES.PAUSED);
  }

  showDialogue(name, text, duration = 3, hold = false) {
    this.dialogueSpeaker.textContent = name;
    this.dialogueText.textContent = text;
    this.dialogueBox.classList.remove("hidden");
    this.dialogueTimer = duration;
    this.dialogueHold = hold;
    this.dialogueHistory.unshift(`${name}: ${text}`);
    this.dialogueHistory = this.dialogueHistory.slice(0, 6);
    mustElement("dialogueHistory").textContent = this.dialogueHistory.join(" | ");
  }

  continueDialogue() {
    this.dialogueHold = false;
    this.dialogueTimer = 0;
    this.dialogueBox.classList.add("hidden");
  }

  markDead(lastDamage) {
    this.deathRecap.classList.remove("hidden");
    this.deathRecap.textContent = `Vous avez subi ${Math.floor(lastDamage)} dégâts fatals. Entrée/Espace pour réapparaître.`;
  }

  hideDeathRecap() { this.deathRecap.classList.add("hidden"); }

  renderInventory() {
    if (!this.inventoryDirty) return;
    this.inventoryList.innerHTML = "";
    this.player.inventory.forEach((item, index) => {
      const li = document.createElement("li");
      li.dataset.index = String(index);
      li.textContent = `${item.name} x${item.count} — ${item.description}`;
      this.inventoryList.appendChild(li);
    });
    this.inventoryDirty = false;
  }
}
