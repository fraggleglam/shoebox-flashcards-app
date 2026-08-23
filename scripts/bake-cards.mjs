#!/usr/bin/env node
/**
 * bake-cards.mjs — turn ESPN's public endpoints into a deck that ships with the app.
 *
 * Run this once (and again each season). It writes:
 *
 *   data/cards.js      every card's facts, as a plain <script> the app loads
 *   data/photos/*.png  the actual headshots, on disk
 *
 * After that the app never fetches a photo or a stat again. The only thing that
 * ever touches the network at runtime is the news lookup, on demand.
 *
 *   node scripts/bake-cards.mjs                 # ~16 players per team, plus coaches
 *   node scripts/bake-cards.mjs --all           # every player with a headshot
 *   node scripts/bake-cards.mjs --per-team 24
 *   node scripts/bake-cards.mjs --teams kc,sf,phi
 *   node scripts/bake-cards.mjs --no-photos     # facts only, keep remote URLs
 *   node scripts/bake-cards.mjs --year 2026
 *
 * Node 18+. No dependencies, no API key, no auth.
 */

import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT   = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_JS = join(ROOT, 'data', 'cards.js');
const PHOTOS = join(ROOT, 'data', 'photos');
const NOTES  = join(ROOT, 'data', 'notes.json');

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const CORE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl';
const CDN  = 'https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full';

/* ---------------------------------------------------------------- options */
const argv = process.argv.slice(2);
const flag = n => argv.includes(`--${n}`);
const opt  = (n, d) => { const i = argv.indexOf(`--${n}`); return i > -1 ? argv[i + 1] : d; };

const OPTS = {
  all:      flag('all'),
  photos:  !flag('no-photos'),
  perTeam:  parseInt(opt('per-team', '16'), 10),
  teams:    opt('teams', '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  year:     opt('year', String(new Date().getFullYear())),
  width:    parseInt(opt('width', '350'), 10)
};

/* Which positions earn a card first when we're not taking everybody.
   Skill players and pass rushers make better trading cards than guards. */
const PRIORITY = ['QB','RB','WR','TE','FB','DE','EDGE','LB','OLB','ILB','MLB',
                  'CB','S','FS','SS','DT','NT','K','P','OT','G','C','LS'];

/* ---------------------------------------------------------------- plumbing */
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: 'application/json' } });
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
      throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      if (i === tries - 1) { warn(`  ${url}\n  ↳ ${e.message}`); return null; }
      await sleep(400 * (i + 1));
    }
  }
}

/** Run tasks with a ceiling on how many are in flight at once. */
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

let warnings = 0;
const warn = m => { warnings++; console.warn(`  ! ${m}`); };
const step = m => console.log(m);

/* ---------------------------------------------------------------- fetching */
async function fetchTeams() {
  const j = await getJSON(`${SITE}/teams`);
  const raw = j?.sports?.[0]?.leagues?.[0]?.teams ?? [];
  return raw
    .map(t => t.team)
    .filter(Boolean)
    .map(t => ({
      id: String(t.id),
      abbrev: String(t.abbreviation || '').toUpperCase(),
      name: t.name || t.displayName,
      location: t.location || '',
      color: t.color ? `#${t.color}` : '#333333',
      alt: t.alternateColor ? `#${t.alternateColor}` : '#888888',
      logo: t.logos?.[0]?.href || null
    }))
    .filter(t => t.abbrev)
    .filter(t => !OPTS.teams.length || OPTS.teams.includes(t.abbrev.toLowerCase()));
}

/** ESPN groups the roster by offense/defense/specialTeam — flatten it. */
function flattenAthletes(payload) {
  const groups = payload?.athletes;
  if (!Array.isArray(groups)) return [];
  return groups.flatMap(g => (Array.isArray(g?.items) ? g.items : (g?.id ? [g] : [])));
}

async function fetchRoster(team) {
  const j = await getJSON(`${SITE}/teams/${team.abbrev.toLowerCase()}/roster`);
  if (!j) { warn(`no roster for ${team.abbrev}`); return []; }

  let players = flattenAthletes(j)
    .filter(a => a?.id && (a.fullName || a.displayName))
    .map(a => ({
      id: `espn_${a.id}`,
      espnId: String(a.id),
      name: a.fullName || a.displayName,
      role: 'player',
      team: team.abbrev,
      pos: (a.position?.abbreviation || '').toUpperCase(),
      jersey: a.jersey ?? '',
      photoRemote: a.headshot?.href || `${CDN}/${a.id}.png&w=${OPTS.width}&h=254`,
      bio: [a.displayHeight, a.displayWeight, a.college?.name].filter(Boolean).join(' · '),
      stats: [
        ['Age', a.age],
        ['Experience', a.experience?.years != null
          ? (a.experience.years === 0 ? 'Rookie' : `${a.experience.years} yrs`) : null],
        ['College', a.college?.name],
        ['Drafted', a.draft?.displayText]
      ].filter(([, v]) => v != null && v !== '').map(([k, v]) => ({ k, v: String(v) }))
    }))
    .filter(p => p.pos);

  if (!OPTS.all) {
    const rank = p => { const i = PRIORITY.indexOf(p.pos); return i === -1 ? 99 : i; };
    players.sort((a, b) => rank(a) - rank(b));
    players = players.slice(0, OPTS.perTeam);
  }
  return players;
}

/** Coaches live on the core API behind $ref links, and many lack headshots. */
async function fetchCoaches(team) {
  const idx = await getJSON(`${CORE}/seasons/${OPTS.year}/teams/${team.id}/coaches`);
  const refs = (idx?.items ?? []).map(i => i.$ref).filter(Boolean).slice(0, 2);
  if (!refs.length) return [];

  const people = await pool(refs, 2, ref => getJSON(ref.replace(/^http:/, 'https:')));
  return people.filter(Boolean).map(c => {
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.displayName;
    if (!name) return null;
    return {
      id: `coach_${c.id ?? `${team.abbrev}_${name.replace(/\W+/g, '')}`}`,
      espnId: c.id ? String(c.id) : null,
      name,
      role: 'coach',
      team: team.abbrev,
      pos: 'HC',
      jersey: '',
      photoRemote: c.headshot?.href || null,   // often missing — app falls back
      bio: `Head Coach · ${team.location} ${team.name}`.trim(),
      stats: [
        ['Experience', c.experience?.years != null ? `${c.experience.years} yrs` : null],
        ['Record', c.record?.displayValue]
      ].filter(([, v]) => v != null && v !== '').map(([k, v]) => ({ k, v: String(v) }))
    };
  }).filter(Boolean);
}

/* ---------------------------------------------------------------- photos */
async function downloadPhoto(card) {
  if (!OPTS.photos || !card.photoRemote) return null;
  const file = `${card.espnId || card.id}.png`;
  const path = join(PHOTOS, file);

  try { if ((await stat(path)).size > 512) return `data/photos/${file}`; } catch {}

  // The combiner resizes for us — much smaller than the full-size PNG.
  const url = card.espnId
    ? `${CDN}/${card.espnId}.png&w=${OPTS.width}&h=254`
    : card.photoRemote;

  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 512) return null;            // ESPN's "no photo" placeholder
    await writeFile(path, buf);
    return `data/photos/${file}`;
  } catch (e) {
    warn(`photo failed for ${card.name}: ${e.message}`);
    return null;
  }
}

/* ---------------------------------------------------------------- main */
async function main() {
  console.log('\n🏈  Baking Gridiron cards from ESPN\n');

  await mkdir(PHOTOS, { recursive: true });

  // Hand-written flavour, kept separate from the auto-fetched facts so a
  // re-bake never clobbers your voice. Keyed by player name.
  let notes = {};
  try { notes = JSON.parse(await readFile(NOTES, 'utf8')); }
  catch { step('  (no data/notes.json — cards will ship facts only)'); }

  step('→ teams');
  const teams = await fetchTeams();
  if (!teams.length) {
    console.error('\n✖ Could not reach ESPN. Check your connection and try again.\n');
    process.exit(1);
  }
  step(`  ${teams.length} teams`);

  step('→ rosters');
  const rosters = await pool(teams, 4, async t => {
    const players = await fetchRoster(t);
    process.stdout.write(`  ${t.abbrev} ${players.length}\n`);
    return players;
  });

  step('→ coaches');
  const staffs = await pool(teams, 4, t => fetchCoaches(t));

  const cards = [...rosters.flat(), ...staffs.flat()];
  step(`  ${cards.length} cards total`);

  if (OPTS.photos) {
    step(`→ photos (${OPTS.width}px wide)`);
    let done = 0, got = 0;
    await pool(cards, 6, async card => {
      card.photo = await downloadPhoto(card);
      if (card.photo) got++;
      if (++done % 25 === 0) process.stdout.write(`  ${done}/${cards.length}\n`);
    });
    step(`  ${got} photos on disk, ${cards.length - got} will use the initials fallback`);
  }

  // number them like a real set, and graft on any hand-written notes
  cards.forEach((c, i) => {
    c.no = i + 1;
    const n = notes[c.name];
    if (n) { c.honors = n.honors || ''; c.note = n.note || ''; }
    // --no-photos keeps the remote URLs, as promised up top: browsers can
    // load ESPN's image CDN as plain <img> even where the data API is
    // walled off, so a facts-only bake still gets faces on the cards.
    if (OPTS.photos) delete c.photoRemote;
  });

  const teamMap = Object.fromEntries(teams.map(t =>
    [t.abbrev, { name: t.name, c1: t.color, c2: t.alt, logo: t.logo }]));

  const banner =
    `/* Generated by scripts/bake-cards.mjs — do not edit by hand.\n` +
    `   ${cards.length} cards · ${teams.length} teams · season ${OPTS.year}\n` +
    `   Re-run: node scripts/bake-cards.mjs */\n`;

  await writeFile(OUT_JS,
    `${banner}window.GRIDIRON_TEAMS = ${JSON.stringify(teamMap)};\n` +
    `window.GRIDIRON_CARDS = ${JSON.stringify(cards)};\n`);

  const kb = Math.round((await stat(OUT_JS)).size / 1024);
  console.log(`\n✓ data/cards.js — ${cards.length} cards, ${kb} KB`);
  if (OPTS.photos) console.log(`✓ data/photos/`);
  if (warnings) console.log(`  ${warnings} warning(s) above — usually missing coach headshots, which is expected.`);
  console.log('\nOpen index.html. The deck is now local.\n');
}

main().catch(e => { console.error('\n✖', e); process.exit(1); });
