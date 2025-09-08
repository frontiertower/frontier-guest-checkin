// Simple script to generate PWA icons
// Since we don't have image manipulation libraries installed,
// we'll create placeholder icons that can be replaced with proper ones

const fs = require('fs');
const path = require('path');

// Create a simple SVG icon with Frontier Tower branding
const createIcon = (size) => {
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#6B46C1"/>
  <rect x="${size * 0.2}" y="${size * 0.35}" width="${size * 0.25}" height="${size * 0.3}" fill="white"/>
  <rect x="${size * 0.55}" y="${size * 0.25}" width="${size * 0.25}" height="${size * 0.4}" fill="white"/>
  <text x="${size * 0.5}" y="${size * 0.8}" font-family="Arial, sans-serif" font-size="${size * 0.15}" font-weight="bold" fill="white" text-anchor="middle">FT</text>
</svg>`;
  return svg;
};

// Create maskable icon (with safe area padding)
const createMaskableIcon = (size) => {
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#6B46C1"/>
  <rect x="${size * 0.3}" y="${size * 0.4}" width="${size * 0.15}" height="${size * 0.2}" fill="white"/>
  <rect x="${size * 0.55}" y="${size * 0.35}" width="${size * 0.15}" height="${size * 0.3}" fill="white"/>
  <text x="${size * 0.5}" y="${size * 0.7}" font-family="Arial, sans-serif" font-size="${size * 0.1}" font-weight="bold" fill="white" text-anchor="middle">FT</text>
</svg>`;
  return svg;
};

// Icon sizes to generate
const sizes = [192, 512];

// Generate icons
sizes.forEach(size => {
  // Regular icons
  fs.writeFileSync(
    path.join(__dirname, 'public', `icon-${size}.svg`),
    createIcon(size)
  );
  
  // Maskable icons (with padding for adaptive icons)
  fs.writeFileSync(
    path.join(__dirname, 'public', `icon-maskable-${size}.svg`),
    createMaskableIcon(size)
  );
});

// Create Apple touch icon (180x180)
fs.writeFileSync(
  path.join(__dirname, 'public', 'apple-touch-icon.svg'),
  createIcon(180)
);

console.log('SVG icons generated successfully!');
console.log('Note: These are placeholder SVG icons. For production, convert to PNG format.');
console.log('You can use online tools or ImageMagick to convert SVG to PNG:');
console.log('  convert icon-192.svg icon-192.png');
console.log('  convert icon-512.svg icon-512.png');
console.log('  convert icon-maskable-192.svg icon-maskable-192.png');
console.log('  convert icon-maskable-512.svg icon-maskable-512.png');
console.log('  convert apple-touch-icon.svg apple-touch-icon.png');