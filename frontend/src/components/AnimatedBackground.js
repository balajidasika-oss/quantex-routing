import React from 'react';
import { motion } from 'framer-motion';

const FloatingPackage = ({ delay, duration, startX, startY, scale, rotate }) => {
  return (
    <motion.div
      initial={{ y: startY, x: startX, opacity: 0, rotate: 0 }}
      animate={{ 
        y: `calc(${startY} - 40vh)`, 
        opacity: [0, 0.15, 0.15, 0],
        rotate: rotate
      }}
      transition={{ 
        repeat: Infinity, 
        duration: duration, 
        delay: delay,
        ease: "easeInOut"
      }}
      className="absolute pointer-events-none border border-cyan-500/20 bg-cyan-900/10 backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_0_rgba(6,182,212,0.1)]"
      style={{ 
        width: `${scale * 120}px`, 
        height: `${scale * 120}px`
      }}
    >
      <div className="w-full h-full flex items-center justify-center text-cyan-500/30">
        <svg xmlns="http://www.w3.org/2000/svg" width="40%" height="40%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      </div>
    </motion.div>
  );
};

const AnimatedBackground = () => {
  const shapes = Array.from({ length: 15 }).map((_, i) => ({
    id: i,
    delay: i * -1.5,
    duration: 25 + Math.random() * 20,
    startX: `${Math.random() * 100}vw`,
    startY: `${100 + Math.random() * 20}vh`,
    scale: 0.5 + Math.random() * 1.5,
    rotate: Math.random() * 360
  }));

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/10 via-transparent to-transparent z-0"></div>
      {shapes.map((shape) => (
        <FloatingPackage key={shape.id} {...shape} />
      ))}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")'}}></div>
    </div>
  );
};

export default AnimatedBackground;
