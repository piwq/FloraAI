import React, { useState, useEffect } from 'react';

export const Typewriter = ({ text, speed = 30, onComplete }) => {
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {

    let i = 0;
    const typingInterval = setInterval(() => {
      if (i < text.length) {
        setDisplayText(prev => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(typingInterval);
        if (onComplete) onComplete(); 
      }
    }, speed);

    return () => clearInterval(typingInterval);
  }, [text, speed, onComplete]); 

  return <>{displayText}</>;
};