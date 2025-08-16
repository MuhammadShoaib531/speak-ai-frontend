import React from 'react';

const Logo = ({ width = 160, height = 45, className = '' }) => {
  return (
    <img 
      src="/SpeakAILogo.png" 
      alt="SpeakAI Logo" 
      className={className}
      style={{ width, height }}
    />
  );
};

export default Logo;
