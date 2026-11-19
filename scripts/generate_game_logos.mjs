import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// 1. Bingo - Color Trading SVG
const bingoSvg = `
<svg width="800" height="800" viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradients -->
    <radialGradient id="bgGlow" cx="50%" cy="45%" r="65%">
      <stop offset="0%" stop-color="#4c1d95" stop-opacity="0.8"/>
      <stop offset="45%" stop-color="#1e113a" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#090514"/>
    </radialGradient>
    
    <linearGradient id="violetGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#c084fc"/>
      <stop offset="50%" stop-color="#9333ea"/>
      <stop offset="100%" stop-color="#581c87"/>
    </linearGradient>

    <linearGradient id="greenOrb" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="40%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>

    <linearGradient id="redOrb" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f87171"/>
      <stop offset="40%" stop-color="#ef4444"/>
      <stop offset="100%" stop-color="#991b1b"/>
    </linearGradient>

    <linearGradient id="violetOrb" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e879f9"/>
      <stop offset="40%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#6b21a8"/>
    </linearGradient>

    <linearGradient id="goldMetallic" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fffbeb"/>
      <stop offset="25%" stop-color="#fef08a"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="75%" stop-color="#d97706"/>
      <stop offset="100%" stop-color="#78350f"/>
    </linearGradient>

    <linearGradient id="textGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="35%" stop-color="#faf5ff"/>
      <stop offset="70%" stop-color="#d8b4fe"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>

    <!-- Filters -->
    <filter id="glowEffect" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="18" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>

    <filter id="shadowFilter" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.8"/>
    </filter>
  </defs>

  <!-- Background Canvas -->
  <rect width="800" height="800" rx="36" fill="url(#bgGlow)"/>

  <!-- Subtle Radial Rings / Trading Target Grid -->
  <circle cx="400" cy="360" r="320" stroke="#7c3aed" stroke-opacity="0.12" stroke-width="2" stroke-dasharray="8 8"/>
  <circle cx="400" cy="360" r="260" stroke="#8b5cf6" stroke-opacity="0.18" stroke-width="2"/>
  <circle cx="400" cy="360" r="190" stroke="#a855f7" stroke-opacity="0.25" stroke-width="2" stroke-dasharray="6 6"/>

  <!-- Trading Market Wave Line (Subtle background graphic) -->
  <path d="M 60 480 Q 180 430, 280 460 T 460 380 T 600 390 T 740 320" fill="none" stroke="#a855f7" stroke-opacity="0.3" stroke-width="3" stroke-linecap="round"/>
  <path d="M 60 520 Q 200 500, 320 440 T 520 460 T 660 360 T 740 280" fill="none" stroke="#ffd700" stroke-opacity="0.25" stroke-width="2" stroke-dasharray="4 4"/>

  <!-- CENTRAL BINGO BALL SPHERE (Deep 3D) -->
  <g filter="url(#shadowFilter)">
    <!-- Outer Glow -->
    <circle cx="400" cy="330" r="150" fill="#7c3aed" opacity="0.25" filter="url(#glowEffect)"/>
    <!-- Sphere Body -->
    <circle cx="400" cy="330" r="140" fill="url(#violetGlow)"/>
    <!-- Specular Highlight for 3D depth -->
    <ellipse cx="360" cy="250" rx="75" ry="40" fill="#ffffff" opacity="0.35" transform="rotate(-25 360 250)"/>
    <!-- Central Number Window / Badge -->
    <circle cx="400" cy="330" r="76" fill="#0f0724" stroke="url(#goldMetallic)" stroke-width="6"/>
    <!-- Winning Number 7 / Lucky Symbol inside Ball -->
    <text x="400" y="358" font-family="'Outfit', 'Plus Jakarta Sans', Arial, sans-serif" font-size="82" font-weight="900" fill="url(#goldMetallic)" text-anchor="middle" letter-spacing="-2">7</text>
  </g>

  <!-- 3 COLOR TRADING ORBS (GREEN, VIOLET, RED) orbiting the center -->
  
  <!-- LEFT: GREEN TRADING ORB (2x) -->
  <g filter="url(#shadowFilter)">
    <circle cx="210" cy="360" r="62" fill="url(#greenOrb)"/>
    <ellipse cx="190" cy="325" rx="30" ry="16" fill="#ffffff" opacity="0.45" transform="rotate(-30 190 325)"/>
    <circle cx="210" cy="360" r="58" stroke="#6ee7b7" stroke-width="2" fill="none" opacity="0.6"/>
    <text x="210" y="355" font-family="'Outfit', Arial, sans-serif" font-size="14" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="1">GREEN</text>
    <text x="210" y="378" font-family="'JetBrains Mono', monospace" font-size="18" font-weight="900" fill="#d1fae5" text-anchor="middle">2.0×</text>
  </g>

  <!-- RIGHT: RED TRADING ORB (2x) -->
  <g filter="url(#shadowFilter)">
    <circle cx="590" cy="360" r="62" fill="url(#redOrb)"/>
    <ellipse cx="570" cy="325" rx="30" ry="16" fill="#ffffff" opacity="0.45" transform="rotate(-30 570 325)"/>
    <circle cx="590" cy="360" r="58" stroke="#fca5a5" stroke-width="2" fill="none" opacity="0.6"/>
    <text x="590" y="355" font-family="'Outfit', Arial, sans-serif" font-size="14" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="1">RED</text>
    <text x="590" y="378" font-family="'JetBrains Mono', monospace" font-size="18" font-weight="900" fill="#fee2e2" text-anchor="middle">2.0×</text>
  </g>

  <!-- TOP-CENTER: VIOLET TRADING ORB (4.5x) -->
  <g filter="url(#shadowFilter)">
    <circle cx="400" cy="140" r="55" fill="url(#violetOrb)"/>
    <ellipse cx="385" cy="110" rx="26" ry="14" fill="#ffffff" opacity="0.5" transform="rotate(-30 385 110)"/>
    <circle cx="400" cy="140" r="51" stroke="#f0abfc" stroke-width="2" fill="none" opacity="0.6"/>
    <text x="400" y="136" font-family="'Outfit', Arial, sans-serif" font-size="13" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="1">VIOLET</text>
    <text x="400" y="157" font-family="'JetBrains Mono', monospace" font-size="16" font-weight="900" fill="#fae8ff" text-anchor="middle">4.5×</text>
  </g>

  <!-- Golden Stars & Sparkles -->
  <path d="M 170 210 L 175 225 L 190 230 L 175 235 L 170 250 L 165 235 L 150 230 L 165 225 Z" fill="#ffd700" opacity="0.85"/>
  <path d="M 640 210 L 644 220 L 654 224 L 644 228 L 640 238 L 636 228 L 626 224 L 636 220 Z" fill="#ffd700" opacity="0.85"/>
  <path d="M 290 150 L 293 158 L 301 161 L 293 164 L 290 172 L 287 164 L 279 161 L 287 158 Z" fill="#a855f7" opacity="0.75"/>
  <path d="M 510 150 L 513 158 L 521 161 L 513 164 L 510 172 L 507 164 L 499 161 L 507 158 Z" fill="#a855f7" opacity="0.75"/>

  <!-- BOTTOM TYPOGRAPHY BANNER -->
  <g filter="url(#shadowFilter)">
    <!-- Brand Ribbon Background -->
    <rect x="90" y="525" width="620" height="225" rx="24" fill="#0b0817" fill-opacity="0.9" stroke="url(#goldMetallic)" stroke-width="2"/>
    
    <!-- MAIN TITLE: BINGO -->
    <text x="400" y="618" font-family="'Sora', 'Outfit', 'Plus Jakarta Sans', Arial, sans-serif" font-size="82" font-weight="900" fill="url(#textGrad)" text-anchor="middle" letter-spacing="4" filter="url(#shadowFilter)">
      BINGO
    </text>

    <!-- SUBTITLE PILL: COLOR TRADING -->
    <rect x="230" y="642" width="340" height="42" rx="21" fill="url(#violetGlow)" stroke="#c084fc" stroke-width="1.5"/>
    <circle cx="262" cy="663" r="6" fill="#10b981"/>
    <circle cx="280" cy="663" r="6" fill="#a855f7"/>
    <circle cx="298" cy="663" r="6" fill="#ef4444"/>
    <text x="424" y="671" font-family="'Outfit', Arial, sans-serif" font-size="18" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="3">
      COLOR TRADING
    </text>

    <!-- FOOTER TAG: 60s RAPID DRAW · PROVABLY FAIR -->
    <text x="400" y="722" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="700" fill="#a78bfa" text-anchor="middle" letter-spacing="2">
      ⚡ 60s RAPID DRAW · 100% PROVABLY FAIR
    </text>
  </g>
</svg>
`;

// 2. Horse Racing SVG
const horseRacingSvg = `
<svg width="800" height="800" viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradients -->
    <radialGradient id="derbyBg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#3b156b" stop-opacity="0.85"/>
      <stop offset="50%" stop-color="#140b2e" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#060312"/>
    </radialGradient>

    <linearGradient id="goldDerby" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fffbeb"/>
      <stop offset="20%" stop-color="#fde047"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="85%" stop-color="#b45309"/>
      <stop offset="100%" stop-color="#78350f"/>
    </linearGradient>

    <linearGradient id="horseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="30%" stop-color="#fef08a"/>
      <stop offset="70%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>

    <linearGradient id="neonTurf" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0"/>
      <stop offset="25%" stop-color="#10b981" stop-opacity="0.8"/>
      <stop offset="50%" stop-color="#34d399"/>
      <stop offset="75%" stop-color="#05d5aa" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#05d5aa" stop-opacity="0"/>
    </linearGradient>

    <linearGradient id="speedViolet" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#c084fc"/>
      <stop offset="60%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#4c1d95"/>
    </linearGradient>

    <!-- Filters -->
    <filter id="horseGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="15" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>

    <filter id="derbyShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000000" flood-opacity="0.85"/>
    </filter>
  </defs>

  <!-- Background Canvas -->
  <rect width="800" height="800" rx="36" fill="url(#derbyBg)"/>

  <!-- Stadium Floodlight Beams (Dynamic Atmosphere) -->
  <polygon points="120,0 260,0 480,500 240,500" fill="#a855f7" opacity="0.08"/>
  <polygon points="680,0 540,0 320,500 560,500" fill="#ffd700" opacity="0.08"/>

  <!-- Circular Stadium / Derby Track Arc -->
  <ellipse cx="400" cy="380" rx="340" ry="240" stroke="#7c3aed" stroke-opacity="0.2" stroke-width="2" stroke-dasharray="8 8"/>
  <ellipse cx="400" cy="380" rx="280" ry="190" stroke="url(#goldDerby)" stroke-opacity="0.3" stroke-width="2"/>

  <!-- Dynamic Curved Turf Sprint Rails -->
  <path d="M 60 480 C 220 380, 580 380, 740 480" stroke="url(#neonTurf)" stroke-width="6" fill="none" filter="url(#horseGlow)"/>
  <path d="M 90 515 C 240 425, 560 425, 710 515" stroke="#10b981" stroke-opacity="0.3" stroke-width="2" stroke-dasharray="10 8" fill="none"/>

  <!-- Motion Streak Lines -->
  <path d="M 120 280 L 320 280" stroke="#ffd700" stroke-width="3" stroke-linecap="round" stroke-opacity="0.4"/>
  <path d="M 80 320 L 260 320" stroke="#c084fc" stroke-width="4" stroke-linecap="round" stroke-opacity="0.5"/>
  <path d="M 140 360 L 300 360" stroke="#ffd700" stroke-width="2" stroke-linecap="round" stroke-opacity="0.3"/>
  <path d="M 100 400 L 240 400" stroke="#34d399" stroke-width="3" stroke-linecap="round" stroke-opacity="0.4"/>

  <!-- CENTERPIECE: DYNAMIC THOROUGHBRED STALLION & JOCKEY SILHOUETTE IN FULL GALLOP -->
  <g filter="url(#derbyShadow)">
    <!-- Ambient Horse Silhouette Glow -->
    <ellipse cx="430" cy="275" rx="190" ry="120" fill="#9333ea" opacity="0.3" filter="url(#horseGlow)"/>

    <!-- Geometric Powerful Galloping Thoroughbred Silhouette -->
    <!-- Horse Body, Neck, Head, Mane, and Legs in Mid-Stride -->
    <path d="
      M 310 320 
      C 300 290, 310 260, 340 240 
      C 370 220, 390 190, 410 140 
      C 415 130, 425 125, 435 130 
      C 440 132, 445 125, 450 115 
      C 455 105, 465 110, 465 120 
      C 475 115, 485 125, 485 135 
      C 495 130, 520 145, 550 170 
      C 565 182, 575 200, 565 210 
      C 555 220, 535 210, 520 205 
      C 510 225, 495 240, 490 260 
      C 525 270, 560 265, 610 280 
      C 645 290, 680 320, 710 370 
      L 675 365 
      C 655 335, 620 315, 580 310 
      C 560 340, 530 365, 500 400 
      L 525 460 
      L 505 465 
      L 475 390 
      C 445 395, 410 395, 380 385 
      L 330 450 
      L 310 445 
      L 345 370 
      C 325 355, 315 340, 310 320 Z
    " fill="url(#horseGradient)" filter="url(#horseGlow)"/>

    <!-- Jockey in crouched sprint position -->
    <path d="
      M 420 195 
      C 425 175, 445 170, 455 180 
      C 465 190, 460 205, 445 210 
      C 435 215, 420 205, 420 195 Z
    " fill="#ffffff"/>
    <path d="
      M 405 215 
      C 415 205, 440 205, 460 215 
      L 490 240 
      L 470 255 
      L 440 235 
      L 410 245 Z
    " fill="#7c3aed"/>

    <!-- Horse eye & muzzle accents -->
    <circle cx="530" cy="180" r="4" fill="#1e113a"/>
    <path d="M 445 145 C 460 170, 440 210, 420 245" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.6"/>
  </g>

  <!-- Golden Horseshoe Icon / Lucky Derby Emblem on Left & Right -->
  <g transform="translate(140, 210) scale(0.7)">
    <path d="M 30 10 C 15 25, 10 50, 15 75 C 20 100, 40 120, 65 120 C 90 120, 110 100, 115 75 C 120 50, 115 25, 100 10 L 80 25 C 90 40, 90 60, 85 75 C 80 90, 75 95, 65 95 C 55 95, 50 90, 45 75 C 40 60, 40 40, 50 25 Z" fill="url(#goldDerby)"/>
  </g>

  <!-- High Odds Multiplier Badge: UP TO 35.0x -->
  <g filter="url(#derbyShadow)">
    <rect x="545" y="140" width="165" height="42" rx="21" fill="#110d24" stroke="url(#goldDerby)" stroke-width="2"/>
    <text x="627" y="167" font-family="'JetBrains Mono', monospace" font-size="16" font-weight="900" fill="#ffd700" text-anchor="middle" letter-spacing="1">
      UP TO 35×
    </text>
  </g>

  <!-- BOTTOM TYPOGRAPHY BANNER -->
  <g filter="url(#derbyShadow)">
    <!-- Brand Ribbon Background -->
    <rect x="90" y="525" width="620" height="225" rx="24" fill="#090514" fill-opacity="0.92" stroke="url(#goldDerby)" stroke-width="2"/>
    
    <!-- MAIN TITLE: HORSE RACING -->
    <text x="400" y="618" font-family="'Sora', 'Outfit', 'Plus Jakarta Sans', Arial, sans-serif" font-size="64" font-weight="900" fill="url(#goldDerby)" text-anchor="middle" letter-spacing="3" filter="url(#derbyShadow)">
      HORSE RACING
    </text>

    <!-- SUBTITLE PILL: LIVE VIRTUAL DERBY -->
    <rect x="240" y="642" width="320" height="42" rx="21" fill="url(#speedViolet)" stroke="#a855f7" stroke-width="1.5"/>
    <text x="400" y="670" font-family="'Outfit', Arial, sans-serif" font-size="18" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="3">
      🏇 LIVE VIRTUAL DERBY
    </text>

    <!-- FOOTER TAG: 6 THOROUGHBREDS · FIXED ODDS -->
    <text x="400" y="722" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="700" fill="#34d399" text-anchor="middle" letter-spacing="2">
      TURF SPRINT · FIXED ODDS · PROVABLY FAIR
    </text>
  </g>
</svg>
`;

async function main() {
  const itemsDir = path.resolve('public/items');
  if (!fs.existsSync(itemsDir)) {
    fs.mkdirSync(itemsDir, { recursive: true });
  }

  console.log('Generating Bingo – Color Trading logos...');
  // Save SVG
  fs.writeFileSync(path.join(itemsDir, 'bingo.svg'), bingoSvg.trim());
  
  // Render PNG and JPG with sharp
  const bingoBuffer = Buffer.from(bingoSvg);
  await sharp(bingoBuffer)
    .resize(800, 800)
    .jpeg({ quality: 95 })
    .toFile(path.join(itemsDir, 'Bingo.jpg'));

  await sharp(bingoBuffer)
    .resize(800, 800)
    .jpeg({ quality: 95 })
    .toFile(path.join(itemsDir, 'Bingo – Color Trading.jpg'));

  await sharp(bingoBuffer)
    .resize(800, 800)
    .png({ quality: 95 })
    .toFile(path.join(itemsDir, 'bingo.png'));

  console.log('✓ Bingo logos saved in public/items/');

  console.log('Generating Horse Racing logos...');
  // Save SVG
  fs.writeFileSync(path.join(itemsDir, 'horse-racing.svg'), horseRacingSvg.trim());

  // Render PNG and JPG with sharp
  const horseBuffer = Buffer.from(horseRacingSvg);
  await sharp(horseBuffer)
    .resize(800, 800)
    .jpeg({ quality: 95 })
    .toFile(path.join(itemsDir, 'Horse Racing.jpg'));

  await sharp(horseBuffer)
    .resize(800, 800)
    .jpeg({ quality: 95 })
    .toFile(path.join(itemsDir, 'horse-racing.jpg'));

  await sharp(horseBuffer)
    .resize(800, 800)
    .png({ quality: 95 })
    .toFile(path.join(itemsDir, 'horse-racing.png'));

  console.log('✓ Horse Racing logos saved in public/items/');
}

main().catch(err => {
  console.error('Error generating logos:', err);
  process.exit(1);
});
