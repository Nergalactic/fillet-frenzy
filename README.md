# Fillet Frenzy

The mobile ad loop, as the actual game. Run a fish shack on a pier: catch it, cut it, cook it, sell it, and do it again.

- **Fish:** stand at a fishing spot on the pier's edge and the catch stacks up on your back.
- **Seven catches:** sardines, salmon, tuna, crab and lobster (from traps), octopus, and squid, each from its own spot further out along the pier. The reef pier past the crab traps holds the lobster and octopus spots.
- **Cut and cook:** drop raw fish on the cutting board (blue ring), grab what comes out of the green ring, and feed it onward. Stations: cutting boards, grill, fryer, sushi bar, smoker (salmon), steam pot (crab and lobster), takoyaki griddle (octopus), plus a bakery that bakes bread on its own and a roll station that combines bread with steamed crab or lobster into the top-priced rolls.
- **Sell:** drop food at the counter. The trash can next to it takes anything you need to get rid of, which is your way out if the kitchen jams up. Customers line up, buy what they came for (or settle for something else), and pay into a cash pile you walk over to collect.
- **Build:** every station, table, upgrade, and hire is on the map from the start, so buy in any order (things out on the pier show up once that stretch of pier is built, and a station's chef once the station exists). The "Next" hint points at the cheapest. Stand on a price pad and your cash pours in until the new thing pops up: stations, tables, fishing spots, a longer pier, bigger baskets, running shoes, and helpers who gradually run the loop for you: a fisher, kitchen runner, server, busser, and dishwasher, a chef for each main station (doubles its speed), a cashier (an extra register, plus VIP customers who pay 2.5×), and a fishing dock whose trawler drops off a crate of mixed fish every few seconds. Staff drop off at the highest-level station with room (nearest breaks ties) and pick up from whichever station has the most food waiting.
- **More staff:** once you've hired your first runner, busser, or server, a green pad in the same spot hires another (each costs 1.8× the last, no cap). Every fishing spot except the squid hole has its own green pad to hire a fisher for it (it shows up once the kitchen has a station that takes that catch). Every cooking station can get its own chef, who doubles its speed: some come in the build queue, the rest have a green pad beside the station. The sink is run by the busser and dishwasher, and the dock by its trawler. After building or hiring, step off before the next pad takes money. Runners drop food at the station that makes the most valuable dish from it (fryer before grill, sushi bar or smoker before grill), and first fetch whatever an idle station is waiting on (the most valuable such thing first, so the steam pot and roll station don't starve), then the biggest pile. Staff spread out so two runners don't chase the same pile, take food only when a station has room for it, and serve it at the counter if they get stuck holding it.
- **Checkout:** each register has its own lane, supermarket style. Customers join the shortest one and the next person waits right behind the register, so sales aren't held up by people walking over from a long line. Extra cashiers (green pad, up to 2 more) each open another register.
- **Tables and plates:** each table level adds a seat (up to 6, then bigger tips). Every diner eats off a plate and leaves it dirty; the busser takes it to the sink and the dishwasher brings it back clean to the rack by the counter. A diner who gets a clean plate pays 50% more. Takeout customers never use a plate, so more seats means more plates in circulation and more plated sales. Extra dishwashers (green pad) keep up when tables get big.
- **Upgrade:** every station, the counter, each fishing spot, and your helpers have a small blue upgrade pad, with no level cap. Each level costs 1.8× the last. Stations work faster and hold more, the counter adds registers and draws more customers, spots bite faster, and staff training lets helpers carry more. Pads only take cash after you stand on them for a moment, so walking across one is free.
- **Delivery boat:** every couple of minutes a boat docks beside the pier with an optional bonus (2× cash, a staff rush, a cash crate, or a free upgrade). Stand on its gold pad to claim it, or ignore it; it sails off with no penalty. Claims are free today. To use rewarded ads later, change `showRewardedAd()` in `src/ads.js` to call your ad SDK; the game pauses while it runs and only grants the bonus if the ad finishes.
- **Keep it small or build it all:** a small shack (say two cutting boards, a grill, a fryer, a Lv 9 counter, five runners, two fishers, and a few servers, bussers, and tables) runs fine on its own; the bot settles around $1,350 a minute that way (`SIMPLE=1 npm run sim`). Building everything is what opens the finale.
- **Prestige:** the squid hole at the end of the pier holds the legendary giant squid. Its pad only appears once everything else on the build list is bought (the hint line counts down what's left). Catch one and a Sell the Shack pad appears. Selling earns stars (one, plus more for bigger runs, with diminishing returns), each worth +50% prices forever, and you start a new shack. Customer order bubbles show the current price, and the HUD shows your bonus under the star count.

Progress saves automatically every few seconds and when you leave the page. The save lives in your browser for the game's site, so it survives reloads and game updates. Opening the game offers Continue or a fresh shack (stars are always kept).

Sound is synthesized in the browser (no audio files) and starts on your first tap. There's a mute button in the corner.

## Run it

```
npm install
npm run dev      # local dev server (works on your phone over LAN)
npm run build    # static build in dist/
npm run sim      # bot playthrough to the squid and the sale; add a star count: npm run sim -- 2
node scripts/layout-check.mjs   # no overlapping stations, every pad reachable, every fishing line lands in water
node scripts/save-test.mjs      # save round-trip plus loading an older-version save
node scripts/staff-check.mjs    # staff only, everything built: shows every station gets used (TABLES=6 COUNTER=9 WASHERS=1 SEED=2 to vary)
node scripts/checkout-check.mjs # how many sales a fully stocked counter can ring up (LV=17 sets the counter level)
```

Every push to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

Controls: drag anywhere for a floating joystick, or WASD / arrow keys. Add `?play` to skip the start screen and `?debug` for `game.give(cash)`, `game.goto(x, z)`, and `game.pads()` in the console.

## Where things live

| File | What it does |
| --- | --- |
| `src/config.js` | Every tuning knob: items and prices, recipes and cook times, fish rates, layout, the build pad sequence |
| `src/logic.js` | All game rules with no rendering: stacks, stations, customers, pads, helper brains, prestige |
| `src/render.js` | Draws the state: beach, water, pier, stations, piles, wobbly back-stacks, flying items, labels |
| `src/models.js` | Low-poly models for people, fish, food, stations, tables |
| `src/sound.js` | Web Audio sound effects |
| `src/ads.js` | The single hook for a rewarded-ad SDK (free bonus until one is connected) |
| `src/main.js` | Main loop, HUD, start and sold screens, camera |
| `scripts/sim.mjs` | Balance check: a bot plays from an empty shack to selling it |
| `scripts/layout-check.mjs` | Layout sanity check for the map |
| `scripts/save-test.mjs` | Save and migration check |
| `scripts/staff-check.mjs` | Staff-only check that every station gets fed |
| `scripts/checkout-check.mjs` | Checkout throughput check |
| `scripts/preview.sh` | Builds a self-contained page for headless screenshot checks |

## Updating without breaking saves

Saves record ids (pads, stations, spots, tables, items), not positions or prices, so moving things around or rebalancing is safe. Never rename or reuse an id; add new ones. If a rename is unavoidable, bump `SAVE_VERSION` and convert old saves in `migrate()` in `src/logic.js`.

## Balance

The bot ignores the boat. On a first run it reaches the giant squid and sells:

| Bot style | Time | Stars | Upgrades bought |
| --- | --- | --- | --- |
| No upgrades (`NO_UPGRADES=1`) | about 42 min | 2 | 0 |
| Default (`UPRATIO=0.3`) | about 67 min | 3 | 147 |

The early game is unchanged: the reef pier opens around the half-hour mark. Upgrading slows the bot down because it keeps spending instead of saving for the next build, but it ends with a much bigger shack and more stars. Add `RATE=1` to log income every five minutes.
