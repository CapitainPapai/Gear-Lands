import { assetUrl, embeddedAudioBytes } from '../game/assets.js';

export class AudioEngine {
  constructor(manifest, settings = {}) {
    this.manifest = manifest;
    this.tracks = manifest.tracks;
    this.ctx = null;
    this.enabled = false;
    this.musicVolume = settings.music ?? .42;
    this.sfxVolume = settings.sfx ?? .65;
    this.buffers = new Map();
    this.loading = new Map();
    this.currentId = 0;
    this.requestedId = 0;
    this.music = null;
    this.token = 0;
    this.preview = false;
    this.contextKey = '';
    this.onChange = () => {};
    this.activeEffects = new Set();
  }
  async unlock() {
    if (!this.ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return false;
      this.ctx = new Context();
      this.master = this.ctx.createGain();
      this.master.gain.value = .85;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicVolume;
      this.musicBus.connect(this.master);
      this.effectsBus = this.ctx.createGain();
      this.effectsBus.gain.value = this.sfxVolume;
      this.effectsBus.connect(this.master);
      for (const [name, file] of Object.entries(this.manifest.effects)) this.load(file).catch(() => {});
    }
    await this.ctx.resume();
    this.enabled = true;
    this.setTrack(this.requestedId);
    return true;
  }
  async mute() {
    this.enabled = false;
    const token = ++this.token;
    if (this.music && this.ctx) {
      const old = this.music;
      old.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      old.gain.gain.setTargetAtTime(0, this.ctx.currentTime, .12);
      setTimeout(() => { try { old.source.stop(); } catch {} old.source.disconnect(); old.gain.disconnect(); }, 600);
      if (this.music === old) this.music = null;
    }
    this.activeEffects.forEach(source => { try { source.stop(); } catch {} });
    this.onChange(this.currentId, false, token);
  }
  async load(file) {
    if (this.buffers.has(file)) return this.buffers.get(file);
    if (this.loading.has(file)) return this.loading.get(file);
    const bytes = embeddedAudioBytes(file);
    const promise = (bytes ? Promise.resolve(bytes) : fetch(assetUrl(`audio/${file}`)).then(r => { if (!r.ok) throw new Error(`Audio ${r.status}`); return r.arrayBuffer(); })).then(b => this.ctx.decodeAudioData(b)).then(buffer => {
      this.buffers.set(file, buffer); this.loading.delete(file); return buffer;
    }).catch(error => { this.loading.delete(file); throw error; });
    this.loading.set(file, promise);
    return promise;
  }
  async setTrack(id, preview = false) {
    id = Math.max(0, Math.min(this.tracks.length - 1, id));
    this.requestedId = id;
    this.preview = preview;
    if (!this.enabled || !this.ctx) { this.onChange(id, false); return; }
    if (this.music && this.currentId === id) { this.onChange(id, true); return; }
    const token = ++this.token;
    try {
      const buffer = await this.load(this.tracks[id].file);
      if (token !== this.token || !this.enabled) return;
      const now = this.ctx.currentTime;
      if (this.music) {
        const old = this.music;
        old.gain.gain.cancelScheduledValues(now);
        old.gain.gain.setTargetAtTime(0, now, .45);
        setTimeout(() => { try { old.source.stop(); } catch {} old.source.disconnect(); old.gain.disconnect(); }, 2300);
      }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer; source.loop = true;
      const gain = this.ctx.createGain(); gain.gain.value = 0;
      source.connect(gain); gain.connect(this.musicBus);
      source.start(0, Math.random() * .1);
      gain.gain.setTargetAtTime(1, now + .05, .6);
      this.music = { source, gain };
      this.currentId = id;
      this.onChange(id, true);
    } catch (error) { console.warn('Не удалось загрузить музыкальную тему:', error); }
  }
  setContext({ zone = 0, boss = false, combat = false, rest = false, victory = false, started = false }) {
    if (this.preview) return;
    const key = `${zone}-${boss}-${combat}-${rest}-${victory}-${started}`;
    if (key === this.contextKey) return;
    this.contextKey = key;
    let id = 0;
    if (victory) id = 14;
    else if (rest) id = 2;
    else if (boss || combat) id = [3, 7, 10, 6, 12, 13][zone];
    else if (started) id = [1, 5, 9, 11, 12, 14][zone];
    else id = [0, 4, 8, 11, 12, 14][zone];
    this.setTrack(id);
  }
  clearPreview() { this.preview = false; this.contextKey = ''; }
  setMusicVolume(value) {
    this.musicVolume = value;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(value, this.ctx.currentTime, .06);
  }
  setSfxVolume(value) {
    this.sfxVolume = value;
    if (this.ctx) this.effectsBus.gain.setTargetAtTime(value, this.ctx.currentTime, .06);
  }
  play(name, volume = 1, pan = 0, pitch = 1) {
    if (!this.enabled || !this.ctx || this.activeEffects.size > 26) return;
    const file = this.manifest.effects[name];
    const buffer = this.buffers.get(file);
    if (!buffer) { if (file) this.load(file).catch(() => {}); return; }
    const source = this.ctx.createBufferSource(); source.buffer = buffer;
    source.playbackRate.value = pitch * (.97 + Math.random() * .06);
    const gain = this.ctx.createGain(); gain.gain.value = volume;
    const panner = this.ctx.createStereoPanner(); panner.pan.value = Math.max(-1, Math.min(1, pan));
    source.connect(gain); gain.connect(panner); panner.connect(this.effectsBus);
    this.activeEffects.add(source);
    source.onended = () => { this.activeEffects.delete(source); source.disconnect(); gain.disconnect(); panner.disconnect(); };
    source.start();
  }
}
