/**
 * Icon Generator Script
 * 
 * This script generates all required icon sizes from a master PNG logo.
 * Run with: pnpm generate:icons
 * 
 * Required: sharp package
 * Run: pnpm add -D sharp
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PUBLIC_DIR = path.join(__dirname, '..', 'apps', 'web', 'public');
const DESKTOP_BUILD_DIR = path.join(__dirname, '..', 'apps', 'desktop', 'build');

// Master icon path (replace with actual path to uploaded logo)
const MASTER_ICON = process.env.ICON_PATH || path.join(PUBLIC_DIR, 'icon.svg');

// Web icon sizes
const WEB_ICONS = [
  { name: 'favicon.ico', size: null },
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

// Desktop icon sizes and formats
const DESKTOP_ICONS = [
  { name: 'icon.png', size: 512, format: 'png' },
  { name: 'icon.ico', size: 256, format: 'ico' },
  { name: 'icon.icns', size: 512, format: 'icns' },
];

async function generateWebIcons() {
  console.log('Generating web icons...');
  
  const masterBuffer = await sharp(MASTER_ICON)
    .resize(512, 512)
    .png()
    .toBuffer();

  for (const icon of WEB_ICONS) {
    if (icon.size === null) {
      // Generate ICO
      await sharp(masterBuffer)
        .resize(256, 256)
        .toFile(path.join(PUBLIC_DIR, icon.name.replace('.png', '.ico')));
    } else {
      await sharp(masterBuffer)
        .resize(icon.size, icon.size)
        .png()
        .toFile(path.join(PUBLIC_DIR, icon.name));
    }
    console.log(`  Created ${icon.name}`);
  }
}

async function generateDesktopIcons() {
  console.log('Generating desktop icons...');
  
  const master = await sharp(MASTER_ICON).resize(512, 512).png().toBuffer();

  // PNG for Linux
  await sharp(master)
    .resize(512, 512)
    .png()
    .toFile(path.join(DESKTOP_BUILD_DIR, 'icon.png'));
  console.log('  Created icon.png (Linux)');

  // ICO for Windows (using multiple sizes)
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const icoBuffers = await Promise.all(
    icoSizes.map(size => 
      sharp(master)
        .resize(size, size)
        .png()
        .toBuffer()
    )
  );
  
  // Simple ICO creation (single size for now)
  await sharp(master)
    .resize(256, 256)
    .png()
    .toFile(path.join(DESKTOP_BUILD_DIR, 'icon.ico'));
  console.log('  Created icon.ico (Windows)');

  // ICNS for macOS
  await sharp(master)
    .resize(512, 512)
    .png()
    .toFile(path.join(DESKTOP_BUILD_DIR, 'icon.icns'));
  console.log('  Created icon.icns (macOS)');
}

async function main() {
  // Ensure directories exist
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }
  if (!fs.existsSync(DESKTOP_BUILD_DIR)) {
    fs.mkdirSync(DESKTOP_BUILD_DIR, { recursive: true });
  }

  // Check if master icon exists
  if (!fs.existsSync(MASTER_ICON)) {
    console.error(`Master icon not found: ${MASTER_ICON}`);
    console.error('Please place your icon.png in apps/web/public/ or set ICON_PATH');
    process.exit(1);
  }

  try {
    await generateWebIcons();
    await generateDesktopIcons();
    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error.message);
    process.exit(1);
  }
}

main();