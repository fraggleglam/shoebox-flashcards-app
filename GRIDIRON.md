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
- **Decks.** Make as many as you want, name them anything, add any card to any number of
  them. Saved automatically.
- **Make your own cards.** Anyone — a coach, a GM, your buddy. Name, team, position, number,
  your own stat lines, and a photo by URL or straight from your camera roll. Uploads get
  resized so they don't blow out browser storage.
- **Search** across names, teams and positions.
- **Export / import** your whole collection as JSON, from the `⋯` menu.

## Where the photos and news come from

Photos use ESPN's public headshot CDN. Each card carries a player ID; if one is stale the
card asks ESPN for the right one, remembers it, and loads the photo from then on. If that
fails too, you get a clean team-colored card with the player's initials — never a broken
image.

The **⟳ Refresh** button on the back of a card pulls current stats and a recent headline
from ESPN's public API. It is strictly a bonus layer: no key, no account, and if the network,
CORS or a firewall says no, the card keeps the content it shipped with and offers a
**Search the news →** link instead. Nothing breaks offline.

> The bundled stat lines are a starting point — accolades and career milestones rather than
> live season numbers. Hit ⟳ for current figures.

## Storage

Everything lives in this browser's `localStorage` under `gridiron.v1`. It survives refreshes
and restarts, but it is per-browser and per-device — clearing site data wipes it. Export
from the `⋯` menu before you clean house.

## Layout

`index.html` is the entire app, organized in numbered sections: teams → seed deck → state →
helpers → render → interactions → decks → editor → live refresh → menu → modals.
