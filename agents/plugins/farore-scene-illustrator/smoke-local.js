"use strict";
// Explicit local integration check; generates one real sample without accessing a microphone.
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const Module = require("node:module");
const assert = require("node:assert/strict");
const core = require("./core");
const notices = [];
const originalLoad = Module._load;
Module._load = function (id, ...args) {
  if (id === "obsidian") return {
    Plugin: class {}, PluginSettingTab: class {}, ItemView: class {},
    Notice: class { constructor(text) { notices.push(text); } },
    normalizePath: value => value.replace(/\\/g, "/"),
  };
  return originalLoad.call(this, id, ...args);
};
const ScenePlugin = require("./main");
Module._load = originalLoad;

async function main() {
  if (!process.argv.includes("--generate")) throw new Error("Use --generate to request one local test image.");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "farore-scene-smoke-"));
  const locate = relative => path.join(root, relative);
  const file = relative => ({ path: relative });
  const known = new Set();
  const plugin = new ScenePlugin();
  plugin.settings = { ...core.DEFAULTS };
  plugin.runs = {}; plugin.requests = new Set(); plugin.busy = false; plugin.unloaded = false;
  plugin.saveData = async value => fs.writeFile(path.join(root, "plugin-state.json"), JSON.stringify(value, null, 2));
  plugin.show = async () => { plugin.previewRequested = true; };
  plugin.app = {
    plugins: { plugins: { lexvoice: {
      recorder: { getInfo: () => ({ state: "recording", elapsed: 600_000 }) },
      session: { id: "technical-preview", mdPath: "Technisch voorbeeld — geen gespeelde sessie.md", segments: [
        { startOffsetMs: 540_000, endOffsetMs: 590_000, text: "De reizigers staan op de brug van Phanarax. De oude stenen brug overspant een diepe bergkloof. De ochtendzon valt op de bronzen leuningen. Beneden ligt mist. De reizigers kijken uit over de kloof; er zijn geen vijanden zichtbaar." },
      ] },
    } } },
    workspace: { getLeavesOfType: () => [] },
    vault: {
      getAbstractFileByPath: relative => known.has(relative) ? file(relative) : null,
      createFolder: async relative => { await fs.mkdir(locate(relative), { recursive: true }); known.add(relative); },
      createBinary: async (relative, bytes) => { await fs.writeFile(locate(relative), Buffer.from(bytes)); known.add(relative); return file(relative); },
      create: async (relative, text) => { await fs.writeFile(locate(relative), text); known.add(relative); return file(relative); },
      append: async (target, text) => fs.appendFile(locate(target.path), text),
    },
  };
  const started = Date.now();
  await plugin.generate(false);
  assert.ok(plugin.latest, plugin.status);
  assert.ok(plugin.previewRequested);
  assert.equal(plugin.runs["technical-preview"].bucket, 1);
  assert.equal(core.due(plugin.current(), plugin.runs["technical-preview"]), false);
  const bytes = await fs.readFile(locate(plugin.latest.path));
  assert.equal(bytes.readUInt32BE(16), core.DEFAULTS.width);
  assert.equal(bytes.readUInt32BE(20), core.DEFAULTS.height);
  const gallery = await fs.readFile(locate(plugin.latest.gallery), "utf8");
  assert.ok(gallery.includes(plugin.latest.path));
  console.log(JSON.stringify({ root, image: locate(plugin.latest.path), gallery: locate(plugin.latest.gallery),
    title: plugin.latest.title, durationSeconds: (Date.now() - started) / 1000, notices }, null, 2));
  await fs.writeFile("/tmp/farore-scene-setup/smoke-result.json", JSON.stringify({ root, image: locate(plugin.latest.path), gallery: locate(plugin.latest.gallery),
    metadata: locate(plugin.latest.path.replace(/\.png$/, ".json")), title: plugin.latest.title }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
