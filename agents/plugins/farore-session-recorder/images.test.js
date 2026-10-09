"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { OpenAIImages, ENDPOINT, imageBytes, customScene, recentScene } = require("./images");
const { DEFAULTS, settingsFrom, SessionEngine } = require("./core");
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(24)]);

function mockRequest(status, result, received = {}) {
  return (url, options, callback) => {
    Object.assign(received, { url, options });
    const req = new EventEmitter();
    req.destroy = error => { req.emit("error", error); req.emit("close"); };
    req.end = body => {
      received.body = JSON.parse(body);
      queueMicrotask(() => {
        const res = new EventEmitter(); res.statusCode = status; callback(res);
        res.emit("data", Buffer.from(JSON.stringify(result))); res.emit("end"); req.emit("close");
      });
    };
    return req;
  };
}
test("OpenAI uses a fixed HTTPS endpoint, one PNG and the requested generation settings", async () => {
  const received = {}, service = new OpenAIImages(mockRequest(200, { data: [{ b64_json: png.toString("base64") }] }, received));
  assert.deepEqual(await service.generate("Een brug", DEFAULTS, "test-key"), png);
  assert.equal(received.url, ENDPOINT); assert.equal(received.options.headers.Authorization, "Bearer test-key");
  assert.deepEqual(received.body, { model: "gpt-image-1.5", prompt: "Een brug", n: 1, size: "1536x1024", quality: "medium", output_format: "png" });
  assert.equal(service.requests.size, 0); service.close();
});
test("invalid keys, settings and prompts cannot start an API request", async () => {
  let calls = 0; const service = new OpenAIImages(() => { calls++; throw new Error("Unexpected"); });
  for (const key of ["", "\n", "key\r\ninjected"]) await assert.rejects(service.generate("prompt", DEFAULTS, key), /API-key/);
  await assert.rejects(service.generate("", DEFAULTS, "key"), /prompt/);
  await assert.rejects(service.generate("prompt", { ...DEFAULTS, imageModel: "dall-e-3" }, "key"), /beeldinstelling/);
  assert.equal(calls, 0); service.close();
});
test("API failures and redirects are not retried and do not echo keys or response bodies", async () => {
  for (const status of [302, 400, 401, 403, 429, 500]) {
    const received = {}, service = new OpenAIImages(mockRequest(status, { error: { message: "private-key SECRET-PROMPT" } }, received));
    await assert.rejects(service.generate("SECRET-PROMPT", DEFAULTS, "private-key"), error => {
      assert.doesNotMatch(error.message, /private-key|SECRET-PROMPT/); return true;
    });
    assert.equal(service.requests.size, 0); service.close();
  }
});
test("closing the plugin cancels image generation and refuses new requests", async () => {
  let req;
  const service = new OpenAIImages(() => {
    req = new EventEmitter(); req.end = () => {}; req.destroy = error => { req.emit("error", error); req.emit("close"); }; return req;
  });
  const pending = service.generate("prompt", DEFAULTS, "test-key"); service.close();
  await assert.rejects(pending, /onderbroken/); assert.equal(service.requests.size, 0);
  await assert.rejects(service.generate("prompt", DEFAULTS, "test-key"), /gesloten/);
});
test("only PNG base64 responses are saved", () => {
  assert.deepEqual(imageBytes({ data: [{ b64_json: png.toString("base64") }] }), png);
  for (const data of [undefined, { data: [{ url: "https://example.com/key" }] }, { data: [{ b64_json: "evil?" }] }, { data: [{ b64_json: Buffer.from("not a PNG").toString("base64") }] }])
    assert.throws(() => imageBytes(data));
});
test("custom descriptions preserve the Theros constraints and recent scenes exclude failed and old speech", () => {
  assert.match(customScene("Een brug boven een kloof").prompt, /ancient Greek/);
  assert.throws(() => customScene(" ")); assert.throws(() => customScene("a".repeat(8001)));
  const snap = recentScene({ id: "s", elapsedMs: 600000, chunks: [
    { status: "done", text: "OLD", endMs: 1000 }, { status: "failed", text: "FAILED", endMs: 550000 },
    { status: "done", text: "CURRENT", endMs: 590000 }, { status: "done", text: "FUTURE", endMs: 620000 },
  ] });
  assert.equal(snap.transcript, "CURRENT"); assert.equal(snap.sourceEnd, 590000);
});
test("keys and unknown fields never enter plugin settings or persisted sessions", async () => {
  const value = { ...DEFAULTS, openaiKey: "secret", apiKey: "secret", accessToken: "secret" };
  assert.doesNotMatch(JSON.stringify(settingsFrom(value)), /secret/);
  let saved;
  const engine = new SessionEngine({ store: { folder: async () => {}, create: async () => {}, write: async (_path, text) => { saved = text; } } });
  await engine.create("Test", value); assert.doesNotMatch(saved, /secret/);
});
