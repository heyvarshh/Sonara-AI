import { useState, useRef } from 'react';
import { motion } from 'framer-motion';

export default function EmergencyPanel({ onClose }) {
  const [isActive, setIsActive] = useState(false);
  const pressStartTime = useRef(0);

  const handlePointerDown = (e) => {
    // Crucial rule: ONLY activate on explicit touch/pointer down.
    e.preventDefault();
    setIsActive(true);
    pressStartTime.current = Date.now();
    
    // In a prod app, this instantly overrides native WS state or invokes local Web Speech TTS
    console.log("URGENT: Isolated Mic Touch Triggered! Latency:", Date.now() - e.timeStamp, "ms");
  };

  const handlePointerUp = (e) => {
    e.preventDefault();
    setIsActive(false);
    console.log("URGENT: Microhpone released after", Date.now() - pressStartTime.current, "ms");
  };

  return (
    <motion.div 
      className="emergency-overlay"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.15 }} // Must be under 500ms constraint, set to 150ms for hyper-speed
    >
      <button 
        className="emergency-close"
        onClick={onClose}
        aria-label="Close emergency panel"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <motion.h1 
        style={{ color: 'white', marginBottom: '3rem', fontFamily: 'var(--font-display)', textAlign: 'center' }}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        Patient Speaking
      </motion.h1>

      <div 
        className={`mic-isolated ${isActive ? 'mic-isolated-active' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <motion.svg 
          animate={isActive ? { scale: [1, 1.2, 1] } : {}} 
          transition={{ repeat: Infinity, duration: 1 }}
          xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="23"></line>
          <line x1="8" y1="23" x2="16" y2="23"></line>
        </motion.svg>
      </div>

      <motion.p 
        style={{ color: 'rgba(255,255,255,0.5)', marginTop: '2rem', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.8rem' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Hold to transmit
      </motion.p>
    </motion.div>
  );
}
