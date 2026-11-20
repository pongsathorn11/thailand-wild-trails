# Thailand Wild Trails (Phaser 3 + TypeScript)

**Play:** https://pongsathorn11.github.io/thailand-wild-trails/

The real build of the game. The single-file prototype in `docs/knowledge/game.html`
(v1.1, also published as a claude.ai artifact) is the reference for how everything should play;
this project ports it system by system into separate, tested modules.

## Develop on another machine

Everything needed is in this repo: code, design docs (`docs/`), prototype, database migrations and deploy config.

1. Install **Node.js 22+** and **Git**, and sign in to GitHub (`gh auth login` or Git Credential Manager).
2. Clone and install:
   ```bash
   git clone https://github.com/pongsathorn11/thailand-wild-trails.git
   cd thailand-wild-trails
   npm install
   npm run dev
   ```
3. Open http://localhost:5173. `.env` is in the repo (public keys only), so sign-in, cloud saves and the leaderboard work right away.
   For co-op, run `npm run coop` in a second terminal.
4. Set your Git identity once on that machine (`git config user.name` / `user.email`, e.g. your GitHub no-reply address), then commit and push as usual.
   Every push to `main` runs the tests and redeploys the game.

Your game progress lives in the browser (localStorage). To carry it over, sign in from the ☁️ Online panel on both machines; the cloud save syncs it.

Design docs for Claude Projects are in [`docs/`](docs/README.md): upload `docs/knowledge/` as Project Knowledge and paste `docs/project-instructions.md` as the Project Instructions.

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
| `src/net/`, `src/ui/` | Supabase client (accounts, cloud save, leaderboard) and the Online panel. Optional: no settings = offline game. `src/ui/theme.ts` is the wood & paper pixel UI kit every HUD and menu draws with. |
| `server/` | Co-op game server (Node + `ws`). Imports `src/core` directly: one movement code for client and server. |
| `docs/` | Design documents (vision, GDD, parks data, progress log), Claude Project instructions, and the prototype `docs/knowledge/game.html`. |
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
| M10 Social Hub | shared plaza on the game server (H from camp): see other hikers live, emotes, party board, parties of 4 (leader picks the trail, everyone readies, all set off into one co-op room), park info centre with real distances | ✅ (needs the game server) |
| UI v2 | wood & paper pixel UI on every screen (HUDs, menus, pack, title, online panel, touch buttons), clickable camp action bar (T hike), journal as an open book (also on the trail: J), big map (Tab), pause (P), HUD warnings, trail switch on the pack screen (Q/E), phone layout fixes | ✅ |
| M11 Stories + events | three camp NPCs (ranger Uncle Kham, cook Auntie Daeng, photographer Fah) with 3-chapter storylines, friendship hearts and story titles; seasonal events on the in-game calendar (Sea of Mist Festival, Hiking Festival, Planting Season) with goals, festival stamps, more fog / bonus photo EXP; rules in `src/core/story.ts`, content in `src/data/story.ts`, text in `src/i18n/story.ts` | ✅ |
| M9 Hosting | game on GitHub Pages (auto-deploy on push, tests run first); co-op server on Render (blueprint in `render.yaml`, Singapore, origin allow-list) | ✅ game live · ✅ server live |

When the port reaches parity (M7), the prototype is retired and this build is what gets published.

## Online (Supabase)

`.env` points at the Supabase project `thailand-wild-trails` (Singapore). The publishable key in it is public by design;
the tables are protected by Row Level Security (see `supabase/migrations/`):

- `saves`: one row per player, readable and writable only by that player.
- `scores`: best time per player per trail. No direct writes; `submit_score()` checks the trail id and the 30 s – 6 h range and keeps the faster time.
- `get_leaderboard()`: public top 10 (plus your own row), returns names and times only, never user ids.

### Log in / Register

`src/ui/authPage.ts` is the account page (form checks in `src/core/auth.ts`, tested). It opens by itself on the first visit
for players who aren't signed in, from the ☁️ chip on the title screen, and from the Online panel (**O**).

- **Log in** with email + password, or **Log in with Google** (Supabase OAuth; the player leaves for Google and comes back signed in).
- **Register** with email + password (at least 8 characters, strength meter, confirm field); Supabase emails a confirmation link.
- **Forgot password** sends a reset link; opening it shows *Set a new password*.
- **Play without an account** closes the page for good on this device (the save stays local); log in later from ☁️.
- If Google isn't switched on in Supabase, the button says so instead of sending players to an error page.
  A failed or cancelled Google sign-in comes back with `?error=…`; the page shows it once and cleans the URL.

Settings that live in the Supabase dashboard (Authentication), not in code:

1. **URL Configuration → Site URL / Redirect URLs**: Site URL `https://pongsathorn11.github.io/thailand-wild-trails/`; add it and
   `http://localhost:5173/` to Redirect URLs. Google sign-in, confirmation emails and password resets all return there.
2. **Sign In / Providers → Google** (for "Log in with Google"):
   - In Google Cloud Console → APIs & Services: set up the OAuth consent screen (External), then Credentials → Create OAuth client ID → *Web application*.
     Authorized JavaScript origins: `https://pongsathorn11.github.io` and `http://localhost:5173`.
     Authorized redirect URI: `https://jfheyrdoxvhjhtlpjccv.supabase.co/auth/v1/callback`.
   - Paste the Client ID and Client Secret into Supabase → Google and enable it. The secret stays in Supabase; it never goes in this repo.
3. Optional, **Sign In / Providers → Allow anonymous sign-ins** for the "Play as guest" button in the Online panel.
4. Optional, **Sign In / Providers → Email → Minimum password length** = 8, to match the game's own check.

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
## Social Hub and parties

Press **H** in camp (or the 🏞️ button) to walk to the **Community Plaza**, a shared map on the same game server as co-op.
Up to 24 hikers per plaza; more open another one.

- **Hikers live:** everyone's chibi, name and title; emotes with **1–4** (👋 📸 ☕ 🚩).
- **Party board** (or the gathering sign, or **P**): start a party or join an open one. Up to 4 per party.
  The leader picks the trail (◀ ▶, from trails the leader has unlocked), members press *I'm ready*, the leader presses *Set off!*.
  Every member then goes to the packing screen for that trail and joins co-op room = party code, so the hike starts together.
- **Park info centre** (**I**): every trail with its park, region and real distance / elevation (`realData`).
- The plaza, its stalls and the info hut are game fiction (`src/data/hub.ts`), kept apart from the parks' real data.
- **Server checks:** clients report their own position 10× a second; the server only accepts moves that a running hiker could
  make and that don't end in trees, stalls or benches, and snaps cheaters back. Party commands are checked on the server
  (only the leader changes the trail or sets off; a party never goes over 4). Rules: `src/core/hub.ts` (tested); server: `server/hub-server.ts`.
- Sign-in works the same as co-op (Supabase token; `COOP_ALLOW_GUESTS=1` for local tests).

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

1. **Render:** done. Blueprint `thailand-wild-trails` → web service `thailand-wild-trails-coop` (https://thailand-wild-trails-coop.onrender.com).
   To recreate it: open https://render.com/deploy?repo=https://github.com/pongsathorn11/thailand-wild-trails, sign in, and approve the blueprint.
   On the free plan the server sleeps after ~15 min without players, so the first co-op join after a pause takes about a minute.
2. **Supabase → Authentication:** URL Configuration and the Google provider, as listed under *Log in / Register* above.
