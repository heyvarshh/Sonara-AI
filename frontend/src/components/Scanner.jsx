import React, { useEffect, useRef, useState, useCallback } from 'react';

// ── VAD Tuning Constants ───────────────────────────────────────────────────
const SPEECH_THRESHOLD   = 18;   // RMS dB above noise floor → speech detected
const SILENCE_TIMEOUT_MS = 1800; // ms of silence after speech → stop & send
const MAX_RECORD_MS      = 30000; // hard cap: force-send after 30s
const VAD_POLL_MS        = 50;    // how often we sample the analyser (~20fps)
// ──────────────────────────────────────────────────────────────────────────

export default function Scanner({ onPayloadReady, disabled }) {
  const videoRef         = useRef(null);
  const streamRef        = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const analyserRef      = useRef(null);
  const vadTimerRef      = useRef(null);   // silence debounce timer
  const maxTimerRef      = useRef(null);   // hard-cap timer
  const isSpeakingRef    = useRef(false);  // are we currently recording?
  const disabledRef      = useRef(disabled);
  const vadLoopRef       = useRef(null);   // requestAnimationFrame id

  const [vadStatus, setVadStatus]   = useState('Listening…');
  const [volumeLevel, setVolumeLevel] = useState(0); // 0–100 for meter
  const [recDuration, setRecDuration] = useState(0);
  const recStartRef = useRef(null);

  // Keep disabledRef in sync
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getRMS = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return 0;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length); // 0–255 range
  }, []);

  const buildPayload = useCallback((blob, mimeType) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        let faceCropB64 = '';
        try {
          const v = videoRef.current;
          if (v && v.videoWidth > 0) {
            const tmp = document.createElement('canvas');
            tmp.width  = v.videoWidth;
            tmp.height = v.videoHeight;
            tmp.getContext('2d').drawImage(v, 0, 0);
            faceCropB64 = tmp.toDataURL('image/jpeg', 0.7);
          }
        } catch (_) {}

        resolve({
          timestamp:    Date.now(),
          audio_b64:    reader.result,
          face_crop_b64: faceCropB64,
          metrics:      { ear: '0.000', target_pts: 0 },
          data:         { coordinates: [] },
        });
      };
      reader.readAsDataURL(blob);
    });
  }, []);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== 'recording') return;
    mr.stop();
    clearTimeout(maxTimerRef.current);
    clearTimeout(vadTimerRef.current);
    isSpeakingRef.current = false;
    setVadStatus('Processing…');
    setRecDuration(0);
    recStartRef.current = null;
  }, []);

  const startRecording = useCallback(() => {
    if (disabledRef.current) return;
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === 'recording') return;

    audioChunksRef.current = [];
    mr.start(200); // collect data every 200ms
    isSpeakingRef.current = true;
    recStartRef.current = Date.now();
    setVadStatus('🎙️ Recording…');

    // Hard-cap: send after MAX_RECORD_MS even if still speaking
    maxTimerRef.current = setTimeout(() => {
      console.log('[VAD] Max duration hit, force-stopping.');
      stopRecording();
    }, MAX_RECORD_MS);
  }, [stopRecording]);

  // ── VAD Loop (throttled to VAD_POLL_MS) ──────────────────────────

  const lastVadPollRef = useRef(0);

  const vadLoop = useCallback(() => {
    const now = performance.now();
    if (now - lastVadPollRef.current >= VAD_POLL_MS) {
      lastVadPollRef.current = now;

      const rms = getRMS();
      const lvl = Math.min(100, (rms / 255) * 100 * 3);
      setVolumeLevel(lvl);

      const isSpeech = rms > SPEECH_THRESHOLD;

      if (!disabledRef.current) {
        if (isSpeech) {
          if (vadTimerRef.current) {
            clearTimeout(vadTimerRef.current);
            vadTimerRef.current = null;
          }
          if (!isSpeakingRef.current) {
            console.log('[VAD] Speech detected — starting recording');
            startRecording();
          }
        } else {
          if (isSpeakingRef.current && !vadTimerRef.current) {
            vadTimerRef.current = setTimeout(() => {
              console.log('[VAD] Silence timeout — stopping recording');
              vadTimerRef.current = null;
              stopRecording();
            }, SILENCE_TIMEOUT_MS);
          }
        }

        if (isSpeakingRef.current && recStartRef.current) {
          setRecDuration(((Date.now() - recStartRef.current) / 1000).toFixed(1));
        }
      }
    }

    vadLoopRef.current = requestAnimationFrame(vadLoop);
  }, [getRMS, startRecording, stopRecording]);


  // ── Main Setup ─────────────────────────────────────────────────────────

  useEffect(() => {
    let audioCtx;

    async function setup() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
        });
        streamRef.current = stream;

        if (videoRef.current) videoRef.current.srcObject = stream;

        // AudioContext for VAD
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source   = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        // MediaRecorder for capturing
        const mr = new MediaRecorder(stream);
        mediaRecorderRef.current = mr;

        mr.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mr.onstop = async () => {
          const chunks = [...audioChunksRef.current];
          audioChunksRef.current = [];
          if (chunks.length === 0) {
            setVadStatus('Listening…');
            return;
          }
          const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
          console.log('[Scanner] Sending to STT — size:', blob.size, 'bytes');

          const payload = await buildPayload(blob, mr.mimeType);
          if (!disabledRef.current) onPayloadReady(payload);
          setVadStatus('Listening…');
        };

        // Start VAD loop
        vadLoopRef.current = requestAnimationFrame(vadLoop);
        setVadStatus('Listening…');

      } catch (err) {
        console.error('[Scanner] Setup error:', err);
        setVadStatus('ERROR: ' + err.message);
      }
    }

    setup();

    return () => {
      cancelAnimationFrame(vadLoopRef.current);
      clearTimeout(vadTimerRef.current);
      clearTimeout(maxTimerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioCtx) audioCtx.close();
    };
  }, [vadLoop, buildPayload, onPayloadReady]);

  // ── Pause / Resume when disabled changes ──────────────────────────────

  useEffect(() => {
    if (disabled) {
      stopRecording();
      setVadStatus('Paused');
      setVolumeLevel(0);
    } else {
      setVadStatus('Listening…');
    }
  }, [disabled, stopRecording]);

  const isRecording = vadStatus === '🎙️ Recording…';

  return (
    <div className="scanner-wrapper">
      <video
        ref={videoRef}
        autoPlay playsInline muted
        className="scanner-video"
      />

      {/* Persistent global UI element for VAD Status / Recording Indicator injected in the HUD automatically via the App component instead of hardcoded in Scanner block now. Scanner handles only background stream layers. */}
      
      {/* VAD Level background pulse subtle hook */}
      {!disabled && isRecording && (
        <div style={{
           position: 'absolute', inset: 0,
           boxShadow: `inset 0 0 ${10 + (volumeLevel)}px rgba(239, 68, 68, 0.4)`,
           pointerEvents: 'none', transition: 'box-shadow 0.1s ease', zIndex: 1
        }} />
      )}
    </div>
  );
}
