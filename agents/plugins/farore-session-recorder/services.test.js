"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { LocalServices } = require("./services");
const { DEFAULTS } = require("./core");
async function server(t, handler) {
  const s = http.createServer(handler); await new Promise(r => s.listen(0, "127.0.0.1", r));
  t.after(() => s.close()); return `http://127.0.0.1:${s.address().port}`;
}
test("multipart Whisper upload contains a playable WAV field and the selected language", async t => {
  let received;
  const url = await server(t, (req, res) => {
    const parts = []; req.on("data", p => parts.push(p)); req.on("end", () => {
      received = { text: Buffer.concat(parts).toString(), contentType: req.headers["content-type"], path: req.url };
      res.end(JSON.stringify({ text: "Tien goudstukken." }));
    });
  });
  const service = new LocalServices(); t.after(() => service.close());
  assert.equal(await service.transcribe(Buffer.from("RIFFwave"), { ...DEFAULTS, whisperUrl: url }), "Tien goudstukken.");
  assert.equal(received.path, "/v1/audio/transcriptions"); assert.match(received.contentType, /multipart\/form-data; boundary=/);
  assert.match(received.text, /filename="fragment.wav"/); assert.match(received.text, /name="language"\r\n\r\nnl/);
});
test("redirects and remote model responses are rejected", async t => {
  const url = await server(t, (req, res) => {
    if (req.url === "/redirect") { res.writeHead(302, { Location: "https://external.test" }); res.end(); }
    else res.end(JSON.stringify({ remote_host: "cloud", message: { content: "oops" } }));
  });
  const service = new LocalServices(); t.after(() => service.close());
  await assert.rejects(service.request(`${url}/redirect`), /HTTP 302/);
  await assert.rejects(service.request(`${url}/remote`), /Externe/);
  await assert.rejects(service.request("http://external.test"), /127.0.0.1/);
});
test("timeouts cancel pending requests and cleanup releases connections", async t => {
  const url = await server(t, () => {}); const service = new LocalServices();
  await assert.rejects(service.request(url, { timeout: 30 }), /niet op tijd/);
  const pending = service.request(url, { timeout: 10000 }); service.close();
  await assert.rejects(pending, /onderbroken/);
});
test("Ollama requires an installed local model and submits Dutch system instructions", async t => {
  let body, available = true;
  const url = await server(t, (req, res) => {
    if (req.url === "/api/tags") { res.end(JSON.stringify({ models: available ? [{ name: "llama3.1:8b" }] : [] })); return; }
    const parts = []; req.on("data", p => parts.push(p)); req.on("end", () => {
      body = JSON.parse(Buffer.concat(parts).toString()); res.end(JSON.stringify({ message: { content: "Verslag" }, done_reason: "stop" }));
    });
  });
  const service = new LocalServices(); t.after(() => service.close());
  assert.equal(await service.summarize("Schrijf Nederlands", "De groep reist", { ...DEFAULTS, ollamaUrl: url }), "Verslag");
  assert.equal(body.messages[0].role, "system"); assert.equal(body.messages[1].content, "De groep reist"); assert.equal(body.stream, false);
  available = false; await assert.rejects(service.summarize("", "", { ...DEFAULTS, ollamaUrl: url }), /niet geïnstalleerd/);
});
