"use strict";

const COMPANIONS = [
  ["atlas-vtt", "Atlas VTT", "Kaarten en de spelersweergave.", "map"],
  ["initiative-tracker", "Initiative Tracker", "Ontmoetingen en gevechtsvolgorde.", "swords"],
  ["obsidian-dice-roller", "Dice Roller", "Dobbelstenen aan tafel.", "dices"],
  ["obsidian-5e-statblocks", "Fantasy Statblocks", "Creatures en statblocks.", "book-open"],
  ["the-dm-compendium", "The DM Compendium", "Naslag voor de Dungeon Master.", "library"],
  ["realclaudian", "Claudian", "Je assistent in de vault.", "sparkles"],
  ["obsidian-git", "Git", "Versiebeheer van de vault.", "git-branch"],
];

// Obsidian's command registry is an internal API. Keep access in one place and
// degrade to plugin settings if a future Obsidian release changes it.
function commandsFor(app, id) {
  const registry = app.commands;
  const commands = registry?.listCommands?.() || Object.values(registry?.commands || {});
  return commands.filter(command => command.id?.startsWith(`${id}:`))
    .sort((a, b) => a.name.localeCompare(b.name, "nl"));
}
function integrations(app, ownId = "farore-session-recorder") {
  const plugins = app.plugins || {}, manifests = plugins.manifests || {};
  const customIds = new Set([...Object.keys(manifests), ...Object.keys(plugins.plugins || {})]
    .filter(id => id.startsWith("farore-") && id !== ownId));
  // Always show the existing local image tool, including when it is disabled.
  customIds.add("farore-scene-illustrator");
  const custom = [...customIds].sort().map(id => [id,
    id === "farore-scene-illustrator" ? "Lokale scènebeelden" : manifests[id]?.name || id,
    id === "farore-scene-illustrator" ? "Illustraties met je lokale beeldmodel." : manifests[id]?.description || "Custom Farore-tool.",
    id === "farore-scene-illustrator" ? "image" : "puzzle"]);
  return [...custom, ...COMPANIONS].map(([id, name, description, icon]) => ({
    id, name, description, icon, custom: id.startsWith("farore-"),
    installed: !!manifests[id] || !!plugins.plugins?.[id],
    enabled: !!plugins.plugins?.[id], commands: commandsFor(app, id),
  }));
}

module.exports = { commandsFor, integrations };
