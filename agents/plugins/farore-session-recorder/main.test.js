"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const original = Module._load;
class TFile { constructor(path) { this.path = path; this.name = path.split("/").at(-1); } }
Module._load = function (id, ...args) {
  if (id === "obsidian") return { Plugin: class {}, PluginSettingTab: class {}, Setting: class {}, ItemView: class {}, Notice: class {}, TFile };
  return original.call(this, id, ...args);
};
const Recorder = require("./main"); Module._load = original;
const { DEFAULTS } = require("./core");
function fixture() {
  const p = new Recorder(), files = new Map(), objects = new Map();
  const put = (path, value, folder = false) => { files.set(path, value); objects.set(path, folder ? { path } : new TFile(path)); };
  p.app = { plugins: { plugins: {} }, workspace: { getLeavesOfType: () => [], getLeaf: () => ({ openFile: async () => {} }) }, vault: {
    getAbstractFileByPath: path => objects.get(path), getFiles: () => [...objects.values()].filter(o => o instanceof TFile),
    createFolder: async path => put(path, "folder", true), create: async (path, text) => put(path, text),
    createBinary: async (path, bytes) => put(path, Buffer.from(bytes)), modify: async (file, text) => put(file.path, text),
    read: async file => files.get(file.path), readBinary: async file => files.get(file.path),
    process: async (file, fn) => put(file.path, fn(files.get(file.path))),
  } };
  p.settings = { ...DEFAULTS }; p.recent = []; p.pendingAudio = []; p.audioWrites = Promise.resolve();
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
