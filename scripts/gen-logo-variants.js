const fs = require('fs');
const svg = fs.readFileSync('C:/Claude/status-pulse/logo.svg', 'utf8');

// The first <path> element is the white background (fill="#FEFEFE").
// Remove it so the falcon appears without a white background.
const firstPathStart = svg.indexOf('<path');
const firstPathEnd   = svg.indexOf('z"/>', firstPathStart) + 4; // 4 = len of z"/>
const withoutBg      = svg.slice(0, firstPathStart) + svg.slice(firstPathEnd);

// ── 1. Transparent logo (for header) ─────────────────────────────────────────
// Falcon renders in its original purple/lavender palette on any background.
// Also strip decorative white (#FEFEFE) fills so they don't show as blobs.
const withoutWhite = withoutBg.replace(/<path fill="#FEFEFE"[\s\S]*?\/>/g, '');
fs.writeFileSync('C:/Claude/status-pulse/public/logo-transparent.svg', withoutWhite);
console.log('✓ logo-transparent.svg written');

// ── 2. Favicon (white falcon on accent-color background) ─────────────────────
// Insert a rounded purple rect right after the opening <svg ...> tag.
const svgTagClose = withoutBg.indexOf('>') + 1;
const withBg =
  withoutBg.slice(0, svgTagClose) +
  '\n<rect width="1024" height="1024" rx="180" fill="#6366f1"/>' +
  withoutBg.slice(svgTagClose);

// Change all the purple/lavender path fills to white.
// Colors in this logo that are NOT near-white: #93xxxx, #92xxxx, #96xxxx, #8Fxxxx
const favicon = withBg.replace(/fill="#[89][0-9A-Fa-f]{5}"/g, 'fill="white"');

fs.writeFileSync('C:/Claude/status-pulse/public/favicon.svg', favicon);
console.log('✓ favicon.svg written');
