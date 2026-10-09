"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { MicrophoneCapture, WORKLET } = require("./audio");

test("worklet averages stereo, preserves tail ordering and excludes paused audio", () => {
  let Processor; const events = [];
  vm.runInNewContext(WORKLET, { Float32Array,
    AudioWorkletProcessor: class { constructor() { this.port = { postMessage: data => events.push(data) }; } },
    registerProcessor: (_name, type) => { Processor = type; },
  });
  const processor = new Processor();
  const block = [new Float32Array(128).fill(0.5), new Float32Array(128).fill(-0.25)];
  processor.process([block]); assert.equal(events.length, 0);
  processor.port.onmessage({ data: { type: "start", id: 1 } });
  for (let i = 0; i < 35; i++) processor.process([block]);
  processor.port.onmessage({ data: { type: "pause", id: 2 } });
  const audio = events.filter(e => e.samples);
  assert.deepEqual(audio.map(e => e.samples.length), [4096, 384]);
  assert.ok(audio.every(e => e.samples.every(s => s === 0.125)));
  assert.equal(events.at(-1).ack, 2);
  processor.process([block]); assert.equal(events.length, 4);
});
test("PCM boundaries have no dropped or duplicated samples and pause flush retains the tail", () => {
  const chunks = [];
  const capture = new MicrophoneCapture({ seconds: 1, onChunk: (...args) => chunks.push(args) });
  capture.rate = 16000; capture.target = 16000;
  for (let i = 0; i < 9; i++) capture.receive(new Float32Array(4096).fill(0.125));
  capture.flush();
  assert.equal(chunks.length, 3);
  assert.equal(chunks.reduce((n, c) => n + (c[0].length - 44) / 2, 0), 9 * 4096);
  assert.equal(chunks[0][1], 0); assert.equal(chunks[0][2], chunks[1][1]); assert.equal(chunks[1][2], chunks[2][1]);
  assert.equal(capture.elapsed(), 9 * 4096 / 16);
  assert.ok(chunks.every(c => !c[3]));
});
