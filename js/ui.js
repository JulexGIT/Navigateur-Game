export class UI {
  constructor(player) {
    this.zoneName = document.getElementById("zoneName");
    this.healthFill = document.getElementById("healthFill");
    this.healthText = document.getElementById("healthText");
    this.dialogueBox = document.getElementById("dialogueBox");
    this.dialogueSpeaker = document.getElementById("dialogueSpeaker");
    this.dialogueText = document.getElementById("dialogueText");
    this.inventoryPanel = document.getElementById("inventoryPanel");
    this.inventoryList = document.getElementById("inventoryList");
    this.pauseMenu = document.getElementById("pauseMenu");
    this.player = player;

    this.dialogueTimer = 0;
    this.renderInventory();
  }

  setZone(name) {
    this.zoneName.textContent = name;
  }

  update(dt) {
    const pct = (this.player.hp / this.player.maxHp) * 100;
    this.healthFill.style.width = `${pct}%`;
    this.healthText.textContent = `${Math.floor(this.player.hp)} / ${this.player.maxHp}`;

    this.dialogueTimer -= dt;
    if (this.dialogueTimer <= 0) {
      this.dialogueBox.classList.add("hidden");
    }
  }

  showDialogue(name, text, duration = 3) {
    this.dialogueSpeaker.textContent = name;
    this.dialogueText.textContent = text;
    this.dialogueBox.classList.remove("hidden");
    this.dialogueTimer = duration;
  }

  toggleInventory() {
    this.inventoryPanel.classList.toggle("hidden");
    this.renderInventory();
  }

  closeInventory() {
    this.inventoryPanel.classList.add("hidden");
  }

  isInventoryOpen() {
    return !this.inventoryPanel.classList.contains("hidden");
  }

  setPaused(paused) {
    this.pauseMenu.classList.toggle("hidden", !paused);
  }

  renderInventory() {
    this.inventoryList.innerHTML = "";
    this.player.inventory.forEach((item, index) => {
      const li = document.createElement("li");
      li.textContent = `${item.name} x${item.count} — ${item.description}`;
      li.addEventListener("click", () => {
        if (this.player.useItem(index)) {
          this.showDialogue("Inventaire", `${item.name} utilisé.`);
          this.renderInventory();
        }
      });
      this.inventoryList.appendChild(li);
    });
  }
}
