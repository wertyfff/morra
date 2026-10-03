import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { GLAZES, GLAZE_NOTES, PRODUCTS, SETS } from './data.js';

gsap.registerPlugin(ScrollTrigger);

// A reload must open at the top: the loader and the intro assume it, and the browser would
// otherwise restore the previous scroll position underneath them.
history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

// The 3D engine is a separate file that is only fetched when a section that needs it comes near.
let ceramicsModule;
const ceramics = () => (ceramicsModule ??= import('./ceramics.js'));

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rub = (n) => `${n.toLocaleString('ru-RU')} ₽`;

/* ---------- smooth scroll ---------- */

let lenis;
if (!calm) {
  lenis = new Lenis({ lerp: 0.11 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;
  const target = $(link.getAttribute('href'));
  if (!target) return;
  e.preventDefault();
  closeMenu();
  if (lenis) lenis.scrollTo(target, { offset: -60, duration: 1.3 });
  else target.scrollIntoView();
});

/* ---------- header ---------- */

const head = $('[data-head]');
const nav = $('[data-nav]');
const menuBtn = $('[data-menu]');

function closeMenu() {
  nav.classList.remove('is-open');
  head.classList.remove('is-menu');
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.textContent = 'Меню';
}

menuBtn.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  head.classList.toggle('is-menu', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.textContent = open ? 'Закрыть' : 'Меню';
});

ScrollTrigger.create({
  start: 40,
  end: 'max',
  onToggle: (self) => head.classList.toggle('is-solid', self.isActive),
});

for (const dark of ['.imperfect']) {
  ScrollTrigger.create({
    trigger: dark,
    start: 'top 34px',
    end: 'bottom 34px',
    onToggle: (self) => head.classList.toggle('is-dark', self.isActive),
  });
}

/* ---------- hero ---------- */

let heroIntro; // played once the loader has counted to 100

if (!calm) {
  const groups = $$('.hero__group');

  // Nearer pieces travel further, both with the pointer and as the page scrolls away.
  // The pairs that overlap in the photo share a group, so they never slide apart.
  const pointer = { x: 0, y: 0 };
  const drift = groups.map((g) => {
    const el = $('.hero__drift', g);
    return {
      depth: Number(g.dataset.depth),
      x: gsap.quickTo(el, 'x', { duration: 1.1, ease: 'power3.out' }),
      y: gsap.quickTo(el, 'y', { duration: 1.1, ease: 'power3.out' }),
    };
  });
  const place = () => {
    const away = Math.min(window.scrollY, window.innerHeight);
    for (const d of drift) {
      d.x(pointer.x * d.depth * -34);
      d.y(pointer.y * d.depth * -18 - away * d.depth * 0.16);
    }
  };
  window.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX / window.innerWidth - 0.5;
    pointer.y = e.clientY / window.innerHeight - 0.5;
    place();
  });
  window.addEventListener('scroll', place, { passive: true });

  // Everything here moves on layers that exist for the whole life of the page (will-change in
  // the stylesheet, force3D below). Promoting text to a layer only while it animates makes
  // Chrome on Windows swap its antialiasing when the tween ends, which reads as a glitch.
  // Pieces and text wait at a hair above zero opacity so they are rasterised under the loader.
  const tl = (heroIntro = gsap.timeline({ paused: true, defaults: { ease: 'expo.out', force3D: true } }));
  tl.fromTo(groups, { y: 70, opacity: 0.01 }, { y: 0, opacity: 1, duration: 1.5, stagger: 0.12 }, 0);
  tl.from('.hero .line > span', { yPercent: 110, duration: 1.2, stagger: 0.09 }, 0.15);
  tl.fromTo('.hero [data-fade]', { opacity: 0.01, y: 14 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.1 }, 0.6);
}

const heroReady = Promise.all($$('.hero__still img').map((img) => img.decode().catch(() => {})));

/* ---------- deferred 3D ---------- */

// No WebGL exists until a section that draws with it comes within a screen and a half of the
// viewport. `start` receives the 3D module once it has been fetched.
function whenNeeded(el, start) {
  const io = new IntersectionObserver(
    async ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      await start(await ceramics());
    },
    { rootMargin: '150% 0px' },
  );
  io.observe(el);
}

/* ---------- catalogue ---------- */

// The pictures are photographs in public/stills/, one per product id (originals in src/assets/catalog/).
const CARD_TINT = { milk: '#dcd6ca', smoke: '#e4e2dc', clay: '#ebdfd0', moss: '#e3e4d6', cobalt: '#dde0ea', paprika: '#eedcd3' };

const productList = $('[data-products]');
productList.innerHTML = PRODUCTS.map(
  (p, i) => `
  <li class="card">
    <div class="card__pic" style="--tint: ${CARD_TINT[p.glaze]}"><img src="${import.meta.env.BASE_URL}stills/${p.id}.webp" width="800" height="1200" loading="lazy" decoding="async" alt="${p.name}, коллекция ${p.collection}" /></div>
    <p class="card__meta"><span>${String(i + 1).padStart(2, '0')} / ${p.type}</span><span>${p.collection}</span></p>
    <h3 class="card__name">${p.name}</h3>
    <p class="card__spec">${p.spec}</p>
    <p class="card__row"><span>${rub(p.price)}</span><button class="card__add" type="button" data-add="${p.id}">В корзину</button></p>
  </li>`,
).join('');

/* ---------- glaze picker ---------- */

function pillsHTML(keys, active) {
  return keys
    .map((k) => {
      const g = GLAZES[k];
      const dot = g ? g.hex : 'conic-gradient(#a9c8e0, #f3eee4, #e0a898, #a9b394, #a9c8e0)';
      return `<button class="pill" type="button" data-glaze-key="${k}" aria-pressed="${k === active}" style="--dot: ${dot}"><i></i>${g ? g.name : 'Микс'}</button>`;
    })
    .join('');
}

function bindPills(root, onPick) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill');
    if (!btn) return;
    $$('.pill', root).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    onPick(btn.dataset.glazeKey);
  });
}

{
  const canvas = $('[data-glaze]');
  const section = $('[data-glaze-section]');
  let current = 'clay';
  let group; // exists once the scene has started

  whenNeeded(canvas, async (c) => {
    const view = c.createView(canvas, { shadow: 0.3 });
    const pieces = c.compose([
      { shape: 'plate', glaze: current, x: 0.8, z: 0.15, rot: 0.4 },
      { shape: 'bowl', glaze: current, x: -1.05, z: -0.45, rot: 2 },
      { shape: 'cup', glaze: current, x: -0.5, z: 1.05, rot: 1.2 },
    ]);
    view.scene.add(pieces);
    const layout = () => c.frame(view, { visW: 4.9, visH: 2.6, dir: [0, 0.5, 1], look: [0, 0.3, 0.2] });
    view.resize();
    layout();
    await view.ready();
    group = pieces;
    show(current);
    c.runWhileVisible(canvas, view, {
      layout,
      tick: (dt) => {
        if (!calm) group.rotation.y += dt * 0.08;
      },
    });
  });

  const pills = $('[data-glaze-pills]');
  pills.innerHTML = pillsHTML(Object.keys(GLAZES), current);
  const show = (key) => {
    const g = GLAZES[(current = key)];
    section.style.setProperty('--glaze', g.hex);
    $('[data-glaze-name]').textContent = g.name;
    $('[data-glaze-ru]').textContent = g.ru;
    $('[data-glaze-note]').textContent = GLAZE_NOTES[key];
    if (!group) return;
    group.children.forEach((m) => m.userData.setGlaze(key));
    if (!calm) gsap.fromTo(group.scale, { x: 0.96, y: 0.96, z: 0.96 }, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'expo.out' });
  };
  bindPills(pills, show);
  show(current);
}

/* ---------- imperfect by design ---------- */

{
  const canvas = $('[data-imperfect]');
  const input = $('[data-hand]');
  const marks = $$('[data-marks] li');
  let bowl; // exists once the scene has started

  const apply = () => {
    const v = Number(input.value);
    if (bowl) bowl.userData.setImperfection((v / 100) * 1.7);
    marks.forEach((m) => m.classList.toggle('is-on', v >= Number(m.dataset.at)));
  };

  whenNeeded(canvas, async (c) => {
    const view = c.createView(canvas, { shadow: 0.5, light: [-3, 5, 2] });
    const piece = c.makePiece('bowl', 'milk', { imperfection: 0, seed: 7 });
    piece.scale.setScalar(1.5);
    view.scene.add(piece);
    const layout = () => c.frame(view, { visW: 3.5, visH: 2.6, dir: [0, 0.8, 1], look: [0, 0.4, 0] });
    view.resize();
    layout();
    await view.ready();
    bowl = piece;
    apply();
    c.runWhileVisible(canvas, view, {
      layout,
      tick: (dt) => {
        if (!calm) bowl.rotation.y += dt * 0.35;
      },
    });
  });
  input.addEventListener('input', apply);

  // the bowl leaves the "factory" on its own the first time it scrolls into view
  const hand = { v: 0 };
  ScrollTrigger.create({
    trigger: canvas,
    start: 'top 65%',
    once: true,
    onEnter: () => {
      if (calm) {
        input.value = 70;
        return apply();
      }
      const tween = gsap.to(hand, {
        v: 70,
        duration: 2.4,
        ease: 'power2.inOut',
        onUpdate: () => {
          input.value = hand.v;
          apply();
        },
      });
      input.addEventListener('pointerdown', () => tween.kill(), { once: true });
    },
  });
}

/* ---------- build your table ---------- */

const MIX = ['cobalt', 'milk', 'paprika', 'moss', 'clay'];
const table = { set: SETS[2], glaze: 'mix' };

{
  const canvas = $('[data-table]');
  let lib; // the 3D module and the view exist once the scene has started
  let view;
  // Every piece any set can need is built once, up front. A click never creates geometry:
  // it only moves, shows and repaints these, so nothing heavy runs when the animation starts.
  let pool; // { plate: [mesh, mesh], bowl: [mesh], cup: [mesh, mesh] }
  let shown = [];
  let growing;

  const layout = () => lib.frame(view, { visW: 8.3 * table.set.dist, visH: 5 * table.set.dist, dir: [0, 1, 0.42], look: [0, 0, 0.25] });
  const glazeAt = (i) => (table.glaze === 'mix' ? MIX[i % MIX.length] : table.glaze);

  // Lays out the current set in the current colours, then lets the pieces grow in.
  // The table stands still otherwise, so it is only redrawn here and while they grow.
  const refresh = () => {
    $('[data-set-name]').textContent = `MORRA Set / ${table.set.id}`;
    $('[data-set-lines]').textContent = table.set.lines.join(', ');
    $('[data-set-price]').textContent = rub(table.set.price);
    if (!view) return;
    growing?.kill();
    for (const m of shown) m.visible = false;
    const used = {};
    shown = table.set.items.map((it, i) => {
      const m = pool[it.shape][(used[it.shape] = (used[it.shape] ?? -1) + 1)];
      m.visible = true;
      m.position.set(it.x, 0, it.z);
      m.rotation.y = i * 1.3;
      m.userData.setGlaze(glazeAt(i));
      m.scale.setScalar(calm ? 1 : 0.001);
      return m;
    });
    layout();
    view.render();
    if (calm) return;
    // The tween is created on the next frame. Started in this one, its clock would already be
    // running while the repaint above is still being paid for, and the fast opening of the
    // ease would be skipped, which is exactly the stutter this replaces.
    requestAnimationFrame(() => {
      growing = gsap.to(
        shown.map((m) => m.scale),
        { x: 1, y: 1, z: 1, duration: 0.9, stagger: 0.05, ease: 'expo.out', onUpdate: view.render },
      );
    });
  };

  const sets = $('[data-sets]');
  sets.innerHTML = SETS.map(
    (s) => `<button class="set" type="button" data-set="${s.id}" aria-pressed="${s === table.set}">${s.title}<span>Set / ${s.id}</span></button>`,
  ).join('');
  sets.addEventListener('click', (e) => {
    const btn = e.target.closest('.set');
    if (!btn) return;
    table.set = SETS.find((s) => s.id === btn.dataset.set);
    $$('.set', sets).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    refresh();
  });

  const pills = $('[data-table-pills]');
  pills.innerHTML = pillsHTML(['mix', ...Object.keys(GLAZES)], 'mix');
  bindPills(pills, (key) => {
    table.glaze = key;
    refresh();
  });

  refresh();
  whenNeeded(canvas, async (c) => {
    lib = c;
    const v = c.createView(canvas, { shadow: 0.34, light: [-4, 6, 1.5] });
    v.resize();
    // as many of each shape as the largest set uses
    const need = {};
    for (const s of SETS) {
      const count = {};
      for (const it of s.items) count[it.shape] = (count[it.shape] || 0) + 1;
      for (const [shape, n] of Object.entries(count)) need[shape] = Math.max(need[shape] || 0, n);
    }
    let seed = 20;
    pool = {};
    for (const [shape, n] of Object.entries(need)) {
      pool[shape] = Array.from({ length: n }, () => {
        const m = c.makePiece(shape, 'milk', { seed: seed++ });
        v.scene.add(m);
        return m;
      });
    }
    await v.ready();
    for (const list of Object.values(pool)) for (const m of list) m.visible = false;
    view = v;
    refresh();
    c.runWhileVisible(canvas, view, { layout });
  });
}

/* ---------- cart ---------- */

const cartEl = $('[data-cart]');
const scrim = $('[data-scrim]');
const toast = $('[data-toast]');
let cart = [];
try {
  cart = JSON.parse(localStorage.getItem('morra-cart')) || [];
} catch {
  cart = [];
}

function say(text) {
  toast.textContent = text;
  toast.classList.add('is-on');
  clearTimeout(say.t);
  say.t = setTimeout(() => toast.classList.remove('is-on'), 2400);
}

function drawCart() {
  try {
    localStorage.setItem('morra-cart', JSON.stringify(cart));
  } catch {
    /* private mode: the cart just lives until reload */
  }
  const count = cart.reduce((n, it) => n + it.qty, 0);
  $('[data-cart-count]').textContent = count;
  $('[data-cart-empty]').hidden = count > 0;
  $('[data-cart-foot]').hidden = count === 0;
  $('[data-cart-total]').textContent = rub(cart.reduce((n, it) => n + it.qty * it.price, 0));
  $('[data-cart-list]').innerHTML = cart
    .map(
      (it) => `
    <li class="cart__item">
      <span>${it.name}${it.qty > 1 ? ` × ${it.qty}` : ''}</span><span>${rub(it.price * it.qty)}</span>
      <small>${it.spec}</small><button type="button" data-remove="${it.id}">Убрать</button>
    </li>`,
    )
    .join('');
}

function addToCart(item) {
  const found = cart.find((it) => it.id === item.id);
  if (found) found.qty += 1;
  else cart.push({ ...item, qty: 1 });
  drawCart();
  say(`В корзине: ${item.name}`);
}

function toggleCart(open) {
  if (open) {
    toast.classList.remove('is-on'); // on a phone it would sit on top of the order button
    cartEl.hidden = scrim.hidden = false;
    requestAnimationFrame(() => cartEl.classList.add('is-open'));
    $('[data-cart-close]').focus();
  } else {
    cartEl.classList.remove('is-open');
    scrim.hidden = true;
    setTimeout(() => (cartEl.hidden = true), 500);
  }
  if (lenis) lenis[open ? 'stop' : 'start']();
}

$('[data-cart-open]').addEventListener('click', () => toggleCart(true));
$('[data-cart-close]').addEventListener('click', () => toggleCart(false));
scrim.addEventListener('click', () => toggleCart(false));
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!cartEl.hidden) toggleCart(false);
  closeMenu();
});

productList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-add]');
  if (!btn) return;
  const p = PRODUCTS.find((x) => x.id === btn.dataset.add);
  addToCart({ id: p.id, name: p.name, spec: p.spec, price: p.price });
});

$('[data-set-add]').addEventListener('click', () => {
  const g = table.glaze === 'mix' ? 'Микс' : GLAZES[table.glaze].name;
  addToCart({
    id: `set-${table.set.id}-${table.glaze}`,
    name: `MORRA Set / ${table.set.id}, ${g}`,
    spec: table.set.lines.join(', '),
    price: table.set.price,
  });
});

$('[data-cart-list]').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove]');
  if (!btn) return;
  cart = cart.filter((it) => it.id !== btn.dataset.remove);
  drawCart();
});

// There is no payment on the site: an order is a Telegram chat with the studio, opened with the
// contents of the cart already typed in as a draft message.
const STUDIO_TELEGRAM = 'kiwnt1';
$('[data-checkout]').addEventListener('click', () => {
  if (!cart.length) return;
  const lines = cart.map((it) => `• ${it.name}${it.qty > 1 ? ` × ${it.qty}` : ''} — ${rub(it.price * it.qty)}`);
  const total = cart.reduce((n, it) => n + it.qty * it.price, 0);
  const text = ['Здравствуйте! Хочу оформить заказ MORRA:', ...lines, `Итого: ${rub(total)}`].join('\n');
  const url = `https://t.me/${STUDIO_TELEGRAM}?text=${encodeURIComponent(text)}`;
  if (!window.open(url, '_blank', 'noopener')) window.location.href = url;
});
drawCart();

/* ---------- scroll details ---------- */

if (!calm) {
  // hand-drawn arrows draw themselves towards each collection name
  for (const arrow of $$('.arrow')) {
    const paths = $$('path', arrow);
    paths.forEach((p) => {
      const len = p.getTotalLength();
      gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
    });
    gsap.to(paths, {
      strokeDashoffset: 0,
      duration: 0.9,
      stagger: 0.5,
      ease: 'power2.inOut',
      scrollTrigger: { trigger: arrow, start: 'top 85%', once: true },
    });
  }

  gsap.fromTo(
    '.steps',
    { '--p': 0 },
    { '--p': 1, ease: 'none', scrollTrigger: { trigger: '.steps', start: 'top 85%', end: 'top 45%', scrub: true } },
  );
}

document.fonts.ready.then(() => ScrollTrigger.refresh());

/* ---------- loader ---------- */

{
  const loader = $('[data-loader]');
  const num = $('[data-loader-num]');
  if (calm) {
    loader.remove();
  } else {
    // The page must not scroll under the curtain. Lenis is not stopped for this: stopping it
    // hides the scrollbar, and bringing the scrollbar back mid-intro reflows the whole page.
    for (const type of ['wheel', 'touchmove']) loader.addEventListener(type, (e) => e.preventDefault(), { passive: false });

    const loaded = new Promise((done) => {
      if (document.readyState === 'complete') done();
      else window.addEventListener('load', done, { once: true });
    });
    const leave = async () => {
      await Promise.all([loaded, document.fonts.ready, heroReady]);
      window.scrollTo(0, 0);
      lenis.scrollTo(0, { immediate: true });
      gsap.to('.loader__count', { yPercent: -30, opacity: 0, duration: 0.35, ease: 'power3.in', force3D: true });
      // the first screen starts moving only once the curtain is most of the way up
      gsap.to(loader, {
        yPercent: -100,
        duration: 0.8,
        delay: 0.1,
        ease: 'expo.inOut',
        force3D: true,
        onStart: () =>
          gsap.delayedCall(0.5, () => {
            heroIntro.play();
          }),
        onComplete: () => {
          loader.style.visibility = 'hidden';
        },
      });
      // the curtain is taken out of the page only when nothing is moving any more
      heroIntro.eventCallback('onComplete', () => {
        loader.remove();
      });
    };

    // The count is for show, not a measure of loading. At this speed it needs 111 numbers a
    // second, more than a 60 Hz screen has frames, so it advances by one or two per frame.
    const count = { v: 1 };
    gsap.to(count, {
      v: 100,
      duration: 0.9,
      ease: 'none',
      onUpdate: () => (num.textContent = Math.round(count.v)),
      onComplete: leave,
    });
  }
}
