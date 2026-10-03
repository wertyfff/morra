// One-off: cut the ceramics out of the hero photo into separate transparent layers.
// Two steps, because the background remover bundles its own copy of sharp and the two
// cannot be loaded into one process:
//   node scripts/cutout.mjs matte   -> cutout.png (background removed)
//   node scripts/cutout.mjs         -> one .webp per object
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dir = new URL('../src/assets/hero/', import.meta.url);
const NAMES = ['plate', 'vase', 'cup', 'tumbler', 'bowl']; // left to right in the photo

if (process.argv[2] === 'matte') {
  const { removeBackground } = await import('@imgly/background-removal-node');
  const source = await readFile(new URL('source.png', dir));
  const blob = await removeBackground(new Blob([source], { type: 'image/png' }), { model: 'medium' });
  await writeFile(new URL('cutout.png', dir), Buffer.from(await blob.arrayBuffer()));
  process.exit(0);
}

const { default: sharp } = await import('sharp');
const cut = await readFile(new URL('cutout.png', dir));

const { data, info } = await sharp(cut).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;

// label connected regions of solid pixels
const label = new Int32Array(W * H);
const parts = [];
const stack = [];
for (let start = 0; start < W * H; start++) {
  if (label[start] || data[start * 4 + 3] < 128) continue;
  const id = parts.length + 1;
  const part = { id, n: 0, x0: W, y0: H, x1: 0, y1: 0, sx: 0 };
  label[start] = id;
  stack.push(start);
  while (stack.length) {
    const p = stack.pop();
    const x = p % W;
    const y = (p - x) / W;
    part.n++;
    part.sx += x;
    if (x < part.x0) part.x0 = x;
    if (x > part.x1) part.x1 = x;
    if (y < part.y0) part.y0 = y;
    if (y > part.y1) part.y1 = y;
    for (const q of [p - 1, p + 1, p - W, p + W]) {
      if (q < 0 || q >= W * H || label[q] || data[q * 4 + 3] < 128) continue;
      if ((q === p - 1 && x === 0) || (q === p + 1 && x === W - 1)) continue;
      label[q] = id;
      stack.push(q);
    }
  }
  parts.push(part);
}

// In the photo the plate overlaps the vase and the bowl overlaps the tumbler, so the matte has
// three blobs: [plate + vase], [cup], [tumbler + bowl]. The pairs are pulled apart by glaze colour.
const [left, mid, right] = parts
  .sort((a, b) => b.n - a.n)
  .slice(0, 3)
  .sort((a, b) => a.sx / a.n - b.sx / b.n);

const hueSat = (p) => {
  const r = data[p * 4] / 255;
  const g = data[p * 4 + 1] / 255;
  const b = data[p * 4 + 2] / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (!d) return [0, 0];
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return [h, d / max];
};

// owner: 1 plate, 2 vase, 3 cup, 4 tumbler, 5 bowl
const owner = new Uint8Array(W * H);
for (let p = 0; p < W * H; p++) {
  const x = p % W;
  const y = (p - x) / W;
  if (label[p] === mid.id) owner[p] = 3;
  else if (label[p] === left.id) {
    const [h, s] = hueSat(p);
    const olive = h > 44 && h < 130 && s > 0.1;
    owner[p] = y > 600 && (olive || x < 415 || y > 695) ? 1 : 2;
  } else if (label[p] === right.id) {
    const [h, s] = hueSat(p);
    const terracotta = (h < 27 || h > 345) && s > 0.32;
    owner[p] = terracotta || y < 552 ? 4 : 5;
  }
}

// majority vote in a small window cleans up highlights that landed on the wrong side
for (let pass = 0; pass < 3; pass++) {
  const next = owner.slice();
  for (let y = 5; y < H - 5; y++) {
    for (let x = 5; x < W - 5; x++) {
      const p = y * W + x;
      if (!owner[p] || owner[p] === 3) continue;
      const votes = [0, 0, 0, 0, 0, 0];
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) votes[owner[p + dy * W + dx]]++;
      const pair = owner[p] < 3 ? [1, 2] : [4, 5];
      next[p] = votes[pair[0]] >= votes[pair[1]] ? pair[0] : pair[1];
    }
  }
  owner.set(next);
}

const PAD = 6;
const layout = {};
let css = '';
for (const [i, name] of NAMES.entries()) {
  const id = i + 1;
  let bx0 = W;
  let by0 = H;
  let bx1 = 0;
  let by1 = 0;
  for (let p = 0; p < W * H; p++) {
    if (owner[p] !== id) continue;
    const x = p % W;
    const y = (p - x) / W;
    if (x < bx0) bx0 = x;
    if (x > bx1) bx1 = x;
    if (y < by0) by0 = y;
    if (y > by1) by1 = y;
  }
  const x0 = Math.max(bx0 - PAD, 0);
  const y0 = Math.max(by0 - PAD, 0);
  const w = Math.min(bx1 + PAD, W - 1) - x0 + 1;
  const h = Math.min(by1 + PAD, H - 1) - y0 + 1;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y0 + y) * W + x0 + x;
      // this object's pixels plus its soft edge; neighbours sharing the box are dropped
      let mine = false;
      let other = false;
      for (const q of [p, p - 1, p + 1, p - W, p + W, p - 2, p + 2, p - 2 * W, p + 2 * W]) {
        if (owner[q] === id) mine = true;
        else if (owner[q]) other = true;
      }
      if (!mine || (owner[p] !== id && other)) continue;
      data.copy(out, (y * w + x) * 4, p * 4, p * 4 + 4);
    }
  }
  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(fileURLToPath(new URL(`${name}.webp`, dir)));
  // the cast shadow is baked here (black silhouette, pre-blurred) so the page never runs a blur filter
  const M = 48;
  const sil = Buffer.alloc(w * h * 4);
  for (let p = 0; p < w * h; p++) sil[p * 4 + 3] = out[p * 4 + 3];
  await sharp(sil, { raw: { width: w, height: h, channels: 4 } })
    .extend({ top: M, bottom: M, left: M, right: M, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .blur(16)
    .webp({ quality: 80, alphaQuality: 80 })
    .toFile(fileURLToPath(new URL(`${name}-shadow.webp`, dir)));

  // position inside the original frame, in percent, for the CSS layout
  const pct = (n) => +(n * 100).toFixed(2);
  layout[name] = { left: pct(x0 / W), bottom: pct((H - y0 - h) / H), width: pct(w / W) };
  css += `.hero__sh--${name} {\n  left: ${pct((x0 - M) / W)}%;\n  bottom: ${pct((H - y0 - h - M) / H)}%;\n  width: ${pct((w + 2 * M) / W)}%;\n  transform-origin: 50% ${pct((M + h * 0.97) / (h + 2 * M))}%;\n}\n\n`;
}
console.log(JSON.stringify(layout, null, 2));
console.log(css);
