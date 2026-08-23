# 🏈 Gridiron — NFL Flash Cards

Old-school bubblegum football cards, on your phone. Tap a card to flip it: photo on the
front, stats and the latest news on the back. Build decks of anything — starters, rookies,
coaches, your fantasy roster, your group chat.

## Open it

One file, no build step, no API keys, no install.

```bash
open index.html          # or just double-click it
```

Want a local server instead:

```bash
python3 -m http.server 8000     # → http://localhost:8000
```

To put it on the web, drag this folder into Netlify — it's a static page, nothing to configure.

## What's in it

- **37 cards to start** — quarterbacks, skill players, defenders and head coaches, ready on
  first open.
- **Tap to flip.** Front is the photo, the team colors, the jersey number and a position
  pennant. Back is the card number, bio line, stat table, a "did you know," and a news box
  where the old trivia cartoon used to live.
- **Two ways to look at them.** The grid lays the whole collection out. The **stack** (`▤` in
  the top bar) hands you one card at a time with the rest of the pile behind it — see below.
- **Scout anybody, mid-game.** Somebody you've never heard of just caught a pass? Type his
  name. If your collection doesn't know him, one tap pulls his card straight out of ESPN —
  photo, bio, live stats, latest headline — and files it, so next time he's already local.
  Also in the `⋯` menu as **🔎 Scout a player**.
- **Team decks in two taps.** `⋯` menu → **🏟 Deal a team deck** → pick a team and a side
  (Offense / Defense / Full squad, coach included) and the deck deals itself, sorted the way
  a program would print it. Deal it again after a league import and it refreshes in place.
- **Decks.** Make as many as you want, name them anything, add any card to any number of
  them. Saved automatically.
- **Make your own cards.** Anyone — a coach, a GM, your buddy. Name, team, position, number,
  your own stat lines, and a photo by URL or straight from your camera roll. Uploads get
  resized so they don't blow out browser storage.
- **Search** across names, teams and positions.
- **Export / import** your whole collection as JSON, from the `⋯` menu.

## The stack

Hit `▤` in the top bar and the grid becomes a pile of cards, one face up, the next two
peeking out behind it. It's the shoebox on the floor rather than the binder on the shelf.

- **Drag it left to pass, right to file it.** A `PASS`/`FILE` stamp fades in as you go, and
  the card only commits once you're past the line — let go short of it and it springs back.
- **"Filing into"** at the top picks which deck a right-swipe drops the card into. Change it
  mid-run, or make a new deck straight from the picker. Sorting a hundred cards into three
  piles takes about a minute.
- **Tap the card to flip it**, same as the grid. A press that barely moves is a tap; a press
  that travels is a swipe.
- **⟲ puts the last one back**, card and deck membership both.
- **Keyboard:** `←` pass, `→` file, `space` flip, `backspace` undo.
- The deck chips still filter, so you can flip through just one deck — or search first and
  sort only what comes back.

Nothing here is destructive: passing a card does nothing to it, and filing only ever adds.

## Get the real deck

Out of the box the app runs on a small deck written into `index.html`. To get the real
thing — every team, real headshots, real bios — open the `⋯` menu and pick
**🏈 Import the league from ESPN**.

It pulls all 32 rosters and coaching staffs, stores every headshot in this browser's
IndexedDB, and swaps the deck. Choose how deep you want to go (16 per team ≈ 550 cards, or
everybody on every roster). Cards you made yourself are kept, and your decks follow the
players across by name.

**After the import the app never fetches a photo again.** Reload it, go offline, get on a
plane — the deck is on your device. The only thing that ever touches the network from then
on is the news button, and only when you press it.

### Or from a terminal

Same job, useful for CI and for Netlify builds:

```bash
node scripts/bake-cards.mjs
```

It pulls rosters and coaching staffs from ESPN's public endpoints, downloads the headshots,
and writes `data/cards.js` plus `data/photos/`. The app picks them up next time you open it.
Node 18+, no dependencies, no API key, no auth.

```bash
node scripts/bake-cards.mjs --all          # every player with a headshot, not just 16/team
node scripts/bake-cards.mjs --per-team 24
node scripts/bake-cards.mjs --teams kc,sf,phi
node scripts/bake-cards.mjs --no-photos    # facts only, keep remote image URLs
```

**After the bake, the app fetches nothing but news.** Photos and bios live on disk. Re-run it
each season — the app notices the new deck, adopts it, and carries your decks and your
hand-made cards across by name.

`data/notes.json` holds the hand-written flavour — the "did you know" line and the scouting
note — keyed by player name. The bake grafts it onto the fetched facts, so re-baking never
overwrites your voice. Add anyone you like.

### The things that stay live

**⟳ Refresh** on the back of a card pulls a recent headline, and **Scout** pulls a card for
someone you don't have yet. Those are the only runtime network calls, they happen only when
you ask, and when they fail the deck you have is untouched. Nothing breaks offline.

### A note on the photos

These are NFL/Getty images. `data/photos/` and `data/cards.js` are gitignored on purpose —
caching them on your own machine is one thing, but this repo is public and committing a few
hundred of them is republishing. Netlify re-bakes at deploy time (`netlify.toml`), so
production still gets the photos without them entering git. Building something private and
want them committed? Delete those two lines from `.gitignore`.

### If ESPN changes

These endpoints are undocumented and can move without warning. If a bake starts coming back
empty, the app keeps running on whatever it baked last — and on the built-in deck if there
never was one. Nothing about a failed bake breaks the app.

## Storage

Card text, decks and your own cards live in `localStorage` under `gridiron.v1`. Headshots are
far too big for that, so they go in IndexedDB (`gridiron` → `photos`) as blobs, mounted as
object URLs at startup — before the first paint, so the browser never reaches for a photo it
already has.

Both survive refreshes and restarts, but they are per-browser and per-device. Clearing site
data wipes them. Export from the `⋯` menu before you clean house. (Firestore sync is the
obvious next step here, and would make this paragraph shorter.)

## Layout

`index.html` is the entire app, organized in numbered sections: teams → seed deck → state →
helpers → photo vault → render → interactions → **the stack** → decks → editor → live
refresh → league import → menu → modals.
