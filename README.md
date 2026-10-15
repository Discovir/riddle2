# ARCHIVE 09-11 // INTERCEPT RECORDING TERMINAL

A cinematic, atmospheric, interactive alternate-reality terminal experience designed for the Guru Nanak Dev University (GNDU) treasure hunt competition.

The website simulates an intercepted emergency dispatch recording being reconstructed character-by-character on a surveillance monitor, presenting a cryptic 5-number sequence that encodes a physical campus destination.

---

## Technical Stack & Architecture

- **Core Technologies**: Semantic HTML5, Vanilla CSS3, Vanilla JavaScript (ES6+).
- **Zero External Dependencies**: Operates 100% offline; uses procedural Web Audio API synthesis for atmospheric audio (no external MP3/WAV files required).
- **Responsive & Mobile-First**: Tested across narrow mobile viewports (320px–430px) through tablets and desktop screens (768px–1440px).
- **Fully Static**: No backend, no API keys, no build pipeline required. Directly deployable to GitHub Pages.

---

## Directory Structure

```
intercepted-terminal/
├── index.html       # Semantic layout, telemetry monitors, dialog feed, accessible markup
├── style.css        # Restrained phosphor palette, CRT overlay, responsive layout
├── script.js        # Timeline playback machine, oscilloscope canvas, Web Audio, cipher verification
└── README.md        # Deployment instructions and architectural documentation
```

---

## How to Deploy to GitHub Pages

1. **Create a GitHub Repository**:
   - Go to [GitHub](https://github.com) and create a new public or private repository (e.g., `intercept-archive` or `gndu-hunt`).

2. **Upload Files**:
   - Upload `index.html`, `style.css`, `script.js`, and `README.md` directly to the repository **root**.
   - Commit the changes to your `main` (or `master`) branch.

3. **Enable GitHub Pages**:
   - In your repository, click **Settings**.
   - In the left sidebar, navigate to **Pages** (under "Code and automation").
   - Under **Build and deployment** → **Source**, select **Deploy from a branch**.
   - Under **Branch**, select `main` (or `master`) and directory `/ (root)`.
   - Click **Save**.

4. **Access the Live Terminal**:
   - GitHub Pages will generate your live URL:
     `https://<your-username>.github.io/<repository-name>/`
   - All assets use relative paths (`style.css`, `script.js`), ensuring seamless operation under GitHub Pages repository subpaths.

---

## Experience Features

### 1. The Paced Dialogue Reconstruction
- Exact dialogue preserved without alteration:
  ```
  Rust: 911. I need help.
  911 Operator: This is 911. What's your location, Detective?
  Rust: 7... 10... 3... 5... 9.
  911 Operator: Could you repeat that?
  Rust: You heard me.
  [CALL DISCONNECTED]
  ```
- Deliberate, suspenseful pacing: the numerical sequence (`7... 10... 3... 5... 9.`) renders with intentional pauses between tokens, highlighting its cryptic significance.
- Call disconnect cleanly flatlines the oscilloscope trace, changes telemetry indicators, and reveals the verification terminal.

### 2. Forensic Signal Visualizer
- Multi-mode real-time canvas visualizer in the header:
  - **Mode 0: Time Domain** — Oscilloscope waveform driven by voice activity amplitude.
  - **Mode 1: Spectral Density** — Discrete vertical frequency energy bands.
  - **Mode 2: Phase Coherence** — Lissajous vector trace.
- Click/tap anywhere on the waveform canvas to cycle modes.

### 3. Procedural Audio Engine (Optional & Muted by Default)
- Restrained, subtle sound design synthesized via the Web Audio API:
  - Analog carrier hum (60Hz grounding harmonic)
  - Soft pink-noise tape floor
  - Micro-damped keystroke reconstruction blips
  - Clean disconnect impulse
- Controlled via the `[AUDIO: OFF / ON]` toggle. Compliant with mobile autoplay restrictions.

### 4. Evidence Verification (Client-Side)
- Accepts the intended cipher answer: **`GJCEI`** (Golden Jubilee Centre for Entrepreneurship and Innovation at Guru Nanak Dev University).
  - Derived via A1Z26 cipher: `7 → G`, `10 → J`, `3 → C`, `5 → E`, `9 → I`.
- Case-insensitive, trims accidental spaces, resilient on mobile keyboards.
- Non-punitive, neutral feedback on unrecognized entries.
- Subtle Easter egg queries supported (`RUST`, `GNDU`, `911`, `HELP`).

### 5. Accessibility & Controls
- `prefers-reduced-motion`: Automatically detects accessibility settings and skips typing animations.
- `[SKIP]` button allows participants to immediately jump to the post-call terminal.
- `[REPLAY]` button resets the transmission and increments cycle telemetry.
- Screen reader accessible: Full transcript mirrored to an off-screen live region per line without spamming individual keystrokes.
- High color contrast ratio exceeding WCAG AAA standards.
