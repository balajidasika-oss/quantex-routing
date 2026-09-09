import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

// Premium Isometric Box Component purely in SVG (Zero External Assets)
const IsometricBox = () => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <path d="M50 15L85 32.5V67.5L50 85L15 67.5V32.5L50 15Z" fill="url(#topGlow)" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M50 50L85 32.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M50 50L15 32.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M50 50V85" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <defs>
      <linearGradient id="topGlow" x1="50" y1="15" x2="50" y2="50" gradientUnits="userSpaceOnUse">
        <stop stopColor="currentColor" stopOpacity="0.9"/>
        <stop offset="1" stopColor="currentColor" stopOpacity="0"/>
      </linearGradient>
    </defs>
  </svg>
);

const AnimatedBackground = () => {
  // Memoized hardware-accelerated shapes to ensure zero layout shifting/lag
  const shapes = useMemo(() => Array.from({ length: 18 }).map((_, i) => {
    const scale = 0.3 + Math.random() * 0.7;
    return {
      id: i,
      xStart: Math.random() * 100,
      yStart: 110 + Math.random() * 20, 
      duration: 18 + Math.random() * 22,
      delay: Math.random() * -20,
      scale: scale,
      rotateZ: Math.random() * 360,
      opacity: 0.1 + (1 - scale) * 0.3, // Depth-based opacity
      blur: Math.max(0, (1 - scale) * 4) // Parallax depth of field
    };
  }), []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(14,165,233,0.12),_transparent_70%)]"></div>
      
      {shapes.map((shape) => (
        <motion.div
          key={shape.id}
          className="absolute text-sky-400 will-change-transform"
          initial={{ x: shape.xStart + 'vw', y: shape.yStart + 'vh', rotate: shape.rotateZ, scale: shape.scale }}
          animate={{ y: '-20vh', rotate: shape.rotateZ + (Math.random() > 0.5 ? 90 : -90) }}
          transition={{
            y: { duration: shape.duration, repeat: Infinity, ease: "linear", delay: shape.delay },
            rotate: { duration: shape.duration * 1.5, repeat: Infinity, ease: "linear" }
          }}
          style={{ width: '120px', height: '120px', opacity: shape.opacity, filter: 'blur(' + shape.blur + 'px)' }}
        >
          <IsometricBox />
        </motion.div>
      ))}
      {/* Noise overlay purely generated via code */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" 
           style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E")' }}>
      </div>
    </div>
  );
};

export default AnimatedBackground;
