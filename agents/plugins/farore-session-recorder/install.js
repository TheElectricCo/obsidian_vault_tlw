"use strict";
// Copy only maintained runtime files; local data.json is preserved.
const fs = require("fs");
const path = require("path");
const source = require("./build").build();
const vault = path.resolve(__dirname, "../../..");
if (!fs.existsSync(path.join(vault, ".obsidian"))) throw new Error("Geen Obsidian-vault gevonden.");
const destination = path.join(vault, ".obsidian/plugins/farore-session-recorder");
fs.mkdirSync(destination, { recursive: true });
for (const file of ["manifest.json", "main.js", "styles.css"])
  fs.copyFileSync(path.join(source, file), path.join(destination, file));
const configPath = path.join(vault, ".obsidian/community-plugins.json");
const enabled = JSON.parse(fs.readFileSync(configPath, "utf8"));
if (!Array.isArray(enabled)) throw new Error("Ongeldige community-plugins.json");
if (!enabled.includes("farore-session-recorder")) {
  enabled.push("farore-session-recorder"); fs.writeFileSync(configPath, JSON.stringify(enabled, null, 2) + "\n");
}
console.log(`Geïnstalleerd: ${destination}. Laad de plugin in Obsidian of heropen de vault wanneer er geen opname loopt.`);
