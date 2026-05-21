const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');
const png2icons = require('png2icons');

// Canonical source PNG image path
const sourcePath = 'C:\\Users\\91808\\.gemini\\antigravity\\brain\\a81f41c0-3841-4fc3-83da-7051f597f1cd\\media__1779298976583.png';

async function generate() {
  console.log('Loading canonical brand asset...');
  console.log(`Source path: ${sourcePath}`);
  
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source image does not exist at ${sourcePath}`);
  }

  const image = await Jimp.read(sourcePath);
  console.log(`Successfully loaded master image: ${image.bitmap.width}x${image.bitmap.height}`);
  
  // Make sure all target directories exist
  const webPublicDir = path.resolve(__dirname, '../apps/web/public');
  const desktopBuildDir = path.resolve(__dirname, '../apps/desktop/build');
  const desktopResourcesDir = path.resolve(__dirname, '../apps/desktop/resources');
  
  console.log('Ensuring destination directories exist...');
  fs.mkdirSync(webPublicDir, { recursive: true });
  fs.mkdirSync(desktopBuildDir, { recursive: true });
  fs.mkdirSync(desktopResourcesDir, { recursive: true });
  
  // We need to generate all the specified icon sizes and locations
  const sizes = [
    { width: 16, height: 16, path: path.join(webPublicDir, 'favicon-16x16.png') },
    { width: 32, height: 32, path: path.join(webPublicDir, 'favicon-32x32.png') },
    { width: 180, height: 180, path: path.join(webPublicDir, 'apple-touch-icon.png') },
    { width: 192, height: 192, path: path.join(webPublicDir, 'icon-192.png') },
    { width: 512, height: 512, path: path.join(webPublicDir, 'icon-512.png') },
    { width: 512, height: 512, path: path.join(desktopBuildDir, 'icon.png') },
    { width: 512, height: 512, path: path.join(desktopResourcesDir, 'icon.png') },
  ];
  
  for (const size of sizes) {
    console.log(` -> Resizing to ${size.width}x${size.height} -> ${path.basename(size.path)}`);
    const resized = image.clone().resize({ w: size.width, h: size.height });
    await resized.write(size.path);
  }
  
  // Generate multi-resolution ICO and ICNS formats
  console.log('Generating multi-resolution ICO and ICNS binaries...');
  const png512Path = path.join(desktopBuildDir, 'icon.png');
  const png512Buffer = fs.readFileSync(png512Path);
  
  // Web Favicon
  console.log(' -> Creating apps/web/public/favicon.ico (Web favicon)...');
  const icoBufferWeb = png2icons.createICO(png512Buffer, png2icons.BILINEAR, 0, false);
  if (icoBufferWeb) {
    fs.writeFileSync(path.join(webPublicDir, 'favicon.ico'), icoBufferWeb);
    console.log('    Saved favicon.ico');
  } else {
    throw new Error('Failed to generate apps/web/public/favicon.ico');
  }
  
  // Desktop Windows Icon
  console.log(' -> Creating apps/desktop/build/icon.ico (Windows icon)...');
  const icoBufferDesktop = png2icons.createICO(png512Buffer, png2icons.BILINEAR, 0, false);
  if (icoBufferDesktop) {
    fs.writeFileSync(path.join(desktopBuildDir, 'icon.ico'), icoBufferDesktop);
    console.log('    Saved build/icon.ico');
  } else {
    throw new Error('Failed to generate apps/desktop/build/icon.ico');
  }
  
  // Desktop macOS Icon
  console.log(' -> Creating apps/desktop/build/icon.icns (macOS icon)...');
  const icnsBuffer = png2icons.createICNS(png512Buffer, png2icons.RESCALE, 0);
  if (icnsBuffer) {
    fs.writeFileSync(path.join(desktopBuildDir, 'icon.icns'), icnsBuffer);
    console.log('    Saved build/icon.icns');
  } else {
    throw new Error('Failed to generate apps/desktop/build/icon.icns');
  }
  
  console.log('All branding assets successfully created and updated!');
}

generate().catch(err => {
  console.error('Fatal error during branding asset generation:', err);
  process.exit(1);
});
