# Thailand Wild Trails (Phaser 3 + TypeScript)

**Play:** https://pongsathorn11.github.io/thailand-wild-trails/

The real build of the game. The single-file prototype in `../thailand-wild-trails/knowledge/game.html`
(v1.1, also published as a claude.ai artifact) is the reference for how everything should play;
this project ports it system by system into separate, tested modules.

## Run

```bash
npm install
npm run dev        # http://localhost:5173  (?trail=<id> opens a trail directly)
npm test           # unit tests (Vitest)
npm run build      # type-check + production bundle in dist/
npm run coop       # co-op game server on ws://localhost:2567 (COOP_ALLOW_GUESTS=1 to test without sign-in)
node tools/coop-smoke.mjs   # two-client check against a running co-op server (needs COOP_ALLOW_GUESTS=1)
```

The game starts at the title screen (character creator); `?trail=<id>` skips straight to packing for a trail (ignores unlocks, for testing).
Trail ids: `doi-inthanon-kew-mae-pan`, `phu-kradueng-summit`, `erawan-waterfall`, `khao-sok-ton-kloi`.

## Layout

| Path | What lives there |
|---|---|
| `src/core/` | Game rules with no Phaser: world generation, hiker stats and movement, clock, save/profile. Unit-tested. |
| `src/data/` | Content as data: terrain, trails (real facts in `realData`, layout in `gen`/`pois`), looks. Add a trail here without touching systems. |
| `src/gfx/` | Code-drawn pixel art (ground, trees, chibi sprite sheet, props). Replace with Aseprite sheets later. |
| `src/scenes/` | Phaser scenes: `BootScene` builds textures, `HikeScene` is the zoomed world, `HudScene` the full-res overlay. |
| `src/i18n/` | Thai/English strings, extracted from the prototype by `npm run extract-strings`. |
| `src/audio/`, `src/input/` | Web Audio sound + generative music; touch joystick and buttons (`?touch=1` forces touch mode). |
| `src/net/`, `src/ui/` | Supabase client (accounts, cloud save, leaderboard) and the Online panel. Optional: no settings = offline game. |
| `server/` | Co-op game server (Node + `ws`). Imports `src/core` directly: one movement code for client and server. |
| `supabase/migrations/` | Database schema with Row Level Security. Already applied to the project in `.env`. |

Rules of the codebase (from the original brief, section 22):
- one system per module; content in data files, never hard-coded in systems
- real-world facts separate from game fiction (`realData` vs layout, and `04-parks-data.md`)
- design for server authority later: the scenes only read/write state through `src/core`

## Port roadmap

| Milestone | Scope | Status |
|---|---|---|
| **M1 Hike core** | 4 trail maps, chibi hiker, movement and collision, stamina/hunger/thirst/warmth, day and night light, fog, objective arrow, checkpoint and finish, Thai/English text, save migration | ✅ done |
| **M2 Trail life** | all trail art (waterfalls animated, karst, stalls, signs per tier, maple and Rafflesia by season), photos incl. rare shots, litter, guide dialogue, random events (slippery, cold wind, fog, deer, lost item), sunbird/hornbill, swimming, refilling water, minimap with reveal, rain, flash, summary + passport stamp + EXP/coins saved, rescue screen | ✅ done |
| **M3 Backpack** | packing screen (forecast, 7 items + cooked food from camp, 12 slots / 6 kg bar, click or keys, trail ◀ ▶ until camp), hotbar 1–9 0 - = (click works too), jacket on/off, raincoat auto in rain, coffee kit while sitting, empty bottles keep weight and refill at water, litter and finds take slots, overweight slows you, leftover cooked food returns to camp storage | ✅ done |
| **M4 Camp** | camp scene (tent, flickering campfire, quest board, mailbox, trail sign, 6 plots), sleeping advances the day and season, garden (plant, water, grow, harvest, Q to pick seed), cooking, mail-order shop with level gates, decorate mode (B, place/pick up, [ ]), level and EXP bar, 3 daily quests with hooks from the hike, trail picker with unlocks, back to camp after a hike with level-up/quest/unlock messages | ✅ done |
| M5 Progress | skills, journal (album, passport, achievements, medals, titles, stats), ranks | ✅ |
| M6 Character creator | title screen from the mockup, chibi portrait, name | ✅ |
| M7 Polish | touch controls, sound effects, generative music, phone layout | ✅ |
| M8a Online | Supabase accounts (email + password, guest), cloud save that never loses progress, per-trail leaderboard written only through a validating database function | ✅ |
| M8b Co-op | hike together (rooms of 4, room codes) on a Node WebSocket game server that moves everyone with the shared `src/core` code; client prediction with correction; server-timed leaderboard runs | ✅ |
| M9 Hosting | game on GitHub Pages (auto-deploy on push, tests run first); co-op server on Render (blueprint in `render.yaml`, Singapore, origin allow-list) | ✅ game live · server: connect once in Render |

When the port reaches parity (M7), the prototype is retired and this build is what gets published.

## Online (Supabase)

`.env` points at the Supabase project `thailand-wild-trails` (Singapore). The publishable key in it is public by design;
the tables are protected by Row Level Security (see `supabase/migrations/`):

- `saves`: one row per player, readable and writable only by that player.
- `scores`: best time per player per trail. No direct writes; `submit_score()` checks the trail id and the 30 s – 6 h range and keeps the faster time.
- `get_leaderboard()`: public top 10 (plus your own row), returns names and times only, never user ids.

Press **O** (or the ☁️ chip on the title screen) to open the Online panel. Two settings live in the Supabase dashboard
(Authentication), not in code:

1. **URL Configuration → Site URL / Redirect URLs**: add where the game runs (e.g. `http://localhost:5173`) so the sign-up confirmation link comes back to the game.
2. **Sign In / Providers → Allow anonymous sign-ins**: turn on for the "Play as guest" button (it shows a clear message while off).

Leaderboard times are timed by the server: `start_run()` stamps the start when a hike begins and `finish_run()` only accepts a time
that real time allows (the game clock can run slower than real time, never faster). The old direct `submit_score()` is closed.

## Co-op (hiking together)

Online panel → 🤝 Hike together → create a room (4-character code) or type a friend's code, then everyone picks the
same trail and starts hiking. Up to 4 per room; the room picks the weather for everyone.

- **Server authority:** clients send inputs only (one per 50 ms). The server moves every hiker with the game's own
  `moveHiker()`, so walls, water and speeds are the same rules as single-player. Inputs are limited to real time
  (plus a 10-step burst), queues are capped, replays and junk are dropped, messages are rate-limited.
- Clients may send a slow-down factor (heavy pack, exhaustion, slippery path) so prediction matches; it can only slow them.
- **Sign-in:** the server checks each player's Supabase access token with Supabase. `COOP_ALLOW_GUESTS=1` skips this for local tests.
- **Prediction:** the client runs the same 50 ms steps locally and corrects to the server position (replaying unconfirmed inputs) when they differ by more than 1.5 px.
- Body stats (stamina, food, warmth), items, photos and quests stay per player, as in single-player.

`VITE_COOP_URL` in `.env` says where the server is (`ws://localhost:2567` now; `wss://…` once hosted).
## Hosting

| Part | Where | How it updates |
|---|---|---|
| Game (static) | GitHub Pages: https://pongsathorn11.github.io/thailand-wild-trails/ | `.github/workflows/pages.yml` runs the tests, builds and deploys on every push to `main` |
| Co-op server | Render free web service `thailand-wild-trails-coop` (Singapore) | `render.yaml` blueprint; Render redeploys on every push to `main` |
| Accounts, saves, leaderboard | Supabase project `thailand-wild-trails` | SQL in `supabase/migrations/` |

`.env.production` points the built game at `wss://thailand-wild-trails-coop.onrender.com`. If Render gives the service a
different address, change it there and push. The server only accepts WebSocket connections from
`https://pongsathorn11.github.io` (`COOP_ORIGINS` in `render.yaml`).

One-time steps in the dashboards (they can't be done from code):

1. **Render:** open https://render.com/deploy?repo=https://github.com/pongsathorn11/thailand-wild-trails, sign in, and approve the blueprint.
   On the free plan the server sleeps after ~15 min without players, so the first co-op join after a pause takes about a minute.
2. **Supabase → Authentication → URL Configuration:** Site URL `https://pongsathorn11.github.io/thailand-wild-trails/`, and add it
   (plus `http://localhost:5173` for development) to Redirect URLs, so sign-up confirmation links come back to the game.
3. Optional, **Supabase → Authentication → Sign In / Providers:** allow anonymous sign-ins for the "Play as guest" button.
