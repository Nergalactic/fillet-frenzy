# Fillet Frenzy

The mobile ad loop, as the actual game. Run a fish shack on a pier: catch it, cut it, cook it, sell it, and do it again.

- **Fish:** stand at a fishing spot on the pier's edge and the catch stacks up on your back.
- **Seven catches:** sardines, salmon, tuna, crab and lobster (from traps), octopus, and squid, each from its own spot further out along the pier. The reef pier past the crab traps holds the lobster and octopus spots.
- **Cut and cook:** drop raw fish on the cutting board (blue ring), grab what comes out of the green ring, and feed it onward. Stations: cutting boards, grill, fryer, sushi bar, smoker (salmon), steam pot (crab and lobster), takoyaki griddle (octopus), plus a bakery that bakes bread on its own and a roll station that combines bread with steamed crab or lobster into the top-priced rolls.
- **Sell:** drop food at the counter. The trash can next to it takes anything you need to get rid of, which is your way out if the kitchen jams up. Customers line up, buy what they came for (or settle for something else), and pay into a cash pile you walk over to collect.
- **Build:** stand on a price pad and your cash pours in until the new thing pops up: stations, tables, fishing spots, a longer pier, bigger baskets, running shoes, and helpers who gradually run the loop for you: a fisher, kitchen runner, server, busser, and dishwasher, a chef for each main station (doubles its speed), a cashier (an extra register, plus VIP customers who pay 2.5×), and a fishing dock whose trawler drops off a crate of mixed fish every few seconds. Staff drop off at the highest-level station with room (nearest breaks ties) and pick up from whichever station has the most food waiting.
- **Plates:** once the sink is built, the busser takes dirty plates there instead of the trash, the dishwasher carries clean ones to the rack by the counter, and every sale served on a plate earns 50% more. Without plates, food still sells at the normal price.
- **Upgrade:** every station, the counter, each fishing spot, and your helpers have a small blue upgrade pad, with no level cap. Each level costs 1.8× the last. Stations work faster and hold more, the counter adds registers and draws more customers, spots bite faster, and staff training lets helpers carry more. Pads only take cash after you stand on them for a moment, so walking across one is free.
- **Delivery boat:** every couple of minutes a boat docks beside the pier with an optional bonus (2× cash, a staff rush, a cash crate, or a free upgrade). Stand on its gold pad to claim it, or ignore it; it sails off with no penalty. Claims are free today. To use rewarded ads later, change `showRewardedAd()` in `src/ads.js` to call your ad SDK; the game pauses while it runs and only grants the bonus if the ad finishes.
- **Prestige:** the squid hole at the end of the pier holds the legendary giant squid. Catch one and a Sell the Shack pad appears. Selling earns stars (one, plus more for bigger runs, with diminishing returns), each worth +50% prices forever, and you start a new shack. Customer order bubbles show the current price, and the HUD shows your bonus under the star count.

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
| `scripts/preview.sh` | Builds a self-contained page for headless screenshot checks |

## Updating without breaking saves

Saves record ids (pads, stations, spots, tables, items), not positions or prices, so moving things around or rebalancing is safe. Never rename or reuse an id; add new ones. If a rename is unavoidable, bump `SAVE_VERSION` and convert old saves in `migrate()` in `src/logic.js`.

## Balance

The bot ignores the boat. On a first run it reaches the giant squid and sells:

| Bot style | Time | Stars | Upgrades bought |
| --- | --- | --- | --- |
| No upgrades (`NO_UPGRADES=1`) | about 44 min | 2 | 0 |
| Light upgrading (`UPRATIO=0.1`) | about 56 min | 2 | 98 |
| Default (`UPRATIO=0.3`) | about 81 min | 3 | 147 |

The early game is unchanged: the reef pier opens around the half-hour mark. Upgrading slows the bot down because it keeps spending instead of saving for the next build, but it ends with a much bigger shack and more stars. Add `RATE=1` to log income every five minutes.
