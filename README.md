# Fillet Frenzy

The mobile ad loop, as the actual game. Run a fish shack on a pier: catch it, cut it, cook it, sell it, and do it again.

- **Fish:** stand at a fishing spot on the pier's edge and the catch stacks up on your back.
- **Cut and cook:** drop raw fish on the cutting board (blue ring), grab fillets from the green ring, and feed them to the grill, fryer, or sushi bar.
- **Sell:** drop food at the counter. The trash can next to it takes anything you need to get rid of, which is your way out if the kitchen jams up. Customers line up, buy what they came for (or settle for something else), and pay into a cash pile you walk over to collect.
- **Build:** stand on a price pad and your cash pours in until the new thing pops up: stations, tables, fishing spots, a longer pier, bigger baskets, running shoes, and helpers (a fisher, kitchen runner, server, and busser) who gradually run the loop for you. Staff drop off at the highest-level station with room (nearest breaks ties) and pick up from whichever station has the most food waiting.
- **Upgrade:** every station, the counter, each fishing spot, and your helpers have a small blue upgrade pad (up to level 5). Stations work faster and hold more, the counter adds registers and draws more customers, spots bite faster, and staff training lets helpers carry more. Pads only take cash after you stand on them for a moment, so walking across one is free.
- **Delivery boat:** every couple of minutes a boat docks beside the pier with an optional bonus (2× cash, a staff rush, a cash crate, or a free upgrade). Stand on its gold pad to claim it, or ignore it; it sails off with no penalty. Claims are free today. To use rewarded ads later, change `showRewardedAd()` in `src/ads.js` to call your ad SDK; the game pauses while it runs and only grants the bonus if the ad finishes.
- **Prestige:** the squid hole at the end of the pier holds the legendary giant squid. Catch one and a Sell the Shack pad appears. Selling earns stars (one, plus another per $25,000 earned that run), each worth +50% prices forever, and you start a new shack. Customer order bubbles show the current price, and the HUD shows your bonus under the star count.

Sound is synthesized in the browser (no audio files) and starts on your first tap. There's a mute button in the corner.

## Run it

```
npm install
npm run dev      # local dev server (works on your phone over LAN)
npm run build    # static build in dist/
npm run sim      # bot playthrough to the squid and the sale; add a star count: npm run sim -- 2
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
| `scripts/preview.sh` | Builds a self-contained page for headless screenshot checks |

## Balance

The bot ignores the boat. It reaches the giant squid and sells in about 21 minutes on a first run if it skips upgrades (1 star, about $10.8K earned). Buying upgrades along the way doubles income: about 28 minutes, $30K earned, 2 stars. Compare with `NO_UPGRADES=1 npm run sim`.
