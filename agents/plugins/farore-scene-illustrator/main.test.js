"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const core = require("./core");
const originalLoad = Module._load;
Module._load = function (id, ...args) {
  if (id === "obsidian") return { Plugin: class {}, PluginSettingTab: class {}, ItemView: class {}, Notice: class {}, normalizePath: s => s };
  return originalLoad.call(this, id, ...args);
};
const ScenePlugin = require("./main");
Module._load = originalLoad;

const selection = { message: { content: JSON.stringify({ illustratable: true, titleNl: "De brug", sceneEn: "An ancient stone bridge spans a misty mountain gorge in the warm morning sunlight." }) } };
const png = Buffer.alloc(32); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);

function setup(request) {
  const plugin = new ScenePlugin();
  const fixture = { recorder: { getInfo: () => ({ state: fixture.state, elapsed: 600_000 }) }, state: "recording",
    session: { id: "live-test", mdPath: "session.md", segments: [{ startOffsetMs: 540_000, endOffsetMs: 590_000, text: "De groep staat op de oude brug. Beneden hen ligt een diepe bergkloof vol mist." }] } };
  const files = new Map(); let calls = 0;
  plugin.settings = { ...core.DEFAULTS }; plugin.runs = {}; plugin.requests = new Set(); plugin.busy = false;
  plugin.saveData = async () => {}; plugin.show = async () => {};
  plugin.request = async (...args) => { calls++; return request(...args); };
  plugin.app = { plugins: { plugins: { lexvoice: fixture } }, workspace: { getLeavesOfType: () => [] }, vault: {
    getAbstractFileByPath: p => files.has(p) ? { path: p } : null,
    createFolder: async p => files.set(p, "folder"),
    createBinary: async (p, data) => files.set(p, data),
    create: async (p, data) => files.set(p, data),
    append: async (file, text) => files.set(file.path, files.get(file.path) + text),
  } };
  return { plugin, fixture, files, calls: () => calls };
}

test("automatic success writes an image, provenance and gallery exactly once", async () => {
  const h = setup(async url => url.includes("/api/chat") ? selection : { image: png.toString("base64") });
  await h.plugin.tick(); await h.plugin.tick();
  assert.equal(h.calls(), 2);
  assert.equal(h.plugin.runs["live-test"].bucket, 1);
  assert.equal([...h.files.keys()].filter(p => p.endsWith(".png")).length, 1);
  assert.ok([...h.files.values()].some(v => typeof v === "string" && v.includes("artisticInterpretation")));
  assert.ok([...h.files.keys()].some(p => p.endsWith("Galerij.md")));
});

test("nonvisual discussion is skipped without calling the image service", async () => {
  const h = setup(async () => ({ message: { content: '{"illustratable":false}' } }));
  await h.plugin.tick(); await h.plugin.tick();
  assert.equal(h.calls(), 1); assert.equal(h.files.size, 0);
  assert.equal(h.plugin.runs["live-test"].bucket, 1);
});

test("a failed image does not change the recorder or create a misleading gallery", async () => {
  const h = setup(async url => {
    if (url.includes("/api/chat")) return selection;
    throw new Error("Image service unavailable");
  });
  const log = console.error; console.error = () => {};
  try { await h.plugin.tick(); await h.plugin.tick(); } finally { console.error = log; }
  assert.equal(h.fixture.state, "recording"); assert.equal(h.files.size, 0);
  assert.ok(h.plugin.runs["live-test"].failedAt); assert.equal(h.calls(), 2);
  assert.equal(h.plugin.busy, false);
});

test("stopping while selecting a scene prevents the image request", async () => {
  const h = setup(async () => { h.fixture.state = "idle"; return selection; });
  await h.plugin.tick(); assert.equal(h.calls(), 1); assert.equal(h.files.size, 0);
});

test("stopping during image generation prevents saving or displaying it", async () => {
  const h = setup(async url => {
    if (url.includes("/api/chat")) return selection;
    h.fixture.state = "idle"; return { image: png.toString("base64") };
  });
  await h.plugin.tick(); assert.equal(h.calls(), 2); assert.equal(h.files.size, 0);
  assert.ok(!h.plugin.latest);
});

test("manual generation with no transcript performs no requests", async () => {
  const h = setup(async () => { throw new Error("Unexpected request"); });
  h.fixture.session.segments = [];
  await h.plugin.generate(true); assert.equal(h.calls(), 0);
});

test("manual generation remains available with the automatic timer disabled", async () => {
  const h = setup(async url => {
    await h.plugin.tick();
    return url.includes("/api/chat") ? selection : { image: png.toString("base64") };
  });
  h.plugin.settings.enabled = false;
  await h.plugin.generate(true);
  assert.ok(h.plugin.latest);
  assert.equal(h.calls(), 2);
  assert.equal(h.plugin.runs["live-test"].bucket, 0);
});

test("HTTP requests cannot use a remote or cloud destination", async () => {
  const h = setup(async () => {});
  await assert.rejects(ScenePlugin.prototype.request.call(h.plugin, "https://example.com/api/generate", {}, 100), /lokale verwerking/);
});
