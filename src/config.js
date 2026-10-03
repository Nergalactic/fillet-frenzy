// Every tuning knob for Fillet Frenzy. Coordinates: x is left/right, z is toward the camera.
// The beach is z > 0; the pier runs out over the water toward negative z.

export const ITEMS = {
  sardine:        { label: 'Sardine' },
  tuna:           { label: 'Tuna' },
  squid:          { label: 'Giant squid' },
  sardineFillet:  { label: 'Sardine fillet',   price: 4 },
  tunaSteak:      { label: 'Tuna steak',       price: 14 },
  calamari:       { label: 'Calamari',         price: 50 },
  grilledSardine: { label: 'Grilled sardines', price: 10 },
  fishAndChips:   { label: 'Fish & chips',     price: 16 },
  grilledTuna:    { label: 'Grilled tuna',     price: 32 },
  sushi:          { label: 'Sushi platter',    price: 48 },
  friedCalamari:  { label: 'Fried calamari',   price: 160 },
  plate:          { label: 'Dirty plate' },
};

// What each station turns things into, and how long one item takes (seconds).
export const RECIPES = {
  cut:   { time: 0.7, makes: { sardine: 'sardineFillet', tuna: 'tunaSteak', squid: 'calamari' }, slow: { squid: 4 } },
  grill: { time: 1.4, makes: { sardineFillet: 'grilledSardine', tunaSteak: 'grilledTuna' } },
  fryer: { time: 1.3, makes: { sardineFillet: 'fishAndChips', calamari: 'friedCalamari' } },
  sushi: { time: 1.8, makes: { tunaSteak: 'sushi' } },
};

export const STATION_LABELS = { cut: 'CUTTING BOARD', grill: 'GRILL', fryer: 'FRYER', sushi: 'SUSHI BAR' };

// Fishing spots: what bites and how often (seconds per catch).
export const FISH = {
  sardine: { every: 0.8 },
  tuna:    { every: 1.5 },
  squid:   { every: 9 },
};

export const PLAYER = { speed: 7.5, cap: 6, transfer: 0.09 };
export const HELPER = { speed: 6, cap: 5 };

export const CUSTOMERS = {
  baseEvery: 4.2,        // seconds between arrivals with no tables
  perTable: 0.45,        // each built table makes arrivals this much more frequent (divides the interval)
  minEvery: 1.1,
  queueMax: 6,
  pickyFor: 5,           // seconds a customer holds out for their favourite before taking anything
  eatTime: 5,
  tip: 0.5,              // seated customers tip this share of the price when they leave
  speed: 4.5,
};

export const STARS = {
  priceBonus: 0.5,       // each star multiplies prices by (1 + 0.5 per star)
  perEarned: 25000,      // one extra star per this much earned in a run
};

// Walkable areas. The pier grows as you buy extensions.
export const AREAS = {
  beach:  { x0: -28, x1: 28, z0: -0.5, z1: 31 },
  pier1:  { x0: -6,  x1: 6,  z0: -24, z1: 0 },
  pier2:  { x0: -6,  x1: 6,  z0: -44, z1: -24 },
  squid:  { x0: -9,  x1: 9,  z0: -56, z1: -44 },
};

// Fixed places on the map.
export const PLACES = {
  start:   { x: 2, z: 10 },
  counter: { x: -20, z: 16, drop: { x: -20, z: 13.4 }, front: { x: -20, z: 18.6 }, cash: { x: -15.8, z: 13.4 } },
  bin:     { x: -25, z: 6 },
  shack:   { x: -21, z: 4.5 },
  enter:   { x: 30, z: 30 },
  helperHome: { x: -16, z: 5 },
};

// Processing stations: model at (x, z), drop-off zone `in`, pick-up zone `out`.
export const STATIONS = {
  cut1:  { type: 'cut',   x: 10,  z: 4,  in: { x: 7.2, z: 4 },   out: { x: 12.8, z: 4 } },
  cut2:  { type: 'cut',   x: 10,  z: 10, in: { x: 7.2, z: 10 },  out: { x: 12.8, z: 10 } },
  grill: { type: 'grill', x: -8,  z: 4,  in: { x: -5.2, z: 4 },  out: { x: -10.8, z: 4 } },
  fryer: { type: 'fryer', x: -8,  z: 10, in: { x: -5.2, z: 10 }, out: { x: -10.8, z: 10 } },
  sushi: { type: 'sushi', x: 10,  z: 16, in: { x: 7.2, z: 16 },  out: { x: 12.8, z: 16 } },
};

// Fishing spots sit on the pier's edge; `water` is where the line goes in.
export const SPOTS = {
  s1: { fish: 'sardine', x: 4.3,  z: -18, water: { x: 8.5, z: -18 } },
  s2: { fish: 'sardine', x: -4.3, z: -12, water: { x: -8.5, z: -12 } },
  t1: { fish: 'tuna',    x: 4.3,  z: -38, water: { x: 8.5, z: -38 } },
  t2: { fish: 'tuna',    x: -4.3, z: -32, water: { x: -8.5, z: -32 } },
  sq: { fish: 'squid',   x: 0,    z: -52, water: { x: 0, z: -58 } },
};

export const TABLES = {
  tb1: { x: -4, z: 25 }, tb2: { x: 2, z: 25 }, tb3: { x: 8, z: 25 },
  tb4: { x: 14, z: 25 }, tb5: { x: 20, z: 25 }, tb6: { x: 20, z: 19 },
};

// Build pads in unlock order. The next three unbuilt pads are on the map at any time.
// kind: station | spot | table | helper | area | upgrade
export const PADS = [
  { id: 'grill',   kind: 'station', ref: 'grill', price: 30,   label: 'Grill' },
  { id: 'tb1',     kind: 'table',   ref: 'tb1',   price: 25,   label: 'Table' },
  { id: 's2',      kind: 'spot',    ref: 's2',    price: 50,   label: 'Fishing spot' },
  { id: 'tb2',     kind: 'table',   ref: 'tb2',   price: 40,   label: 'Table' },
  { id: 'basket1', kind: 'upgrade', ref: 'cap',   value: 10,   price: 80,   label: 'Bigger basket', x: -1, z: 4 },
  { id: 'fryer',   kind: 'station', ref: 'fryer', price: 140,  label: 'Fryer' },
  { id: 'fisher1', kind: 'helper',  ref: 'fisher', spot: 's1', price: 180, label: 'Hire a fisher', x: 0, z: -20 },
  { id: 'tb3',     kind: 'table',   ref: 'tb3',   price: 120,  label: 'Table' },
  { id: 'shoes1',  kind: 'upgrade', ref: 'speed', value: 1.3, price: 160, label: 'Running shoes', x: -1, z: 9 },
  { id: 'pier2',   kind: 'area',    ref: 'pier2', price: 350,  label: 'Extend the pier', x: 0, z: -22.5, then: 't1' },
  { id: 'cut2',    kind: 'station', ref: 'cut2',  price: 300,  label: 'Cutting board' },
  { id: 'runner',  kind: 'helper',  ref: 'runner', price: 450, label: 'Hire a kitchen runner', x: 1.5, z: 15 },
  { id: 'tb4',     kind: 'table',   ref: 'tb4',   price: 250,  label: 'Table' },
  { id: 'sushi',   kind: 'station', ref: 'sushi', price: 650,  label: 'Sushi bar' },
  { id: 't2',      kind: 'spot',    ref: 't2',    price: 550,  label: 'Tuna spot' },
  { id: 'server',  kind: 'helper',  ref: 'server', price: 700, label: 'Hire a server', x: -14, z: 20 },
  { id: 'basket2', kind: 'upgrade', ref: 'cap',   value: 16,   price: 600,  label: 'Huge basket', x: -1, z: 14 },
  { id: 'tb5',     kind: 'table',   ref: 'tb5',   price: 450,  label: 'Table' },
  { id: 'busser',  kind: 'helper',  ref: 'busser', price: 600, label: 'Hire a busser', x: -22, z: 22 },
  { id: 'fisher2', kind: 'helper',  ref: 'fisher', spot: 't1', price: 900, label: 'Hire a tuna fisher', x: 0, z: -40 },
  { id: 'tb6',     kind: 'table',   ref: 'tb6',   price: 600,  label: 'Table' },
  { id: 'squid',   kind: 'area',    ref: 'squid', price: 3000, label: 'Squid hole', x: 0, z: -42.5, then: 'sq' },
];
export const PADS_SHOWN = 3;
export const SELL_PAD = { x: -15, z: 26 };
