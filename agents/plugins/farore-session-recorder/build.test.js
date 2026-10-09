"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path"), vm = require("node:vm");
const { build } = require("./build");
test("the distribution loads without any relative filesystem dependencies", t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "farore-build-test-"));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  build(folder);
  const module = { exports: {} }, external = [];
  vm.runInNewContext(fs.readFileSync(path.join(folder, "main.js"), "utf8"), { module, Buffer, URL,
    require: id => {
      external.push(id); assert.ok(!id.startsWith("."));
      if (id === "obsidian") return { Plugin: class {}, PluginSettingTab: class {}, ItemView: class {}, FuzzySuggestModal: class {} };
      return require(id);
    },
  });
  assert.equal(typeof module.exports, "function"); assert.equal(typeof module.exports.prototype.getSceneSnapshot, "function");
  assert.ok(external.includes("obsidian"));
  assert.deepEqual(fs.readdirSync(folder).sort(), ["assets", "main.js", "manifest.json", "styles.css"]);
  assert.deepEqual(fs.readFileSync(path.join(folder, "assets/farore-logo.png")), fs.readFileSync(path.join(__dirname, "assets/farore-logo.png")));
  assert.deepEqual(fs.readFileSync(path.join(folder, "assets/farore-logo-transparent.png")), fs.readFileSync(path.join(__dirname, "assets/farore-logo-transparent.png")));
});
