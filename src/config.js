// Every tuning knob for Fillet Frenzy. Coordinates: x is left/right, z is toward the camera.
// The beach is z > 0; the pier runs out over the water toward negative z.
//
// Save compatibility: ids here (items, stations, spots, tables, pads) are stored in saves.
// Never rename or reuse one; add new ids instead. See migrate() in logic.js.

export const ITEMS = {
  // Raw catch
  sardine:        { label: 'Sardine' },
  salmon:         { label: 'Salmon' },
  tuna:           { label: 'Tuna' },
  crab:           { label: 'Crab' },
  lobster:        { label: 'Lobster' },
  octopus:        { label: 'Octopus' },
  squid:          { label: 'Giant squid' },
  // Prepped and cooked
  sardineFillet:  { label: 'Sardine fillet',   price: 5 },
  salmonFillet:   { label: 'Salmon fillet',    price: 10 },
  tunaSteak:      { label: 'Tuna steak',       price: 15 },
  tentacles:      { label: 'Tentacles',        price: 30 },
  calamari:       { label: 'Calamari',         price: 50 },
  grilledSardine: { label: 'Grilled sardines', price: 12 },
  fishAndChips:   { label: 'Fish & chips',     price: 18 },
  grilledSalmon:  { label: 'Grilled salmon',   price: 26 },
  smokedSalmon:   { label: 'Smoked salmon',    price: 38 },
  grilledTuna:    { label: 'Grilled tuna',     price: 34 },
  steamedCrab:    { label: 'Steamed crab',     price: 45 },
  sushi:          { label: 'Sushi platter',    price: 50 },
  crabRoll:       { label: 'Crab roll',        price: 95 },
  steamedLobster: { label: 'Steamed lobster',  price: 90 },
  friedCalamari:  { label: 'Fried calamari',   price: 160 },
  takoyaki:       { label: 'Takoyaki',         price: 190 },
  lobsterRoll:    { label: 'Lobster roll',     price: 240 },
  // Kitchen supplies
  bread:          { label: 'Bread' },
  plate:          { label: 'Dirty plate' },
  cleanPlate:     { label: 'Clean plate' },
};

// Station recipes.
//   makes:   one input in, one output out
//   produce: no input; makes `produce` on its own every `time` seconds (the bakery)
//   combo:   needs one `with` item plus one main item; the main item decides the result
export const RECIPES = {
  cut:     { time: 0.7, makes: { sardine: 'sardineFillet', salmon: 'salmonFillet', tuna: 'tunaSteak', octopus: 'tentacles', squid: 'calamari' }, slow: { squid: 4, octopus: 1.6 } },
  grill:   { time: 1.4, makes: { sardineFillet: 'grilledSardine', tunaSteak: 'grilledTuna', salmonFillet: 'grilledSalmon' } },
  fryer:   { time: 1.3, makes: { sardineFillet: 'fishAndChips', calamari: 'friedCalamari' } },
  sushi:   { time: 1.8, makes: { tunaSteak: 'sushi' } },
  smoker:  { time: 2.0, makes: { salmonFillet: 'smokedSalmon' } },
  steam:   { time: 1.8, makes: { crab: 'steamedCrab', lobster: 'steamedLobster' } },
  griddle: { time: 2.2, makes: { tentacles: 'takoyaki' } },
  sink:    { time: 0.6, makes: { plate: 'cleanPlate' } },
  bakery:  { time: 2.2, produce: 'bread' },
  roll:    { time: 1.6, combo: { with: 'bread', makes: { steamedLobster: 'lobsterRoll', steamedCrab: 'crabRoll' } } },
  dock:    { time: 0 },  // the trawler fills it; see DOCK
};

export const STATION_LABELS = {
  cut: 'CUTTING BOARD', grill: 'GRILL', fryer: 'FRYER', sushi: 'SUSHI BAR', smoker: 'SMOKER', steam: 'STEAM POT',
  griddle: 'TAKOYAKI GRIDDLE', sink: 'DISH SINK', bakery: 'BAKERY', roll: 'ROLL STATION', dock: 'FISHING DOCK',
};
export const NAMES = {
  cut: 'Cutting board', grill: 'Grill', fryer: 'Fryer', sushi: 'Sushi bar', smoker: 'Smoker', steam: 'Steam pot',
  griddle: 'Takoyaki griddle', sink: 'Dish sink', bakery: 'Bakery', roll: 'Roll station', dock: 'Fishing dock',
};

// Fishing spots: what bites and how often (seconds per catch). Traps get a cage instead of a rod.
export const FISH = {
  sardine: { every: 0.8 },
  salmon:  { every: 1.1 },
  tuna:    { every: 1.5 },
  crab:    { every: 1.7, trap: true },
  lobster: { every: 2.4, trap: true },
  octopus: { every: 2.6 },
  squid:   { every: 9 },
};

export const PLAYER = { speed: 7.5, cap: 8, transfer: 0.09 };
export const HELPER = { speed: 6, cap: 5 };

export const CUSTOMERS = {
  baseEvery: 3.0,        // seconds between arrivals with no tables
  perTable: 0.5,         // each built table makes arrivals this much more frequent (divides the interval)
  minEvery: 0.8,
  queueMax: 6,
  pickyFor: 1.5,         // seconds a customer holds out for their favourite before taking anything
  eatTime: 5,
  tip: 0.5,              // seated customers tip this share of the price when they leave
  speed: 5.5,
};

// The cashier adds a register and brings VIP customers who pay extra and get served first.
export const CASHIER = { vipChance: 0.2, vipPay: 2.5 };

// Clean plates on the counter's rack: each sale served on one pays this much extra.
export const PLATES = { rackMax: 40, bonus: 0.5 };

// The fishing dock: a trawler drops a crate of mixed fish every `every` seconds.
export const DOCK = { every: 10, crate: 4, perLevel: 2, boat: { x: 19.5, z: -5.5 } };

export const STARS = {
  priceBonus: 0.5,       // each star multiplies prices by (1 + 0.5 per star)
  // Stars for selling: 1, plus more the more you earned (square-root curve so big runs don't explode)
  scale: 60000,          // earning this much gives 1 extra star, 4x this gives 2, 9x gives 3...
};

// Walkable areas. The pier grows as you buy extensions.
export const AREAS = {
  beach:  { x0: -40, x1: 40, z0: -0.5, z1: 31 },
  pier1:  { x0: -11, x1: 11, z0: -18, z1: 0 },
  pier2:  { x0: -11, x1: 11, z0: -38, z1: -18 },
  pier3:  { x0: -11, x1: 11, z0: -58, z1: -38 },
  squid:  { x0: -14, x1: 14, z0: -72, z1: -58 },
};

// Fixed places on the map.
export const PLACES = {
  start:   { x: 2, z: 10 },
  counter: { x: -20, z: 16, drop: { x: -20, z: 13.4 }, front: { x: -20, z: 18.6 }, cash: { x: -15.8, z: 13.4 } },
  bin:     { x: -36, z: 15 },   // tucked in the west corner, off every worker's route
  shack:   { x: -21, z: 4.5 },
  enter:   { x: -12, z: 34 },
  helperHome: { x: -16, z: 5 },
};

// Stations: model at (x, z), drop-off zone `in`, pick-up zone `out`.
// `up` overrides where the upgrade pad goes (default: just in front of the station).
// `chef` is where a hired station chef stands.
export const STATIONS = {
  cut1:    { type: 'cut',     x: 10,  z: 4,  in: { x: 7.2, z: 4 },    out: { x: 12.8, z: 4 },   chef: { x: 10, z: 2.4 } },
  cut2:    { type: 'cut',     x: 10,  z: 10, in: { x: 7.2, z: 10 },   out: { x: 12.8, z: 10 },  chef: { x: 10, z: 8.4 } },
  grill:   { type: 'grill',   x: -8,  z: 4,  in: { x: -5.2, z: 4 },   out: { x: -10.8, z: 4 },  chef: { x: -8, z: 2.4 } },
  fryer:   { type: 'fryer',   x: -8,  z: 10, in: { x: -5.2, z: 10 },  out: { x: -10.8, z: 10 }, chef: { x: -8, z: 8.4 } },
  sushi:   { type: 'sushi',   x: 10,  z: 16, in: { x: 7.2, z: 16 },   out: { x: 12.8, z: 16 },  chef: { x: 10, z: 14.4 } },
  smoker:  { type: 'smoker',  x: 22,  z: 4,  in: { x: 19.2, z: 4 },   out: { x: 24.8, z: 4 },   chef: { x: 22, z: 2.4 } },
  steam:   { type: 'steam',   x: 22,  z: 10, in: { x: 19.2, z: 10 },  out: { x: 24.8, z: 10 },  chef: { x: 22, z: 8.4 } },
  bakery:  { type: 'bakery',  x: 32,  z: 4,  in: null,                 out: { x: 34.8, z: 4 },   chef: { x: 32, z: 2.4 } },
  griddle: { type: 'griddle', x: 32,  z: 10, in: { x: 29.2, z: 10 },  out: { x: 34.8, z: 10 },  chef: { x: 32, z: 8.4 } },
  roll:    { type: 'roll',    x: -8,  z: 16, in: { x: -5.2, z: 16 },  out: { x: -10.8, z: 16 },  chef: { x: -8, z: 14.4 } },
  sink:    { type: 'sink',    x: -31, z: 8,  in: { x: -28.2, z: 8 },  out: { x: -33.8, z: 8 },  up: { x: -31, z: 5.3 } },
  dock:    { type: 'dock',    x: 16.5, z: -3, in: null,                out: { x: 16.5, z: 1.4 }, up: { x: 13.8, z: -0.2 } },
};

// Fishing spots sit on the pier's edge; `water` is where the line goes in.
export const SPOTS = {
  s1:  { fish: 'sardine', x: 9.3,  z: -11, water: { x: 13.5, z: -11 },  up: { x: 5.6, z: -11 } },
  s2:  { fish: 'sardine', x: -9.3, z: -7,  water: { x: -13.5, z: -7 },  up: { x: -5.6, z: -7 } },
  sa1: { fish: 'salmon',  x: 9.3,  z: -3.5, water: { x: 13.5, z: -3.5 }, up: { x: 5.6, z: -3.5 } },
  sa2: { fish: 'salmon',  x: -9.3, z: -15, water: { x: -13.5, z: -15 }, up: { x: -5.6, z: -15 } },
  t1:  { fish: 'tuna',    x: 9.3,  z: -31, water: { x: 13.5, z: -31 },  up: { x: 5.6, z: -31 } },
  t2:  { fish: 'tuna',    x: -9.3, z: -25, water: { x: -13.5, z: -25 }, up: { x: -5.6, z: -25 } },
  cr1: { fish: 'crab',    x: 9.3,  z: -21, water: { x: 13.5, z: -21 },  up: { x: 5.6, z: -21 } },
  cr2: { fish: 'crab',    x: -9.3, z: -33, water: { x: -13.5, z: -33 }, up: { x: -5.6, z: -33 } },
  lb1: { fish: 'lobster', x: 9.3,  z: -43, water: { x: 13.5, z: -43 },  up: { x: 5.6, z: -43 } },
  lb2: { fish: 'lobster', x: -9.3, z: -55, water: { x: -13.5, z: -55 }, up: { x: -5.6, z: -55 } },
  oc1: { fish: 'octopus', x: -9.3, z: -47, water: { x: -13.5, z: -47 }, up: { x: -5.6, z: -47 } },
  oc2: { fish: 'octopus', x: 9.3,  z: -53, water: { x: 13.5, z: -53 },  up: { x: 5.6, z: -53 } },
  sq:  { fish: 'squid',   x: 0,    z: -68, water: { x: 0, z: -75 } },
};

export const TABLES = {
  tb1: { x: -4, z: 25 }, tb2: { x: 2, z: 25 }, tb3: { x: 8, z: 25 },
  tb4: { x: 14, z: 25 }, tb5: { x: 20, z: 25 }, tb6: { x: 20, z: 19 },
  tb7: { x: 26, z: 25 }, tb8: { x: 26, z: 19 },
};

// Build pads in unlock order. The next three unbuilt pads are on the map at any time.
// kind: station | spot | table | helper | area | upgrade
// Helpers: fisher (spot), runner, server, busser, chef (station), cashier, washer
export const PADS = [
  { id: 'grill',     kind: 'station', ref: 'grill',  price: 30,    label: 'Grill' },
  { id: 'tb1',       kind: 'table',   ref: 'tb1',    price: 25,    label: 'Table' },
  { id: 's2',        kind: 'spot',    ref: 's2',     price: 50,    label: 'Fishing spot' },
  { id: 'tb2',       kind: 'table',   ref: 'tb2',    price: 40,    label: 'Table' },
  { id: 'basket1',   kind: 'upgrade', ref: 'cap',    value: 12,    price: 80,    label: 'Bigger basket', x: -1, z: 4 },
  { id: 'fryer',     kind: 'station', ref: 'fryer',  price: 140,   label: 'Fryer' },
  { id: 'fisher1',   kind: 'helper',  ref: 'fisher', spot: 's1',   price: 180,   label: 'Hire a fisher', x: 6, z: -15 },
  { id: 'tb3',       kind: 'table',   ref: 'tb3',    price: 120,   label: 'Table' },
  { id: 'sa1',       kind: 'spot',    ref: 'sa1',    price: 180,   label: 'Salmon spot' },
  { id: 'shoes1',    kind: 'upgrade', ref: 'speed',  value: 1.3,   price: 160,   label: 'Running shoes', x: -1, z: 9 },
  { id: 'smoker',    kind: 'station', ref: 'smoker', price: 240,   label: 'Smoker' },
  { id: 'pier2',     kind: 'area',    ref: 'pier2',  price: 350,   label: 'Extend the pier', x: 0, z: -16.5, then: 't1' },
  { id: 'cut2',      kind: 'station', ref: 'cut2',   price: 300,   label: 'Cutting board' },
  { id: 'runner',    kind: 'helper',  ref: 'runner', price: 450,   label: 'Hire a kitchen runner', x: 1.5, z: 15 },
  { id: 'tb4',       kind: 'table',   ref: 'tb4',    price: 250,   label: 'Table' },
  { id: 'sushi',     kind: 'station', ref: 'sushi',  price: 650,   label: 'Sushi bar' },
  { id: 't2',        kind: 'spot',    ref: 't2',     price: 550,   label: 'Tuna spot' },
  { id: 'cr1',       kind: 'spot',    ref: 'cr1',    price: 600,   label: 'Crab trap' },
  { id: 'steam',     kind: 'station', ref: 'steam',  price: 700,   label: 'Steam pot' },
  { id: 'server',    kind: 'helper',  ref: 'server', price: 700,   label: 'Hire a server', x: -14, z: 20 },
  { id: 'basket2',   kind: 'upgrade', ref: 'cap',    value: 20,    price: 600,   label: 'Huge basket', x: -2, z: 18 },
  { id: 'tb5',       kind: 'table',   ref: 'tb5',    price: 450,   label: 'Table' },
  { id: 'busser',    kind: 'helper',  ref: 'busser', price: 600,   label: 'Hire a busser', x: -22, z: 22 },
  { id: 'sink',      kind: 'station', ref: 'sink',   price: 800,   label: 'Dish sink' },
  { id: 'washer',    kind: 'helper',  ref: 'washer', price: 900,   label: 'Hire a dishwasher', x: -31, z: 12.5 },
  { id: 'chef_cut1', kind: 'helper',  ref: 'chef',   station: 'cut1', price: 1000, label: 'Hire a prep chef', x: 10, z: 1.3 },
  { id: 'fisher2',   kind: 'helper',  ref: 'fisher', spot: 't1',   price: 900,   label: 'Hire a tuna fisher', x: 6, z: -35 },
  { id: 'tb6',       kind: 'table',   ref: 'tb6',    price: 600,   label: 'Table' },
  { id: 'cashier',   kind: 'helper',  ref: 'cashier', price: 1400, label: 'Hire a cashier', x: -27, z: 22 },
  { id: 'sa2',       kind: 'spot',    ref: 'sa2',    price: 1100,  label: 'Salmon spot' },
  { id: 'dock',      kind: 'station', ref: 'dock',   price: 1800,  label: 'Fishing dock', x: 16.5, z: 1.4 },
  { id: 'chef_grill', kind: 'helper', ref: 'chef',   station: 'grill', price: 1800, label: 'Hire a grill chef', x: -8, z: 1.3 },
  { id: 'pier3',     kind: 'area',    ref: 'pier3',  price: 3000,  label: 'Reef pier', x: 0, z: -36.5, then: 'lb1' },
  { id: 'bakery',    kind: 'station', ref: 'bakery', price: 2200,  label: 'Bakery' },
  { id: 'roll',      kind: 'station', ref: 'roll',   price: 2800,  label: 'Roll station' },
  { id: 'cr2',       kind: 'spot',    ref: 'cr2',    price: 2200,  label: 'Crab trap' },
  { id: 'chef_fryer', kind: 'helper', ref: 'chef',   station: 'fryer', price: 2600, label: 'Hire a fry chef', x: -13.5, z: 7 },
  { id: 'oc1',       kind: 'spot',    ref: 'oc1',    price: 3500,  label: 'Octopus spot' },
  { id: 'griddle',   kind: 'station', ref: 'griddle', price: 4000, label: 'Takoyaki griddle' },
  { id: 'tb7',       kind: 'table',   ref: 'tb7',    price: 2500,  label: 'Table' },
  { id: 'lb2',       kind: 'spot',    ref: 'lb2',    price: 4500,  label: 'Lobster trap' },
  { id: 'chef_sushi', kind: 'helper', ref: 'chef',   station: 'sushi', price: 4500, label: 'Hire a sushi chef', x: 15.5, z: 18.5 },
  { id: 'tb8',       kind: 'table',   ref: 'tb8',    price: 3500,  label: 'Table' },
  { id: 'oc2',       kind: 'spot',    ref: 'oc2',    price: 6000,  label: 'Octopus spot' },
  { id: 'chef_griddle', kind: 'helper', ref: 'chef', station: 'griddle', price: 6500, label: 'Hire a takoyaki chef', x: 37, z: 13.5 },
  { id: 'squid',     kind: 'area',    ref: 'squid',  price: 15000, label: 'Squid hole', x: 0, z: -56.5, then: 'sq' },
];
export const PADS_SHOWN = 3;

// More staff. These pads stay on the map once the first of each job is hired, with no cap.
// Each extra runner or busser costs LEVELS.growth times the last. Every fishing spot (except the
// squid hole) can get one fisher; their pad sits just shoreward of the spot's upgrade pad.
export const HIRES = {
  runner: { base: 800, x: 1.5, z: 15, after: 'runner', name: 'runner' },
  busser: { base: 900, x: -22, z: 22, after: 'busser', name: 'busser' },
  server: { base: 1000, x: -14, z: 20, after: 'server', name: 'server' },
  cashier: { base: 3000, x: -27, z: 22, after: 'cashier', name: 'cashier', max: 2 },   // each opens another register
  fisher: { mult: 3, dz: 3 },   // price = this times the spot's upgrade base
  // A chef for every cooking station that doesn't get one in the build queue. Doubles that station's speed.
  // The pad sits beside the station. (The sink is run by the busser and dishwasher, the dock by its trawler.)
  chef: {
    cut2:   { price: 1500, x: 15.5, z: 7 },
    smoker: { price: 2200, x: 22, z: 2.4 },
    steam:  { price: 2800, x: 27.5, z: 7 },
    bakery: { price: 3200, x: 32, z: 2.4 },
    roll:   { price: 4500, x: -2.5, z: 13 },
  },
};
export const CHEF_TITLES = { cut: 'prep chef', grill: 'grill chef', fryer: 'fry chef', sushi: 'sushi chef', smoker: 'smoker chef',
  steam: 'steam cook', bakery: 'baker', roll: 'roll chef', griddle: 'takoyaki chef' };

// Upgrade pads sit next to each station, the counter, each fishing spot, and the helpers' hangout.
// They stay out of the build queue above. Levels never cap; each costs `growth` times the last.
export const LEVELS = {
  growth: 1.8,
  station: {
    speed: 0.6, buffer: 8,
    base: { cut: 50, grill: 80, fryer: 130, sushi: 350, smoker: 200, steam: 300, bakery: 350, roll: 600, griddle: 700, sink: 200, dock: 700 },
  },
  counter: { base: 80, customers: 0.4, stock: 12, queue: 2, x: -26, z: 13 },
  spot:    { speed: 0.4, base: { sardine: 60, salmon: 120, tuna: 250, crab: 300, lobster: 600, octopus: 700 } },
  staff:   { base: 250, cap: 3, speed: 0.1, x: -3.5, z: 0.8 },
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

export const SELL_PAD = { x: -15, z: 26 };
