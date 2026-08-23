# Shoebox Flashcards

Flash card apps, kept in one shoebox.

## 🏈 Gridiron — NFL Flash Cards

Old-school bubblegum football cards. Tap a card to flip it: photo on the front, stats and
the latest news on the back. Somebody you've never heard of just made a play? Type his name
and scout his card straight out of ESPN. Switch to the stack and thumb through them one at a
time — drag left to pass, right to file into a deck. Deal a whole team's offense into its
own deck in two taps.

One file, no build step, no API keys: open [`index.html`](index.html) and it runs.

**[Full documentation → GRIDIRON.md](GRIDIRON.md)**

### Live site

One manual step, because a workflow token is not permitted to create a Pages site:

**Settings → Pages → Build and deployment → Source: _GitHub Actions_**

That's all of it. Every push to `main` then deploys automatically to
https://fraggleglam.github.io/shoebox-flashcards-app/

(*Deploy from a branch* → `main` → `/ (root)` also works — `.nojekyll` is there for it —
but then delete `.github/workflows/pages.yml`, or it will fail on every push.)
