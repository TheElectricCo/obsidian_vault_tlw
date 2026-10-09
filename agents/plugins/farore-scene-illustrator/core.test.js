"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("./core");

function live(elapsed = 600_000, state = "recording") {
  return { recorder: { getInfo: () => ({ state, elapsed }) }, session: {
    id: "session-1", mdPath: "The Last Wish/Sessions/Opnames/Verslagen/test.md",
    segments: [{ startOffsetMs: 540_000, endOffsetMs: 590_000, text: "De groep bereikt de oude brug. Er hangt mist boven de diepe kloof." }],
  } };
}

test("first image follows ten recorded minutes, once per interval", () => {
  assert.equal(core.due(core.snapshot(live(599_999))), false);
  assert.equal(core.due(core.snapshot(live())), true);
  assert.equal(core.due(core.snapshot(live()), { bucket: 1, sourceEnd: 590_000 }), false);
  const next = live(1_200_000);
  next.session.segments.push({ startOffsetMs: 1_140_000, endOffsetMs: 1_190_000, text: "De groep bevindt zich nu in de stad en bekijkt de bronzen poort." });
  assert.equal(core.due(core.snapshot(next), { bucket: 1, sourceEnd: 590_000 }), true);
});

test("idle, paused, completed and imported sessions never generate", () => {
  for (const state of ["idle", "paused"]) assert.equal(core.snapshot(live(600_000, state)), null);
  const done = live(); done.session.finalized = true;
  assert.equal(core.snapshot(done), null);
  const imported = live(); imported.session.source = "import";
  assert.equal(core.snapshot(imported), null);
  assert.equal(core.due(null), false);
});

test("only recent successful transcript segments are sent to the scene model", () => {
  const fixture = live();
  fixture.session.segments.unshift({ startOffsetMs: 0, endOffsetMs: 100_000, text: "Ancient scene no longer current" });
  fixture.session.segments.push({ startOffsetMs: 550_000, endOffsetMs: 599_000, error: "failed", text: "Unconfirmed error text" });
  const snap = core.snapshot(fixture);
  assert.ok(snap.transcript.includes("mist"));
  assert.ok(!snap.transcript.includes("Ancient"));
  assert.ok(!snap.transcript.includes("Unconfirmed"));
  assert.equal(snap.sourceEnd, 590_000);
});

test("missing, stale and already-used speech cannot produce a repeated scene", () => {
  const empty = live(); empty.session.segments = [];
  assert.equal(core.due(core.snapshot(empty)), false);
  const stale = live(900_000);
  assert.equal(core.due(core.snapshot(stale)), false);
  assert.equal(core.due(core.snapshot(live()), { sourceEnd: 590_000 }), false);
  assert.equal(core.due(core.snapshot(live()), { failedAt: 150_000 }, core.DEFAULTS, 180_000), false);
  assert.equal(core.due(core.snapshot(live()), { failedAt: 150_000 }, core.DEFAULTS, 220_000), true);
});

test("recording continuations use the current recording's time window", () => {
  const fixture = live(); fixture.session.continuationOffsetMs = 3_600_000;
  fixture.session.segments = [{ startOffsetMs: 4_140_000, endOffsetMs: 4_190_000, text: "De helden zijn inmiddels bij een Griekse tempel aangekomen." }];
  assert.equal(core.snapshot(fixture).sourceEnd, 590_000);
  assert.equal(core.due(core.snapshot(fixture)), true);
});

test("unsupported discussion is skipped, prompts retain the fixed Theros constraints", () => {
  assert.equal(core.sceneFrom({ message: { content: '{"illustratable":false}' } }), null);
  const scene = core.sceneFrom({ message: { content: JSON.stringify({ illustratable: true, titleNl: "De brug", sceneEn: "A weathered ancient bridge spans a deep chasm, viewed from behind distant travelers." }) } });
  assert.ok(scene.prompt.includes("Theros"));
  assert.ok(scene.prompt.includes("Nyx sky only"));
  assert.ok(scene.prompt.includes("absent from the scene"));
  assert.throws(() => core.sceneFrom({ message: { content: '{"illustratable":true}' } }));
});

test("invalid image bytes and remote responses are rejected before saving", () => {
  assert.throws(() => core.imageBytes({ image: Buffer.from("not an image").toString("base64") }));
  assert.throws(() => core.imageBytes({ image: "x", remote_host: "example.com" }));
  assert.throws(() => core.imageBytes({}));
});

test("session identifiers cannot escape the vault output folder", () => {
  assert.equal(core.safeSessionId("../../secret"), "______secret");
  assert.equal(core.settingsFrom({ intervalMinutes: 0 }).intervalMinutes, 1);
  assert.equal(core.settingsFrom({ intervalMinutes: "invalid" }).intervalMinutes, 10);
});
