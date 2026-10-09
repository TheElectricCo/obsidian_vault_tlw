"use strict";
const http = require("http");
const { execFile } = require("child_process");
const os = require("os");
const path = require("path");
const { localUrl } = require("./core");

function run(file, args) {
  return new Promise((resolve, reject) => execFile(file, args, { timeout: 15000, maxBuffer: 256000, windowsHide: true },
    (error, stdout, stderr) => error ? reject(new Error(stderr.trim() || error.message)) : resolve(stdout)));
}
class LocalServices {
  constructor() { this.requests = new Set(); this.cancelled = false; }
  request(url, { method = "GET", body, headers = {}, timeout = 5000 } = {}) {
    const target = new URL(url); localUrl(target.origin);
    if (this.cancelled) return Promise.reject(new Error("Verbindingen zijn gesloten."));
    return new Promise((resolve, reject) => {
      if (body) headers = { ...headers, "Content-Length": Buffer.byteLength(body) };
      const req = http.request(target, { method, headers }, res => {
        let size = 0; const chunks = [];
        res.on("data", chunk => {
          size += chunk.length;
          if (size > 8_000_000) req.destroy(new Error("Het lokale antwoord is te groot."));
          else chunks.push(chunk);
        });
        res.on("error", reject); res.on("aborted", () => reject(new Error("Lokale verbinding onderbroken.")));
        res.on("end", () => {
          try {
            if (res.statusCode < 200 || res.statusCode >= 300) throw new Error(`Lokale service: HTTP ${res.statusCode}.`);
            const json = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (json.error) throw new Error(typeof json.error === "string" ? json.error : JSON.stringify(json.error));
            if (json.remote_host || json.remote_model) throw new Error("Externe AI-verwerking wordt niet gebruikt.");
            resolve(json);
          } catch (e) { reject(e); }
        });
      });
      this.requests.add(req);
      const timer = setTimeout(() => req.destroy(new Error("De lokale service antwoordde niet op tijd.")), timeout);
      req.on("close", () => { clearTimeout(timer); this.requests.delete(req); });
      req.on("error", reject); req.end(body);
    });
  }
  json(url, body, timeout) {
    return this.request(url, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" }, timeout });
  }
  async health(settings) {
    const results = await Promise.allSettled([
      this.request(`${settings.whisperUrl}/health`, { timeout: 2000 }),
      this.request(`${settings.ollamaUrl}/api/tags`, { timeout: 2000 }),
      this.request("http://127.0.0.1:11435/api/version", { timeout: 2000 }),
    ]);
    const models = results[1].status === "fulfilled" ? results[1].value.models || [] : [];
    return { whisper: results[0].status === "fulfilled" && results[0].value.status === "ok", ollama: results[1].status === "fulfilled",
      model: models.some(m => m.name === settings.textModel || m.name === `${settings.textModel}:latest`),
      images: results[2].status === "fulfilled" };
  }
  async agent(label, start) {
    if (process.platform !== "darwin") throw new Error("Automatisch starten/stoppen gebruikt macOS LaunchAgents. Start de diensten op dit systeem handmatig.");
    if (!["net.farore.whisper", "net.farore.scene-images"].includes(label)) throw new Error("Onbekende lokale dienst.");
    const domain = `gui/${process.getuid()}`, target = `${domain}/${label}`;
    let loaded = true;
    try { await run("/bin/launchctl", ["print", target]); } catch { loaded = false; }
    if (start) {
      if (!loaded) await run("/bin/launchctl", ["bootstrap", domain, path.join(os.homedir(), "Library", "LaunchAgents", `${label}.plist`)]);
      else await run("/bin/launchctl", ["kickstart", target]);
    } else if (loaded) await run("/bin/launchctl", ["bootout", target]);
  }
  async waitFor(url) {
    for (let n = 0; n < 60; n++) {
      if (this.cancelled) throw new Error("Starten geannuleerd.");
      try { const result = await this.request(url, { timeout: 2000 }); if (result.status !== "loading") return; } catch { /* warming up */ }
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error(`Dienst startte niet op tijd: ${url}`);
  }
  async start(settings, update = () => {}) {
    let state = await this.health(settings);
    if (!state.whisper) {
      if (settings.whisperUrl !== "http://127.0.0.1:8178") throw new Error("Start de aangepaste Whisper-service handmatig.");
      update("Whisper-model wordt geladen…"); await this.agent("net.farore.whisper", true); await this.waitFor(`${settings.whisperUrl}/health`);
    }
    if (!state.ollama && settings.ollamaUrl === "http://127.0.0.1:11434" && process.platform === "darwin") {
      update("Ollama wordt geopend…");
      try { await run("/usr/bin/open", ["-g", "-a", "Ollama"]); await this.waitFor(`${settings.ollamaUrl}/api/tags`); }
      catch (e) { update(`Whisper is klaar. Ollama starten lukte niet: ${e.message}`); }
    }
    if (settings.sceneService && !state.images) {
      update("Beeldservice wordt gestart…");
      try { await this.agent("net.farore.scene-images", true); await this.waitFor("http://127.0.0.1:11435/api/version"); }
      catch (e) { update(`Transcriptie beschikbaar; beeldservice niet gestart: ${e.message}`); }
    }
    return this.health(settings);
  }
  async stop(settings) {
    if (settings.whisperUrl !== "http://127.0.0.1:8178") throw new Error("Stop de aangepaste Whisper-service handmatig.");
    await this.agent("net.farore.whisper", false);
    if (settings.sceneService) await this.agent("net.farore.scene-images", false);
  }
  async transcribe(bytes, settings) {
    const boundary = `----Farore${require("crypto").randomBytes(16).toString("hex")}`;
    const fields = { response_format: "json", language: settings.language, temperature: "0.0", temperature_inc: "0.0" };
    const chunks = [];
    for (const [key, value] of Object.entries(fields)) chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="fragment.wav"\r\nContent-Type: audio/wav\r\n\r\n`));
    chunks.push(Buffer.from(bytes), Buffer.from(`\r\n--${boundary}--\r\n`));
    const result = await this.request(`${settings.whisperUrl}/v1/audio/transcriptions`, { method: "POST", body: Buffer.concat(chunks),
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` }, timeout: 180000 });
    if (typeof result.text !== "string") throw new Error("Whisper gaf geen geldig transcript terug.");
    return result.text.trim();
  }
  async summarize(instructions, text, settings) {
    // An installed local model is required before each generation, including recovery.
    const tags = await this.request(`${settings.ollamaUrl}/api/tags`);
    const model = (tags.models || []).find(m => m.name === settings.textModel || m.name === `${settings.textModel}:latest`);
    if (!model || /cloud/i.test(model.name) || model.remote_host || model.remote_model) throw new Error("Het gekozen lokale Ollama-model is niet geïnstalleerd.");
    const result = await this.json(`${settings.ollamaUrl}/api/chat`, {
      model: model.name, stream: false, keep_alive: "5m",
      messages: [{ role: "system", content: instructions }, { role: "user", content: text }],
      options: { temperature: 0.15, num_ctx: 16384, num_predict: 2200 },
    }, 240000);
    if (result.done_reason === "length") throw new Error("Verslag afgebroken door de uitvoerlimiet; de transcriptie blijft bewaard.");
    return result.message?.content;
  }
  close() { this.cancelled = true; for (const req of this.requests) req.destroy(new Error("Verwerking onderbroken.")); }
}
module.exports = { LocalServices, run };
