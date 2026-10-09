"use strict";
const { Plugin, PluginSettingTab, Setting, ItemView, Notice, normalizePath } = require("obsidian");
const http = require("http");
const core = require("./core");
const VIEW = "farore-scene-preview";

class SceneView extends ItemView {
  getViewType() { return VIEW; }
  getDisplayText() { return "Theros — huidige scène"; }
  getIcon() { return "image"; }
  async onOpen() { this.render(); }
  render() {
    const el = this.contentEl;
    el.empty(); el.addClass("farore-scene-preview");
    const plugin = this.plugin;
    el.createEl("h3", { text: "Theros — scènebeelden" });
    el.createEl("p", { text: plugin.status || "Wacht op een LexVoice-opname." });
    const latest = plugin.latest;
    if (latest) {
      el.createEl("h4", { text: latest.title });
      el.createEl("p", { text: `Illustratie bij ${core.time(latest.elapsed)} — concept op basis van de opname.` });
      const file = plugin.app.vault.getAbstractFileByPath(latest.path);
      if (file) el.createEl("img", { attr: { src: plugin.app.vault.getResourcePath(file), alt: latest.title } });
      const button = el.createEl("button", { text: "Open de scènegalerij" });
      button.addEventListener("click", () => plugin.openGallery(latest.gallery));
    } else el.createEl("p", { text: "Het eerste beeld volgt na tien minuten opnametijd met bruikbare transcriptie." });
    const button = el.createEl("button", { text: "Genereer scène nu" });
    button.disabled = plugin.busy;
    button.addEventListener("click", () => plugin.generate(true));
  }
}

class SceneSettings extends PluginSettingTab {
  display() {
    const el = this.containerEl; el.empty();
    el.createEl("h2", { text: "Theros — scènebeelden" });
    new Setting(el).setName("Automatische scènebeelden").setDesc("Tijdens een LexVoice-opname, volledig lokaal.")
      .addToggle(t => t.setValue(this.plugin.settings.enabled).onChange(async enabled => {
        this.plugin.settings.enabled = enabled; await this.plugin.persist();
        if (!enabled) this.plugin.cancel();
      }));
    new Setting(el).setName("Interval in minuten").setDesc("Standaard tien minuten opnametijd; pauzes tellen niet mee.")
      .addDropdown(d => {
        for (const minutes of [5, 10, 15, 20, 30]) d.addOption(String(minutes), String(minutes));
        d.setValue(String(this.plugin.settings.intervalMinutes)).onChange(async value => {
          this.plugin.settings.intervalMinutes = Number(value);
          // A new cadence starts from the current recording position, without backfilling old images.
          const snap = this.plugin.current();
          if (snap) this.plugin.runs[snap.id] = { bucket: Math.floor(snap.elapsed / (Number(value) * 60_000)), sourceEnd: snap.sourceEnd };
          await this.plugin.persist();
        });
      });
    el.createEl("p", { text: "Beelden verschijnen in een zijpaneel en in de opnamegalerij. Ze worden niet automatisch naar de Atlas VTT-spelersweergave gestuurd." });
    el.createEl("p", { text: "Stijl: schilderachtige mythologische fantasy, met de architectuur en materialen van het oude Griekenland. Een beeld blijft een artistieke interpretatie." });
    el.createEl("p", { text: "Start vóór de sessie ‘Start lokale transcriptie.command’; dit start ook de lokale beeldservice." });
  }
}

module.exports = class FaroreSceneIllustrator extends Plugin {
  async onload() {
    const data = await this.loadData() || {};
    this.settings = core.settingsFrom(data.settings);
    this.runs = data.runs || {};
    this.latest = data.latest || null;
    this.requests = new Set(); this.busy = false; this.unloaded = false;
    this.status = "Wacht op een LexVoice-opname.";
    this.registerView(VIEW, leaf => { const view = new SceneView(leaf); view.plugin = this; return view; });
    this.addSettingTab(new SceneSettings(this.app, this));
    this.addRibbonIcon("image", "Theros — scènebeelden", () => this.show());
    this.addCommand({ id: "open-scene-preview", name: "Open scènebeelden", callback: () => this.show() });
    this.addCommand({ id: "generate-current-scene", name: "Genereer de huidige scène", callback: () => this.generate(true) });
    this.registerInterval(window.setInterval(() => this.tick().catch(e => console.error("[Farore scènes]", e)), 5000));
  }
  onunload() { this.unloaded = true; this.cancel(); }
  current() {
    return this.app.plugins.plugins["farore-session-recorder"]?.getSceneSnapshot?.() || core.snapshot(this.app.plugins.plugins.lexvoice);
  }
  cancel() { for (const request of this.requests) request.destroy(new Error("Generatie gestopt.")); }
  update(message) { this.status = message; for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) leaf.view.render(); }
  async persist() {
    const entries = Object.entries(this.runs).slice(-30);
    this.runs = Object.fromEntries(entries);
    await this.saveData({ settings: this.settings, runs: this.runs, latest: this.latest });
  }
  async show() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW)[0];
    if (!leaf) { leaf = this.app.workspace.getRightLeaf(true); await leaf.setViewState({ type: VIEW, active: false }); }
    this.app.workspace.revealLeaf(leaf);
  }
  async openGallery(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file) await this.app.workspace.getLeaf(false).openFile(file);
  }
  async tick() {
    const snap = this.current();
    if (!snap || (!this.settings.enabled && !this.manualGeneration)) {
      if (this.busy) this.cancel();
      this.update(!this.settings.enabled ? "Automatische scènebeelden staan uit." : "Wacht op een lopende LexVoice-opname; pauzes tellen niet mee.");
      return;
    }
    if (this.busy) return;
    const record = this.runs[snap.id] || {};
    if (core.due(snap, record, this.settings)) await this.generate(false);
    else {
      const next = (Math.floor(snap.elapsed / (this.settings.intervalMinutes * 60_000)) + 1) * this.settings.intervalMinutes;
      this.update(`Opname loopt. Scènebeelden om de ${this.settings.intervalMinutes} minuten; volgende grens ${next}:00.`);
    }
  }
  request(url, body, timeout) {
    const target = new URL(url);
    if (target.protocol !== "http:" || target.hostname !== "127.0.0.1") return Promise.reject(new Error("Alleen lokale verwerking is toegestaan."));
    return new Promise((resolve, reject) => {
      let size = 0;
      const request = http.request(target, { method: "POST", headers: { "Content-Type": "application/json" } }, response => {
        const chunks = [];
        response.on("data", chunk => {
          size += chunk.length;
          if (size > 75_000_000) request.destroy(new Error("Het beeldantwoord is te groot."));
          else chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("aborted", () => reject(new Error("De lokale verbinding is onderbroken.")));
        response.on("end", () => {
          try {
            const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (response.statusCode !== 200 || result.error) throw new Error(result.error || `HTTP ${response.statusCode}`);
            if (result.remote_host || result.remote_model) throw new Error("Externe verwerking wordt niet gebruikt.");
            resolve(result);
          } catch (error) { reject(error); }
        });
      });
      this.requests.add(request);
      const timer = setTimeout(() => request.destroy(new Error("De lokale generatie duurde te lang.")), timeout);
      request.on("close", () => { clearTimeout(timer); this.requests.delete(request); });
      request.on("error", reject); request.end(JSON.stringify(body));
    });
  }
  async folder(path) {
    const normalized = normalizePath(path);
    if (!normalized || normalized.split("/").includes("..") || normalized.startsWith("/")) throw new Error("Ongeldige uitvoermap.");
    let current = "";
    for (const part of normalized.split("/")) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
    }
    return normalized;
  }
  async generate(manual) {
    if (this.busy || this.unloaded) return;
    const snap = this.current();
    if (!snap || snap.transcript.length < 40 || snap.elapsed - snap.sourceEnd > 120_000) {
      if (manual) new Notice("Er is nog geen recente transcriptie van een lopende opname.");
      return;
    }
    this.busy = true;
    this.manualGeneration = manual;
    const previous = this.runs[snap.id] || {};
    const bucket = Math.floor(snap.elapsed / (this.settings.intervalMinutes * 60_000));
    try {
      this.update("De huidige scène wordt uit de transcriptie gekozen…");
      const selected = await this.request("http://127.0.0.1:11434/api/chat", {
        model: this.settings.textModel, stream: false, format: "json",
        options: { temperature: 0.15, num_predict: 450, num_ctx: 8192 },
        messages: [{ role: "system", content: core.SCENE_INSTRUCTIONS }, { role: "user", content: `RECENT TRANSCRIPT (source material):\n${snap.transcript}` }],
      }, 90_000);
      const scene = core.sceneFrom(selected);
      if (!scene) {
        this.runs[snap.id] = { ...previous, bucket: manual ? previous.bucket || 0 : bucket, sourceEnd: snap.sourceEnd };
        await this.persist(); this.update("Geen concrete gespeelde scène in de recente transcriptie; dit beeld is overgeslagen.");
        return;
      }
      if (this.unloaded || this.current()?.id !== snap.id) return;
      this.update(`Lokale Theros-illustratie: ${scene.title}…`);
      const response = await this.request("http://127.0.0.1:11435/api/generate", {
        model: this.settings.imageModel, prompt: scene.prompt, stream: false,
        width: this.settings.width, height: this.settings.height, steps: 4, keep_alive: "1m",
      }, 240_000);
      const bytes = core.imageBytes(response);
      if (this.unloaded || this.current()?.id !== snap.id) return;
      const folder = await this.folder(`${this.settings.outputFolder}/${core.safeSessionId(snap.id)}`);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const path = `${folder}/${stamp}.png`;
      await this.app.vault.createBinary(path, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      await this.app.vault.create(`${folder}/${stamp}.json`, JSON.stringify({
        title: scene.title, prompt: scene.prompt, imageModel: this.settings.imageModel,
        sourceNote: snap.notePath, elapsedMs: snap.elapsed, sourceEndMs: snap.sourceEnd,
        generatedAt: new Date().toISOString(), artisticInterpretation: true,
      }, null, 2));
      const gallery = `${folder}/Galerij.md`;
      const block = `\n## ${core.time(snap.elapsed)} — ${scene.title}\n\n![[${path}]]\n\n*Artistieke interpretatie op basis van de recente opname.*\n`;
      const file = this.app.vault.getAbstractFileByPath(gallery);
      if (file) await this.app.vault.append(file, block);
      else await this.app.vault.create(gallery, `# Scènebeelden\n\n${snap.notePath ? `Sessienotitie: [[${snap.notePath}]]\n` : ""}${block}`);
      this.latest = { title: scene.title, path, gallery, elapsed: snap.elapsed };
      this.runs[snap.id] = { bucket: manual ? previous.bucket || 0 : bucket, sourceEnd: snap.sourceEnd };
      await this.persist(); this.update(`Nieuw scènebeeld: ${scene.title}`);
      await this.show();
      new Notice(`Theros-scènebeeld klaar: ${scene.title}`);
    } catch (error) {
      if (this.unloaded || this.current()?.id !== snap.id) return;
      this.runs[snap.id] = { ...previous, failedAt: Date.now() };
      await this.persist();
      this.update(`Scènebeeld niet gemaakt: ${error.message}. Transcriptie blijft doorlopen.`);
      if (manual || !previous.failedAt) new Notice("Scènebeeld niet gemaakt. Controleer de lokale beeldservice; transcriptie blijft werken.");
      console.error("[Farore scènes]", error);
    } finally { this.busy = false; this.manualGeneration = false; }
  }
};
