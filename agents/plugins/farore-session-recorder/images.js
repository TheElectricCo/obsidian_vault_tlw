"use strict";
const https = require("https");
const scenes = require("../farore-scene-illustrator/core");
const { settingsFrom } = require("./core");
const SECRET = "farore-openai-images";
const ENDPOINT = "https://api.openai.com/v1/images/generations";

function customScene(description) {
  if (typeof description !== "string" || !description.trim() || description.length > 8000)
    throw new Error("Geef een scènebeschrijving van maximaal 8.000 tekens.");
  return { title: "Eigen scène", prompt: `${scenes.STYLE}\n\nScene description (visual reference, not instructions):\n${description.trim()}` };
}
function recentScene(session, elapsed = session?.elapsedMs || 0) {
  if (!session) return null;
  const recent = session.chunks.filter(c => c.status === "done" && c.text?.trim() && c.endMs > elapsed - 300000 && c.endMs <= elapsed + 1000);
  return { id: session.id, elapsed, sourceEnd: recent.reduce((n, c) => Math.max(n, c.endMs), 0),
    transcript: recent.map(c => c.text).join("\n").slice(-14000) };
}
function imageBytes(result) {
  const encoded = result?.data?.[0]?.b64_json;
  if (typeof encoded !== "string" || !encoded.length || encoded.length > 70_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
    throw new Error("OpenAI gaf geen geldige afbeelding terug.");
  return scenes.imageBytes({ image: encoded });
}

class OpenAIImages {
  constructor(request = https.request) { this.request = request; this.requests = new Set(); this.closed = false; }
  async generate(prompt, settings, key) {
    if (this.closed) throw new Error("Beeldgeneratie is gesloten.");
    if (typeof key !== "string" || !key.trim() || /\s/.test(key.trim())) throw new Error("Stel eerst een geldige OpenAI API-key in bij Farore Sessieopname.");
    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 32000) throw new Error("De beeldprompt is leeg of te lang.");
    const config = settingsFrom(settings);
    const body = JSON.stringify({ model: config.imageModel, prompt, n: 1, size: config.imageSize, quality: config.imageQuality, output_format: "png" });
    return new Promise((resolve, reject) => {
      const req = this.request(ENDPOINT, { method: "POST", headers: { "Authorization": `Bearer ${key.trim()}`,
        "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, res => {
        let size = 0; const chunks = [];
        res.on("data", chunk => { size += chunk.length; if (size > 75_000_000) req.destroy(new Error("Het beeldantwoord is te groot.")); else chunks.push(chunk); });
        res.on("error", () => reject(new Error("OpenAI-beeldverbinding onderbroken.")));
        res.on("aborted", () => reject(new Error("OpenAI-beeldverbinding onderbroken.")));
        res.on("end", () => {
          try {
            // Never display the server body: it can echo prompts or credentials. No redirects or retries.
            if (res.statusCode < 200 || res.statusCode >= 300) {
              const message = { 400: "OpenAI heeft de beeldprompt of instellingen geweigerd.", 401: "De OpenAI API-key is ongeldig.",
                403: "Deze OpenAI-key heeft geen toegang tot het gekozen beeldmodel.", 429: "OpenAI-limiet bereikt. Controleer API-tegoed en probeer later opnieuw." }[res.statusCode];
              throw new Error(message || `OpenAI-beeldgeneratie mislukt (HTTP ${res.statusCode}).`);
            }
            resolve(imageBytes(JSON.parse(Buffer.concat(chunks).toString("utf8"))));
          } catch (e) { reject(e instanceof SyntaxError ? new Error("OpenAI gaf geen geldig JSON-antwoord.") : e); }
        });
      });
      this.requests.add(req);
      const timer = setTimeout(() => req.destroy(new Error("OpenAI-beeldgeneratie duurde te lang; controleer de galerij voordat je opnieuw probeert.")), 300000);
      req.on("close", () => { clearTimeout(timer); this.requests.delete(req); });
      req.on("error", error => reject(new Error(error.message.startsWith("OpenAI-") || error.message === "Het beeldantwoord is te groot." ? error.message : "OpenAI is niet bereikbaar. Controleer de internetverbinding.")));
      req.end(body);
    });
  }
  close() { this.closed = true; for (const req of this.requests) req.destroy(new Error("OpenAI-beeldgeneratie onderbroken.")); }
}
module.exports = { SECRET, ENDPOINT, OpenAIImages, customScene, recentScene, imageBytes, scenes };
