

# Quantum Score

A web app that composes a unique 4-bar generative track every time you press
the button. Every musical decision — key, scale, tempo, drum patterns,
bassline, melody, instrument timbres, chord progression — is derived from
the bits of a fresh signed pulse fetched from the
[NIST Randomness Beacon v2](https://beacon.nist.gov/).

Built for the Light Rider Qualification Contest.

## What this proves about quantum entropy

The contest brief asks for an application that "translates entropy into
meaningful outputs." A pulse from a quantum-mixed beacon is just 64 bytes
of unpredictable hex. This app turns those bytes into something a human can
*hear* — the abstract idea of entropy made directly perceptual.

The pulse is signed and chained: anyone can hash the bytes into the same
song. Share the link, and a friend's browser re-derives the exact same
composition from the same public bytes — the audio file never leaves your
machine. The composition could not have existed before NIST emitted that
pulse.

## Why NIST and not CURBy-Q

The contest brief points to CURBy. CURBy-Q (the pure quantum endpoint at
CU Boulder) is currently offline; per Anthony, the NIST Randomness Beacon
is an accepted substitute. Each NIST pulse mixes entropy from independent
hardware sources — including commercial quantum random number generators —
binds them with SHA-512, signs the result with NIST's RSA key, and chains
it to the prior pulse. The signature and chain make every pulse
verifiable, irreversible, and impossible to forge after the fact.

## Bit allocation (192 bits, every one named)

| Bits      | Field                        |
|-----------|------------------------------|
| 0–3       | Key (root note, 12 options)   |
| 4–7       | Scale family (8 modes)        |
| 8–14      | Tempo offset (70–129 BPM)     |
| 15        | Swing on/off                  |
| 16–19     | Lead synth timbre             |
| 20–23     | Bass synth timbre             |
| 24–27     | Pad synth timbre              |
| 28–31     | Filter cutoff character       |
| 32–35     | Delay send amount             |
| 36–39     | Delay feedback amount         |
| 40–55     | Kick pattern (16 steps)       |
| 56–71     | Snare pattern (16 steps)      |
| 72–87     | Hat pattern (16 steps)        |
| 88–119    | Bass line (8 notes × 4 bits)  |
| 120–183   | Lead melody (16 notes × 4 bits) |
| 184–189   | Chord progression (2 × 3 bits) |
| 190–191   | Pad voicing & level           |

Total: 192 bits, comfortably within one 512-bit pulse output.

## Files

```
.
├── index.html   # markup + transport + grid view
├── style.css    # design system, grid, provenance panel
├── app.js       # NIST fetch, bit allocation, Web Audio engine
└── README.md
```

No frameworks, no build step, no dependencies. Pure HTML + CSS + JS.

## Audio integrity

White noise for snare and hi-hat is filled from `crypto.getRandomValues`,
not `Math.random`. **Every musical decision** — key, tempo, every drum hit,
every melody note, every chord — comes from the named bits in the
pulse. If the NIST fetch fails, the app shows an error and refuses to
generate a track. Transparency about the source is the whole concept.

## Run locally

```
python3 -m http.server 8000
# then open http://localhost:8000/music/
```

## Deploy

The app is fully static. Push to a public GitHub repo and enable
GitHub Pages on the `main` branch (root). The live URL appears within a
minute.

## Sharing a song

After generating, the URL hash holds `#chain=N&pulse=M`. Anyone opening
that URL fetches the same NIST pulse and re-derives the identical
composition byte-for-byte. The song is portable, but the *audio file* is
never sent anywhere — your browser synthesises it from the bits.

## Source attribution

- Entropy: [NIST Randomness Beacon v2](https://beacon.nist.gov/)
- Built by Dan for the Light Rider Qualification Contest.
