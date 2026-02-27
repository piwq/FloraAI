import React, { useRef, useEffect } from 'react';
import { AnimatedBackground } from './utils/animatedBackground.js';

export const AnimatedBackgroundCanvas = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const background = new AnimatedBackground(canvas);
    
    background.start();

    return () => {
      background.stop();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full -z-10"
    />
  );
};