import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// Read the logo image
const logoPath = resolve('public/lite-logo.png');

// Define all the sizes we need for comprehensive favicon support
const sizes = [
  { name: 'favicon-16x16.png', size: 16 },     // Standard browser tab
  { name: 'favicon-32x32.png', size: 32 },     // Standard browser tab (high DPI)
  { name: 'favicon-48x48.png', size: 48 },     // Windows site icons
  { name: 'apple-touch-icon.png', size: 180 }, // iOS home screen
  { name: 'android-chrome-192x192.png', size: 192 }, // Android home screen
  { name: 'android-chrome-512x512.png', size: 512 }, // Android splash screen
];

async function generateFavicons() {
  console.log('Generating favicons...');
  
  for (const { name, size } of sizes) {
    await sharp(logoPath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(resolve('public', name));
    
    console.log(`✓ Generated ${name} (${size}x${size})`);
  }

  // Generate favicon.ico (multi-size icon for legacy browsers)
  // ICO format supports multiple sizes in one file
  await sharp(logoPath)
    .resize(32, 32, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .toFile(resolve('public/favicon.ico'));
  
  console.log('✓ Generated favicon.ico (32x32)');

  // Generate SVG version (scalable for any size)
  console.log('\n⚠ Note: SVG favicon should be created manually from your logo');
  console.log('  Place it at public/favicon.svg for best scalability');

  // Generate web app manifest for PWA support
  const manifest = {
    name: "Travio Ghana Tours",
    short_name: "Travio Ghana",
    description: "Explore Tourism in Ghana",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ],
    theme_color: "#ffffff",
    background_color: "#ffffff",
    display: "standalone"
  };

  writeFileSync(
    resolve('public/site.webmanifest'),
    JSON.stringify(manifest, null, 2)
  );
  
  console.log('✓ Generated site.webmanifest');
  console.log('\n✅ All favicons generated successfully!');
}

generateFavicons().catch(console.error);
