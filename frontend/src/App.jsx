import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebSocket } from './hooks/useWebSocket';
import Scanner from './components/Scanner';
import SettingsModal from './components/SettingsModal';
import EmergencyPanel from './components/EmergencyPanel';
import CalmModeWrapper from './components/CalmModeWrapper';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

export default function App() {
  const { isConnected, sendPayload, lastMessage } = useWebSocket(WS_URL);

  const [reconstructed, setReconstructed] = useState('');
  const [pipelineData, setPipelineData] = useState({
    transcript: '',
    emotion_context: ''
  });
  1
  const [isScanning, setIsScanning] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [isCalmMode, setIsCalmMode] = useState(false);

  // When Scanner completes its 1.5s cycle, it hands us the payload
  const handlePayloadReady = useCallback((payload) => {
    if (isConnected && !isEmergencyMode) {
      const geminiKey = localStorage.getItem('GEMINI_API_KEY');
      const sarvamKey = localStorage.getItem('SARVAM_API_KEY');

      const payloadWithKeys = {
        ...payload,
        config: {
          ...payload.config,
          gemini_api_key: geminiKey || undefined,
          sarvam_api_key: sarvamKey || undefined,
        }
      };

      sendPayload(payloadWithKeys);
    }
  }, [isConnected, isEmergencyMode, sendPayload]);

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'stt_result') {
      setPipelineData({
        transcript: lastMessage.transcript || '',
        emotion_context: lastMessage.emotion_context || '',
      });
      if (lastMessage.transcript) {
        setReconstructed(`🎙️ "${lastMessage.transcript}"...`);
      }
    } else if (lastMessage.type === 'result' && lastMessage.reconstructed) {
      setReconstructed(lastMessage.reconstructed);
      setPipelineData(prev => ({
        ...prev,
        transcript: lastMessage.transcript || prev.transcript,
        emotion_context: lastMessage.emotion_context || prev.emotion_context,
      }));

      if (lastMessage.audio_b64) {
        const audio = new Audio('data:audio/wav;base64,' + lastMessage.audio_b64);
        if (isCalmMode) {
          audio.volume = 0.5;
        }
        audio.play().catch(e => console.error('Audio playback failed:', e));
      }
    } else if (lastMessage.status === 'ack') {
      setReconstructed('Tracking Intent...');
    }
  }, [lastMessage, isCalmMode]);

  const parseEmotionContext = (context) => {
    if (!context) return { visual: null, acoustic: null, gesture: null };
    const visualMatch = context.match(/Visual Emotion:\s*([^.]+)/);
    const acousticMatch = context.match(/Acoustic Emotion:\s*([^.]+)/);
    const gestureMatch = context.match(/Gesture Detected:\s*([^.]+)/);

    const v = visualMatch ? visualMatch[1].trim() : null;
    const a = acousticMatch ? acousticMatch[1].trim() : null;
    const g = gestureMatch ? gestureMatch[1].trim() : null;

    return {
      visual: v && v !== '-' && v !== 'Unknown' ? v : null,
      acoustic: a && a !== '-' && a !== 'Unknown' ? a : null,
      gesture: g && g !== '-' && g !== 'Unknown' ? g : null,
    };
  };

  const { visual, acoustic, gesture } = parseEmotionContext(pipelineData.emotion_context);

  // High-end spring physics configuration
  const springConf = { type: "spring", stiffness: 400, damping: 20 };

  return (
    <CalmModeWrapper isCalmMode={isCalmMode} onExitCalmMode={() => setIsCalmMode(false)}>

      {/* 1. LAYER ONE: Fullscreen Edge Scanner Background */}
      <Scanner onPayloadReady={handlePayloadReady} disabled={!isScanning || isEmergencyMode} />

      {/* 2. LAYER TWO: AR Head-Up Display (HUD) Component Overlay */}
      <div className="hud-layer">

        {/* Absolute Header */}
        <div style={{ position: 'absolute', top: 20, left: 24 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600, background: 'linear-gradient(to right, var(--accent), var(--accent2))', WebkitBackgroundClip: 'text', color: 'transparent', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
            IntentCast
          </h1>
        </div>

        <div className="status-indicator">
          {isConnected ?
            <><div className="status-dot"></div> CONNECTED</> :
            <><div className="status-dot offline"></div> OFFLINE</>
          }
        </div>

        {/* Animated Emotion Orbs (Top Right HUD) */}
        <div className="emotion-orbs">
          <AnimatePresence>
            {visual && (
              <motion.div
                key="visual" className="emotion-orb visual"
                initial={{ opacity: 0, x: 50, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={springConf}
              >
                👁️ {visual}
              </motion.div>
            )}
            {acoustic && (
              <motion.div
                key="acoustic" className="emotion-orb acoustic"
                initial={{ opacity: 0, x: 50, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={springConf}
              >
                🔊 {acoustic}
              </motion.div>
            )}
            {gesture && (
              <motion.div
                key="gesture" className="emotion-orb gesture"
                initial={{ opacity: 0, x: 50, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={springConf}
              >
                ✋ {gesture}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Reconstructed Intent (Center High) */}
        <div className="intent-overlay">
          <AnimatePresence mode="wait">
            {reconstructed ? (
              <motion.div
                key="text"
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                transition={springConf}
                className="output-text"
              >
                "{reconstructed}"
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="output-placeholder"
              >
                Awaiting intent string...
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Realistic Tactile Action Tray (Bottom Dock) */}
        <div className="action-tray">
          <motion.button
            className="btn-primary"
            onPointerDown={() => setIsScanning(!isScanning)}
            style={{ flex: 1 }}
            whileTap={{ scale: 0.95 }}
            transition={springConf}
          >
            {isScanning ? 'Halt Radar' : 'Resume Radar'}
          </motion.button>

          <motion.button
            className="btn-calm"
            onPointerDown={() => setIsCalmMode(true)}
            aria-label="Activate Calm Mode"
            whileTap={{ scale: 0.9 }}
            transition={springConf}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>
          </motion.button>
        </div>

        {/* Global Overlays */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />

        <AnimatePresence>
          {isEmergencyMode && (<EmergencyPanel onClose={() => setIsEmergencyMode(false)} />)}
        </AnimatePresence>

      </div>
    </CalmModeWrapper>
  );
}
