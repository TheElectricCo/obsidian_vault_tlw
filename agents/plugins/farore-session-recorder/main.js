"use strict";
const { Plugin, PluginSettingTab, Setting, ItemView, FuzzySuggestModal, Notice, TFile, setIcon } = require("obsidian");
const core = require("./core");
const { LocalServices } = require("./services");
const { MicrophoneCapture } = require("./audio");
const images = require("./images");
const gateway = require("./gateway");
const { randomUUID } = require("crypto");
const VIEW = "farore-session-recorder-view";

function button(el, text, action, disabled = false, primary = false) {
  const b = el.createEl("button", { text }); b.disabled = disabled;
  if (primary) b.addClass("mod-cta");
  b.addEventListener("click", () => Promise.resolve().then(action).catch(e => new Notice(e.message, 10000)));
  return b;
}
function card(parent, title, icon, collapsible = false) {
  const body = parent.createEl(collapsible ? "details" : "section", { cls: "farore-card" });
  const header = body.createEl(collapsible ? "summary" : "div", { cls: "farore-card-heading" });
  setIcon(header.createEl("span", { cls: "farore-card-icon", attr: { "aria-hidden": "true" } }), icon);
  header.createEl("span", { text: title });
  return { body: body.createDiv({ cls: "farore-card-body" }), header };
}
class RecorderView extends ItemView {
  getViewType() { return VIEW; }
  getDisplayText() { return "Tales from Farore"; }
  getIcon() { return "compass"; }
  async onOpen() { this.build(); }
  build() {
    const el = this.contentEl; el.empty(); el.addClass("farore-recorder");
    this.lastText = null; this.previewPath = null;
    const header = el.createDiv({ cls: "farore-recorder-heading" });
    const heading = header.createDiv();
    heading.createEl("span", { text: "TALES FROM FARORE", cls: "farore-eyebrow" });
    heading.createEl("span", { text: "Het kompas van de Dungeon Master", cls: "farore-header-caption" });
    const settingsButton = button(header, "", () => this.plugin.openSettings());
    settingsButton.addClass("farore-icon-button");
    settingsButton.setAttribute("aria-label", "Open Farore-instellingen");
    settingsButton.setAttribute("title", "Open Farore-instellingen");
    setIcon(settingsButton, "settings");

    const nav = el.createEl("nav", { cls: "farore-nav", attr: { "aria-label": "Farore-navigatie" } });
    this.pages = {}; this.navButtons = {};
    for (const [id, label] of [["home", "Overzicht"], ["recording", "Opname"], ["images", "Beelden"], ["tools", "Tools"]]) {
      const b = button(nav, label, () => this.selectPage(id));
      b.setAttribute("aria-controls", `${this.plugin.manifest.id}-${id}`);
      this.navButtons[id] = b;
      this.pages[id] = el.createEl("section", { cls: "farore-page", attr: { id: `${this.plugin.manifest.id}-${id}`, "aria-label": label } });
    }
    this.buildHome(this.pages.home);
    this.buildTools(this.pages.tools);

    const recording = card(this.pages.recording, "De sessie vastleggen", "audio-lines").body;
    const sessionRow = recording.createDiv({ cls: "farore-session-row" });
    this.stateEl = sessionRow.createEl("span", { cls: "farore-state" });
    this.clock = sessionRow.createEl("strong", { cls: "farore-clock", text: "00:00" });
    this.sessionTitleEl = recording.createEl("p", { cls: "farore-session-title" });
    const actions = recording.createDiv({ cls: "farore-actions farore-recording-actions" });
    this.startButton = button(actions, "Start opname", () => this.plugin.startRecording(this.titleInput.value), false, true);
    this.pauseButton = button(actions, "Pauzeer", () => this.plugin.togglePause());
    this.stopButton = button(actions, "Stop & verslag", () => this.plugin.stopRecording(), true);
    this.stopButton.addClass("farore-stop-button");
    this.stopButton.setAttribute("title", "Stop de opname, bewaar audio en maak een conceptverslag");
    const waveform = recording.createDiv({ cls: "farore-waveform", attr: { "aria-hidden": "true" } });
    this.waveLevels = Array(48).fill(0);
    this.waveBars = this.waveLevels.map(() => waveform.createEl("span", { cls: "farore-wave-bar" }));
    const meterRow = recording.createDiv({ cls: "farore-meter-row" });
    meterRow.createEl("span", { text: "Microfoonniveau" });
    this.meter = meterRow.createEl("progress", { attr: { max: "1", value: "0", "aria-label": "Microfoonniveau" } });
    this.statusEl = recording.createEl("p", { cls: "farore-status", attr: { role: "status", "aria-live": "polite" } });

    const setup = card(this.pages.recording, "Sessie instellen", "sliders-horizontal", true).body;
    setup.parentElement.open = true;
    const nameLabel = setup.createEl("label", { text: "Sessienaam" });
    this.titleInput = nameLabel.createEl("input", { type: "text", attr: { placeholder: "The Last Wish — sessie", "aria-label": "Sessienaam" } });
    this.titleInput.value = "The Last Wish — sessie";
    const micLabel = setup.createEl("label", { text: "Microfoon" });
    this.deviceSelect = micLabel.createEl("select", { attr: { "aria-label": "Microfoon" } });
    this.deviceSelect.addEventListener("change", () => this.plugin.changeSettings({ deviceId: this.deviceSelect.value }).catch(e => new Notice(e.message)));
    button(setup, "Ververs microfoons", async () => { await this.plugin.refreshDevices(); this.devices(); });
    this.devices();

    const transcript = card(this.pages.recording, "Live transcriptie", "file-text");
    transcript.header.createEl("span", { cls: "farore-badge", text: "Lokaal" });
    this.transcriptEl = transcript.body.createDiv({ cls: "farore-transcript", attr: { tabindex: "0", "aria-label": "Recente transcriptie" } });
    this.detailEl = transcript.body.createEl("p", { cls: "farore-caption" });
    const notes = transcript.body.createDiv({ cls: "farore-actions" });
    this.transcriptButton = button(notes, "Open transcript", () => this.plugin.openNote(`${this.plugin.engine.session.folder}/Transcript.md`));
    this.summaryButton = button(notes, "Maak conceptverslag", () => this.plugin.manualSummary());
    this.retryButton = button(notes, "Probeer transcriptie opnieuw", () => this.plugin.retry());
    this.latestButton = button(notes, "Open laatste verslag", () => this.plugin.openNote(this.plugin.engine.session.summaries.at(-1)?.path));

    const scene = card(this.pages.images, "Scènes tot leven brengen", "images");
    this.autoImageEl = scene.header.createEl("span", { cls: "farore-badge" });
    this.imagePreview = scene.body.createDiv({ cls: "farore-image-preview" });
    this.imagePreview.createEl("p", { cls: "farore-empty-state", text: "Geef de gespeelde scène een beeld. Je laatste afbeelding verschijnt hier." });
    const sceneLabel = scene.body.createEl("label", { text: "Eigen scènebeschrijving (optioneel)" });
    this.sceneInput = sceneLabel.createEl("textarea", { attr: { rows: "3", maxlength: "8000", "aria-label": "Eigen scènebeschrijving", placeholder: "Laat leeg voor de recente gespeelde scène, of beschrijf zelf een beeld…" } });
    const imageActions = scene.body.createDiv({ cls: "farore-actions" });
    this.imageButton = button(imageActions, "Genereer afbeelding", () => this.plugin.generateImage(this.sceneInput.value), false, true);
    this.galleryButton = button(imageActions, "Open beeldgalerij", () => this.plugin.openNote(this.plugin.latestImage?.gallery));
    this.imageStatusEl = scene.body.createEl("p", { cls: "farore-caption", attr: { role: "status", "aria-live": "polite" } });
    scene.body.createEl("p", { cls: "farore-caption", text: "Alleen de beeldprompt gaat naar OpenAI. Beeldgeneratie gebruikt betaald API-tegoed." });

    const serviceCard = card(this.pages.tools, "Lokale diensten", "server", true).body;
    this.serviceEl = serviceCard.createEl("p", { cls: "farore-services" });
    const services = serviceCard.createDiv({ cls: "farore-actions" });
    this.startService = button(services, "Start diensten", () => this.plugin.startServices());
    button(services, "Controleer", () => this.plugin.checkServices());
    this.stopService = button(services, "Stop diensten", () => this.plugin.stopServices());
    const history = card(this.pages.recording, "Vorige sessies & herstel", "history", true).body;
    this.historyDetails = history.parentElement;
    history.createEl("p", { cls: "farore-caption", text: "Open een bewaarde sessie om fragmenten te herstellen of een nieuw verslag te maken." });
    this.historySelect = history.createEl("select", { attr: { "aria-label": "Bewaarde sessies" } });
    this.historySelect.addEventListener("change", () => { this.historyChoice = this.historySelect.value; });
    const historyActions = history.createDiv({ cls: "farore-actions" });
    this.loadButton = button(historyActions, "Open sessie", () => this.plugin.loadSession(this.historySelect.value));
    button(historyActions, "Ververs sessies", async () => { await this.plugin.refreshHistory(); this.renderHistoryList(); });
    this.renderHistoryList(); this.selectPage(this.page || "home"); this.refresh();
  }
  selectPage(id = "home") {
    if (!this.pages[id]) id = "home";
    this.page = id;
    for (const [key, page] of Object.entries(this.pages)) {
      page.hidden = key !== id;
      this.navButtons[key].setAttribute("aria-current", key === id ? "page" : "false");
    }
    if (id === "tools") this.refreshTools();
  }
  tile(parent, title, description, icon, label, action) {
    const tile = parent.createEl("article", { cls: "farore-tool-tile" });
    setIcon(tile.createEl("span", { cls: "farore-tool-icon", attr: { "aria-hidden": "true" } }), icon);
    tile.createEl("h3", { text: title });
    tile.createEl("p", { text: description });
    const b = button(tile, label, action);
    return { tile, button: b };
  }
  buildHome(parent) {
    const hero = parent.createDiv({ cls: "farore-hero" });
    const logo = hero.createDiv({ cls: "farore-logo-frame" });
    const adapter = this.plugin.app.vault.adapter;
    const logoPath = `${this.plugin.manifest.dir || `${this.plugin.app.vault.configDir || ".obsidian"}/plugins/${this.plugin.manifest.id}`}/assets/farore-logo.png`;
    logo.createEl("img", { cls: "farore-logo", attr: { src: adapter?.getResourcePath?.(logoPath) || "", alt: "Tales from Farore" } });
    hero.createEl("p", { cls: "farore-hero-kicker", text: "JOUW WERELD. JOUW VERHALEN." });
    hero.createEl("h2", { text: "Een nieuw hoofdstuk wacht." });
    hero.createEl("p", { cls: "farore-hero-description", text: "Van de eerste worp tot het laatste woord: alles voor je volgende avontuur, op één plek." });
    button(hero, "Naar de sessie", () => this.selectPage("recording"), false, true);

    const session = card(parent, "Aan de speeltafel", "flame").body;
    this.homeSessionEl = session.createEl("p", { cls: "farore-home-session" });
    this.homeStatusEl = session.createEl("p", { cls: "farore-caption", attr: { role: "status", "aria-live": "polite" } });
    const actions = session.createDiv({ cls: "farore-actions" });
    button(actions, "Open opname", () => this.selectPage("recording"));
    this.homeTranscriptButton = button(actions, "Transcript", () => this.plugin.openNote(`${this.plugin.engine?.session.folder}/Transcript.md`), true);
    this.homeSummaryButton = button(actions, "Laatste verslag", () => this.plugin.openNote(this.plugin.engine?.session.summaries.at(-1)?.path), true);

    parent.createEl("h2", { cls: "farore-section-title", text: "Jouw Farore-tools" });
    const tiles = parent.createDiv({ cls: "farore-tool-grid" });
    this.tile(tiles, "Sessieopname", "Bewaar de stemmen, het transcript en je sessieverslag.", "mic", "Open opname", () => this.selectPage("recording"));
    this.tile(tiles, "Scènebeelden", "Geef een gespeelde scène een beeld met OpenAI.", "images", "Open beelden", () => this.selectPage("images"));
    this.tile(tiles, "Sessiearchief", "Keer terug naar eerdere opnames en herstel fragmenten.", "scroll-text", "Bekijk sessies", () => {
      this.selectPage("recording"); this.historyDetails.open = true;
      this.historyDetails.scrollIntoView?.({ block: "nearest" });
    });
    this.tile(tiles, "De gereedschapskist", "Lokale scènebeelden en alle verbonden plugins.", "compass", "Ontdek tools", () => this.selectPage("tools"));

    const resources = card(parent, "De wereld van Farore", "book-open").body;
    const links = resources.createDiv({ cls: "farore-resource-links" });
    for (const [label, prefix] of [["Huisregels", "D&D 5E/Farore"], ["Sessies", "The Last Wish/Sessions"], ["Personages", "The Last Wish/Players"], ["Wereld & locaties", "The Last Wish/Locations"], ["Lore", "The Last Wish/Lore"]])
      button(links, label, () => this.plugin.pickNote(prefix, label));
    button(links, "Handleiding", () => this.plugin.openNote("agents/docs/session-recording/Farore Sessieopname.md"));
  }
  buildTools(parent) {
    parent.createEl("h2", { cls: "farore-section-title", text: "De gereedschapskist" });
    parent.createEl("p", { cls: "farore-caption", text: "Open een tool en kies wat je wilt doen. Nieuwe Farore-plugins verschijnen hier vanzelf." });
    this.toolsEl = parent.createDiv({ cls: "farore-tool-grid" });
    button(parent, "Ververs tools", () => this.refreshTools());
  }
  refreshTools() {
    this.toolsEl.empty();
    for (const tool of gateway.integrations(this.plugin.app, this.plugin.manifest.id)) {
      const available = tool.enabled && tool.commands.length > 0;
      const entry = this.tile(this.toolsEl, tool.name, tool.description, tool.icon,
        available ? "Open tool" : tool.enabled ? "Instellingen" : tool.installed ? "Plugin inschakelen" : "Niet geïnstalleerd",
        () => available ? this.plugin.pickCommand(tool) : this.plugin.openSettings(tool.enabled ? tool.id : "community-plugins"));
      entry.tile.createEl("span", { cls: "farore-tool-status", text: tool.enabled ? tool.custom ? "Farore · actief" : "Verbonden" : tool.installed ? "Uitgeschakeld" : "Niet geïnstalleerd" });
      entry.button.disabled = !tool.installed;
    }
  }
  devices() {
    if (!this.deviceSelect) return;
    this.deviceSelect.empty(); this.deviceSelect.createEl("option", { text: "Standaardmicrofoon", value: "" });
    for (const d of this.plugin.devices || []) if (d.deviceId && d.deviceId !== "default")
      this.deviceSelect.createEl("option", { text: d.label || `Microfoon ${d.deviceId.slice(0, 6)} (naam na toestemming)`, value: d.deviceId });
    this.deviceSelect.value = this.plugin.settings.deviceId;
  }
  renderHistoryList() {
    if (!this.historySelect) return;
    const selected = this.historyChoice || this.historySelect.value;
    this.historySelect.empty(); this.historySelect.createEl("option", { text: "Kies een sessie…", value: "" });
    for (const path of this.plugin.history || []) this.historySelect.createEl("option", { text: path.split("/").at(-2), value: path });
    this.historySelect.value = selected;
  }
  refresh() {
    if (!this.statusEl) return;
    const p = this.plugin, s = p.engine?.session, active = p.capture && ["recording", "paused"].includes(s?.status);
    const busy = p.busy || p.serviceBusy || p.unloaded;
    this.homeSessionEl.setText(s ? `${s.title} · ${core.time(p.capture?.elapsed() || s.elapsedMs || 0)}` : "The Last Wish");
    this.homeStatusEl.setText(active ? s.status === "paused" ? "De opname is gepauzeerd." : "De opname loopt. Je kunt de andere tools blijven gebruiken." : busy ? "De sessie wordt verwerkt…" : s ? "Je sessie is bewaard." : "Klaar voor het volgende avontuur.");
    this.homeTranscriptButton.disabled = !s;
    this.homeSummaryButton.disabled = !s?.summaries.length;
    this.statusEl.setText(p.status || "Klaar voor een nieuwe sessie.");
    const state = busy ? "processing" : active ? s.status : s ? "saved" : "ready";
    this.stateEl.setAttribute("data-state", state);
    this.stateEl.setText({ recording: "Actief", paused: "Gepauzeerd", processing: "Verwerken", saved: "Bewaard", ready: "Klaar voor opname" }[state]);
    this.sessionTitleEl.setText(s?.title || "Een nieuw hoofdstuk aan tafel");
    this.autoImageEl.setText(p.settings.autoImages ? `Elke ${p.settings.imageMinutes} min` : "Handmatig");
    const h = p.health || {};
    this.serviceEl.setText(`Whisper: ${h.whisper ? "klaar" : "niet bereikbaar"} · Ollama: ${h.model ? "model klaar" : h.ollama ? "model ontbreekt" : "niet bereikbaar"} · Beelden: ${h.images ? "klaar" : "niet bereikbaar"}`);
    this.clock.setText(core.time(p.capture?.elapsed() || s?.elapsedMs || 0));
    this.meter.value = Math.min(1, (p.level || 0) * 5);
    const waveTime = p.capture?.elapsed() || 0;
    if (this.waveCapture !== p.capture) {
      this.waveLevels.fill(0); this.waveTime = null; this.waveCapture = p.capture;
    }
    if (s?.status === "recording" && active && waveTime !== this.waveTime) {
      this.waveLevels.shift(); this.waveLevels.push(this.meter.value); this.waveTime = waveTime;
    }
    this.waveBars.forEach((bar, i) => {
      bar.style.height = `${3 + this.waveLevels[i] * 49}px`;
      bar.style.opacity = String(0.25 + this.waveLevels[i] * 0.75);
    });
    this.startButton.disabled = !!active || !!busy || !!p.imageBusy || !!p.engine?.running || !!p.engine?.summaryRunning;
    this.pauseButton.disabled = !active || !!busy;
    this.pauseButton.setText(s?.status === "paused" ? "Hervat" : "Pauzeer");
    this.stopButton.disabled = !active || !!busy;
    this.titleInput.disabled = !!active || !!busy; this.deviceSelect.disabled = !!active || !!busy;
    this.startService.disabled = !!busy;
    this.stopService.disabled = !!active || !!busy || !!p.imageBusy || !!p.engine?.running || !!p.engine?.summaryRunning;
    this.transcriptButton.disabled = !s;
    this.summaryButton.disabled = !s || !!busy || !!p.engine?.summaryRunning || !s.chunks.some(c => c.status === "done" && c.text?.trim());
    this.retryButton.disabled = !s || !!busy || !!p.engine?.running || (!p.pendingAudio.length && !s.chunks.some(c => c.status === "failed" || c.status === "pending"));
    this.latestButton.disabled = !s?.summaries.length;
    this.loadButton.disabled = !!active || !!busy || !!p.imageBusy || !!p.engine?.running || !!p.engine?.summaryRunning;
    this.imageButton.disabled = !!busy || !!p.imageBusy;
    this.sceneInput.disabled = !!p.imageBusy;
    this.imageButton.setText(p.imageBusy ? "Afbeelding wordt gemaakt…" : "Genereer afbeelding");
    this.galleryButton.disabled = !p.latestImage;
    this.imageStatusEl.setText(p.imageStatus || (p.getImageKey() ? "OpenAI-key ingesteld. Klaar om een beeld te maken." : "Stel je OpenAI API-key in onder Settings → Tales from Farore."));
    if (this.previewPath !== p.latestImage?.path) {
      this.imagePreview.empty(); this.previewPath = p.latestImage?.path;
      const file = this.previewPath && p.app.vault.getAbstractFileByPath(this.previewPath);
      if (file instanceof TFile) {
        this.imagePreview.createEl("img", { attr: { src: p.app.vault.getResourcePath(file), alt: p.latestImage.title } });
        this.imagePreview.createEl("p", { cls: "farore-image-caption", text: p.latestImage.title });
      } else this.imagePreview.createEl("p", { cls: "farore-empty-state", text: "Geef de gespeelde scène een beeld. Je laatste afbeelding verschijnt hier." });
    }
    this.detailEl.setText(s ? `${s.title} · ${core.coverage(s)}${s.summaryError ? ` Verslag: ${s.summaryError}` : ""}${p.engine.error ? ` Opslag: ${p.engine.error}` : ""}` : "Audio wordt tijdens de opname in WAV-fragmenten bewaard.");
    const chunks = s?.chunks.filter(c => c.status === "done" && c.text).slice(-4) || [];
    const text = JSON.stringify(chunks.map(c => [c.startMs, c.text]));
    if (text !== this.lastText) {
      const follow = !this.lastText || this.transcriptEl.scrollHeight - this.transcriptEl.scrollTop - this.transcriptEl.clientHeight < 32;
      this.transcriptEl.empty(); this.lastText = text;
      if (!chunks.length) this.transcriptEl.createEl("p", { cls: "farore-empty-state", text: "De eerste woorden verschijnen na het fragmentinterval en de verwerkingstijd." });
      for (const chunk of chunks) {
        const row = this.transcriptEl.createDiv({ cls: "farore-transcript-row" });
        row.createEl("span", { cls: "farore-timecode", text: core.time(chunk.startMs) });
        row.createEl("p", { text: chunk.text });
      }
      if (follow) this.transcriptEl.scrollTop = this.transcriptEl.scrollHeight;
    }
  }
}

class GatewayPicker extends FuzzySuggestModal {
  constructor(app, title, items, label, choose) {
    super(app); this.items = items; this.label = label; this.choose = choose;
    this.setPlaceholder(title);
  }
  getItems() { return this.items; }
  getItemText(item) { return this.label(item); }
  onChooseItem(item) { Promise.resolve().then(() => this.choose(item)).catch(e => new Notice(e.message, 10000)); }
}

class RecorderSettings extends PluginSettingTab {
  display() {
    const el = this.containerEl; el.empty(); const p = this.plugin;
    el.createEl("h2", { text: "Tales from Farore" });
    el.createEl("p", { text: "Instellingen gelden vanaf de volgende opname. Een bewaarde sessie behoudt haar eigen instellingen en prompt." });
    const change = async (key, value) => {
      try { await p.changeSettings({ [key]: value }); } catch (e) { new Notice(e.message, 8000); }
    };
    for (const [key, name, desc] of [
      ["outputFolder", "Uitvoermap", "Nieuwe sessiemappen met audio, transcript en conceptverslagen."],
      ["promptPath", "Promptnotitie", "Deze Markdown-notitie wordt bij het starten gelezen en met de sessie bewaard."],
      ["textModel", "Lokaal Ollama-model", "Standaard llama3.1:8b; het model moet lokaal geïnstalleerd zijn."],
      ["whisperUrl", "Whisper-adres", "Lokaal http-adres op 127.0.0.1; gebruikt /health en /v1/audio/transcriptions."],
      ["ollamaUrl", "Ollama-adres", "Lokaal http-adres op 127.0.0.1; gebruikt /api/tags en /api/chat."],
    ]) new Setting(el).setName(name).setDesc(desc).addText(t => t.setValue(p.settings[key]).onChange(v => { t.inputEl.onblur = () => change(key, v); }));
    new Setting(el).setName("Transcriptietaal").addDropdown(d => {
      for (const [value, text] of [["nl", "Nederlands"], ["en", "Engels"], ["fr", "Frans"], ["de", "Duits"]]) d.addOption(value, text);
      d.setValue(p.settings.language).onChange(v => change("language", v));
    });
    new Setting(el).setName("Audiofragment in seconden").setDesc("Kortere fragmenten verschijnen sneller; woorden op fragmentgrenzen kunnen minder goed worden herkend.")
      .addDropdown(d => { for (const v of [15, 30, 60, 120]) d.addOption(String(v), String(v)); d.setValue(String(p.settings.chunkSeconds)).onChange(v => change("chunkSeconds", Number(v))); });
    for (const [key, name, desc] of [
      ["autoStart", "Diensten starten bij opname", "Start de bestaande macOS Whisper-dienst en open Ollama indien nodig."],
      ["sceneService", "Ook de beeldservice starten", "Start de bestaande lokale beeldservice voor Farore Scènebeelden."],
      ["liveSummary", "Tussentijdse conceptverslagen", "Maak geregeld een nieuw concept naast het eindverslag; oudere versies blijven bewaard."],
    ]) new Setting(el).setName(name).setDesc(desc).addToggle(t => t.setValue(p.settings[key]).onChange(v => change(key, v)));
    new Setting(el).setName("Verslaginterval in minuten").addDropdown(d => {
      for (const v of [2, 5, 10, 15]) d.addOption(String(v), String(v));
      d.setValue(String(p.settings.summaryMinutes)).onChange(v => change("summaryMinutes", Number(v)));
    });
    el.createEl("h3", { text: "Afbeeldingen met OpenAI" });
    el.createEl("p", { text: "Deze beeldinstellingen gelden meteen, ook voor een geopende sessie. Audio, transcriptie en verslagen blijven lokaal. OpenAI ontvangt alleen de beeldprompt; generatie gebruikt betaald API-tegoed." });
    let enteredKey = "";
    new Setting(el).setName("OpenAI API-key").setDesc(p.app.secretStorage ? "Bewaard in Obsidian-sleutelopslag, niet in plugininstellingen of sessiebestanden." : "Deze Obsidian-versie bewaart de key alleen in het geheugen tot je de plugin sluit. Vanaf 1.11.4 is sleutelopslag beschikbaar.")
      .addText(t => { t.inputEl.type = "password"; t.inputEl.autocomplete = "off";
        t.setPlaceholder(p.getImageKey() ? "Key ingesteld" : "sk-…").onChange(value => { enteredKey = value; }); })
      .addButton(b => b.setButtonText("Bewaar key").onClick(() => {
        try { if (!enteredKey.trim()) throw new Error("Vul eerst een API-key in."); p.setImageKey(enteredKey); this.display(); new Notice("OpenAI-key ingesteld."); } catch (e) { new Notice(e.message); }
      }))
      .addButton(b => b.setButtonText("Verwijder key").onClick(() => { p.setImageKey(""); this.display(); }));
    for (const [key, name, options] of [
      ["imageModel", "OpenAI-beeldmodel", { "gpt-image-1.5": "GPT Image 1.5", "gpt-image-2.5-flare": "GPT Image 2.5 Flare", "gpt-image-1-mini": "GPT Image 1 Mini" }],
      ["imageSize", "Beeldformaat", { "1536x1024": "Liggend (1536 × 1024)", "1024x1024": "Vierkant (1024 × 1024)", "1024x1536": "Staand (1024 × 1536)" }],
      ["imageQuality", "Beeldkwaliteit", { low: "Laag", medium: "Gemiddeld", high: "Hoog" }],
    ]) new Setting(el).setName(name).addDropdown(d => { for (const [value, label] of Object.entries(options)) d.addOption(value, label); d.setValue(p.settings[key]).onChange(value => change(key, value)); });
    new Setting(el).setName("Automatisch OpenAI-beelden maken").setDesc("Tijdens opname, alleen bij nieuwe recente transcriptie. Schakel automatische beelden in Farore Scènebeelden uit om dubbele beelden te voorkomen.")
      .addToggle(t => t.setValue(p.settings.autoImages).onChange(value => change("autoImages", value)));
    new Setting(el).setName("Beeldinterval in minuten").addDropdown(d => {
      for (const value of [5, 10, 15, 20, 30]) d.addOption(String(value), String(value));
      d.setValue(String(p.settings.imageMinutes)).onChange(value => change("imageMinutes", Number(value)));
    });
    el.createEl("p", { text: "Selecteer de microfoon in het opnamepaneel. Geen automatische sprekeridentificatie. Verslagen zijn concepten voor controle door de DM. Stop de opname en wacht op verwerking voordat je Obsidian sluit." });
  }
}

module.exports = class FaroreSessionRecorder extends Plugin {
  async onload() {
    const data = await this.loadData() || {};
    try { this.settings = core.settingsFrom(data.settings); }
    catch (e) { this.settings = { ...core.DEFAULTS }; new Notice(`Farore-instellingen ongeldig: ${e.message} Standaardwaarden geladen.`, 10000); }
    this.recent = Array.isArray(data.recent) ? data.recent.filter(p => typeof p === "string").slice(-100) : [];
    this.history = []; this.devices = []; this.services = new LocalServices(); this.status = "Klaar voor een nieuwe sessie.";
    this.audioWrites = Promise.resolve(); this.pendingAudio = []; this.unloaded = false;
    this.imageService = new images.OpenAIImages(); this.imageBusy = false; this.imageRuns = {};
    this.latestImage = data.latestImage && typeof data.latestImage.path === "string" && typeof data.latestImage.gallery === "string" ? data.latestImage : null;
    this.registerView(VIEW, leaf => { const v = new RecorderView(leaf); v.plugin = this; return v; });
    this.addSettingTab(new RecorderSettings(this.app, this));
    this.addRibbonIcon("compass", "Tales from Farore — open het kompas", () => this.safe(() => this.show("home")));
    for (const [id, name, action] of [
      ["open-gateway", "Open het Farore-kompas", () => this.show("home")],
      ["open-recorder", "Open sessieopname", () => this.show("recording")],
      ["open-images", "Open scènebeelden met OpenAI", () => this.show("images")],
      ["open-tools", "Open de gereedschapskist", () => this.show("tools")],
      ["start-recording", "Start sessieopname", () => this.startRecording("The Last Wish — sessie")],
      ["pause-resume", "Pauzeer of hervat sessieopname", () => this.togglePause()],
      ["stop-recording", "Stop opname en maak sessieverslag", () => this.stopRecording()],
      ["start-services", "Start lokale diensten", () => this.startServices()],
      ["stop-services", "Stop lokale diensten", () => this.stopServices()],
      ["retry-transcription", "Herstel ontbrekende transcriptie", () => this.retry()],
      ["make-summary", "Maak conceptverslag", () => this.manualSummary()],
      ["generate-image", "Genereer afbeelding van de recente scène met OpenAI", () => this.generateImage()],
    ]) this.addCommand({ id, name, callback: () => this.safe(action) });
    this.statusBar = this.addStatusBarItem(); this.statusBar.addClass("farore-recorder-status");
    this.registerDomEvent(this.statusBar, "click", () => this.safe(() => this.show(this.capture ? "recording" : "home")));
    this.registerInterval(window.setInterval(() => { this.update(); this.liveSummary(); }, 1000));
    this.registerInterval(window.setInterval(() => this.checkServices().catch(() => {}), 30000));
    this.registerInterval(window.setInterval(() => this.autoImage().catch(e => { this.imageStatus = e.message; this.update(); }), 5000));
    if (navigator.mediaDevices) this.registerDomEvent(navigator.mediaDevices, "devicechange", () => this.safe(() => this.refreshDevices()));
    this.app.workspace.onLayoutReady(() => {
      this.safe(async () => { await Promise.all([this.refreshHistory(), this.refreshDevices(), this.checkServices()]); });
    });
    this.update();
  }
  safe(action) { return Promise.resolve().then(action).catch(e => { this.update(e.message); new Notice(e.message, 10000); console.error("[Farore opname]", e); }); }
  update(message) {
    if (message) this.status = message;
    if (this.unloaded) return;
    const s = this.engine?.session;
    this.statusBar?.setText(s && this.capture ? `Farore ${s.status === "paused" ? "Ⅱ" : "●"} ${core.time(this.capture.elapsed())}` : "Farore kompas");
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) leaf.view.refresh();
  }
  async show(page = "recording") {
    let leaf = this.app.workspace.getLeavesOfType(VIEW)[0];
    if (!leaf) { leaf = this.app.workspace.getRightLeaf(false); if (!leaf) throw new Error("Kan geen opnamepaneel openen."); await leaf.setViewState({ type: VIEW, active: true }); }
    leaf.view.selectPage(page);
    await this.app.workspace.revealLeaf(leaf);
  }
  openSettings(id = this.manifest.id) {
    this.app.setting.open(); this.app.setting.openTabById(id);
  }
  pickCommand(tool) {
    const commands = gateway.commandsFor(this.app, tool.id);
    if (!this.app.plugins?.plugins?.[tool.id] || !commands.length) {
      this.openSettings("community-plugins"); return;
    }
    new GatewayPicker(this.app, `${tool.name} — kies een actie…`, commands, item => item.name, command => {
      if (!this.app.plugins?.plugins?.[tool.id] || !gateway.commandsFor(this.app, tool.id).some(item => item.id === command.id))
        throw new Error("Deze tool is niet meer actief. Ververs de gereedschapskist.");
      if (!this.app.commands?.executeCommandById || this.app.commands.executeCommandById(command.id) === false)
        throw new Error("Deze actie is momenteel niet beschikbaar.");
    }).open();
  }
  pickNote(prefix, label) {
    const files = this.app.vault.getFiles().filter(file => file.path.startsWith(`${prefix}/`) && file.path.endsWith(".md"));
    if (!files.length) { new Notice(`Nog geen notities onder ${prefix}.`); return; }
    new GatewayPicker(this.app, `${label} — kies een notitie…`, files,
      file => file.path.slice(prefix.length + 1).replace(/\.md$/, ""), file => this.openNote(file.path)).open();
  }
  async openNote(path) {
    const file = path && this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) await this.app.workspace.getLeaf(false).openFile(file);
    else throw new Error("Er is nog geen bestand om te openen.");
  }
  async persist() { await this.saveData({ settings: this.settings, recent: this.recent.slice(-100), latestImage: this.latestImage }); }
  async changeSettings(changes) {
    this.settings = core.settingsFrom({ ...this.settings, ...changes });
    if (Object.hasOwn(changes, "autoImages") || Object.hasOwn(changes, "imageMinutes")) {
      const snap = this.imageSnapshot();
      if (snap) this.imageRuns[snap.id] = { bucket: Math.floor(snap.elapsed / (this.settings.imageMinutes * 60000)), sourceEnd: snap.sourceEnd };
    }
    await this.persist(); this.update();
  }
  getImageKey() { return this.app.secretStorage?.getSecret(images.SECRET) || this.temporaryImageKey || ""; }
  setImageKey(key) {
    key = key.trim();
    if (key && /\s/.test(key)) throw new Error("De API-key mag geen spaties of regeleinden bevatten.");
    if (this.app.secretStorage) this.app.secretStorage.setSecret(images.SECRET, key);
    else this.temporaryImageKey = key;
    this.imageStatus = ""; this.update();
  }
  async refreshDevices() {
    this.devices = navigator.mediaDevices ? (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "audioinput") : [];
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) leaf.view.devices();
  }
  async refreshHistory() {
    const found = this.app.vault.getFiles().filter(f => f.name === "Etat.json" && f.path.startsWith(`${this.settings.outputFolder}/`)).map(f => f.path);
    this.history = [...new Set([...this.recent, ...found])].filter(p => this.app.vault.getAbstractFileByPath(p)).sort().reverse().slice(0, 100);
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) leaf.view.renderHistoryList();
  }
  async checkServices() { this.health = await this.services.health(this.settings); this.update(); return this.health; }
  async startServices() {
    if (this.serviceBusy) throw new Error("Diensten worden al gestart.");
    this.serviceBusy = true; this.update("Lokale diensten controleren…");
    try { this.health = await this.services.start(this.settings, message => this.update(message));
      this.update(this.health.whisper ? `Whisper klaar.${this.health.model ? " Ollama-model klaar." : " Verslag vereist het lokale Ollama-model."}${this.settings.sceneService && !this.health.images ? " Beeldservice niet bereikbaar." : ""}` : "Whisper is niet bereikbaar.");
    } finally { this.serviceBusy = false; this.update(); }
  }
  async stopServices() {
    if (this.busy || this.serviceBusy || this.capture || this.imageBusy || this.engine?.running || this.engine?.summaryRunning || this.app.plugins.plugins["farore-scene-illustrator"]?.busy ||
        this.app.plugins.plugins.lexvoice?.recorder?.getInfo?.()?.state === "recording" || this.app.plugins.plugins.lexvoice?.recorder?.getInfo?.()?.state === "paused")
      throw new Error("Stop eerst de opname en wacht tot de verwerking klaar is.");
    this.serviceBusy = true; this.update("Lokale diensten stoppen…");
    try { await this.services.stop(this.settings); await this.checkServices(); this.update("Whisper en de ingeschakelde beeldservice gestopt. Ollama blijft beschikbaar."); }
    finally { this.serviceBusy = false; this.update(); }
  }
  store() {
    const vault = this.app.vault;
    const file = path => { const f = vault.getAbstractFileByPath(core.vaultPath(path)); if (!(f instanceof TFile)) throw new Error(`Bestand ontbreekt: ${path}`); return f; };
    return {
      folder: async path => {
        let current = "";
        for (const part of core.outputPath(path).split("/")) {
          current = current ? `${current}/${part}` : part;
          const existing = vault.getAbstractFileByPath(current);
          if (existing instanceof TFile) throw new Error(`Een bestand blokkeert de map ${current}.`);
          if (!existing) await vault.createFolder(current);
        }
      },
      create: (path, text) => vault.create(core.vaultPath(path), text),
      write: async (path, text) => { const f = vault.getAbstractFileByPath(core.vaultPath(path)); if (f) await vault.modify(file(path), text); else await vault.create(path, text); },
      read: path => vault.read(file(path)), readBinary: path => vault.readBinary(file(path)),
      binary: async (path, bytes) => {
        path = core.vaultPath(path);
        if (vault.getAbstractFileByPath(path)) {
          if (!Buffer.from(await vault.readBinary(file(path))).equals(Buffer.from(bytes))) throw new Error(`Er staat al andere audio op ${path}.`);
          return;
        }
        await vault.createBinary(path, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      },
      appendOnce: async (path, marker, block) => vault.process(file(path), text => text.includes(marker) ? text : text + block),
    };
  }
  newEngine() {
    return new core.SessionEngine({ store: this.store(), transcribe: (bytes, settings) => this.services.transcribe(bytes, settings),
      summarize: (prompt, text, settings) => this.services.summarize(prompt, text, settings), onChange: () => this.update() });
  }
  assertIdle() {
    if (this.busy || this.capture || this.imageBusy || this.engine?.running || this.engine?.summaryRunning || this.serviceBusy) throw new Error("Er loopt nog een opname of verwerking.");
  }
  async startRecording(title) {
    this.assertIdle();
    const lex = this.app.plugins.plugins.lexvoice?.recorder?.getInfo?.()?.state;
    if (["recording", "paused"].includes(lex)) throw new Error("Stop eerst de LexVoice-opname voordat je Farore start.");
    this.busy = true; this.update("Opname voorbereiden…");
    let capture, engine;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microfoonopname is niet beschikbaar in deze Obsidian-versie.");
      const settings = core.settingsFrom(this.settings);
      const promptFile = this.app.vault.getAbstractFileByPath(settings.promptPath);
      if (!(promptFile instanceof TFile)) throw new Error(`Promptnotitie ontbreekt: ${settings.promptPath}. Controleer de plugininstellingen.`);
      const prompt = await this.app.vault.read(promptFile);
      if (prompt.length > 16000) throw new Error("De promptnotitie is te lang (maximaal 16.000 tekens).");
      if (settings.autoStart) await this.startServices(); else await this.checkServices();
      if (!this.health.whisper) throw new Error("Whisper is niet bereikbaar. Start de lokale diensten.");
      if (!this.health.model) new Notice("Opname en transcriptie werken; voor verslagen moet het lokale Ollama-model beschikbaar zijn.", 10000);
      capture = new MicrophoneCapture({ seconds: settings.chunkSeconds,
        onChunk: (...args) => this.queueAudio(engine, ...args), onLevel: value => { this.level = value; },
        onEnded: () => this.safe(() => this.stopRecording()),
        onError: error => { this.update(error.message); new Notice(error.message, 10000); if (!this.busy) this.safe(() => this.stopRecording()); },
      });
      await capture.open(settings.deviceId);
      if (this.unloaded) throw new Error("Plugin is gesloten.");
      engine = this.newEngine(); await engine.create(title, settings, prompt);
      this.engine = engine; this.capture = capture; this.audioWrites = Promise.resolve(); this.pendingAudio = []; this.audioSaveError = null;
      this.recent.push(`${engine.session.folder}/Etat.json`); await this.persist();
      await capture.start();
      this.safe(() => this.refreshDevices()); this.safe(() => this.refreshHistory()); this.safe(() => this.show());
      this.update("Opname loopt. De microfoon is actief.");
    } catch (e) {
      await capture?.close(); this.capture = null;
      if (engine?.session) { engine.session.status = "interrupted"; await engine.persist(); }
      throw e;
    } finally { this.busy = false; this.update(); }
  }
  queueAudio(engine, ...args) {
    const entry = { engine, args }; this.pendingAudio.push(entry);
    this.audioWrites = this.audioWrites.then(async () => {
      if (this.audioSaveError) return;
      try {
        await engine.addAudio(...args);
        this.pendingAudio.splice(this.pendingAudio.indexOf(entry), 1);
      } catch (e) {
        this.audioSaveError = e;
        this.update(`Audio kon niet worden bewaard: ${e.message}. Houd Obsidian open en herstel de opslag.`);
        new Notice(this.status, 15000);
        if (!this.busy && this.capture?.active) this.safe(() => this.togglePause());
      }
    });
  }
  async flushAudioWrites() {
    await this.audioWrites;
    if (this.audioSaveError) throw new Error(`Audio wacht nog in het geheugen: ${this.audioSaveError.message}. Herstel de opslag en gebruik ‘Probeer transcriptie opnieuw’.`);
  }
  async togglePause() {
    const s = this.engine?.session;
    if (this.busy || !this.capture || !["recording", "paused"].includes(s?.status)) throw new Error("Er is geen opname om te pauzeren of hervatten.");
    this.busy = true;
    try {
      if (s.status === "recording") { await this.capture.pause(); s.status = "paused"; await this.flushAudioWrites(); this.update("Opname gepauzeerd. Pauzetijd telt niet mee."); }
      else { if (this.audioSaveError) await this.flushAudioWrites(); await this.capture.start(); s.status = "recording"; this.update("Opname hervat."); }
      await this.engine.persist();
    } finally { this.busy = false; this.update(); }
  }
  async stopRecording() {
    if (this.busy || !this.capture) throw new Error("Er is geen actieve opname om te stoppen.");
    this.busy = true; this.update("Opname stoppen en laatste audiofragment bewaren…");
    try {
      if (this.capture.active) await this.capture.pause();
      this.engine.session.status = "paused";
      await this.flushAudioWrites(); await this.capture.close(); this.capture = null;
      this.update("Audio bewaard. Transcriptie en eindverslag worden afgewerkt…");
      const path = await this.engine.finish();
      const missing = this.engine.session.chunks.some(c => c.status !== "done");
      this.update(missing ? "Opname bewaard; enkele fragmenten moeten opnieuw worden verwerkt." : path ? "Opname, transcript en conceptverslag klaar." : "Opname gestopt; geen herkenbare spraak voor een verslag.");
      if (path) await this.openNote(path);
    } finally { this.busy = false; this.update(); }
  }
  async retry() {
    if (!this.engine || this.busy || this.engine.summaryRunning) throw new Error("Open eerst een bewaarde sessie en wacht op lopende verwerking.");
    this.busy = true; this.update("Ontbrekende fragmenten opnieuw verwerken…");
    try {
      await this.audioWrites;
      if (this.pendingAudio.length) {
        this.audioSaveError = null;
        for (const entry of [...this.pendingAudio]) {
          await entry.engine.addAudio(...entry.args);
          this.pendingAudio.splice(this.pendingAudio.indexOf(entry), 1);
        }
      }
      await this.engine.retry();
      this.update(this.engine.session.chunks.some(c => c.status !== "done") ? "Enkele fragmenten lukten niet. Controleer Whisper en probeer opnieuw." : "Alle bewaarde fragmenten zijn verwerkt. Je kunt een nieuw verslag maken.");
    } catch (e) { if (this.pendingAudio.length) this.audioSaveError = e; throw e; }
    finally { this.busy = false; this.update(); }
  }
  async manualSummary() {
    if (!this.engine || this.busy) throw new Error("Open eerst een sessie en wacht op lopende verwerking.");
    this.update("Conceptverslag wordt gemaakt…");
    const path = await this.engine.makeSummary(!this.capture);
    if (path) { this.update("Nieuw conceptverslag bewaard."); await this.openNote(path); }
    else this.update("Nog geen herkenbare transcriptie voor een verslag.");
  }
  liveSummary() {
    const e = this.engine, s = e?.session;
    if (!e || this.busy || !this.capture || !s.settings.liveSummary || s.status !== "recording" || e.summaryRunning) return;
    const end = s.chunks.filter(c => c.status === "done" && c.text?.trim()).reduce((n, c) => Math.max(n, c.endMs), 0);
    if (end - s.lastSummaryEndMs < s.settings.summaryMinutes * 60000 || Date.now() - (this.lastSummaryAttempt || 0) < 60000) return;
    this.lastSummaryAttempt = Date.now();
    this.safe(async () => { this.update("Opname loopt; tussentijds conceptverslag wordt gemaakt…"); await e.makeSummary(false); this.update("Opname loopt. Tussentijds conceptverslag bewaard."); });
  }
  async loadSession(path) {
    this.assertIdle(); if (!path) throw new Error("Kies eerst een sessie.");
    this.busy = true;
    try {
      const engine = this.newEngine(); await engine.load(path); this.engine = engine;
      this.update("Bewaarde sessie geopend. Herstel ontbrekende transcriptie of maak een nieuw conceptverslag.");
      await this.openNote(`${engine.session.folder}/Transcript.md`);
    } finally { this.busy = false; this.update(); }
  }
  getSceneSnapshot() { return this.capture ? this.engine?.sceneSnapshot(this.capture.elapsed()) : null; }
  imageSnapshot() { return images.recentScene(this.engine?.session, this.capture?.elapsed() ?? this.engine?.session.elapsedMs); }
  async autoImage() {
    if (this.unloaded || this.busy || this.imageBusy || !this.settings.autoImages || !this.getImageKey() || !this.capture || this.engine?.session.status !== "recording") return;
    const snap = this.imageSnapshot();
    const record = this.imageRuns[snap.id] || {};
    if (images.scenes.due(snap, record, { enabled: true, intervalMinutes: this.settings.imageMinutes })) await this.generateImage("", true);
  }
  async generateImage(description = "", automatic = false) {
    if (this.unloaded || this.busy || this.imageBusy) throw new Error("Wacht tot de lopende verwerking klaar is.");
    const key = this.getImageKey();
    if (!key) throw new Error("Stel eerst je OpenAI API-key in onder Settings → Farore Sessieopname.");
    const engine = this.engine, session = engine?.session, snap = this.imageSnapshot();
    const config = core.settingsFrom(this.settings);
    const custom = !!description.trim();
    if (!custom && !snap?.transcript.trim()) throw new Error("Nog geen transcriptie om een scène uit te kiezen. Vul een eigen scènebeschrijving in of open een bewaarde sessie.");
    this.imageBusy = true; this.imageStatus = custom ? "De afbeelding wordt door OpenAI gemaakt…" : "De recente gespeelde scène wordt lokaal gekozen…"; this.update();
    let scene;
    try {
      if (custom) scene = images.customScene(description);
      else {
        const text = await this.services.summarize(images.scenes.SCENE_INSTRUCTIONS, snap.transcript, session.settings, "json");
        scene = images.scenes.sceneFrom({ message: { content: text } });
        if (!scene) { this.imageStatus = "Geen concrete gespeelde scène gevonden; er is geen OpenAI-aanvraag gedaan."; return null; }
      }
      if (this.unloaded) throw new Error("Beeldgeneratie onderbroken.");
      this.imageStatus = "De afbeelding wordt door OpenAI gemaakt…"; this.update();
      const bytes = await this.imageService.generate(scene.prompt, config, key);
      if (this.unloaded) throw new Error("Beeldgeneratie onderbroken.");
      const store = this.store(), folder = session ? core.outputPath(session.folder) : `${core.outputPath(config.outputFolder)}/Losse scenebeelden`;
      await store.folder(`${folder}/Beelden`);
      const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
      const path = `${folder}/Beelden/${id}.png`, gallery = `${folder}/Beeldgalerij.md`;
      await store.binary(path, bytes);
      if (!this.app.vault.getAbstractFileByPath(gallery)) await store.create(gallery, `# Scènebeelden — ${session ? session.title : "losse beelden"}\n\nArtistieke conceptbeelden met OpenAI; controleer de voorstelling.\n`);
      await store.appendOnce(gallery, `<!-- farore-image:${id} -->`, `\n<!-- farore-image:${id} -->\n## ${scene.title}\n\n${custom ? "Eigen beschrijving" : `Recente scène bij ${core.time(snap.sourceEnd)}`} · ${config.imageModel}\n\n![[${path}]]\n\n<details>\n<summary>Beeldprompt</summary>\n\n~~~text\n${scene.prompt.replace(/~/g, "～")}\n~~~\n\n</details>\n`);
      this.latestImage = { path, gallery, title: scene.title };
      await this.persist();
      this.imageStatus = `Afbeelding bewaard: ${scene.title}.`; return this.latestImage;
    } catch (e) {
      this.imageStatus = `Afbeelding niet voltooid: ${e.message}`;
      if (automatic && snap) this.imageRuns[snap.id] = { ...(this.imageRuns[snap.id] || {}), failedAt: Date.now() };
      throw e;
    } finally {
      // Consume this interval even on failure: never repeat a potentially billed call automatically.
      if (automatic && snap) this.imageRuns[snap.id] = { ...(this.imageRuns[snap.id] || {}), bucket: Math.floor(snap.elapsed / (config.imageMinutes * 60000)), sourceEnd: snap.sourceEnd };
      this.imageBusy = false; this.update();
    }
  }
  async shutdown() {
    this.unloaded = true;
    // Obsidian doesn't await onunload. Saving the tail is best effort; completed chunks are already durable.
    const engine = this.engine;
    this.services.close();
    this.imageService?.close(); this.temporaryImageKey = "";
    const capture = this.capture;
    if (capture) {
      if (capture.active) {
        try { await capture.pause(); } catch { capture.flush(); }
      }
      await capture.close(); this.capture = null;
      await this.audioWrites;
      if (engine) { engine.cancelled = true; engine.session.status = "interrupted"; await engine.persist(); }
    }
    if (engine) engine.cancelled = true;
  }
  onunload() { this.shutdown().catch(e => { this.services.close(); console.error("[Farore opname] Sluiten:", e); }); }
};
