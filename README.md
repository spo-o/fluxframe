# FluxFrame

FluxFrame is a browser-based generative synthesis platform that transforms publicly verifiable entropy into deterministic audiovisual compositions. The system derives structured musical output directly from cryptographically signed randomness pulses using deterministic bit allocation and procedural audio synthesis.

## System Overview

Each composition is generated from entropy retrieved from the NIST Randomness Beacon v2. The platform maps entropy bits into musical parameters including:

- Tonal center selection
- Scale and modal structure
- Tempo generation
- Rhythmic sequencing
- Bassline synthesis
- Melody construction
- Chord progression logic
- DSP parameterization
- Instrument timbre allocation

Every generated composition is reproducible from the original pulse payload, enabling deterministic regeneration across environments.

## Entropy Pipeline

FluxFrame uses signed beacon pulses as the sole entropy source for all compositional decisions.

### Entropy Source

- NIST Randomness Beacon v2
- SHA-512 chained pulse architecture
- RSA signature verification
- Quantum-mixed entropy aggregation
- Deterministic regeneration support

The application performs direct pulse-to-audio transformation without storing or transmitting rendered audio artifacts.

## Bitstream Mapping Architecture

A fixed-width entropy allocation model maps pulse bits into compositional structures.

| Bit Range | Allocation |
|---|---|
| 0–3 | Root note selection |
| 4–7 | Scale family / mode |
| 8–14 | BPM derivation |
| 15 | Swing state |
| 16–31 | Synth timbre allocation |
| 32–39 | DSP modulation parameters |
| 40–87 | Percussion sequencing |
| 88–119 | Bassline generation |
| 120–183 | Lead melody generation |
| 184–189 | Harmonic progression |
| 190–191 | Voicing configuration |

## Technical Stack

- HTML5
- CSS3
- Vanilla JavaScript
- Web Audio API
- Crypto API (`crypto.getRandomValues`)
- NIST Beacon API

No frontend frameworks, runtime dependencies, or build tooling are used.

## Audio Engine

FluxFrame uses a browser-native synthesis engine built on the Web Audio API.

### Features

- Procedural oscillator synthesis
- Deterministic sequencing engine
- Dynamic envelope shaping
- Delay and filter modulation
- Multi-layer rhythmic synthesis
- Entropy-driven DSP routing

Noise generation for percussion layers uses cryptographically secure browser randomness.

## Deterministic Composition Model

Given the same beacon pulse:
- identical bit allocations are derived
- identical sequencing decisions are reconstructed
- identical compositions are reproduced

This enables portable and verifiable regeneration without exchanging rendered media files.

## Deployment

FluxFrame is fully static and can be deployed using:

- GitHub Pages
- Netlify
- Vercel

## Architecture Goals

- Deterministic generative synthesis
- Cryptographic provenance
- Transparent entropy mapping
- Zero-backend deployment
- Lightweight runtime execution
- Browser-native audio rendering

## Attribution

- Entropy Source: NIST Randomness Beacon v2
- Audio Rendering: Web Audio API
- Cryptographic Utilities: Browser Crypto API