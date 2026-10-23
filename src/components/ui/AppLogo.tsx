import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: number;
}

export const AppLogo: React.FC<AppLogoProps> = ({ className = 'w-6 h-6', size }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 512 512" 
      className={className}
      width={size}
      height={size}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <style>{`
          .app-logo-stroke {
            stroke: #001c38;
            stroke-width: 14;
            stroke-linecap: round;
            stroke-linejoin: round;
          }
        `}</style>
      </defs>

      {/* 1. CARDBOARD BOX */}
      <g id="box">
        <rect 
          x="52" 
          y="44" 
          width="324" 
          height="306" 
          fill="#FAB800" 
          className="app-logo-stroke" 
        />
        
        {/* Tape frame (white) */}
        <path 
          d="M 168 44 L 168 134 C 168 144 176 150 186 150 L 242 150 C 252 150 260 144 260 134 L 260 44 Z" 
          fill="#FFFFFF" 
          className="app-logo-stroke" 
        />
        
        {/* Orange tape */}
        <rect 
          x="184" 
          y="44" 
          width="60" 
          height="86" 
          fill="#F26522" 
          className="app-logo-stroke" 
        />
      </g>

      {/* 2. JET SWOOSH (Trail) */}
      <g id="swoosh">
        <path 
          d="M 55 385 C 18 412 18 456 50 478 C 92 502 205 480 305 388" 
          fill="none" 
          stroke="#001c38" 
          strokeWidth="38" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        <path 
          d="M 55 385 C 18 412 18 456 50 478 C 92 502 205 480 305 388" 
          fill="none" 
          stroke="#00A3E8" 
          strokeWidth="22" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
      </g>

      {/* 3. AIRPLANE */}
      <g id="airplane" transform="translate(382, 355) rotate(42)">
        <path 
          d="
            M 0 -135
            C 16 -135 18 -115 18 -92
            L 18 -55
            L 68 -75
            C 78 -79 87 -70 83 -60
            L 62 -32
            L 18 2
            L 18 42
            L 128 48
            C 142 49 150 62 140 72
            L 96 100
            L 18 110
            L 18 142
            C 18 158 -18 158 -18 142
            L -18 110
            L -96 100
            C -106 90 -98 77 -84 76
            L 0 70
            L 0 42
            L -18 42
            L -18 2
            L -62 -32
            C -66 -42 -57 -51 -47 -47
            L 0 -26
            L 0 -92
            C 0 -115 2 -135 0 -135
            Z
          " 
          transform="rotate(180)" 
          fill="#00A3E8" 
          className="app-logo-stroke" 
        />
      </g>
    </svg>
  );
};
