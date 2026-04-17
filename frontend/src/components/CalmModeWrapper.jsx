import { useEffect, useRef, useState } from 'react';

export default function CalmModeWrapper({ isCalmMode, onExitCalmMode, children }) {
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimer = useRef(null);
  const HOLD_DURATION = 2000; // 2 seconds strict requirement

  useEffect(() => {
    if (isCalmMode) {
      document.body.classList.add('theme-calm');
    } else {
      document.body.classList.remove('theme-calm');
    }
  }, [isCalmMode]);

  const startHold = (e) => {
    if (!isCalmMode) return;
    e.preventDefault();
    
    // Simulate a progress ring mapping
    let elapsed = 0;
    holdTimer.current = setInterval(() => {
      elapsed += 50;
      setHoldProgress((elapsed / HOLD_DURATION) * 100);
      
      if (elapsed >= HOLD_DURATION) {
        clearInterval(holdTimer.current);
        onExitCalmMode();
        setHoldProgress(0);
      }
    }, 50);
  };

  const cancelHold = () => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
    }
    setHoldProgress(0);
  };

  return (
    <div 
      style={{ width: '100vw', height: '100vh', position: 'relative' }}
      onPointerDown={isCalmMode ? startHold : undefined}
      onPointerUp={isCalmMode ? cancelHold : undefined}
      onPointerLeave={isCalmMode ? cancelHold : undefined}
    >
      {isCalmMode && holdProgress > 0 && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, height: '4px',
          background: 'rgba(255,255,255,0.1)',
          zIndex: 1000
        }}>
          <div style={{
            height: '100%',
            width: `${holdProgress}%`,
            background: 'var(--text)',
            transition: 'width 0.05s linear'
          }} />
        </div>
      )}
      
      {/* If calm mode is active, we render an overlay instruction periodically */}
      {isCalmMode && holdProgress === 0 && (
        <div style={{
          position: 'fixed', 
          bottom: '20px', 
          width: '100%', 
          textAlign: 'center', 
          color: 'var(--muted)', 
          fontSize: '0.8rem',
          pointerEvents: 'none',
          zIndex: 1000,
          opacity: 0.5
        }}>
          Hold anywhere for 2s to exit calm mode
        </div>
      )}

      {children}
    </div>
  );
}
