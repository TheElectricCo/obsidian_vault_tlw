"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { integrations, commandsFor } = require("./gateway");

test("the gateway discovers new custom plugins and distinguishes disabled tools", () => {
  const commands = [
    { id: "farore-weather:forecast", name: "Weer voorspellen" },
    { id: "farore-weather-extra:other", name: "Andere tool" },
    { id: "atlas-vtt:open", name: "Open kaart" },
  ];
  const app = { commands: { listCommands: () => commands }, plugins: {
    manifests: { "farore-weather": { name: "Farore Weer", description: "Weer aan tafel." }, "farore-session-recorder": {}, "farore-scene-illustrator": {}, "atlas-vtt": {} },
    plugins: { "farore-weather": {}, "atlas-vtt": {} },
  } };
  const tools = integrations(app);
  const weather = tools.find(tool => tool.id === "farore-weather");
  assert.equal(weather.name, "Farore Weer"); assert.equal(weather.custom, true); assert.equal(weather.enabled, true);
  assert.deepEqual(weather.commands, [commands[0]]);
  const local = tools.find(tool => tool.id === "farore-scene-illustrator");
  assert.equal(local.installed, true); assert.equal(local.enabled, false);
  assert.ok(!tools.some(tool => tool.id === "farore-session-recorder"));
  assert.equal(tools.find(tool => tool.id === "atlas-vtt").enabled, true);
});

test("missing command APIs degrade gracefully and the registry fallback matches exact plugin IDs", () => {
  assert.deepEqual(commandsFor({}, "farore-test"), []);
  assert.ok(integrations({}).every(tool => !tool.enabled));
  const command = { id: "farore-test:open", name: "Open" };
  assert.deepEqual(commandsFor({ commands: { commands: { open: command } } }, "farore-test"), [command]);
});
