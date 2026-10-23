import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resvg } from '@resvg/resvg-js';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

// Precise colorized vector SVG based on the new uploaded icon: air-freight (2).png
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Airplane Fuselage Pearl White Gradient -->
    <linearGradient id="planeBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="65%" stop-color="#F8FAFC"/>
      <stop offset="100%" stop-color="#E2E8F0"/>
    </linearGradient>

    <!-- Wing Aerodynamic Gradient -->
    <linearGradient id="planeWingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="50%" stop-color="#F1F5F9"/>
      <stop offset="100%" stop-color="#E0F2FE"/>
    </linearGradient>

    <!-- Cargo Box Kraft Golden Cardboard Gradient -->
    <linearGradient id="cargoBoxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="30%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>

    <!-- Flap / Seal Red Accent Gradient -->
    <linearGradient id="sealFlapGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#F87171"/>
      <stop offset="40%" stop-color="#EF4444"/>
      <stop offset="100%" stop-color="#DC2626"/>
    </linearGradient>

    <!-- Cockpit Glass Cyan Gradient -->
    <linearGradient id="cockpitGlass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7DD3FC"/>
      <stop offset="60%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#0284C7"/>
    </linearGradient>

    <!-- Jet Engine Intake Red Ring -->
    <linearGradient id="engineRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#EF4444"/>
      <stop offset="100%" stop-color="#B91C1C"/>
    </linearGradient>

    <!-- Tail Fin Red Gradient -->
    <linearGradient id="tailFinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F87171"/>
      <stop offset="50%" stop-color="#EF4444"/>
      <stop offset="100%" stop-color="#B91C1C"/>
    </linearGradient>
  </defs>

  <!-- ==================== LIFTING / SLING TETHER CABLES ==================== -->
  <g id="tether-cables" stroke="#0F172A" stroke-width="15" stroke-linecap="round" stroke-linejoin="round">
    <!-- Rear sling cable: underside of fuselage down to left vertical edge of box -->
    <line x1="288" y1="264" x2="315" y2="322"/>
    <!-- Front sling cable: underside of fuselage down to top edge of box -->
    <line x1="346" y1="202" x2="368" y2="272"/>
  </g>

  <!-- ==================== CARGO BOX (LOWER RIGHT) ==================== -->
  <g id="cargo-box">
    <!-- Main Box Body: Crisp square with smooth rounded corners -->
    <rect x="314" y="270" width="170" height="168" rx="8" 
          fill="url(#cargoBoxGrad)" stroke="#0F172A" stroke-width="16" stroke-linejoin="round"/>

    <!-- Subtle Top Cardboard Rim Highlight -->
    <path d="M 322 276 L 476 276 C 478 276 480 278 480 280 L 480 288 C 440 282 350 282 322 288 Z" 
          fill="#FFFBEB" opacity="0.75"/>

    <!-- Center Flap / Seal with Swallowtail Inverted V-Notch -->
    <path d="M 368 270 L 428 270 L 428 334 L 398 300 L 368 334 Z" 
          fill="url(#sealFlapGrad)" stroke="#0F172A" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/>

    <!-- Shipping Label / Barcode Tag on the Box Face -->
    <rect x="330" y="348" width="34" height="46" rx="4" fill="#FFFFFF" stroke="#0F172A" stroke-width="4" opacity="0.95"/>
    <line x1="337" y1="360" x2="357" y2="360" stroke="#0F172A" stroke-width="3" stroke-linecap="round"/>
    <line x1="337" y1="368" x2="353" y2="368" stroke="#0F172A" stroke-width="3" stroke-linecap="round"/>
    <line x1="337" y1="376" x2="349" y2="376" stroke="#0F172A" stroke-width="3" stroke-linecap="round"/>
  </g>

  <!-- ==================== CARGO AIRPLANE ==================== -->
  <g id="airplane">
    <!-- 1. LEFT WING (Extending to Upper-Left) -->
    <!-- Swept-back wing with aerodynamic profile -->
    <path d="M 226 210 L 102 120 C 92 112 90 98 98 88 C 106 78 120 76 130 84 L 284 154 Z" 
          fill="url(#planeWingGrad)" stroke="#0F172A" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/>

    <!-- Wing Tip Red Accent Winglet -->
    <path d="M 102 120 C 92 112 90 98 98 88 C 106 78 120 76 130 84 L 144 95 L 118 132 Z" 
          fill="url(#sealFlapGrad)" opacity="0.9"/>

    <!-- 2. JET ENGINES (Two nacelles mounted on the wing leading edge) -->
    <!-- Outboard Engine (Further out on wing) -->
    <g transform="translate(152, 98) rotate(-45)">
      <!-- Nacelle Body -->
      <rect x="-14" y="-32" width="28" height="46" rx="14" 
            fill="url(#planeBodyGrad)" stroke="#0F172A" stroke-width="14" stroke-linejoin="round"/>
      <!-- Front Intake Ring (Red) -->
      <path d="M -14 -18 C -14 -28 14 -28 14 -18 Z" fill="url(#engineRingGrad)"/>
    </g>

    <!-- Inboard Engine (Closer to fuselage) -->
    <g transform="translate(216, 142) rotate(-45)">
      <!-- Nacelle Body -->
      <rect x="-14" y="-32" width="28" height="46" rx="14" 
            fill="url(#planeBodyGrad)" stroke="#0F172A" stroke-width="14" stroke-linejoin="round"/>
      <!-- Front Intake Ring (Red) -->
      <path d="M -14 -18 C -14 -28 14 -28 14 -18 Z" fill="url(#engineRingGrad)"/>
    </g>

    <!-- 3. TAIL STABILIZERS (At bottom-left) -->
    <!-- Lower Horizontal Stabilizer (Pointing down-right) -->
    <path d="M 126 376 L 172 444 C 176 450 184 452 190 448 C 196 444 198 436 194 430 L 158 360 Z" 
          fill="#38BDF8" stroke="#0F172A" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/>

    <!-- Upper Vertical Stabilizer (Tail Fin pointing up-left) -->
    <path d="M 148 350 L 46 294 C 36 288 34 274 42 266 C 50 258 64 260 72 268 L 184 316 Z" 
          fill="url(#tailFinGrad)" stroke="#0F172A" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/>

    <!-- 4. MAIN FUSELAGE -->
    <!-- Full fuselage contour -->
    <path d="M 128 372 
             C 142 342 186 286 264 218 
             C 334 156 382 116 402 98 
             C 416 112 410 134 374 186 
             C 318 266 226 364 166 392 
             C 152 398 136 392 128 372 Z" 
          fill="url(#planeBodyGrad)" stroke="#0F172A" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/>

    <!-- Aero Blue Speed Underbelly Stripe (Giving modern logistics feel) -->
    <path d="M 134 376 
             C 178 356 250 286 318 214 
             C 356 174 384 140 394 122 
             C 400 132 390 154 366 188 
             C 316 260 230 356 164 388 
             C 148 394 138 388 134 376 Z" 
          fill="#0284C7" opacity="0.95" stroke="none"/>

    <!-- 5. COCKPIT WINDOW (Capsule pill along centerline) -->
    <g transform="translate(328, 160) rotate(-45)">
      <rect x="-10" y="-30" width="20" height="60" rx="10" 
            fill="url(#cockpitGlass)" stroke="#0F172A" stroke-width="14" stroke-linejoin="round"/>
      <!-- Glass reflection glint -->
      <line x1="-3" y1="-22" x2="-3" y2="8" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.85"/>
    </g>
  </g>
</svg>`;

// PWA Maskable Icon with dark slate container and safe margins
const maskableSvgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="110" fill="#0f172a"/>
  <!-- Centered with safe margin (inner 78%) -->
  <g transform="translate(56, 56) scale(0.78)">
    ${svgContent.replace(/<svg[^>]*>|<\/svg>/g, '')}
  </g>
</svg>`;

async function generate() {
  console.log('Generating new colorized air-freight icons...');

  // 1. Write public/icon.svg
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent, 'utf-8');
  console.log('Saved public/icon.svg');

  // 2. Render PNG files
  const sizes = [
    { name: 'pwa-512x512.png', width: 512, svg: svgContent },
    { name: 'pwa-192x192.png', width: 192, svg: svgContent },
    { name: 'apple-touch-icon.png', width: 180, svg: svgContent },
    { name: 'pwa-maskable-512x512.png', width: 512, svg: maskableSvgContent }
  ];

  for (const { name, width, svg } of sizes) {
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: width } });
    const pngData = resvg.render().asPng();
    fs.writeFileSync(path.join(publicDir, name), pngData);
    console.log(`Saved ${name} (${width}x${width})`);

    // Also update dist if it exists
    if (fs.existsSync(path.join(rootDir, 'dist'))) {
      fs.writeFileSync(path.join(rootDir, 'dist', name), pngData);
    }
  }

  // 3. Generate favicon.ico using ImageMagick
  try {
    const icon192 = path.join(publicDir, 'pwa-192x192.png');
    const faviconPath = path.join(publicDir, 'favicon.ico');
    execSync(`convert -background none "${icon192}" -define icon:auto-resize=48,32,16 "${faviconPath}"`);
    console.log('Saved favicon.ico');
    if (fs.existsSync(path.join(rootDir, 'dist'))) {
      fs.copyFileSync(faviconPath, path.join(rootDir, 'dist', 'favicon.ico'));
    }
  } catch (err) {
    console.error('favicon.ico note:', err.message);
  }

  console.log('New icons successfully generated!');
}

generate();
