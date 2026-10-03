// Every tuning knob for Fillet Frenzy. Coordinates: x is left/right, z is toward the camera.
// The beach is z > 0; the pier runs out over the water toward negative z.

export const ITEMS = {
  sardine:        { label: 'Sardine' },
  tuna:           { label: 'Tuna' },
  squid:          { label: 'Giant squid' },
  sardineFillet:  { label: 'Sardine fillet',   price: 5 },
  tunaSteak:      { label: 'Tuna steak',       price: 15 },
  calamari:       { label: 'Calamari',         price: 50 },
  grilledSardine: { label: 'Grilled sardines', price: 12 },
  fishAndChips:   { label: 'Fish & chips',     price: 18 },
  grilledTuna:    { label: 'Grilled tuna',     price: 34 },
  sushi:          { label: 'Sushi platter',    price: 50 },
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

export const PLAYER = { speed: 7.5, cap: 8, transfer: 0.09 };
export const HELPER = { speed: 6, cap: 5 };

export const CUSTOMERS = {
  baseEvery: 3.0,        // seconds between arrivals with no tables
  perTable: 0.5,         // each built table makes arrivals this much more frequent (divides the interval)
  minEvery: 0.8,
  queueMax: 6,
  pickyFor: 1.5,          // seconds a customer holds out for their favourite before taking anything
  eatTime: 5,
  tip: 0.5,              // seated customers tip this share of the price when they leave
  speed: 5.5,
};

export const STARS = {
  priceBonus: 0.5,       // each star multiplies prices by (1 + 0.5 per star)
  perEarned: 25000,      // one extra star per this much earned in a run
};

// Walkable areas. The pier grows as you buy extensions.
export const AREAS = {
  beach:  { x0: -28, x1: 28, z0: -0.5, z1: 31 },
  pier1:  { x0: -11, x1: 11, z0: -18, z1: 0 },
  pier2:  { x0: -11, x1: 11, z0: -38, z1: -18 },
  squid:  { x0: -14, x1: 14, z0: -52, z1: -38 },
};

// Fixed places on the map.
export const PLACES = {
  start:   { x: 2, z: 10 },
  counter: { x: -20, z: 16, drop: { x: -20, z: 13.4 }, front: { x: -20, z: 18.6 }, cash: { x: -15.8, z: 13.4 } },
  bin:     { x: -26, z: 12 },
  shack:   { x: -21, z: 4.5 },
  enter:   { x: -12, z: 34 },
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
  s1: { fish: 'sardine', x: 9.3,  z: -11, water: { x: 13.5, z: -11 },  up: { x: 5.6, z: -11 } },
  s2: { fish: 'sardine', x: -9.3, z: -7,  water: { x: -13.5, z: -7 },  up: { x: -5.6, z: -7 } },
  t1: { fish: 'tuna',    x: 9.3,  z: -31, water: { x: 13.5, z: -31 },  up: { x: 5.6, z: -31 } },
  t2: { fish: 'tuna',    x: -9.3, z: -25, water: { x: -13.5, z: -25 }, up: { x: -5.6, z: -25 } },
  sq: { fish: 'squid',   x: 0,    z: -48, water: { x: 0, z: -55 } },
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
  { id: 'basket1', kind: 'upgrade', ref: 'cap',   value: 12,   price: 80,   label: 'Bigger basket', x: -1, z: 4 },
  { id: 'fryer',   kind: 'station', ref: 'fryer', price: 140,  label: 'Fryer' },
  { id: 'fisher1', kind: 'helper',  ref: 'fisher', spot: 's1', price: 180, label: 'Hire a fisher', x: 6, z: -15 },
  { id: 'tb3',     kind: 'table',   ref: 'tb3',   price: 120,  label: 'Table' },
  { id: 'shoes1',  kind: 'upgrade', ref: 'speed', value: 1.3, price: 160, label: 'Running shoes', x: -1, z: 9 },
  { id: 'pier2',   kind: 'area',    ref: 'pier2', price: 350,  label: 'Extend the pier', x: 0, z: -16.5, then: 't1' },
  { id: 'cut2',    kind: 'station', ref: 'cut2',  price: 300,  label: 'Cutting board' },
  { id: 'runner',  kind: 'helper',  ref: 'runner', price: 450, label: 'Hire a kitchen runner', x: 1.5, z: 15 },
  { id: 'tb4',     kind: 'table',   ref: 'tb4',   price: 250,  label: 'Table' },
  { id: 'sushi',   kind: 'station', ref: 'sushi', price: 650,  label: 'Sushi bar' },
  { id: 't2',      kind: 'spot',    ref: 't2',    price: 550,  label: 'Tuna spot' },
  { id: 'server',  kind: 'helper',  ref: 'server', price: 700, label: 'Hire a server', x: -14, z: 20 },
  { id: 'basket2', kind: 'upgrade', ref: 'cap',   value: 20,   price: 600,  label: 'Huge basket', x: -2, z: 18 },
  { id: 'tb5',     kind: 'table',   ref: 'tb5',   price: 450,  label: 'Table' },
  { id: 'busser',  kind: 'helper',  ref: 'busser', price: 600, label: 'Hire a busser', x: -22, z: 22 },
  { id: 'fisher2', kind: 'helper',  ref: 'fisher', spot: 't1', price: 900, label: 'Hire a tuna fisher', x: 6, z: -35 },
  { id: 'tb6',     kind: 'table',   ref: 'tb6',   price: 600,  label: 'Table' },
  { id: 'squid',   kind: 'area',    ref: 'squid', price: 3000, label: 'Squid hole', x: 0, z: -36.5, then: 'sq' },
];
export const PADS_SHOWN = 3;

// Upgrade pads sit next to each station, the counter, each fishing spot, and the helpers' hangout.
// They stay out of the build queue above and are always available until level `max`.
export const LEVELS = {
  max: 5,
  growth: 2.2,                 // each level costs this much more than the one before
  station: { speed: 0.8, buffer: 8, base: { cut: 50, grill: 80, fryer: 130, sushi: 350 } },
  counter: { base: 80, customers: 0.5, stock: 12, queue: 2, x: -25, z: 16.5 },
  spot:    { speed: 0.5, base: { sardine: 60, tuna: 250 } },
  staff:   { base: 250, cap: 3, speed: 0.12, x: -15, z: 8.5 },
};
// The delivery boat: an optional bonus that docks now and then. Ignoring it costs nothing.
export const BOAT = {
  first: 80,               // seconds before the first visit
  every: 140,              // seconds between visits
  stay: 40,                // seconds it waits at the pier
  dock: { x: -17.5, z: -4.2 },
  pad: { x: -16.5, z: 0.8 },  // on the sand beside the pier, off the walking paths
  hold: 0.7,               // seconds to stand on the pad before claiming
  boost: 120,              // length of timed boosts, seconds
  offers: [
    { id: 'cash2x',  label: '2× cash for 2 minutes' },
    { id: 'rush',    label: 'Staff rush: helpers 2× faster' },
    { id: 'crate',   label: 'A crate of cash' },
    { id: 'upgrade', label: 'A free upgrade' },
  ],
};

export const NAMES = { cut: 'Cutting board', grill: 'Grill', fryer: 'Fryer', sushi: 'Sushi bar' };
export const SELL_PAD = { x: -15, z: 26 };
