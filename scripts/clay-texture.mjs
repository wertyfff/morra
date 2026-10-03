// One-off: lifts the real clay surface out of the product photo (src/assets/glaze-clay-source.png)
// and turns it into a seamless, colour-neutral detail texture for the 3D pieces.
// Run with `node scripts/clay-texture.mjs`.
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const src = fileURLToPath(new URL('../src/assets/glaze-clay-source.png', import.meta.url));
const out = fileURLToPath(new URL('../src/assets/clay-detail.webp', import.meta.url));

// evenly lit stretches of bare surface: the side of the cup and the inside of the bowl
const PATCHES = [
  { left: 915, top: 630, width: 190, height: 170 },
  { left: 300, top: 500, width: 200, height: 115 },
];
const TILE = 256;

async function patch(region) {
  const grey = await sharp(src)
    .removeAlpha()
    .extract(region)
    .resize(TILE, TILE, { fit: 'fill' })
    .toColourspace('b-w')
    .raw()
    .toBuffer();
  if (grey.length !== TILE * TILE) throw new Error(`expected one channel, got ${grey.length / (TILE * TILE)}`);
  // dividing by a heavily blurred copy removes the photo's own light and shade, leaving only
  // the relief of the clay
  const low = await sharp(grey, { raw: { width: TILE, height: TILE, channels: 1 } }).blur(22).toColourspace('b-w').raw().toBuffer();
  const flat = Buffer.alloc(TILE * TILE);
  for (let i = 0; i < flat.length; i++) {
    const k = grey[i] / Math.max(low[i], 1);
    flat[i] = Math.min(255, Math.max(0, 222 + (k - 1) * 330));
  }
  return flat;
}

// Each patch is mirrored into a 2×2 block, which makes it tile without seams; the blocks are
// then averaged, which hides the mirror symmetry of any single one.
const size = TILE * 2;
const sum = new Float32Array(size * size);
for (const region of PATCHES) {
  const p = await patch(region);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = x < TILE ? x : size - 1 - x;
      const sy = y < TILE ? y : size - 1 - y;
      // the second patch is laid in transposed, so the two symmetries do not line up
      sum[y * size + x] += region === PATCHES[0] ? p[sy * TILE + sx] : p[sx * TILE + sy];
    }
  }
}
const sheet = Buffer.from(sum.map((v) => v / PATCHES.length));
const info = await sharp(sheet, { raw: { width: size, height: size, channels: 1 } })
  .webp({ quality: 90 })
  .toFile(out);
console.log(info.width, info.height, info.size);
