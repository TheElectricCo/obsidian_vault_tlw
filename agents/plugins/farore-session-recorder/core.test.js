"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { SessionEngine, DEFAULTS, settingsFrom, outputPath, localUrl, wav, groups, coverage } = require("./core");

function fixture(overrides = {}) {
  const files = new Map(), calls = [];
  const store = {
    folder: async () => {},
    create: async (p, text) => { assert.ok(!files.has(p)); files.set(p, text); },
    write: async (p, text) => files.set(p, text),
    binary: async (p, bytes) => files.set(p, Buffer.from(bytes)),
    read: async p => { if (!files.has(p)) throw new Error("Missing file"); return files.get(p); },
    readBinary: async p => { if (!files.has(p)) throw new Error("Missing audio"); return files.get(p); },
    appendOnce: async (p, marker, block) => { const text = files.get(p); if (!text.includes(marker)) files.set(p, text + block); },
  };
  const engine = new SessionEngine({ store,
    transcribe: async bytes => { calls.push(Buffer.from(bytes).toString()); return "De groep bereikt Akros."; },
    summarize: async (system, text) => { calls.push({ system, text }); return "## Gebeurtenissen\n- De groep bereikt Akros."; }, ...overrides });
  return { engine, store, files, calls };
}
async function ready(h) { await h.engine.create("Test / Sessie", DEFAULTS, "Spelling: Akros"); return h; }
async function settled(e) { do { if (e.running) await e.running; else break; } while (e.running); }

test("settings exclude remote endpoints, source books, traversal and cloud models", () => {
  for (const value of ["https://127.0.0.1", "http://localhost", "http://evil.test", "http://user:pass@127.0.0.1", "file:///tmp"]) assert.throws(() => localUrl(value));
  for (const value of ["D&D 5E/Base Edition", "atlas-vtt/test", "Farore", "../oops", "/tmp", ".obsidian", "foo/../D&D 5E", "foo\\bar"]) assert.throws(() => outputPath(value));
  assert.throws(() => settingsFrom({ textModel: "gpt-oss:120b-cloud" }));
  assert.equal(settingsFrom({ chunkSeconds: -1, summaryMinutes: "oops" }).chunkSeconds, 60);
});
test("WAV encoding produces valid mono PCM, clips safely and has the correct duration", () => {
  const data = wav(new Float32Array([-2, -1, 0, 1, 2, NaN]), 16000);
  assert.equal(data.toString("ascii", 0, 4), "RIFF"); assert.equal(data.toString("ascii", 8, 12), "WAVE");
  assert.equal(data.readUInt32LE(24), 16000); assert.equal(data.readUInt32LE(40), 12);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(i => data.readInt16LE(44 + i * 2)), [-32768, -32768, 0, 32767, 32767, 0]);
});
test("audio is saved before transcription and stopping creates a separate final draft", async () => {
  const h = await ready(fixture());
  await h.engine.addAudio(Buffer.from("audio"), 0, 60000); await settled(h.engine);
  const path = await h.engine.finish();
  assert.ok(h.files.has(h.engine.session.chunks[0].audioPath)); assert.equal(h.engine.session.status, "stopped");
  assert.equal(h.engine.session.chunks[0].status, "done");
  assert.match(h.files.get(`${h.engine.session.folder}/Transcript.md`), /De groep bereikt Akros/);
  assert.match(h.files.get(path), /concept — opname gestopt/); assert.match(h.files.get(path), /1\/1/);
  assert.ok(h.calls.find(c => c.system)?.system.includes("Schrijf nooit dialoog als een spelerpersonage"));
});
test("a failed request leaves durable audio and recovery retries exactly once without duplicating text", async () => {
  let fail = true, count = 0;
  const h = await ready(fixture({ transcribe: async () => { count++; if (fail) throw new Error("Offline"); return "Tien goudstukken."; } }));
  await h.engine.addAudio(Buffer.from("audio"), 0, 60000); await settled(h.engine);
  assert.equal(h.engine.session.chunks[0].status, "failed"); assert.match(coverage(h.engine.session), /Ontbrekende/);
  const other = new SessionEngine({ store: h.store, transcribe: h.engine.transcribe, summarize: h.engine.summarize });
  await other.load(`${h.engine.session.folder}/Etat.json`); fail = false;
  await other.retry(); await other.retry();
  assert.equal(count, 2); assert.equal(other.session.status, "interrupted");
  assert.equal(h.files.get(`${other.session.folder}/Transcript.md`).split("Tien goudstukken.").length - 1, 1);
});
test("crash after text checkpoint reuses the transcription and preserves manual additions", async () => {
  const h = await ready(fixture());
  let fail = true; const append = h.store.appendOnce;
  h.store.appendOnce = async (...args) => { if (fail) throw new Error("Disk error"); return append(...args); };
  await h.engine.addAudio(Buffer.from("audio"), 0, 60000); await settled(h.engine);
  assert.equal(h.engine.session.chunks[0].status, "failed");
  const path = `${h.engine.session.folder}/Transcript.md`; h.files.set(path, h.files.get(path) + "\nDM: naam gecorrigeerd.\n");
  fail = false; await h.engine.retry();
  assert.equal(h.calls.filter(c => typeof c === "string").length, 1);
  assert.match(h.files.get(path), /DM: naam gecorrigeerd/);
});
test("retry after journal-write failure does not duplicate the audio or time interval", async () => {
  const h = await ready(fixture()); const write = h.store.write; let fail = true;
  h.store.write = async (...args) => { if (fail) throw new Error("Full disk"); return write(...args); };
  await assert.rejects(h.engine.addAudio(Buffer.from("audio"), 0, 60000), /Full disk/);
  fail = false; await h.engine.addAudio(Buffer.from("audio"), 0, 60000); await settled(h.engine);
  assert.equal(h.engine.session.chunks.length, 1); assert.equal([...h.files.keys()].filter(p => p.endsWith(".wav")).length, 1);
});
test("strictly silent audio is retained and does not call Whisper", async () => {
  const h = await ready(fixture()); await h.engine.addAudio(Buffer.from("silence"), 0, 15000, true); await settled(h.engine);
  assert.equal(h.calls.length, 0); assert.equal(h.engine.session.chunks[0].status, "done");
  assert.equal(await h.engine.finish(), null);
});
test("summary outage does not discard transcript and regenerated drafts preserve edited versions", async () => {
  let fail = true;
  const h = await ready(fixture({ summarize: async () => { if (fail) throw new Error("Ollama unavailable"); return "## Recap\nDe groep bereikt Akros."; } }));
  await h.engine.addAudio(Buffer.from("audio"), 0, 60000); await settled(h.engine);
  await assert.rejects(h.engine.finish(), /Ollama unavailable/); assert.equal(h.engine.session.status, "stopped");
  fail = false; const first = await h.engine.makeSummary(true); h.files.set(first, "Edited by DM");
  const next = await h.engine.makeSummary(true); assert.notEqual(next, first); assert.equal(h.files.get(first), "Edited by DM");
});
test("summary processes every part of a long session, including the last loot item", async () => {
  const inputs = [];
  const h = await ready(fixture({ transcribe: async bytes => Buffer.from(bytes).toString(),
    summarize: async (_system, text) => { inputs.push(text); return text.includes("LAATSTE BELONING") ? "LAATSTE BELONING: sleutel." : "Bevestigde gebeurtenissen."; } }));
  for (let i = 0; i < 5; i++) await h.engine.addAudio(Buffer.from("bron ".repeat(3200) + (i === 4 ? "LAATSTE BELONING" : `deel ${i}`)), i * 60000, (i + 1) * 60000);
  await settled(h.engine); const path = await h.engine.finish();
  assert.ok(inputs.some(t => t.includes("deel 0"))); assert.ok(inputs.some(t => t.includes("deel 3")));
  assert.match(h.files.get(path), /LAATSTE BELONING/);
});
test("chunking retains all source text, including lines larger than the model window", () => {
  const text = "a".repeat(40000) + "\nTAIL";
  const chunks = groups(text); assert.ok(chunks.every(c => c.length <= 14001));
  assert.equal(chunks.join("").replace(/\n/g, ""), text.replace(/\n/g, ""));
});
test("a final summary waits for and survives a failed concurrent live summary", async () => {
  let finishLive; let n = 0;
  const h = await ready(fixture({ summarize: async () => { n++; if (n === 1) await new Promise((_r, reject) => { finishLive = () => reject(new Error("Transient")); }); return "Final draft"; } }));
  await h.engine.addAudio(Buffer.from("audio"), 0, 60000); await settled(h.engine);
  const live = h.engine.makeSummary(false); live.catch(() => {});
  const final = h.engine.makeSummary(true); finishLive();
  assert.ok(await final); assert.equal(n, 2);
});
test("scene snapshot excludes pauses and imported or old speech", async () => {
  const h = await ready(fixture()); await h.engine.addAudio(Buffer.from("audio"), 0, 60000); await settled(h.engine);
  assert.equal(h.engine.sceneSnapshot(90000).sourceEnd, 60000);
  assert.equal(h.engine.sceneSnapshot(500000).transcript, "");
  h.engine.session.status = "paused"; assert.equal(h.engine.sceneSnapshot(90000), null);
});
test("recovery refuses audio paths outside the session", async () => {
  const h = await ready(fixture()); await h.engine.addAudio(Buffer.from("audio"), 0, 60000); await settled(h.engine);
  h.engine.session.chunks[0].audioPath = "D&D 5E/private.wav"; await h.engine.persist();
  await assert.rejects(h.engine.load(`${h.engine.session.folder}/Etat.json`), /buiten/);
});
