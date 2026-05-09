

/* =========================================================================
   Quantum Score — entropy-driven generative music
   Source: NIST Randomness Beacon v2 — https://beacon.nist.gov/

   Design note (the harmony fix):
   Earlier versions mapped raw quantum bits to per-step on/off and per-step
   pitches. That produced an entropy artifact: the bits are uniform, but
   *music* isn't — random hits don't groove and random pitches against a
   chord don't resolve. The current version uses bits to SELECT from
   curated musical building blocks (drum patterns, rhythms, chord
   progressions, chord-tone-aware lead choices). Every bit is still named
   in the provenance panel — but the bits select *between* well-formed
   options, so every output is on-beat and harmonic.

   White noise for snare/hihat is filled from crypto.getRandomValues, not
   Math.random. Every musical decision traces to specific pulse bits.
   ========================================================================= */

const NIST_API = "https://beacon.nist.gov/beacon/2.0";

/* -------------------------------------------------------------------------
   1) FETCH A NIST PULSE
   ------------------------------------------------------------------------- */

async function fetchPulse({ chainIndex, pulseIndex } = {}) {
  const url = (chainIndex != null && pulseIndex != null)
    ? `${NIST_API}/chain/${chainIndex}/pulse/${pulseIndex}`
    : `${NIST_API}/pulse/last`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`NIST returned HTTP ${res.status}`);
  return res.json();
}

function getPulse(p) { return p?.pulse ?? p; }
function pulseLabel(p) {
  const x = getPulse(p);
  return `chain ${x.chainIndex} · pulse ${x.pulseIndex}`;
}
function pulseShareKey(p) {
  const x = getPulse(p);
  return `chain=${x.chainIndex}&pulse=${x.pulseIndex}`;
}
function pulseUrl(p) {
  const x = getPulse(p);
  return x?.uri || `${NIST_API}/chain/${x.chainIndex}/pulse/${x.pulseIndex}`;
}
function pulseBits(p) {
  const x = getPulse(p);
  if (!/^[0-9a-fA-F]+$/.test(x?.outputValue || "")) {
    throw new Error("Pulse has no usable outputValue");
  }
  const bytes = hexToBytes(x.outputValue);
  if (bytes.length < 24) throw new Error(`Pulse delivered ${bytes.length} bytes; need ≥ 24`);
  return bytesToBits(bytes);
}

/* -------------------------------------------------------------------------
   2) BIT HELPERS
   ------------------------------------------------------------------------- */

function hexToBytes(hex) {
  const out = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
function bytesToBits(bytes) {
  const bits = [];
  for (const b of bytes) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  return bits;
}
function bitsToInt(bits, start, count) {
  let n = 0;
  for (let i = 0; i < count; i++) n = (n << 1) | bits[start + i];
  return n;
}

/* -------------------------------------------------------------------------
   3) MUSIC THEORY — keys, scales, chord-aware mapping.
   ------------------------------------------------------------------------- */

const KEYS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

// Friendly modal scales — all 7-note diatonic. (Pentatonic etc. removed
// because they break diatonic chord progressions and 7-degree contour math.)
const SCALES = {
  "Major":         [0, 2, 4, 5, 7, 9, 11],
  "Natural minor": [0, 2, 3, 5, 7, 8, 10],
  "Dorian":        [0, 2, 3, 5, 7, 9, 10],
  "Mixolydian":    [0, 2, 4, 5, 7, 9, 10],
  "Lydian":        [0, 2, 4, 6, 7, 9, 11],
  "Aeolian":       [0, 2, 3, 5, 7, 8, 10],   // = nat. minor but labelled
  "Phrygian":      [0, 1, 3, 5, 7, 8, 10],
  "Harmonic minor":[0, 2, 3, 5, 7, 8, 11],
};
const SCALE_NAMES = Object.keys(SCALES);

// Diatonic Roman-numeral progressions. Each value is a 0-indexed scale degree
// for the chord root (so [0,4,5,3] = I-V-vi-IV in major).
const PROGRESSIONS = [
  [0, 4, 5, 3],   // I-V-vi-IV  (Axis of Awesome)
  [0, 5, 3, 4],   // I-vi-IV-V  (50s)
  [5, 3, 0, 4],   // vi-IV-I-V
  [0, 3, 4, 0],   // I-IV-V-I
  [1, 4, 0, 0],   // ii-V-I-I
  [0, 2, 5, 4],   // I-iii-vi-V
  [5, 1, 4, 0],   // vi-ii-V-I
  [0, 5, 1, 4],   // I-vi-ii-V
  [3, 0, 4, 5],   // IV-I-V-vi
  [0, 4, 3, 0],   // I-V-IV-I
  [5, 3, 4, 4],   // vi-IV-V-V
  [0, 0, 3, 4],   // I-I-IV-V
  [0, 2, 3, 4],   // I-iii-IV-V
  [4, 5, 3, 0],   // V-vi-IV-I
  [0, 3, 5, 4],   // I-IV-vi-V
  [5, 0, 3, 4],   // vi-I-IV-V
];
const PROG_LABELS = [
  "I–V–vi–IV", "I–vi–IV–V", "vi–IV–I–V", "I–IV–V–I",
  "ii–V–I–I",  "I–iii–vi–V","vi–ii–V–I", "I–vi–ii–V",
  "IV–I–V–vi", "I–V–IV–I",  "vi–IV–V–V", "I–I–IV–V",
  "I–iii–IV–V","V–vi–IV–I", "I–IV–vi–V", "vi–I–IV–V",
];

/* Drum patterns are 16-step strings: "1" hit, "0" rest. All hand-curated
   to groove. Kicks always anchor beat 1; snares always hit the backbeat. */
const KICK_PATTERNS = [
  "1000100010001000", // four-on-the-floor
  "1000000010001000", // basic dance
  "1010001010100010", // syncopated
  "1000100010101000", // funk
  "1000000010100000", // boom-bap
  "1000100110001000", // pushed
  "1000100010100010", // shuffle
  "1000000010010000", // sparse
  "1010100010001000", // 16th-leaning
  "1000100110001010", // garage
  "1001001010010000", // dembow
  "1000001010001000", // breakbeat A
  "1000000010101000", // breakbeat B
  "1100100010001000", // dotted
  "1000100010000100", // and-of-4
  "1010001010100010", // 16-syncopation
];
const SNARE_PATTERNS = [
  "0000100000001000", // 2 & 4 backbeat
  "0001100000001000", // 2-and 4
  "0000100000001100", // 4-and
  "0000100100001000", // sixteenth ghosts
  "0000100000011000", // pickup to 4
  "0000110000001000", // 2-trail
  "0000100000001010", // 4-and-of
  "0000100100001010", // ghost+pickup
];
const HAT_PATTERNS = [
  "1010101010101010", // straight 8ths
  "1111111111111111", // 16ths
  "1010101110101010", // syncopated 8ths
  "0010001000100010", // off-8ths only
  "1000100010001000", // quarters
  "1010101010101110", // 8ths + push
  "0101010101010101", // upbeats only
  "1010101010101011", // shuffle
];

/* Bass rhythm patterns. Each character is either:
     R = chord root, 5 = perfect fifth, 3 = third, . = rest    */
const BASS_PATTERNS = [
  "R...R...R...R...", // root every quarter
  "R.......R.......", // root every half
  "R...R...5...R...", // root + dom
  "R.5.R.5.R.5.R.5.", // root-fifth alternation
  "R...R.3.R...5...", // walking
  "R.....R.R.....5.", // syncopated
  "R...3...5...R...", // arpeggio
  "R.R.R...R.R.R...", // riff
];
const BASS_LABELS = [
  "Quarter root", "Half root", "Root–dom", "Root↔5",
  "Walking",      "Syncopated","Arpeggio", "Repeated riff",
];

/* Lead rhythm: 1 = strike a note, . = rest. Strikes will pick a pitch
   from the chord-tone palette using `Lead palette` bits. */
const LEAD_RHYTHMS = [
  "1.1.1.1.1.1.1.1.", // straight 8ths
  "1...1...1.1.1...", // hook 1
  "1.1...1.1...1.1.", // hook 2
  "1.....1.1.....1.", // sparse
  "1...1...1...1.1.", // call/response
  "1...1.....1.....", // very sparse
  "1.1.1.....1.1.1.", // bursts
  "1.1...1.1.1.1...", // syncopated
];
const LEAD_LABELS = [
  "Straight 8ths", "Hook A", "Hook B", "Sparse",
  "Call/response", "Very sparse", "Bursts", "Syncopated",
];

/* Lead pitch palette. Each 3-bit choice maps to a scale-degree offset
   from the current chord's root — heavily biased toward chord tones so
   every note resolves into the harmony. 7 = rest. */
const LEAD_PALETTE = [
  0,   // chord root
  2,   // chord third (in scale degrees)
  4,   // chord fifth
  7,   // octave up
  -3,  // sixth below (lower neighbour, sounds bluesy)
  1,   // 2nd (passing tone)
  5,   // 6th (passing tone)
  null,// rest
];
const LEAD_PALETTE_LABEL = ["root", "third", "fifth", "octave", "low6", "2nd", "6th", "rest"];

/* Synth timbres. Pads always use detuned dual-osc pairs for warmth. */
const LEAD_TIMBRES = ["sine", "triangle", "sawtooth", "square"];
const BASS_TIMBRES = ["sawtooth", "square", "triangle", "sine"];
const PAD_TIMBRES  = ["sine", "triangle", "sawtooth", "square"];

/* -------------------------------------------------------------------------
   4) BIT ALLOCATION — every named bit selects between musical options.
   ------------------------------------------------------------------------- */

const ALLOCATION = [
  { range: [0, 4],   field: "Key (root)"            },
  { range: [4, 3],   field: "Scale family"          },
  { range: [7, 6],   field: "Tempo (BPM)"           },
  { range: [13, 1],  field: "Swing"                 },
  { range: [14, 2],  field: "Energy/density"        },
  { range: [16, 2],  field: "Lead timbre"           },
  { range: [18, 2],  field: "Bass timbre"           },
  { range: [20, 2],  field: "Pad timbre"            },
  { range: [22, 4],  field: "Filter cutoff"         },
  { range: [26, 4],  field: "Delay send"            },
  { range: [30, 4],  field: "Delay feedback"        },
  { range: [34, 4],  field: "Chord progression"    },
  { range: [38, 2],  field: "Pad voicing"           },
  { range: [40, 4],  field: "Kick pattern (16)"     },
  { range: [44, 3],  field: "Snare pattern (8)"     },
  { range: [47, 3],  field: "Hat pattern (8)"       },
  { range: [50, 3],  field: "Bass pattern (8)"      },
  { range: [53, 3],  field: "Lead rhythm (8)"       },
  { range: [56, 48], field: "Lead palette · 16 × 3 bits" },
];
const ALLOC_END = 56 + 48;  // 104 bits used; pulse provides 512.

/* -------------------------------------------------------------------------
   5) COMPOSE — turn pulse bits into a fully-formed score.
   ------------------------------------------------------------------------- */

function compose(bits, pulseInfo) {
  const pull = (s, c) => bitsToInt(bits, s, c);

  const keyIdx     = pull(0, 4) % 12;
  const scaleIdx   = pull(4, 3) % SCALE_NAMES.length;
  const bpm        = 80 + Math.round((pull(7, 6) / 63) * 40);   // 80..120
  const swing      = pull(13, 1);
  const energy     = pull(14, 2);                               // 0..3
  const leadIdx    = pull(16, 2);
  const bassIdx    = pull(18, 2);
  const padIdx     = pull(20, 2);
  const filterChar = pull(22, 4);
  const delaySend  = pull(26, 4);
  const delayFb    = pull(30, 4);
  const progIdx    = pull(34, 4);
  const padVoicing = pull(38, 2);
  const kickIdx    = pull(40, 4);
  const snareIdx   = pull(44, 3);
  const hatIdx     = pull(47, 3);
  const bassRhyIdx = pull(50, 3);
  const leadRhyIdx = pull(53, 3);

  // Lead palette: 16 steps × 3 bits, selecting from LEAD_PALETTE
  const leadChoices = [];
  for (let i = 0; i < 16; i++) leadChoices.push(pull(56 + i * 3, 3));

  return {
    pulseInfo, bits,
    bpm,
    swing: !!swing,
    swingAmount: swing ? 0.07 : 0,
    energy,
    key: KEYS[keyIdx],
    keyIdx,
    rootMidi: 60 + keyIdx,                       // C4 + offset
    scaleName: SCALE_NAMES[scaleIdx],
    scale: SCALES[SCALE_NAMES[scaleIdx]],
    leadTimbre: LEAD_TIMBRES[leadIdx],
    bassTimbre: BASS_TIMBRES[bassIdx],
    padTimbre:  PAD_TIMBRES[padIdx],
    filter: 700 + filterChar * 230,              // 700..4150 Hz
    delaySend: delaySend / 15,                   // 0..1
    delayFb:   delayFb / 15,
    progIdx,
    progression: PROGRESSIONS[progIdx],
    progLabel:   PROG_LABELS[progIdx],
    padVoicing,
    kickIdx,  kickPattern:  KICK_PATTERNS[kickIdx],
    snareIdx, snarePattern: SNARE_PATTERNS[snareIdx],
    hatIdx,   hatPattern:   HAT_PATTERNS[hatIdx],
    bassRhyIdx, bassPattern: BASS_PATTERNS[bassRhyIdx],
    bassRhyLabel: BASS_LABELS[bassRhyIdx],
    leadRhyIdx, leadRhythm: LEAD_RHYTHMS[leadRhyIdx],
    leadRhyLabel: LEAD_LABELS[leadRhyIdx],
    leadChoices,
  };
}

/* -------------------------------------------------------------------------
   6) PITCH HELPERS — chord-aware scale-degree mapping.
   ------------------------------------------------------------------------- */

/* Convert a scale-degree offset (relative to scale[0]) to a frequency.
   Negative degrees and degrees > scale.length wrap with octave shift. */
function degreeToFreq(score, degree, octaveOffset = 0) {
  const scale = score.scale;
  const len = scale.length;
  const wrapped = ((degree % len) + len) % len;
  const octShift = Math.floor(degree / len);
  const midi = score.rootMidi + scale[wrapped] + (octaveOffset + octShift) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/* The current "chord" at bar `bar` is the chord-root scale-degree. From
   that root we can build root/third/fifth as scale degrees +0/+2/+4. */
function chordRootAtBar(score, bar) {
  return score.progression[bar % score.progression.length];
}
function chordToneFreq(score, chordRootDeg, palette, octaveOffset) {
  // palette: 0=root,1=third,2=fifth,3=octave,4=low6,5=2nd,6=6th
  const offsets = [0, 2, 4, 7, -3, 1, 5];
  if (palette < 0 || palette > 6) return null;
  return degreeToFreq(score, chordRootDeg + offsets[palette], octaveOffset);
}

/* -------------------------------------------------------------------------
   7) AUDIO ENGINE — Chris-Wilson-style scheduler with low-latency lookahead.
   ------------------------------------------------------------------------- */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.delay = null;
    this.delayFeedback = null;
    this.delayMix = null;
    this.analyser = null;
    this.score = null;
    this.playing = false;
    this.current16th = 0;
    this.nextNoteTime = 0;
    this.lookahead = 25;       // ms between scheduler runs
    this.scheduleAhead = 0.12; // sec to look ahead
    this.timer = null;
    this.noiseBuffer = null;
    this.onStep = null;
    this._lastChord = -1;
  }

  ensureCtx() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;

    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    comp.attack.value = 0.005;
    comp.release.value = 0.12;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.7;

    this.master.connect(comp).connect(this.analyser).connect(this.ctx.destination);

    // Send-style FX delay
    this.delay = this.ctx.createDelay(1.5);
    this.delayFeedback = this.ctx.createGain();
    this.delayMix = this.ctx.createGain();
    this.delayMix.gain.value = 0.0;
    this.delay.delayTime.value = 0.32;
    this.delayFeedback.gain.value = 0.32;
    this.delay.connect(this.delayFeedback).connect(this.delay);
    this.delay.connect(this.delayMix).connect(this.master);

    // White noise buffer, filled with crypto.getRandomValues — not Math.random.
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, sr * 1.0, sr);
    const data = buf.getChannelData(0);
    const seed = new Uint8Array(data.length);
    crypto.getRandomValues(seed);
    for (let i = 0; i < data.length; i++) data[i] = (seed[i] / 127.5) - 1;
    this.noiseBuffer = buf;
  }

  start(score) {
    this.ensureCtx();
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.score = score;
    this._lastChord = -1;

    const now = this.ctx.currentTime;
    this.delayMix.gain.cancelScheduledValues(now);
    this.delayFeedback.gain.cancelScheduledValues(now);
    this.delay.delayTime.cancelScheduledValues(now);

    this.delayMix.gain.setTargetAtTime(0.16 + 0.45 * score.delaySend, now, 0.05);
    this.delayFeedback.gain.setTargetAtTime(0.18 + 0.5 * score.delayFb, now, 0.05);
    // sync delay to a dotted-eighth for groove
    this.delay.delayTime.setTargetAtTime((60 / score.bpm) * 0.75, now, 0.05);

    this.current16th = 0;
    this.nextNoteTime = now + 0.06;
    this.playing = true;
    this._tick();
  }

  stop() {
    this.playing = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  _tick = () => {
    if (!this.playing) return;
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAhead) {
      this.scheduleStep(this.current16th, this.nextNoteTime);
      this._advance();
    }
    this.timer = setTimeout(this._tick, this.lookahead);
  };

  _advance() {
    const sec16 = (60 / this.score.bpm) * 0.25;
    let dt = sec16;
    if (this.score.swing && (this.current16th % 2 === 1)) {
      dt = sec16 * (1 + this.score.swingAmount);
    } else if (this.score.swing && (this.current16th % 2 === 0)) {
      dt = sec16 * (1 - this.score.swingAmount);
    }
    this.nextNoteTime += dt;
    this.current16th = (this.current16th + 1) % 64;  // 4 bars × 16
  }

  scheduleStep(step, time) {
    const s = this.score;
    const stepInBar = step % 16;
    const bar = Math.floor(step / 16);
    const chordDeg = chordRootAtBar(s, bar);

    // Drums
    if (s.kickPattern[stepInBar] === "1")  this.playKick(time);
    if (s.snarePattern[stepInBar] === "1") this.playSnare(time);
    if (s.hatPattern[stepInBar] === "1")   this.playHat(time);

    // Bass: pattern drives root/third/fifth at chord root
    const bassCh = s.bassPattern[stepInBar];
    if (bassCh !== ".") {
      let degOff = 0;
      if (bassCh === "5") degOff = 4;
      else if (bassCh === "3") degOff = 2;
      const f = degreeToFreq(s, chordDeg + degOff, -2);
      this.playBass(f, time, (60 / s.bpm) * 0.45);
    }

    // Lead: rhythm dictates strike, palette dictates pitch (chord-aware)
    if (s.leadRhythm[stepInBar] === "1") {
      const palette = s.leadChoices[stepInBar];   // 0..7
      if (palette !== 7) {                         // 7 = rest in palette
        const f = chordToneFreq(s, chordDeg, palette, 1);
        if (f) this.playLead(f, time, (60 / s.bpm) * 0.4);
      }
    }

    // Pad: chord change at start of every bar
    if (stepInBar === 0 && bar !== this._lastChord) {
      this._lastChord = bar;
      const dur = (60 / s.bpm) * 4 * 0.96;        // 1 bar
      const root  = degreeToFreq(s, chordDeg + 0, 0);
      const third = degreeToFreq(s, chordDeg + 2, 0);
      const fifth = degreeToFreq(s, chordDeg + 4, 0);
      this.playPad(root, time, dur);
      this.playPad(third, time, dur);
      this.playPad(fifth, time, dur);
      // Pad voicing: 2 = add octave, 3 = add 7th
      if (s.padVoicing === 2) this.playPad(degreeToFreq(s, chordDeg, 1), time, dur, 0.5);
      if (s.padVoicing === 3) this.playPad(degreeToFreq(s, chordDeg + 6, 0), time, dur, 0.6);
    }

    if (this.onStep) this.onStep(stepInBar, bar, time);
  }

  /* ---- Voices ---- */

  playKick(time) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(140, time);
    o.frequency.exponentialRampToValueAtTime(45, time + 0.18);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.95, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.34);
    o.connect(g).connect(this.master);
    o.start(time); o.stop(time + 0.36);
  }

  playSnare(time) {
    const src = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    src.buffer = this.noiseBuffer;
    filter.type = "bandpass";
    filter.frequency.value = 1700;
    filter.Q.value = 1.1;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.42, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    src.connect(filter).connect(g).connect(this.master);

    const o = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(220, time);
    o.frequency.exponentialRampToValueAtTime(110, time + 0.06);
    og.gain.setValueAtTime(0.0001, time);
    og.gain.exponentialRampToValueAtTime(0.18, time + 0.003);
    og.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    o.connect(og).connect(this.master);

    src.start(time); src.stop(time + 0.22);
    o.start(time); o.stop(time + 0.14);
  }

  playHat(time) {
    const src = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    src.buffer = this.noiseBuffer;
    filter.type = "highpass";
    filter.frequency.value = 6500;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.13, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    src.connect(filter).connect(g).connect(this.master);
    src.start(time); src.stop(time + 0.08);
  }

  playBass(freq, time, dur) {
    const o = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = this.score.bassTimbre;
    o.frequency.value = freq;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(this.score.filter * 0.85, time);
    filter.frequency.exponentialRampToValueAtTime(this.score.filter * 0.4, time + dur);
    filter.Q.value = 4;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.30, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(filter).connect(g).connect(this.master);
    o.start(time); o.stop(time + dur + 0.05);
  }

  playLead(freq, time, dur) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const send = this.ctx.createGain();
    o.type = this.score.leadTimbre;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.22, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g);
    g.connect(this.master);
    send.gain.value = 0.55;
    g.connect(send).connect(this.delay);
    o.start(time); o.stop(time + dur + 0.02);
  }

  /* Pad: detuned dual-osc. `level` lets supplemental voices come in softer. */
  playPad(freq, time, dur, level = 1) {
    const make = (cents) => {
      const o = this.ctx.createOscillator();
      o.type = this.score.padTimbre;
      o.frequency.value = freq;
      o.detune.value = cents;
      const g = this.ctx.createGain();
      const a = Math.min(0.5, dur * 0.25);
      const r = Math.min(0.5, dur * 0.25);
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(0.07 * level, time + a);
      g.gain.setValueAtTime(0.07 * level, time + dur - r);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      o.connect(g).connect(this.master);
      o.start(time); o.stop(time + dur + 0.05);
    };
    make(0); make(8); make(-8);
  }
}

/* -------------------------------------------------------------------------
   8) UI WIRING
   ------------------------------------------------------------------------- */

const $ = (id) => document.getElementById(id);
const engine = new AudioEngine();
let currentScore = null;
let visualizerRaf = 0;

function setStatus(msg, kind = "") {
  const el = $("status");
  el.textContent = msg;
  el.className = "status" + (kind ? " " + kind : "");
}

/* Build the 5×16 step grid showing each instrument's hits across the bar. */
function buildGrid(score) {
  const grid = $("grid");
  grid.innerHTML = "";
  const rows = [
    parsePattern(score.kickPattern),
    parsePattern(score.snarePattern),
    parsePattern(score.hatPattern),
    bassRow(score),
    leadRow(score),
  ];
  for (let r = 0; r < rows.length; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "grid-row";
    for (let c = 0; c < 16; c++) {
      const cell = document.createElement("div");
      cell.className = "cell" + ((c % 4 === 0) ? " beat-1" : "") +
                       (rows[r][c] ? ` on row-${r}` : "");
      cell.dataset.row = r; cell.dataset.col = c;
      rowEl.appendChild(cell);
    }
    grid.appendChild(rowEl);
  }
}
function parsePattern(s) { return s.split("").map(c => c === "1" ? 1 : 0); }
function bassRow(score) {
  return score.bassPattern.split("").map(c => c === "." ? 0 : 1);
}
function leadRow(score) {
  const out = score.leadRhythm.split("").map(c => c === "1" ? 1 : 0);
  // a strike that maps to palette 7 (rest) shouldn't light the cell
  for (let i = 0; i < 16; i++) {
    if (out[i] && score.leadChoices[i] === 7) out[i] = 0;
  }
  return out;
}

/* Chord labels strip — shown above the grid. Each chord = 1 bar. */
function buildChordStrip(score) {
  const strip = $("chord-strip");
  strip.innerHTML = "";
  const labels = score.progression.map(deg => chordLabel(deg, score));
  for (let i = 0; i < labels.length; i++) {
    const div = document.createElement("div");
    div.className = "chord-block";
    div.dataset.bar = i;
    div.innerHTML = `<span class="chord-num">Bar ${i + 1}</span><span class="chord-name">${labels[i]}</span>`;
    strip.appendChild(div);
  }
}
function chordLabel(degree, score) {
  // Determine quality (major/minor) from the scale at this degree.
  const scale = score.scale;
  const root  = scale[degree % scale.length];
  const third = scale[(degree + 2) % scale.length] + (degree + 2 >= scale.length ? 12 : 0);
  const interval = ((third - root) + 12) % 12;
  const quality = interval === 4 ? "" : interval === 3 ? "m" : "°";
  // root note name
  const rootMidi = (score.rootMidi + scale[degree % scale.length]) % 12;
  return `${KEYS[(rootMidi % 12 + 12) % 12]}${quality}`;
}

function renderScore(score) {
  $("track-stage").hidden = false;
  $("track-title").textContent = `Pulse · ${score.pulseInfo.label}`;
  $("track-key").textContent = `${score.key} ${score.scaleName} · ${score.bpm} BPM${score.swing ? " (swing)" : ""}`;
  $("track-prog").textContent = score.progLabel;

  const meta = $("track-meta");
  meta.innerHTML = "";
  const fields = [
    ["Key",         `${score.key} ${score.scaleName}`],
    ["Tempo",       `${score.bpm} BPM${score.swing ? " (swing)" : ""}`],
    ["Progression", score.progLabel],
    ["Lead",        score.leadTimbre],
    ["Bass",        score.bassTimbre],
    ["Pad",         score.padTimbre],
    ["Filter",      `${score.filter} Hz`],
    ["Delay",       `${Math.round(score.delaySend * 100)}% / fb ${Math.round(score.delayFb * 100)}%`],
    ["Drum kit",    `kick ${score.kickIdx} · snare ${score.snareIdx} · hat ${score.hatIdx}`],
    ["Bass rhy.",   score.bassRhyLabel],
    ["Lead rhy.",   score.leadRhyLabel],
  ];
  for (const [k, v] of fields) {
    const row = document.createElement("div");
    row.innerHTML = `${k} · <strong>${v}</strong>`;
    meta.appendChild(row);
  }

  buildChordStrip(score);
  buildGrid(score);

  // Provenance bit grid — show 192 bits even though only ~104 are named,
  // so the user can see how much entropy is in flight.
  const bg = $("bit-grid");
  bg.innerHTML = "";
  const bitCount = Math.min(192, score.bits.length);
  for (let i = 0; i < bitCount; i++) {
    const d = document.createElement("div");
    d.className = "bit b" + score.bits[i];
    d.title = `bit ${i} = ${score.bits[i]}`;
    bg.appendChild(d);
  }

  // Allocation list
  const ul = $("allocation");
  ul.innerHTML = "";
  for (const a of ALLOCATION) {
    const [start, count] = a.range;
    const value = bitsToInt(score.bits, start, count);
    const li = document.createElement("li");
    li.innerHTML = `<span class="alloc-bits">[${start}–${start + count - 1}]</span><span class="alloc-desc">${a.field} → <strong>${value}</strong></span>`;
    ul.appendChild(li);
  }

  // Pulse link
  const a = $("pulse-link");
  a.href = score.pulseInfo.url;
  a.textContent = `NIST · ${score.pulseInfo.label}`;
}

function highlightStep(stepInBar, bar) {
  document.querySelectorAll(".cell.playing").forEach(el => el.classList.remove("playing"));
  document.querySelectorAll(`.cell[data-col="${stepInBar}"]`).forEach(el => el.classList.add("playing"));

  document.querySelectorAll(".chord-block.active").forEach(el => el.classList.remove("active"));
  const chord = document.querySelector(`.chord-block[data-bar="${bar}"]`);
  if (chord) chord.classList.add("active");

  $("position").textContent = `bar ${bar + 1} · step ${stepInBar + 1}`;
}

/* -------------------------------------------------------------------------
   9) VISUALIZER — frequency bars driven by the analyser node.
   ------------------------------------------------------------------------- */

function startVisualizer() {
  const canvas = $("viz");
  if (!canvas) return;
  const ctx2d = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  function resize() {
    canvas.width  = canvas.clientWidth  * dpr;
    canvas.height = canvas.clientHeight * dpr;
  }
  resize();
  window.addEventListener("resize", resize);

  const analyser = engine.analyser;
  if (!analyser) return;
  const bins = analyser.frequencyBinCount;
  const data = new Uint8Array(bins);

  cancelAnimationFrame(visualizerRaf);
  function draw() {
    visualizerRaf = requestAnimationFrame(draw);
    if (!engine.analyser) return;
    engine.analyser.getByteFrequencyData(data);
    const w = canvas.width, h = canvas.height;
    ctx2d.clearRect(0, 0, w, h);
    const N = 64;
    const slice = Math.floor(bins / 2 / N);
    const barW = w / N;
    for (let i = 0; i < N; i++) {
      let sum = 0;
      for (let j = 0; j < slice; j++) sum += data[i * slice + j];
      const v = sum / slice / 255;
      const barH = Math.pow(v, 1.4) * h * 0.95;
      const grad = ctx2d.createLinearGradient(0, h, 0, h - barH);
      grad.addColorStop(0, "#7fd1ff");
      grad.addColorStop(0.5, "#d2a8ff");
      grad.addColorStop(1, "#ff7bb0");
      ctx2d.fillStyle = grad;
      const x = i * barW;
      const bw = barW * 0.78;
      ctx2d.fillRect(x, h - barH, bw, barH);
    }
  }
  draw();
}
function stopVisualizer() {
  cancelAnimationFrame(visualizerRaf);
  const canvas = $("viz");
  if (canvas) {
    const c = canvas.getContext("2d");
    c.clearRect(0, 0, canvas.width, canvas.height);
  }
}

/* -------------------------------------------------------------------------
   10) BUTTONS — generate / play / share
   ------------------------------------------------------------------------- */

async function generate(opts = {}) {
  const btn = $("generate-btn");
  btn.disabled = true;
  btn.classList.add("loading");
  setStatus("Contacting NIST Randomness Beacon…");

  try {
    const pulse = await fetchPulse(opts);
    const bits = pulseBits(pulse);
    setStatus(`Received pulse · ${pulseLabel(pulse)} (${bits.length} bits). Composing…`, "success");

    const score = compose(bits, {
      label: pulseLabel(pulse),
      url: pulseUrl(pulse),
      shareKey: pulseShareKey(pulse),
    });
    currentScore = score;

    engine.stop();
    setPlayLabel(false);
    stopVisualizer();
    renderScore(score);
    location.hash = score.pulseInfo.shareKey;
    setStatus(`${score.key} ${score.scaleName} · ${score.bpm} BPM · ${score.progLabel}. Press Play.`, "success");
  } catch (err) {
    console.error(err);
    setStatus(
      `Could not fetch a NIST pulse: ${err.message}. ` +
      `(This app refuses to silently substitute pseudorandom numbers.)`,
      "error"
    );
  } finally {
    btn.disabled = false;
    btn.classList.remove("loading");
  }
}

function setPlayLabel(playing) {
  const btn = $("play-btn");
  if (!btn) return;
  btn.querySelector(".play-icon").textContent = playing ? "■" : "▶";
  btn.querySelector(".play-label").textContent = playing ? "Stop" : "Play";
  btn.classList.toggle("is-playing", playing);
}

function togglePlay() {
  if (!currentScore) return;
  if (engine.playing) {
    engine.stop();
    setPlayLabel(false);
    document.querySelectorAll(".cell.playing").forEach(el => el.classList.remove("playing"));
    document.querySelectorAll(".chord-block.active").forEach(el => el.classList.remove("active"));
    $("position").textContent = "stopped";
    stopVisualizer();
    return;
  }
  engine.onStep = highlightStep;
  engine.start(currentScore);
  setPlayLabel(true);
  startVisualizer();
}

function copyShareLink() {
  navigator.clipboard?.writeText(location.href).then(() => {
    const b = $("copy-btn");
    b.textContent = "Copied ✓";
    b.classList.add("copied");
    setTimeout(() => {
      b.textContent = "Copy share link";
      b.classList.remove("copied");
    }, 1600);
  });
}

/* -------------------------------------------------------------------------
   11) MAIN
   ------------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  $("generate-btn").addEventListener("click", () => generate());
  $("play-btn").addEventListener("click", togglePlay);
  $("copy-btn").addEventListener("click", copyShareLink);

  // Spacebar = play/stop when a track is loaded
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && currentScore && !["INPUT","TEXTAREA"].includes(document.activeElement.tagName)) {
      e.preventDefault();
      togglePlay();
    }
  });

  const m = location.hash.match(/chain=(\d+)&pulse=(\d+)/);
  if (m) {
    generate({ chainIndex: Number(m[1]), pulseIndex: Number(m[2]) });
  }
});
