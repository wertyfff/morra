import * as THREE from 'three';

import clayDetailUrl from './assets/clay-detail.webp';
import { GLAZES } from './data.js';

// Outer silhouettes as [radius, height], from the centre of the base up to the rim.
const SHAPES = {
  cup: { t: 0.04, outer: [[0, 0], [0.29, 0], [0.33, 0.035], [0.36, 0.3], [0.4, 0.66], [0.41, 0.85]] },
  tumbler: { t: 0.035, outer: [[0, 0], [0.27, 0], [0.31, 0.04], [0.3, 0.4], [0.34, 0.8], [0.36, 1.08]] },
  plate: { t: 0.035, outer: [[0, 0], [0.6, 0], [0.68, 0.025], [0.98, 0.06], [1.2, 0.15]] },
  bowl: { t: 0.04, outer: [[0, 0], [0.3, 0], [0.35, 0.035], [0.6, 0.2], [0.77, 0.43], [0.82, 0.6]] },
  vase: {
    t: 0.04,
    outer: [[0, 0], [0.3, 0], [0.37, 0.05], [0.56, 0.42], [0.5, 0.92], [0.26, 1.32], [0.2, 1.58], [0.29, 1.76]],
  },
};

export function shapeSize(shape) {
  const o = SHAPES[shape].outer;
  return { r: Math.max(...o.map((p) => p[0])), h: o[o.length - 1][1] };
}

const BODY = new THREE.Color('#b08a72'); // raw clay showing through at the rim and foot
const geoCache = {};

function baseGeometry(shape) {
  if (geoCache[shape]) return geoCache[shape];
  const { outer, t } = SHAPES[shape];
  const n = outer.length;
  const inner = outer.map((p, i) => {
    const a = outer[Math.max(i - 1, 0)];
    const b = outer[Math.min(i + 1, n - 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [Math.max(p[0] - (dy / l) * t, 0), p[1] + (dx / l) * t];
  });
  inner[0][0] = 0;
  const pts = [...outer, ...inner.reverse()].map((p) => new THREE.Vector3(p[0], p[1], 0));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const profile = curve.getPoints(110).map((p) => new THREE.Vector2(Math.max(p.x, 0), p.y));
  profile[0].x = 0;
  profile[profile.length - 1].x = 0;
  const geo = new THREE.LatheGeometry(profile, 128);
  geo.userData = {
    rows: profile.length,
    cols: 129,
    lipV: (n - 0.5) / (2 * n - 1),
    footV: 1 / (2 * n - 1),
    ...shapeSize(shape),
  };
  geoCache[shape] = geo;
  return geo;
}

function seeds(seed) {
  let s = seed * 9301 + 49297;
  return Array.from({ length: 8 }, () => {
    s = (s * 9301 + 49297) % 233280;
    return (s / 233280) * Math.PI * 2;
  });
}

// Push the lathe-perfect form out of true: oval walls, a tilted rim, throwing rings.
function deform(geo, base, amt, seed) {
  const { r: R, h: H, rows, cols } = geo.userData;
  const s = seeds(seed);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3];
    const y = base[i * 3 + 1];
    const z = base[i * 3 + 2];
    const r = Math.hypot(x, z);
    if (r < 1e-5) {
      pos.setXYZ(i, x, y, z);
      continue;
    }
    const th = Math.atan2(z, x);
    const h = y / H;
    const k =
      1 +
      amt *
        h *
        (0.032 * Math.sin(2 * th + s[0] + h * 1.3) +
          0.02 * Math.sin(3 * th + s[1] - h * 2) +
          0.008 * Math.sin(7 * th + s[2] + h * 5) +
          // finger-width facets, as on a pinched rather than a thrown pot
          0.008 * Math.sin(11 * th + s[6] + h * 7) +
          0.005 * Math.sin(17 * th + s[7] - h * 11)) +
      amt * 0.0028 * Math.sin(y * 48 + s[3]);
    // the rim leans as a whole, and its very edge is ragged
    const edge = h ** 6;
    const ny =
      y +
      amt *
        Math.min(R, H * 1.6) *
        (h * h * (0.035 * Math.sin(th + s[4]) + 0.014 * Math.sin(2 * th + s[5])) +
          edge * (0.009 * Math.sin(9 * th + s[6]) + 0.006 * Math.sin(21 * th + s[7])));
    pos.setXYZ(i, x * k, ny, z * k);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  // weld the lathe seam so shading stays continuous
  const nor = geo.attributes.normal;
  const last = (cols - 1) * rows;
  for (let j = 0; j < rows; j++) {
    const ax = (nor.getX(j) + nor.getX(last + j)) / 2;
    const ay = (nor.getY(j) + nor.getY(last + j)) / 2;
    const az = (nor.getZ(j) + nor.getZ(last + j)) / 2;
    const l = Math.hypot(ax, ay, az) || 1;
    nor.setXYZ(j, ax / l, ay / l, az / l);
    nor.setXYZ(last + j, ax / l, ay / l, az / l);
  }
  nor.needsUpdate = true;
}

// Glaze: thins to bare clay on the lip, pools and mottles a little everywhere else.
function paint(geo, base, hex, amt, seed) {
  const { lipV, footV, h: H } = geo.userData;
  const s = seeds(seed + 11);
  const glaze = new THREE.Color(hex);
  const c = new THREE.Color();
  const uv = geo.attributes.uv;
  const col = geo.attributes.color;
  for (let i = 0; i < col.count; i++) {
    const v = uv.getY(i);
    const th = Math.atan2(base[i * 3 + 2], base[i * 3]);
    const h = base[i * 3 + 1] / H;
    const mottle =
      amt * (0.07 * Math.sin(2 * th + s[0] + h * 4) + 0.05 * Math.sin(5 * th + s[1] - h * 9));
    c.copy(glaze).offsetHSL(0, 0, mottle * 0.5);
    const lip = Math.max(0, 1 - Math.abs(v - lipV) / 0.022);
    c.lerp(BODY, lip * lip * (0.25 + 0.4 * Math.min(amt, 1)));
    if (v < footV) c.lerp(BODY, 0.9);
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}

// The surface is real: clay-detail.webp is lifted from a photograph of hand-built pieces
// (scripts/clay-texture.mjs) with its own light removed. It tints the glaze colour and drives
// the bump relief, so the light on the dents is computed and stays right as the piece turns.
// A standard material on purpose: its shader compiles far faster than a lacquered physical
// one, which matters on integrated graphics.
let material;
let detailLoaded = Promise.resolve();
function glazeMaterial() {
  if (material) return material;
  let detail;
  detailLoaded = new Promise((done) => {
    detail = new THREE.TextureLoader().load(clayDetailUrl, done, undefined, done);
  });
  detail.wrapS = detail.wrapT = THREE.RepeatWrapping;
  detail.repeat.set(2, 1);
  detail.colorSpace = THREE.SRGBColorSpace;
  detail.anisotropy = 4;
  material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: detail,
    bumpMap: detail,
    bumpScale: 2.5,
    roughness: 0.38,
    side: THREE.DoubleSide,
    shadowSide: THREE.DoubleSide,
  });
  return material;
}

let seedCounter = 1;

export function makePiece(shape, glaze, { imperfection = 1, seed = seedCounter++ } = {}) {
  const src = baseGeometry(shape);
  const geo = src.clone();
  geo.userData = src.userData;
  const base = src.attributes.position.array;
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(base.length), 3));
  const mesh = new THREE.Mesh(geo, glazeMaterial());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const state = { glaze, imperfection };
  mesh.userData.setGlaze = (g) => {
    state.glaze = g;
    paint(geo, base, GLAZES[g].hex, state.imperfection, seed);
  };
  mesh.userData.setImperfection = (a) => {
    state.imperfection = a;
    deform(geo, base, a, seed);
    paint(geo, base, GLAZES[state.glaze].hex, a, seed);
  };
  mesh.userData.setImperfection(imperfection);
  return mesh;
}

// items: [{ shape, glaze, x, z, y, rot, scale }]
export function compose(items) {
  const group = new THREE.Group();
  for (const it of items) {
    const m = makePiece(it.shape, it.glaze, { seed: it.seed });
    m.position.set(it.x || 0, it.y || 0, it.z || 0);
    m.rotation.y = it.rot || 0;
    m.scale.setScalar(it.scale || 1);
    group.add(m);
  }
  return group;
}

export function disposeGroup(group) {
  group.traverse((o) => o.geometry && o.geometry.dispose());
  group.removeFromParent();
}

// Place the camera along `dir` so that a visW × visH area around the target stays in frame.
export function frame(stage, { visW, visH = 0, dir = [0, 0.32, 1], look }) {
  const tan = Math.tan((stage.camera.fov * Math.PI) / 360) * 2;
  const dist = Math.max(visW / stage.aspect, visH) / tan;
  const l = Math.hypot(...dir);
  if (look) stage.target.set(...look);
  stage.camera.position.set(
    stage.target.x + (dir[0] / l) * dist,
    stage.target.y + (dir[1] / l) * dist,
    stage.target.z + (dir[2] / l) * dist,
  );
}

// Live views. Every section draws through one shared WebGL context into a hidden canvas and
// copies the result onto its own 2D canvas, so shaders are compiled once for the whole page
// instead of once per section.
let shared;
function sharedRenderer() {
  if (shared) return shared;
  shared = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  shared.setPixelRatio(1);
  shared.shadowMap.enabled = true;
  shared.shadowMap.type = THREE.PCFShadowMap;
  shared.toneMapping = THREE.NeutralToneMapping;
  shared.toneMappingExposure = 1.05;
  return shared;
}

export function createView(canvas, { fov = 26, look = [0, 0.5, 0], shadow = 0.26, light = [-3.5, 6, 3.5] } = {}) {
  const renderer = sharedRenderer();
  const ctx = canvas.getContext('2d');

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc6b6, 1.5));
  const key = new THREE.DirectionalLight(0xfff4e6, 2.1);
  key.position.set(...light);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 5;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.03;
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 20 });
  const fill = new THREE.DirectionalLight(0xe6ecff, 0.55);
  fill.position.set(-light[0], light[1] * 0.4, -light[2]);
  scene.add(key, fill);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: shadow }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.002;
  ground.receiveShadow = true;
  scene.add(ground);

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  const target = new THREE.Vector3(...look);

  const view = {
    scene,
    camera,
    target,
    aspect: 1,
    resize() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      view.aspect = camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    render() {
      const gl = renderer.domElement;
      if (gl.width !== canvas.width || gl.height !== canvas.height) renderer.setSize(canvas.width, canvas.height, false);
      camera.lookAt(target);
      renderer.render(scene, camera);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(gl, 0, 0);
    },
    // compiles the scene's shaders off the main thread where the browser allows it,
    // and waits for the clay texture so the first frame is already the finished look
    ready() {
      camera.lookAt(target);
      return Promise.all([renderer.compileAsync(scene, camera), detailLoaded]);
    },
  };
  return view;
}

// Keeps a view sized to its canvas and drawn while it is on screen. With `tick` it redraws
// every frame; without one the scene is still and only redrawn when asked (view.render()).
export function runWhileVisible(canvas, view, { tick, layout } = {}) {
  let raf = 0;
  let visible = false;
  let prev = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const dt = prev ? Math.min((now - prev) / 1000, 0.1) : 0;
    prev = now;
    tick(dt);
    view.render();
  };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting === visible) return;
    visible = e.isIntersecting;
    cancelAnimationFrame(raf);
    if (!visible) return;
    view.render();
    if (tick) {
      prev = 0;
      raf = requestAnimationFrame(loop);
    }
  }).observe(canvas);
  new ResizeObserver(() => {
    view.resize();
    layout?.();
    view.render();
  }).observe(canvas);
}
