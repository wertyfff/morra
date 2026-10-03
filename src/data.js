// A pastel palette: every glaze is light and low in saturation, nothing shouts.
// (The `cobalt` key is historical; the glaze itself is now a pale sky blue.)
export const GLAZES = {
  clay: { name: 'Clay', ru: 'тёплый глиняный', hex: '#cfa184' },
  milk: { name: 'Milk', ru: 'нежный молочный', hex: '#f3eee4' },
  moss: { name: 'Moss', ru: 'мягкий шалфейный', hex: '#a9b394' },
  cobalt: { name: 'Sky', ru: 'небесно-голубой', hex: '#a9c8e0' },
  paprika: { name: 'Paprika', ru: 'нежный розово-терракотовый', hex: '#e0a898' },
  smoke: { name: 'Smoke', ru: 'светлый дымчатый', hex: '#bdbdb7' },
};

export const PRODUCTS = [
  { id: 'cobalt-cup', type: 'CUP', name: 'Cobalt Cup', spec: 'ручная работа · 320 мл', price: 2400, shape: 'cup', glaze: 'cobalt', collection: 'Color' },
  { id: 'moss-plate', type: 'PLATE', name: 'Moss Plate', spec: 'ручная работа · 24 см', price: 3200, shape: 'plate', glaze: 'moss', collection: 'Color' },
  { id: 'paprika-bowl', type: 'BOWL', name: 'Paprika Bowl', spec: 'ручная работа · 18 см', price: 2900, shape: 'bowl', glaze: 'paprika', collection: 'Color' },
  { id: 'milk-tumbler', type: 'TUMBLER', name: 'Milk Tumbler', spec: 'ручная работа · 280 мл', price: 2100, shape: 'tumbler', glaze: 'milk', collection: 'Objects' },
  { id: 'clay-plate', type: 'PLATE', name: 'Clay Plate', spec: 'ручная работа · 24 см', price: 3200, shape: 'plate', glaze: 'clay', collection: 'Earth' },
  { id: 'smoke-bowl', type: 'BOWL', name: 'Smoke Bowl', spec: 'ручная работа · 18 см', price: 2900, shape: 'bowl', glaze: 'smoke', collection: 'Objects' },
  { id: 'cobalt-vase', type: 'BOWL', name: 'Sky Bowl', spec: 'ручная работа · 18 см', price: 2900, shape: 'bowl', glaze: 'cobalt', collection: 'Color' },
  { id: 'clay-cup', type: 'CUP', name: 'Clay Cup', spec: 'ручная работа · 320 мл', price: 2400, shape: 'cup', glaze: 'clay', collection: 'Earth' },
];

export const SETS = [
  {
    id: '01',
    title: 'Утро на одного',
    price: 7900,
    lines: ['1 чашка', '1 тарелка', '1 миска'],
    dist: 0.82,
    items: [
      { shape: 'plate', x: -0.75, z: 0.25 },
      { shape: 'bowl', x: 1.1, z: -0.55 },
      { shape: 'cup', x: 1.25, z: 0.95 },
    ],
  },
  {
    id: '02',
    title: 'Завтрак на двоих',
    price: 10400,
    lines: ['2 чашки', '2 тарелки'],
    dist: 0.95,
    items: [
      { shape: 'plate', x: -1.45, z: 0.35 },
      { shape: 'plate', x: 1.45, z: 0.35 },
      { shape: 'cup', x: -0.45, z: -1.15 },
      { shape: 'cup', x: 0.5, z: -1.05 },
    ],
  },
  {
    id: '03',
    title: 'Ужин с друзьями',
    price: 13200,
    lines: ['2 чашки', '2 тарелки', '1 миска'],
    dist: 1.12,
    items: [
      { shape: 'plate', x: -2.1, z: 0.55 },
      { shape: 'plate', x: 2.1, z: 0.55 },
      { shape: 'bowl', x: 0, z: 0.1 },
      { shape: 'cup', x: -1.05, z: -1.25 },
      { shape: 'cup', x: 1.1, z: -1.2 },
    ],
  },
];

export const GLAZE_NOTES = {
  clay: 'Цвет необожжённой глины. Самый тёплый в палитре, на его фоне еда выглядит ярче.',
  milk: 'Не белый, а молочный: с мягкой желтизной и редкими тёмными крапинами.',
  moss: 'Зелёный, который не спорит с едой. Хорош рядом с Clay и Milk.',
  cobalt: 'Цвет ясного неба. Самый лёгкий в палитре: рядом с ним стол выглядит свежее.',
  paprika: 'Мягкий розово-терракотовый. На краях глазурь тоньше, и сквозь неё видна глина.',
  smoke: 'Серый с тёплым подтоном. Спокойная пара для Sky и Paprika.',
};
