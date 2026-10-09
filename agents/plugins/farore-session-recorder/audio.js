"use strict";
const { wav } = require("./core");

// The audio thread buffers PCM, keeping chunk boundaries independent of UI timers.
const WORKLET = `class FarorePCM extends AudioWorkletProcessor {
  constructor() {
    super(); this.active = false; this.buffer = new Float32Array(4096); this.offset = 0;
    this.port.onmessage = event => {
      const { type, id } = event.data;
      if (type === 'start') this.active = true;
      else { this.active = false; this.flush(); }
      this.port.postMessage({ ack: id });
    };
  }
  flush() {
    if (!this.offset) return;
    const samples = this.buffer.slice(0, this.offset);
    this.port.postMessage({ samples }, [samples.buffer]); this.offset = 0;
  }
  process(inputs) {
    if (!this.active || !inputs[0]?.length) return true;
    const channels = inputs[0];
    for (let i = 0; i < channels[0].length; i++) {
      let value = 0; for (const channel of channels) value += channel[i] || 0;
      this.buffer[this.offset++] = value / channels.length;
      if (this.offset === this.buffer.length) this.flush();
    }
    return true;
  }
}
registerProcessor('farore-pcm', FarorePCM);`;

class MicrophoneCapture {
  constructor({ seconds, onChunk, onLevel = () => {}, onEnded = () => {}, onError = () => {} }) {
    this.seconds = seconds; this.onChunk = onChunk; this.onLevel = onLevel; this.onEnded = onEnded; this.onError = onError;
    this.parts = []; this.length = 0; this.total = 0; this.pending = new Map(); this.sequence = 0;
  }
  async open(deviceId) {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}), channelCount: 1,
        echoCancellation: false, noiseSuppression: false, autoGainControl: false,
      }, video: false });
      this.context = new AudioContext({ sampleRate: 16000, latencyHint: "interactive" });
      this.rate = this.context.sampleRate; this.target = Math.round(this.seconds * this.rate);
      if (!this.context.audioWorklet) throw new Error("AudioWorklet is niet beschikbaar in deze Obsidian-versie.");
      const url = URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" }));
      try { await this.context.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
      this.node = new AudioWorkletNode(this.context, "farore-pcm");
      this.node.port.onmessage = e => {
        if (e.data.ack) { const item = this.pending.get(e.data.ack); if (item) { clearTimeout(item.timer); item.resolve(); this.pending.delete(e.data.ack); } }
        else if (e.data.samples) this.receive(e.data.samples);
      };
      this.node.onprocessorerror = () => this.onError(new Error("De audioprocessor is gestopt. Stop de opname en controleer de bewaarde fragmenten."));
      this.source = this.context.createMediaStreamSource(this.stream); this.gain = this.context.createGain(); this.gain.gain.value = 0;
      this.source.connect(this.node); this.node.connect(this.gain); this.gain.connect(this.context.destination);
      for (const track of this.stream.getTracks()) track.onended = () => { if (!this.closed) this.onEnded(); };
      await this.context.resume();
      if (this.context.state !== "running") throw new Error("Het audiosysteem kon niet starten.");
      this.context.onstatechange = () => { if (!this.closed && this.active && this.context.state !== "running") this.onError(new Error("Audio onderbroken. Houd de Mac wakker en hervat de opname.")); };
    } catch (e) { await this.close(); throw e; }
  }
  command(type) {
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error("De audioprocessor antwoordt niet.")); }, 5000);
      this.pending.set(id, { resolve, reject, timer }); this.node.port.postMessage({ type, id });
    });
  }
  async start() { await this.context.resume(); this.active = true; await this.command("start"); }
  async pause() { this.active = false; await this.command("pause"); this.flush(); this.onLevel(0); }
  receive(samples) {
    let sum = 0; for (const s of samples) sum += s * s;
    this.onLevel(Math.sqrt(sum / samples.length));
    for (let offset = 0; offset < samples.length;) {
      const size = Math.min(this.target - this.length, samples.length - offset);
      this.parts.push(samples.slice(offset, offset + size)); this.length += size; offset += size; this.total += size;
      if (this.length === this.target) this.flush();
    }
  }
  flush() {
    if (!this.length) return;
    const samples = new Float32Array(this.length); let offset = 0, power = 0;
    for (const part of this.parts) { samples.set(part, offset); offset += part.length; }
    for (const sample of samples) power += sample * sample;
    const start = (this.total - this.length) / this.rate * 1000, end = this.total / this.rate * 1000;
    const bytes = wav(samples, this.rate), silent = Math.sqrt(power / samples.length) < 0.0001;
    this.parts = []; this.length = 0; this.onChunk(bytes, start, end, silent);
  }
  elapsed() { return this.rate ? this.total / this.rate * 1000 : 0; }
  async close() {
    this.closed = true; this.active = false;
    for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(new Error("Microfoon gesloten.")); }
    this.pending.clear(); this.source?.disconnect(); this.node?.disconnect(); this.gain?.disconnect();
    for (const track of this.stream?.getTracks() || []) { track.onended = null; track.stop(); }
    if (this.context && this.context.state !== "closed") await this.context.close();
  }
}
module.exports = { MicrophoneCapture, WORKLET };
