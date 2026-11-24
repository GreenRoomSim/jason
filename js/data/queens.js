/* ==========================================================================
   GreenRoom Simulator - data/queens.js
   Loads the queen database (data/queens.json) and turns each entry into the
   shape the rest of the app uses.

   Sections:
     1. Settings (folder names, stat list)
     2. Loading and checking the data
     3. Secret bonus queens (loaded only when the secret code is typed, see cast.js)
   Plain script (no modules): IMAGE_FOLDER, QUEENS_URL, STATS, STAT_MAX,
   QUEENS and loadQueens() are global.

   ---- What data/queens.json looks like ----
     { "queens": [
         {
           "name":    "Akashia",
           "image":   "akashia.webp",          file inside the queens/ photo folder
           "seasons": ["US S1"],               every season she has been on
           "stats":   [4, 4, 7, 4, 8]          one number (1-10) per stat in STATS
         }
     ] }

   ---- What the rest of the app gets (each item in QUEENS) ----
     {
       id:      'akashia',                      the image name without .webp (unique)
       name:    'Akashia',
       image:   'queens/akashia.webp',          full path, ready for <img src>
       seasons: ['US S1'],
       stats:   { comedy: 4, design: 4, performance: 7, acting: 4, lipSync: 8 }
     }
   ========================================================================== */

'use strict';


/* ---------- 1. Settings ---------- */

const IMAGE_FOLDER = 'queens/';           // photo folder, next to index.html
const QUEENS_URL   = 'data/queens.json';  // the queen database

/* Secret bonus queens (the easter egg). Same format as queens.json. They are
   only fetched when the secret code is typed in the search box (the code is
   SECRET_CODE at the top of js/cast.js). Their photos live in BONUS_IMAGE_FOLDER. */
const BONUS_QUEENS_URL   = 'data/bbdrqueens.json';
const BONUS_IMAGE_FOLDER = IMAGE_FOLDER;      // change if the bonus photos are in another folder

/* The stats every queen has.
   IMPORTANT: the ORDER here must match the order of the numbers in each
   queen's "stats" list in queens.json.
   key = used in code, label = shown on screen. */
const STATS = [
  { key: 'comedy',      label: 'Comedy' },
  { key: 'design',      label: 'Design' },
  { key: 'performance', label: 'Performance' },
  { key: 'acting',      label: 'Acting' },
  { key: 'lipSync',     label: 'Lip sync' }
];

/* Highest value a stat can have (bars on the cards are drawn against this). */
const STAT_MAX = 10;

/* Filled in by loadQueens(). */
const QUEENS = [];


/* ---------- 2. Loading and checking the data ---------- */

// Turn one raw entry from the JSON into a queen, or null if it is unusable.
function toQueen(raw, position, folder, source) {
  folder = folder || IMAGE_FOLDER;
  source = source || 'queens.json';
  const where = source + ' entry #' + (position + 1) + (raw && raw.name ? ' (' + raw.name + ')' : '');

  if (!raw || typeof raw.name !== 'string' || raw.name.trim() === '') {
    console.warn(where + ': skipped, no name.');
    return null;
  }
  if (!Array.isArray(raw.stats) || raw.stats.length !== STATS.length ||
      !raw.stats.every(function (n) { return typeof n === 'number'; })) {
    console.warn(where + ': skipped, "stats" must be a list of ' + STATS.length + ' numbers.');
    return null;
  }

  const stats = {};
  STATS.forEach(function (stat, i) { stats[stat.key] = raw.stats[i]; });

  const hasImage = typeof raw.image === 'string' && raw.image !== '';
  const id = hasImage
    ? raw.image.replace(/\.[^.]+$/, '')                                       // akashia.webp -> akashia
    : raw.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return {
    id: id,
    name: raw.name.trim(),
    image: hasImage ? folder + raw.image : null,
    seasons: Array.isArray(raw.seasons) ? raw.seasons : [],
    stats: stats
  };
}

// Fetch queens.json and fill QUEENS. Returns a Promise.
function loadQueens() {
  return fetch(QUEENS_URL)
    .then(function (response) {
      if (!response.ok) {
        throw new Error('could not load ' + QUEENS_URL + ' (error ' + response.status + ')');
      }
      return response.json();
    })
    .then(function (data) {
      const list = Array.isArray(data) ? data : data.queens;
      if (!Array.isArray(list)) {
        throw new Error(QUEENS_URL + ' needs a "queens" list');
      }

      QUEENS.length = 0;
      const seen = new Set();

      list.forEach(function (raw, position) {
        const queen = toQueen(raw, position);
        if (!queen) return;
        if (seen.has(queen.id)) {
          console.warn('queens.json: skipped a second "' + queen.id + '" (every image/name must be unique).');
          return;
        }
        seen.add(queen.id);
        QUEENS.push(queen);
      });

      if (QUEENS.length === 0) throw new Error(QUEENS_URL + ' has no usable queens');
      return QUEENS;
    });
}


/* ---------- 3. Secret bonus queens ----------
   Fetches the bonus file and ADDS its queens to QUEENS (skipping any id that
   is already there). Returns a Promise of the list of queens that were added.
   Nothing is saved: they only exist until the page is closed or refreshed. */
function loadBonusQueens() {
  return fetch(BONUS_QUEENS_URL)
    .then(function (response) {
      if (!response.ok) {
        throw new Error('could not load ' + BONUS_QUEENS_URL + ' (error ' + response.status + ')');
      }
      return response.json();
    })
    .then(function (data) {
      const list = Array.isArray(data) ? data : data.queens;
      if (!Array.isArray(list)) throw new Error(BONUS_QUEENS_URL + ' needs a "queens" list');

      const seen = new Set(QUEENS.map(function (queen) { return queen.id; }));
      const added = [];

      list.forEach(function (raw, position) {
        const queen = toQueen(raw, position, BONUS_IMAGE_FOLDER, BONUS_QUEENS_URL);
        if (!queen) return;
        if (seen.has(queen.id)) {
          console.warn(BONUS_QUEENS_URL + ': skipped a second "' + queen.id + '" (every image/name must be unique).');
          return;
        }
        seen.add(queen.id);
        QUEENS.push(queen);
        added.push(queen);
      });

      if (added.length === 0) throw new Error(BONUS_QUEENS_URL + ' has no usable queens');
      return added;
    });
}
