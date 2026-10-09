"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const original = Module._load;
let lastPicker;
class TFile { constructor(path) { this.path = path; this.name = path.split("/").at(-1); } }
function element() {
  return { children: [], style: {}, empty() { this.children = []; }, addClass() {}, addEventListener(name, handler) { (this.listeners ||= {})[name] = handler; }, setAttribute(key, value) { (this.attr ||= {})[key] = value; }, setText(text) { this.text = text; },
    createEl(tag, options = {}) { const child = Object.assign(element(), { tag, parentElement: this }, options); this.children.push(child); return child; },
    createDiv(options) { return this.createEl("div", options); } };
}
Module._load = function (id, ...args) {
  if (id === "obsidian") return { Plugin: class {}, PluginSettingTab: class {}, Setting: class {},
    ItemView: class { constructor() { this.history = []; this.contentEl = element(); } },
    FuzzySuggestModal: class { setPlaceholder() {} open() { lastPicker = this; } }, Notice: class {}, TFile, setIcon() {} };
  return original.call(this, id, ...args);
};
const Recorder = require("./main"); Module._load = original;
const { DEFAULTS } = require("./core");
function fixture() {
  const p = new Recorder(), files = new Map(), objects = new Map();
  p.manifest = { id: "farore-session-recorder", dir: ".obsidian/plugins/farore-session-recorder" };
  const put = (path, value, folder = false) => { files.set(path, value); objects.set(path, folder ? { path } : new TFile(path)); };
  const secrets = new Map();
  p.app = { secretStorage: { getSecret: id => secrets.get(id), setSecret: (id, value) => secrets.set(id, value) }, plugins: { plugins: {} }, workspace: { getLeavesOfType: () => [], getLeaf: () => ({ openFile: async () => {} }) }, vault: {
    adapter: { getResourcePath: path => `app://local/${path}` },
    getAbstractFileByPath: path => objects.get(path), getFiles: () => [...objects.values()].filter(o => o instanceof TFile),
    createFolder: async path => put(path, "folder", true), create: async (path, text) => put(path, text),
    createBinary: async (path, bytes) => put(path, Buffer.from(bytes)), modify: async (file, text) => put(file.path, text),
    read: async file => files.get(file.path), readBinary: async file => files.get(file.path),
    process: async (file, fn) => put(file.path, fn(files.get(file.path))),
  } };
  p.settings = { ...DEFAULTS }; p.recent = []; p.pendingAudio = []; p.audioWrites = Promise.resolve(); p.imageRuns = {};
  p.saveData = async () => {}; p.services = { transcribe: async () => "De groep bereikt Akros.", summarize: async () => "## Recap\nDe groep bereikt Akros.", close: () => {} };
  return { p, files, put };
}
test("audio write failure pauses recording and retry retains the buffered fragment", async () => {
  const { p } = fixture(); let writes = 0, pauses = 0;
  p.engine = { session: { chunks: [] }, addAudio: async () => { writes++; if (writes === 1) throw new Error("Full disk"); }, retry: async () => {} };
  p.capture = { active: true }; p.togglePause = async () => { pauses++; };
  p.queueAudio(p.engine, Buffer.from("audio"), 0, 1000, false);
  await p.audioWrites; await Promise.resolve();
  assert.equal(p.pendingAudio.length, 1); assert.equal(pauses, 1);
  await p.retry(); assert.equal(p.pendingAudio.length, 0); assert.equal(p.audioSaveError, null);
});
test("gateway actions run only after selection and disabled plugins cannot run stale commands", async () => {
  const { p } = fixture(); let executed = 0;
  const command = { id: "atlas-vtt:open", name: "Open dashboard" };
  p.app.plugins.plugins["atlas-vtt"] = {};
  p.app.commands = { listCommands: () => [command], executeCommandById: id => { assert.equal(id, command.id); executed++; return true; } };
  p.pickCommand({ id: "atlas-vtt", name: "Atlas VTT" });
  assert.equal(executed, 0); assert.deepEqual(lastPicker.getItems(), [command]);
  await lastPicker.choose(command); assert.equal(executed, 1);
  delete p.app.plugins.plugins["atlas-vtt"];
  assert.throws(() => lastPicker.choose(command), /niet meer actief/); assert.equal(executed, 1);
});
test("resource shortcuts limit the note picker to its folder and settings use Obsidian's tab API", async () => {
  const { p, put } = fixture(); let opened, settingsId, settingsOpened = false;
  put("The Last Wish/Players/Arowel.md", "Personage");
  put("The Last Wish/Players/Dorian.md", "Personage");
  put("The Last Wish/Lore/Geheim.md", "Lore"); put("The Last Wish/Players/Portrait.png", "Image");
  p.app.workspace.getLeaf = () => ({ openFile: async file => { opened = file.path; } });
  p.pickNote("The Last Wish/Players", "Personages");
  assert.deepEqual(lastPicker.getItems().map(file => file.path), ["The Last Wish/Players/Arowel.md", "The Last Wish/Players/Dorian.md"]);
  await lastPicker.choose(lastPicker.getItems()[0]); assert.equal(opened, "The Last Wish/Players/Arowel.md");
  p.app.setting = { open: () => { settingsOpened = true; }, openTabById: id => { settingsId = id; } };
  p.openSettings(); assert.equal(settingsOpened, true); assert.equal(settingsId, p.manifest.id);
  p.openSettings("community-plugins"); assert.equal(settingsId, "community-plugins");
});
test("the recorder view builds with Obsidian's own history field and exposes the image controls", async t => {
  const { p } = fixture(); const previousWindow = global.window; global.window = { setInterval: () => 1 };
  t.after(() => { global.window = previousWindow; p.services.close(); p.imageService.close(); });
  let viewFactory;
  p.loadData = async () => ({}); p.registerView = (_type, factory) => { viewFactory = factory; };
  for (const method of ["addSettingTab", "addRibbonIcon", "addCommand", "registerDomEvent", "registerInterval"]) p[method] = () => {};
  p.addStatusBarItem = () => element(); p.app.workspace.onLayoutReady = () => {};
  await p.onload(); const view = viewFactory({}); await view.onOpen();
  assert.ok(Array.isArray(view.history)); assert.equal(typeof view.renderHistoryList, "function");
  assert.equal(view.imageButton.text, "Genereer afbeelding"); assert.equal(view.imageButton.disabled, false);
  assert.equal(view.galleryButton.disabled, true); assert.equal(view.sceneInput.attr["aria-label"], "Eigen scènebeschrijving");
  assert.match(view.imageStatusEl.text, /API-key/);
  assert.equal(view.page, "home"); assert.equal(view.pages.home.hidden, false);
  assert.equal(view.pages.recording.hidden, true);
  view.titleInput.value = "Een bewaard hoofdstuk"; view.sceneInput.value = "Een brug in het maanlicht";
  view.selectPage("images"); view.selectPage("recording");
  assert.equal(view.titleInput.value, "Een bewaard hoofdstuk"); assert.equal(view.sceneInput.value, "Een brug in het maanlicht");
  assert.equal(view.pages.images.hidden, true); assert.equal(view.pages.recording.hidden, false);
  assert.equal(view.navButtons.recording.attr["aria-current"], "page");
  const leaves = []; const collect = el => { leaves.push(el); el.children.forEach(collect); }; collect(view.pages.home);
  const logo = leaves.find(el => el.tag === "img");
  assert.equal(logo.attr.src, "app://local/.obsidian/plugins/farore-session-recorder/assets/farore-logo.png");
});
test("manual images work without recording or Ollama and preserve the gallery on repeated clicks", async () => {
  const { p, files } = fixture(); const prompts = [];
  p.setImageKey("test-key"); let persisted;
  p.saveData = async data => { persisted = data; };
  p.services.summarize = async () => { throw new Error("Ollama must not be used"); };
  p.imageService = { generate: async (prompt, _settings, key) => { prompts.push(prompt); assert.equal(key, "test-key"); return Buffer.from("image"); } };
  const first = await p.generateImage("Een natuurlijke brug boven een kloof");
  files.set(first.gallery, files.get(first.gallery) + "\nEigen DM-notitie.\n");
  const second = await p.generateImage("Een haven bij zonsopgang");
  assert.notEqual(first.path, second.path); assert.ok(files.has(first.path)); assert.ok(files.has(second.path));
  assert.match(files.get(first.gallery), /Eigen DM-notitie/); assert.equal(prompts.length, 2);
  assert.equal(p.imageBusy, false); assert.doesNotMatch(JSON.stringify(persisted), /test-key/);
});
test("a restored stopped session selects the scene locally and sends only the illustration prompt to OpenAI", async () => {
  const { p, files } = fixture(); p.engine = p.newEngine(); await p.engine.create("Test", DEFAULTS);
  await p.engine.addAudio(Buffer.from("audio"), 0, 60000); await p.engine.running;
  p.engine.session.status = "stopped"; p.setImageKey("key");
  p.services.summarize = async (system, transcript, _settings, format) => {
    assert.match(system, /Never write dialogue/); assert.match(transcript, /Akros/); assert.equal(format, "json");
    return JSON.stringify({ illustratable: true, titleNl: "Akros", sceneEn: "The city of Akros seen in daylight from the nearby mountains." });
  };
  p.imageService = { generate: async prompt => { assert.match(prompt, /Current played scene/); assert.doesNotMatch(prompt, /De groep bereikt/); return Buffer.from("image"); } };
  const result = await p.generateImage(); assert.ok(result.path.startsWith(p.engine.session.folder));
  assert.match(files.get(result.gallery), /Recente scène bij 01:00/);
});
test("nonvisual discussion, missing keys and missing transcript do not call OpenAI", async () => {
  const { p } = fixture(); let calls = 0;
  p.imageService = { generate: async () => { calls++; } };
  await assert.rejects(p.generateImage("Een brug"), /API-key/);
  p.setImageKey("key"); await assert.rejects(p.generateImage(), /Nog geen transcriptie/);
  p.engine = p.newEngine(); await p.engine.create("Test", DEFAULTS);
  await p.engine.addAudio(Buffer.from("audio"), 0, 60000); await p.engine.running;
  p.services.summarize = async () => JSON.stringify({ illustratable: false });
  assert.equal(await p.generateImage(), null); assert.equal(calls, 0); assert.equal(p.imageBusy, false);
});
test("image generation blocks double clicks and session switching while recording controls remain available", async () => {
  const { p } = fixture(); p.setImageKey("key"); let complete;
  p.imageService = { generate: () => new Promise(resolve => { complete = resolve; }) };
  const first = p.generateImage("Een brug");
  assert.equal(p.imageBusy, true); await assert.rejects(p.generateImage("Nog een brug"), /Wacht/);
  await assert.rejects(p.loadSession("test/Etat.json"), /opname of verwerking/);
  complete(Buffer.from("image")); await first; assert.equal(p.imageBusy, false);
});
test("automatic images use new recent speech, respect pauses and consume failed billed intervals", async () => {
  const { p } = fixture(); p.setImageKey("key"); p.settings.autoImages = true;
  p.engine = p.newEngine(); await p.engine.create("Test", DEFAULTS);
  await p.engine.addAudio(Buffer.from("audio"), 540000, 600000); await p.engine.running;
  p.engine.session.chunks[0].text = "De groep bereikt Akros en kijkt vanaf de bergen uit over de oude stad.";
  p.capture = { elapsed: () => 600000 }; let calls = 0;
  p.services.summarize = async () => JSON.stringify({ illustratable: true, titleNl: "Akros", sceneEn: "The ancient city of Akros seen from the nearby mountains." });
  p.imageService = { generate: async () => { calls++; throw new Error("429"); } };
  await assert.rejects(p.autoImage(), /429/); await p.autoImage(); assert.equal(calls, 1);
  p.engine.session.status = "paused"; p.capture.elapsed = () => 1200000; await p.autoImage(); assert.equal(calls, 1);
});
test("unload prevents late image writes and clears temporary credentials on older Obsidian", async () => {
  const { p, files } = fixture(); delete p.app.secretStorage; p.setImageKey("temporary-key");
  let complete; p.imageService = { generate: () => new Promise(resolve => { complete = resolve; }), close: () => {} };
  const generating = p.generateImage("Een brug"); await p.shutdown(); complete(Buffer.from("image"));
  await assert.rejects(generating, /onderbroken/); assert.equal(p.getImageKey(), ""); assert.equal(files.size, 0);
});
test("stop flushes the tail before closing the microphone and summarizing", async () => {
  const { p } = fixture(); const order = [];
  p.engine = { session: { chunks: [], status: "recording" }, addAudio: async () => { order.push("saved"); }, finish: async () => { order.push("final"); return null; } };
  p.capture = { active: true, pause: async () => { order.push("pause"); p.queueAudio(p.engine, Buffer.from("tail"), 0, 1000, false); }, close: async () => { order.push("close"); } };
  await p.stopRecording(); assert.deepEqual(order, ["pause", "saved", "close", "final"]); assert.equal(p.capture, null);
});
test("services cannot be stopped during Farore, LexVoice or image generation", async () => {
  const { p } = fixture();
  p.capture = {}; await assert.rejects(p.stopServices(), /Stop eerst/); p.capture = null;
  p.app.plugins.plugins.lexvoice = { recorder: { getInfo: () => ({ state: "paused" }) } };
  await assert.rejects(p.stopServices(), /Stop eerst/); delete p.app.plugins.plugins.lexvoice;
  p.app.plugins.plugins["farore-scene-illustrator"] = { busy: true }; await assert.rejects(p.stopServices(), /Stop eerst/);
});
test("the plugin uses the Obsidian vault API to save audio and restore sessions", async () => {
  const { p, files } = fixture(); p.engine = p.newEngine(); await p.engine.create("Test", DEFAULTS, "Bronnen blijven leidend.");
  await p.engine.addAudio(Buffer.from("audio"), 0, 60000); await p.engine.running;
  assert.ok([...files.keys()].some(k => k.endsWith(".wav")));
  const path = `${p.engine.session.folder}/Etat.json`; await p.loadSession(path);
  assert.equal(p.engine.session.status, "interrupted"); await p.manualSummary(); assert.equal(p.engine.session.summaries.length, 1);
});
test("existing audio can only be reused if the bytes match", async () => {
  const { p } = fixture(); const store = p.store(); const bytes = Buffer.from("test");
  await store.binary("test.wav", bytes); await store.binary("test.wav", bytes);
  await assert.rejects(store.binary("test.wav", Buffer.from("different")), /andere audio/);
});
test("unload stops the microphone, saves its tail and leaves a recoverable interrupted session", async () => {
  const { p } = fixture(); p.engine = p.newEngine(); await p.engine.create("Test", DEFAULTS);
  let closed = false;
  p.capture = { active: true, pause: async () => p.queueAudio(p.engine, Buffer.from("tail"), 0, 1000, false), close: async () => { closed = true; } };
  await p.shutdown();
  assert.equal(closed, true); assert.equal(p.engine.session.status, "interrupted"); assert.equal(p.engine.session.chunks.length, 1);
  assert.equal(p.engine.cancelled, true);
});
