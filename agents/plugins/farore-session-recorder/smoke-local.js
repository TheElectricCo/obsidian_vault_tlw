"use strict";
// Explicit opt-in: real local AI calls, synthetic audio only, output outside the vault.
if (!process.argv.includes("--run")) { console.log("Gebruik --run voor een echte lokale proef met synthetische audio."); process.exit(0); }
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { SessionEngine, DEFAULTS } = require("./core");
const { LocalServices } = require("./services");
async function main() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "farore-recorder-smoke-"));
  const source = path.join(temp, "synthetic.aiff"), sourceWav = path.join(temp, "synthetic.wav");
  const run = promisify(execFile);
  await run("/usr/bin/say", ["-v", "Xander", "-o", source,
    "De groep ontvangt tien goudstukken. Darius vindt een sleutel. De koning wordt verdacht, maar dat is nog niet bevestigd. De groep is van plan om Akros te bezoeken."]);
  await run("/opt/homebrew/bin/ffmpeg", ["-y", "-loglevel", "error", "-i", source, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", sourceWav]);
  const resolve = p => path.join(temp, p);
  const store = {
    folder: p => fs.mkdir(resolve(p), { recursive: true }), create: (p, text) => fs.writeFile(resolve(p), text, { flag: "wx" }),
    write: (p, text) => fs.writeFile(resolve(p), text), binary: (p, bytes) => fs.writeFile(resolve(p), Buffer.from(bytes)),
    read: p => fs.readFile(resolve(p), "utf8"), readBinary: p => fs.readFile(resolve(p)),
    appendOnce: async (p, marker, block) => { const text = await fs.readFile(resolve(p), "utf8"); if (!text.includes(marker)) await fs.appendFile(resolve(p), block); },
  };
  const services = new LocalServices();
  try {
    const health = await services.health(DEFAULTS); if (!health.whisper || !health.model) throw new Error("Start Whisper en lokaal llama3.1:8b voor deze proef.");
    const engine = new SessionEngine({ store, transcribe: (bytes, settings) => services.transcribe(bytes, settings),
      summarize: (system, text, settings) => services.summarize(system, text, settings) });
    const prompt = await fs.readFile(path.resolve(__dirname, "../../docs/session-recording/Sessienotities-prompt.md"), "utf8");
    await engine.create("Technische proef — geen gespeelde sessie", DEFAULTS, prompt);
    const bytes = await fs.readFile(sourceWav); const duration = (bytes.length - 44) / 32000 * 1000;
    await engine.addAudio(bytes, 0, duration); const summary = await engine.finish();
    if (engine.session.chunks[0].status !== "done") throw new Error(engine.session.chunks[0].error);
    if (!summary) throw new Error("Geen verslag geproduceerd.");
    const transcript = engine.session.chunks[0].text;
    if (!/sleutel/i.test(transcript) || !/goud/i.test(transcript)) throw new Error("Transcript mist de herkenbare controlewoorden.");
    console.log(JSON.stringify({ output: temp, transcript, summary: resolve(summary), status: engine.session.status,
      summaryText: await fs.readFile(resolve(summary), "utf8") }, null, 2));
  } finally { services.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
