/**
 * ARCHIVE 09-11 // INTERCEPT RECORDING TERMINAL
 * Complete client-side playback state machine, procedural audio,
 * oscilloscope visualizer, and evidence verification engine.
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. Exact Transcript Definition & Precise Pacing Configuration
     ========================================================================== */

  /**
   * The dialogue must preserve the exact wording, punctuation, capitalization,
   * and sequence specified in the prompt:
   *
   * Line 1: Rust: 911. I need help.
   * Line 2: 911 Operator: This is 911. What's your location, Detective?
   * Line 3: Rust: 7... 10... 3... 5... 9.
   * Line 4: 911 Operator: Could you repeat that?
   * Line 5: Rust: You heard me.
   * Final:  [CALL DISCONNECTED]
   */

  const DIALOGUE_SCRIPT = [
    {
      id: 'line-1',
      speaker: 'Rust: ',
      speakerClass: 'speaker-rust',
      segments: [
        { text: '911. I need help.', charDelay: 42 }
      ],
      postPause: 1200
    },
    {
      id: 'line-2',
      speaker: '911 Operator: ',
      speakerClass: 'speaker-operator',
      segments: [
        { text: "This is 911. What's your location, Detective?", charDelay: 38 }
      ],
      postPause: 1300
    },
    {
      id: 'line-3',
      speaker: 'Rust: ',
      speakerClass: 'speaker-rust',
      // Intentional pauses between numbers for suspense and distinct emphasis
      segments: [
        { text: '7', charDelay: 90, isCipher: true },
        { text: '...', charDelay: 160, pauseAfter: 480 },
        { text: ' 10', charDelay: 90, isCipher: true },
        { text: '...', charDelay: 160, pauseAfter: 480 },
        { text: ' 3', charDelay: 90, isCipher: true },
        { text: '...', charDelay: 160, pauseAfter: 480 },
        { text: ' 5', charDelay: 90, isCipher: true },
        { text: '...', charDelay: 160, pauseAfter: 480 },
        { text: ' 9.', charDelay: 90, isCipher: true }
      ],
      postPause: 1400
    },
    {
      id: 'line-4',
      speaker: '911 Operator: ',
      speakerClass: 'speaker-operator',
      segments: [
        { text: 'Could you repeat that?', charDelay: 40 }
      ],
      postPause: 1400
    },
    {
      id: 'line-5',
      speaker: 'Rust: ',
      speakerClass: 'speaker-rust',
      segments: [
        { text: 'You heard me.', charDelay: 55 }
      ],
      postPause: 1600
    },
    {
      id: 'line-disconnect',
      isDisconnect: true,
      text: '[CALL DISCONNECTED]'
    }
  ];

  /* ==========================================================================
     2. DOM Elements & State
     ========================================================================== */

  const DOM = {
    transcriptFeed: document.getElementById('transcriptFeed'),
    liveCursor: document.getElementById('liveCursor'),
    srTranscript: document.getElementById('srTranscript'),
    querySection: document.getElementById('querySection'),
    verifyForm: document.getElementById('verifyForm'),
    locInput: document.getElementById('locInput'),
    submitBtn: document.getElementById('submitBtn'),
    terminalOutput: document.getElementById('terminalOutput'),
    audioToggle: document.getElementById('audioToggle'),
    audioLabel: document.getElementById('audioLabel'),
    skipBtn: document.getElementById('skipBtn'),
    replayBtn: document.getElementById('replayBtn'),
    statusPip: document.getElementById('statusPip'),
    timeCounter: document.getElementById('timeCounter'),
    signalStatus: document.getElementById('signalStatus'),
    waveModeBtn: document.getElementById('waveModeBtn'),
    waveModeLabel: document.getElementById('waveModeLabel'),
    waveformCanvas: document.getElementById('waveformCanvas'),
    canvasContainer: document.getElementById('canvasContainer'),
    replayCounter: document.getElementById('replayCounter'),
    channelTag: document.getElementById('channelTag')
  };

  const state = {
    isPlaying: false,
    isPaused: false,
    isDisconnected: false,
    audioEnabled: false,
    currentTimeout: null,
    playStartTime: null,
    elapsedMs: 0,
    timerInterval: null,
    waveMode: 0, // 0: Time Domain, 1: Spectral Density, 2: Forensic Phase
    replayCycle: 1,
    voiceActivity: 0, // 0 to 1, drives waveform amplitude
    activityDecayTimer: null
  };

  const WAVE_MODES = ['TIME DOMAIN', 'SPECTRAL DENSITY', 'PHASE COHERENCE'];

  /* ==========================================================================
     3. Procedural Audio Engine (Web Audio API - Zero External Files)
     ========================================================================== */

  let audioCtx = null;
  let masterGain = null;
  let carrierOsc = null;
  let carrierGain = null;
  let noiseNode = null;
  let noiseGain = null;

  function initAudioContext() {
    if (audioCtx) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioCtx = new AudioContextClass();

      // Master output
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);

      // Low-level subtle analog carrier hum (60Hz + filtered harmonics)
      carrierOsc = audioCtx.createOscillator();
      carrierOsc.type = 'sine';
      carrierOsc.frequency.setValueAtTime(60, audioCtx.currentTime);

      const carrierFilter = audioCtx.createBiquadFilter();
      carrierFilter.type = 'lowpass';
      carrierFilter.frequency.setValueAtTime(160, audioCtx.currentTime);

      carrierGain = audioCtx.createGain();
      carrierGain.gain.setValueAtTime(0.015, audioCtx.currentTime);

      carrierOsc.connect(carrierFilter);
      carrierFilter.connect(carrierGain);
      carrierGain.connect(masterGain);
      carrierOsc.start();

      // Extremely faint noise floor (pink/brown simulation)
      const bufferSize = audioCtx.sampleRate * 2;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + white * 0.05;
        b1 = 0.95 * b1 + white * 0.1;
        b2 = 0.85 * b2 + white * 0.2;
        output[i] = (b0 + b1 + b2) * 0.15;
      }

      noiseNode = audioCtx.createBufferSource();
      noiseNode.buffer = noiseBuffer;
      noiseNode.loop = true;

      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(450, audioCtx.currentTime);
      noiseFilter.Q.setValueAtTime(0.8, audioCtx.currentTime);

      noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.012, audioCtx.currentTime);

      noiseNode.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(masterGain);
      noiseNode.start();

    } catch (e) {
      console.warn('Web Audio initialization suppressed:', e);
    }
  }

  function setAudioEnabled(enable) {
    state.audioEnabled = enable;
    DOM.audioToggle.setAttribute('aria-pressed', enable ? 'true' : 'false');
    DOM.audioLabel.textContent = enable ? 'AUDIO: ON' : 'AUDIO: OFF';

    if (enable) {
      initAudioContext();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      if (masterGain && audioCtx) {
        masterGain.gain.setTargetAtTime(1.0, audioCtx.currentTime, 0.05);
      }
      playBlip(1100, 0.03, 0.03);
    } else {
      if (masterGain && audioCtx) {
        masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
      }
    }
  }

  /**
   * Micro-damped soft keystroke / transcription blip.
   * Extremely subtle and non-intrusive.
   */
  function playCharBlip(isCipher = false) {
    if (!state.audioEnabled || !audioCtx || state.isDisconnected) return;
    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      // Pitch: cipher numbers slightly deeper and resonant
      const freq = isCipher ? 480 : 760 + (Math.random() * 80 - 40);
      osc.type = isCipher ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);

      const amp = isCipher ? 0.022 : 0.012;
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (isCipher ? 0.045 : 0.016));

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + (isCipher ? 0.05 : 0.02));
    } catch (_) {}
  }

  function playBlip(freq = 880, duration = 0.03, volume = 0.03) {
    if (!state.audioEnabled || !audioCtx) return;
    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + duration + 0.01);
    } catch (_) {}
  }

  function playDisconnectSound() {
    if (!state.audioEnabled || !audioCtx) return;
    try {
      const now = audioCtx.currentTime;
      
      // Step 1: Abrupt low click
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);

      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.15);

      // Step 2: Silence carrier hum
      if (carrierGain) {
        carrierGain.gain.setTargetAtTime(0.0005, now + 0.1, 0.08);
      }
    } catch (_) {}
  }

  function playSuccessHarmonic() {
    if (!state.audioEnabled || !audioCtx) return;
    try {
      const now = audioCtx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);

        gain.gain.setValueAtTime(0.025, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.35);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.36);
      });
    } catch (_) {}
  }

  /* ==========================================================================
     4. Signal Oscilloscope & Spectral Canvas Visualizer
     ========================================================================== */

  let canvasCtx = null;
  let animFrameId = null;
  let phase = 0;

  function initWaveform() {
    const canvas = DOM.waveformCanvas;
    if (!canvas) return;
    canvasCtx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    renderWaveform();
  }

  function resizeCanvas() {
    const canvas = DOM.waveformCanvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(300, Math.floor(rect.width * dpr));
    canvas.height = Math.floor(rect.height * dpr);
  }

  function triggerVoiceActivity(amount = 0.8) {
    state.voiceActivity = Math.min(1.0, state.voiceActivity + amount);
    if (state.activityDecayTimer) clearTimeout(state.activityDecayTimer);
    state.activityDecayTimer = setTimeout(() => {
      state.voiceActivity = 0.05;
    }, 180);
  }

  function renderWaveform() {
    if (!canvasCtx) return;
    const canvas = DOM.waveformCanvas;
    const width = canvas.width;
    const height = canvas.height;
    const cy = height / 2;

    canvasCtx.clearRect(0, 0, width, height);

    // Grid baseline
    canvasCtx.lineWidth = 1;
    canvasCtx.strokeStyle = 'rgba(28, 40, 32, 0.45)';
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, cy);
    canvasCtx.lineTo(width, cy);
    canvasCtx.stroke();

    phase += 0.06;

    if (state.isDisconnected) {
      // Disconnected: completely flatline with minuscule micro-noise
      canvasCtx.strokeStyle = 'rgba(196, 104, 104, 0.7)';
      canvasCtx.lineWidth = 1.2;
      canvasCtx.beginPath();
      for (let x = 0; x < width; x += 3) {
        const jitter = (Math.random() - 0.5) * 1.5;
        const y = cy + jitter;
        if (x === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);
      }
      canvasCtx.stroke();
      animFrameId = requestAnimationFrame(renderWaveform);
      return;
    }

    const activity = Math.max(0.04, state.voiceActivity);

    if (state.waveMode === 0) {
      // MODE 0: TIME DOMAIN (Analog Oscilloscope Trace)
      canvasCtx.strokeStyle = activity > 0.3 ? '#e0f2d8' : '#718b75';
      canvasCtx.lineWidth = 1.5;
      canvasCtx.beginPath();

      const step = 2;
      for (let x = 0; x < width; x += step) {
        const norm = (x / width) * Math.PI * 4;
        const s1 = Math.sin(norm * 2.5 + phase) * 0.6;
        const s2 = Math.sin(norm * 6.8 - phase * 1.5) * 0.3;
        const s3 = Math.sin(norm * 14.2 + phase * 2) * 0.1;
        const noise = (Math.random() - 0.5) * 0.15;

        const amp = (height * 0.42) * activity;
        const y = cy + (s1 + s2 + s3 + noise) * amp;

        if (x === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);
      }
      canvasCtx.stroke();

    } else if (state.waveMode === 1) {
      // MODE 1: SPECTRAL DENSITY (Minimal Vertical Frequency Bands)
      const bars = 28;
      const barWidth = Math.max(2, (width / bars) - 3);
      for (let i = 0; i < bars; i++) {
        const harmonic = Math.sin((i / bars) * Math.PI + phase * 0.8);
        const noise = Math.random() * 0.3;
        const mag = Math.max(0.08, (harmonic * 0.7 + noise) * activity);
        const barH = (height * 0.75) * mag;
        const x = i * (barWidth + 3);
        const y = cy - (barH / 2);

        canvasCtx.fillStyle = activity > 0.3 ? '#b8d7b5' : '#26372c';
        canvasCtx.fillRect(x, y, barWidth, barH);
      }

    } else if (state.waveMode === 2) {
      // MODE 2: PHASE COHERENCE (Lissajous Vector Loop)
      canvasCtx.strokeStyle = '#b8d7b5';
      canvasCtx.lineWidth = 1.2;
      canvasCtx.beginPath();
      const points = 80;
      const radiusX = (width * 0.25) * activity;
      const radiusY = (height * 0.4) * activity;

      for (let i = 0; i <= points; i++) {
        const t = (i / points) * Math.PI * 2;
        const x = (width / 2) + Math.sin(t * 2 + phase) * radiusX;
        const y = cy + Math.sin(t * 3) * radiusY;
        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);
      }
      canvasCtx.stroke();
    }

    // Decay voice activity smoothly
    state.voiceActivity = Math.max(0.02, state.voiceActivity * 0.94);

    animFrameId = requestAnimationFrame(renderWaveform);
  }

  function cycleWaveMode() {
    state.waveMode = (state.waveMode + 1) % WAVE_MODES.length;
    DOM.waveModeLabel.textContent = WAVE_MODES[state.waveMode];
    DOM.waveModeBtn.setAttribute('aria-label', `Signal inspection mode: ${WAVE_MODES[state.waveMode]}`);
    playBlip(1320, 0.02, 0.02);
  }

  /* ==========================================================================
     5. Time Counter Implementation
     ========================================================================== */

  function startTimer() {
    state.playStartTime = performance.now() - state.elapsedMs;
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(updateTimerDisplay, 40);
  }

  function stopTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function resetTimer() {
    stopTimer();
    state.elapsedMs = 0;
    DOM.timeCounter.textContent = '00:00.00';
  }

  function updateTimerDisplay() {
    if (!state.playStartTime) return;
    state.elapsedMs = performance.now() - state.playStartTime;
    const totalSeconds = state.elapsedMs / 1000;
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    const centis = Math.floor((state.elapsedMs % 1000) / 10);
    DOM.timeCounter.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
  }

  /* ==========================================================================
     6. Dialogue Playback State Machine (Character-by-Character)
     ========================================================================== */

  function clearActiveTimeout() {
    if (state.currentTimeout) {
      clearTimeout(state.currentTimeout);
      state.currentTimeout = null;
    }
  }

  function attachCursorTo(parentEl) {
    if (!parentEl) return;
    parentEl.appendChild(DOM.liveCursor);
    DOM.liveCursor.classList.remove('is-idle');
  }

  function detachCursor() {
    DOM.liveCursor.classList.add('is-idle');
    if (DOM.liveCursor.parentElement) {
      DOM.liveCursor.parentElement.removeChild(DOM.liveCursor);
    }
  }

  /**
   * Starts or restarts playback from the beginning.
   */
  function startPlayback() {
    clearActiveTimeout();
    state.isPlaying = true;
    state.isDisconnected = false;
    DOM.transcriptFeed.innerHTML = '';
    DOM.srTranscript.textContent = '';
    DOM.querySection.classList.add('is-hidden');
    DOM.replayBtn.classList.add('is-hidden');
    DOM.skipBtn.classList.remove('is-hidden');

    DOM.statusPip.classList.remove('is-disconnected');
    DOM.signalStatus.textContent = 'RECONSTRUCTING';
    DOM.signalStatus.classList.remove('is-cut');

    // Carrier hum restore if audio enabled
    if (state.audioEnabled && carrierGain && audioCtx) {
      carrierGain.gain.setTargetAtTime(0.015, audioCtx.currentTime, 0.05);
    }

    resetTimer();
    startTimer();

    playLine(0);
  }

  /**
   * Sequentially renders a single dialogue line item.
   */
  function playLine(lineIdx) {
    if (!state.isPlaying) return;

    if (lineIdx >= DIALOGUE_SCRIPT.length) {
      finishPlayback();
      return;
    }

    const item = DIALOGUE_SCRIPT[lineIdx];

    // Special handler: Final Call Disconnect
    if (item.isDisconnect) {
      handleCallDisconnect(item.text);
      return;
    }

    // Create line container in DOM
    const lineEl = document.createElement('div');
    lineEl.className = 'dialogue-line';
    lineEl.id = item.id;

    // Speaker label
    const speakerSpan = document.createElement('span');
    speakerSpan.className = `speaker-tag ${item.speakerClass}`;
    speakerSpan.textContent = item.speaker;
    lineEl.appendChild(speakerSpan);

    // Text holder
    const textSpan = document.createElement('span');
    textSpan.className = 'speech-text';
    lineEl.appendChild(textSpan);

    DOM.transcriptFeed.appendChild(lineEl);
    attachCursorTo(lineEl);

    // Synchronize full line to Screen Reader transcript
    syncScreenReaderLine(item.speaker, item.segments);

    // Begin character typing across segments
    playSegments(item.segments, 0, 0, textSpan, lineEl, () => {
      // Post-line pause
      state.currentTimeout = setTimeout(() => {
        playLine(lineIdx + 1);
      }, item.postPause || 1000);
    });
  }

  /**
   * Progressively renders characters through all segments of a line.
   */
  function playSegments(segments, segIdx, charIdx, textSpan, lineEl, onComplete) {
    if (!state.isPlaying) return;

    if (segIdx >= segments.length) {
      onComplete();
      return;
    }

    const currentSeg = segments[segIdx];
    const text = currentSeg.text;

    if (charIdx < text.length) {
      const char = text[charIdx];

      // If cipher segment, style distinctly
      if (currentSeg.isCipher) {
        let cipherSpan = textSpan.lastElementChild;
        if (!cipherSpan || !cipherSpan.classList.contains('cipher-segment')) {
          cipherSpan = document.createElement('span');
          cipherSpan.className = 'cipher-segment';
          textSpan.appendChild(cipherSpan);
        }
        cipherSpan.textContent += char;
      } else {
        textSpan.appendChild(document.createTextNode(char));
      }

      // Re-attach cursor to stay after current content
      attachCursorTo(lineEl);

      // Trigger micro-audio pulse and waveform jitter
      playCharBlip(!!currentSeg.isCipher);
      triggerVoiceActivity(currentSeg.isCipher ? 0.85 : 0.65);

      const delay = currentSeg.charDelay || 40;
      state.currentTimeout = setTimeout(() => {
        playSegments(segments, segIdx, charIdx + 1, textSpan, lineEl, onComplete);
      }, delay);

    } else {
      // Completed current segment
      const pauseAfter = currentSeg.pauseAfter || 0;
      if (pauseAfter > 0) {
        state.currentTimeout = setTimeout(() => {
          playSegments(segments, segIdx + 1, 0, textSpan, lineEl, onComplete);
        }, pauseAfter);
      } else {
        playSegments(segments, segIdx + 1, 0, textSpan, lineEl, onComplete);
      }
    }
  }

  /**
   * Final state execution when transmission ends.
   */
  function handleCallDisconnect(disconnectText) {
    state.isDisconnected = true;
    detachCursor();

    const disconnectEl = document.createElement('div');
    disconnectEl.className = 'disconnect-line';
    disconnectEl.textContent = disconnectText;
    DOM.transcriptFeed.appendChild(disconnectEl);

    // Screen reader notice
    const srNotice = document.createElement('p');
    srNotice.textContent = disconnectText;
    DOM.srTranscript.appendChild(srNotice);

    // Terminal status flip
    DOM.statusPip.classList.add('is-disconnected');
    DOM.signalStatus.textContent = 'CARRIER LOST';
    DOM.signalStatus.classList.add('is-cut');

    playDisconnectSound();
    stopTimer();

    // Reveal terminal verification section
    finishPlayback();
  }

  function finishPlayback() {
    state.isPlaying = false;
    clearActiveTimeout();
    detachCursor();

    DOM.skipBtn.classList.add('is-hidden');
    DOM.replayBtn.classList.remove('is-hidden');
    DOM.querySection.classList.remove('is-hidden');

    // Smoothly focus input for keyboard users on desktop, avoid aggressive scroll jump on mobile
    if (window.innerWidth > 600) {
      DOM.locInput.focus({ preventScroll: true });
    }
  }

  /**
   * Instant skip to end (respects prefers-reduced-motion or explicit user request).
   */
  function skipToEnd() {
    clearActiveTimeout();
    state.isPlaying = false;
    DOM.transcriptFeed.innerHTML = '';
    DOM.srTranscript.textContent = '';

    DIALOGUE_SCRIPT.forEach(item => {
      if (item.isDisconnect) {
        const disc = document.createElement('div');
        disc.className = 'disconnect-line';
        disc.textContent = item.text;
        DOM.transcriptFeed.appendChild(disc);
        return;
      }

      const lineEl = document.createElement('div');
      lineEl.className = 'dialogue-line';
      lineEl.id = item.id;

      const speakerSpan = document.createElement('span');
      speakerSpan.className = `speaker-tag ${item.speakerClass}`;
      speakerSpan.textContent = item.speaker;
      lineEl.appendChild(speakerSpan);

      const textSpan = document.createElement('span');
      textSpan.className = 'speech-text';

      item.segments.forEach(seg => {
        if (seg.isCipher) {
          const cSpan = document.createElement('span');
          cSpan.className = 'cipher-segment';
          cSpan.textContent = seg.text;
          textSpan.appendChild(cSpan);
        } else {
          textSpan.appendChild(document.createTextNode(seg.text));
        }
      });

      lineEl.appendChild(textSpan);
      DOM.transcriptFeed.appendChild(lineEl);

      syncScreenReaderLine(item.speaker, item.segments);
    });

    handleCallDisconnect('[CALL DISCONNECTED]');
  }

  /**
   * Syncs text to the screen-reader-only element per completed line.
   */
  function syncScreenReaderLine(speaker, segments) {
    const fullText = speaker + segments.map(s => s.text).join('');
    const p = document.createElement('p');
    p.textContent = fullText;
    DOM.srTranscript.appendChild(p);
  }

  /* ==========================================================================
     7. Verification & Answer Evaluation Logic
     ========================================================================== */

  /**
   * Intended Answer: GJCEI (Guru Nanak Dev University, Amritsar)
   * A1Z26 Cipher mapping:
   * 7  -> G
   * 10 -> J
   * 3  -> C
   * 5  -> E
   * 9  -> I
   */
  const TARGET_HASH = 'GJCEI';

  function handleVerificationSubmit(e) {
    e.preventDefault();
    const rawVal = DOM.locInput.value;
    const cleanVal = (rawVal || '').trim().toUpperCase();

    if (!cleanVal) {
      renderTerminalOutput('neutral', [
        'ERROR: NULL DESIGNATION',
        'ENTER IDENTIFIER BEFORE TRANSMITTING.'
      ]);
      return;
    }

    // Match Target
    if (cleanVal === TARGET_HASH) {
      playSuccessHarmonic();
      renderTerminalOutput('success', [
        '[EVIDENCE VERIFICATION CONFIRMED]',
        'SECTOR: GURU NANAK DEV UNIVERSITY // AMRITSAR',
        'FACILITY: GOLDEN JUBILEE CENTRE FOR ENTREPRENEURSHIP & INNOVATION (GJCEI)',
        'STATUS: TARGET LOCATION VERIFIED'
      ]);
      DOM.locInput.blur();
      return;
    }

    // Special Forensic Easter Eggs (Rewards curious exploration without spoiling)
    if (cleanVal === 'RUST' || cleanVal === 'COHLE') {
      renderTerminalOutput('neutral', [
        'PERSONNEL: COHLE, RUSTIN // STATE CID',
        'RECORD STATUS: REDACTED // ARCHIVE SECTOR UNKNOWN'
      ]);
      return;
    }

    if (cleanVal === 'GNDU' || cleanVal === 'AMRITSAR') {
      renderTerminalOutput('neutral', [
        'REGIONAL HUB DETECTED: GURU NANAK DEV UNIVERSITY',
        'SPECIFY EXACT 5-LETTER FACILITY ACRONYM.'
      ]);
      return;
    }

    if (cleanVal === '911' || cleanVal === 'DISPATCH') {
      renderTerminalOutput('neutral', [
        'DISPATCH ARCHIVE #1995-1103 // DURATION: 00:22.45',
        'TRANSMISSION TERMINATED BY CALLER.'
      ]);
      return;
    }

    if (cleanVal === 'HELP' || cleanVal === 'STATUS') {
      renderTerminalOutput('neutral', [
        'FORENSIC TRACE: 5-TOKEN NUMERICAL SEQUENCE RECONSTRUCTED.',
        'SUBMIT DECODED PHYSICAL SECTOR IDENTIFIER.'
      ]);
      return;
    }

    // Default Neutral Rejection (Non-punitive, neutral, no spoilers)
    playBlip(320, 0.08, 0.02);
    renderTerminalOutput('neutral', [
      `ENTRY: "${cleanVal}"`,
      'STATUS: NO ARCHIVAL CORRELATION FOUND',
      'VERIFICATION NEGATIVE // STANDBY'
    ]);
  }

  function renderTerminalOutput(type, lines) {
    DOM.terminalOutput.innerHTML = '';
    const block = document.createElement('div');
    block.className = `output-block is-${type}`;

    lines.forEach((lineText, idx) => {
      const lineEl = document.createElement('div');
      lineEl.className = 'output-line';
      if (idx === 0) {
        lineEl.classList.add('output-highlight');
      }
      lineEl.textContent = lineText;
      block.appendChild(lineEl);
    });

    DOM.terminalOutput.appendChild(block);
  }

  /* ==========================================================================
     8. Replay & Interactive Easter Eggs
     ========================================================================== */

  function handleReplay() {
    state.replayCycle++;
    DOM.replayCounter.textContent = `CYCLE: ${String(state.replayCycle).padStart(2, '0')}`;
    
    // Easter Egg: Alternate channel telemetry badge on replay
    if (state.replayCycle === 2) {
      DOM.channelTag.textContent = 'CH-01 [B-FILTER]';
    } else if (state.replayCycle > 2) {
      DOM.channelTag.textContent = `CH-01 [TRACE-${state.replayCycle}]`;
    }

    // Reset terminal output on replay
    DOM.terminalOutput.innerHTML = '';
    DOM.locInput.value = '';

    playBlip(980, 0.04, 0.02);
    startPlayback();
  }

  /* Keyboard shortcut handling */
  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // If typing in input, ignore global shortcuts
      if (document.activeElement === DOM.locInput) {
        return;
      }

      // Escape key skips playback
      if (e.key === 'Escape' && state.isPlaying) {
        e.preventDefault();
        skipToEnd();
      }

      // 'M' toggles audio
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setAudioEnabled(!state.audioEnabled);
      }

      // 'T' cycles waveform mode
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        cycleWaveMode();
      }
    });
  }

  /* Minimal, restrained console Easter egg */
  function printConsoleLog() {
    console.log(
      '%c[ARCHIVE INTERCEPT 09-11]%c\n' +
      'SIGNAL INTEGRITY: 98.4%\n' +
      'SEQUENCE: 5 TOKENS CAPTURED\n' +
      'ORIGIN SECTOR: AMRITSAR // GNDU ARCHIVE REF #710359',
      'color: #b8d7b5; font-weight: bold; font-family: monospace;',
      'color: #718b75; font-family: monospace;'
    );
  }

  /* ==========================================================================
     9. Initialization & Event Binding
     ========================================================================== */

  function bindEvents() {
    // Audio toggle
    DOM.audioToggle.addEventListener('click', () => {
      setAudioEnabled(!state.audioEnabled);
    });

    // Skip button
    DOM.skipBtn.addEventListener('click', () => {
      skipToEnd();
    });

    // Replay button
    DOM.replayBtn.addEventListener('click', () => {
      handleReplay();
    });

    // Waveform inspection toggle
    DOM.canvasContainer.addEventListener('click', cycleWaveMode);
    DOM.waveModeBtn.addEventListener('click', cycleWaveMode);

    // Verification form submission
    DOM.verifyForm.addEventListener('submit', handleVerificationSubmit);

    // Prevent virtual keyboard from clipping input on mobile
    DOM.locInput.addEventListener('focus', () => {
      setTimeout(() => {
        DOM.locInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    });
  }

  function init() {
    printConsoleLog();
    initWaveform();
    bindEvents();
    setupKeyboardShortcuts();

    // Check accessibility: prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      skipToEnd();
    } else {
      // Small initialization beat before reconstruction begins
      setTimeout(() => {
        startPlayback();
      }, 600);
    }
  }

  // Execute on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
