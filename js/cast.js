/* ==========================================================================
   GreenRoom Simulator - cast.js
   The RIGHT half of the setup screen: search, random pick, the search results
   and "Your cast" underneath them (a card for every queen picked).
   Needs js/data/queens.js (loadQueens, QUEENS, QUEENS_URL) loaded first.

   How the search works: nothing is shown until you type. Then only the best
   matches appear (see RESULT_LIMIT), best first. Names that start with what
   you typed come first, then names with a word that starts with it, then
   names that contain it anywhere.

   Sections:
     1. Settings (edit these)
     2. Elements and state
     3. Messages (loading / errors / no results)
     4. Building the cards (results cards and cast cards)
     5. Search and results
     6. Cast changes (add / remove / random / clear)
     7. Refreshing the cast and cards
     8. Predefined casts (the second tab)
     9. Start-up

   Handy in the browser console (F12):
     Cast.get()         ids of the queens picked so far
     Cast.getQueens()   the full queen objects picked so far
     Cast.min / Cast.max   fewest / most queens allowed in the cast
   ========================================================================== */

'use strict';

const Cast = (function () {

  /* ---------- 1. Settings ---------- */
  const CAST_MIN = 8;        // fewest queens you can start a season with
  const CAST_MAX = 14;       // most queens you can pick
  const RESULT_LIMIT = 10;   // search results shown (the grid is 5 wide x 2 tall)
  const SEARCH_DELAY = 120;  // ms to wait after typing before searching
  const START_MESSAGE = 'Start searching to find your cast.';

  // EASTER EGG: type this in the search box to unlock the secret queens
  // (data/bbdrqueens.json). Not case sensitive. Change it to whatever you like.
  // They stay unlocked until the page is closed or refreshed.
  const SECRET_CODE = 'LUCKYS-SECRET-SAUCE';


  /* ---------- 2. Elements and state ---------- */
  const grid        = document.getElementById('queen-grid');
  const message     = document.getElementById('grid-message');
  const searchBox   = document.getElementById('queen-search');
  const randomBtn   = document.getElementById('random-queen');
  const resultsText = document.getElementById('results-count');
  const countText   = document.getElementById('cast-count');
  const castGrid    = document.getElementById('cast-grid');
  const castHint    = document.getElementById('cast-hint');
  const clearBtn    = document.getElementById('cast-clear');
  const continueBtn = document.getElementById('cast-continue');
  const statusText  = document.getElementById('cast-status');

  // The two tabs and the predefined casts tab
  const tabButtons   = Array.from(document.querySelectorAll('.cast-tab'));
  const tabPanels    = { find: document.getElementById('tab-find'), predefined: document.getElementById('tab-predefined') };
  const franchiseBar = document.getElementById('predef-franchises');
  const seasonGrid   = document.getElementById('predef-seasons');
  const predefNote   = document.getElementById('predef-note');

  const cards = new Map();        // queen id -> result card (made on first use)
  const castCards = new Map();    // queen id -> card shown in "Your cast"
  const queensById = new Map();   // queen id -> queen data
  let searchIndex = [];           // [{ queen, text, words }] prepared for searching
  let castIds = [];               // ids picked so far, in order
  let searchTimer = null;
  let secretUnlocked = false;     // true once the code has been typed (this visit only)
  let secretLoading = false;
  let franchises = [];            // predefined casts: [{ id, name, seasons: [{ label, full, num, queens }] }]
  let activeFranchise = null;     // id of the franchise shown on the predefined tab
  let seasonCards = [];           // [{ card, ids }] so the loaded season can be highlighted


  /* ---------- 3. Messages ---------- */
  function showMessage(text) {
    message.textContent = text;
    message.hidden = false;
  }

  function hideMessage() {
    message.hidden = true;
  }


  /* ---------- 4. Building the cards ---------- */
  // Small helper: make an element with a class and optional text
  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  // The photo (or silhouette) part of a card, shared by both kinds of card
  function makePortrait(queen) {
    const portrait = make('span', 'portrait');
    if (queen.image) {
      const img = document.createElement('img');
      img.src = queen.image;
      img.alt = '';
      img.decoding = 'async';
      // Missing photo? Remove the broken image so the silhouette shows instead
      img.addEventListener('error', function () { img.remove(); });
      portrait.appendChild(img);
    }
    return portrait;
  }

  // The name over the bottom of a card. Long names get smaller text so they
  // fit fully, and CamelCase names (ExclamationPoint) may break between words.
  function makeNameLabel(queen) {
    const label = make('span', 'queen-name');
    label.textContent = queen.name.replace(/([a-z\u00E0-\u00FF])([A-Z])/g, '$1\u200B$2');

    // Longest piece that can't be split across lines (pieces end at spaces, hyphens, CamelCase)
    const pieces = queen.name
      .replace(/([a-z\u00E0-\u00FF])([A-Z])/g, '$1 $2')
      .replace(/-/g, '- ')
      .split(/\s+/);
    const longest = Math.max.apply(null, pieces.map(function (piece) { return piece.length; }));

    if (longest >= 12) label.classList.add('is-xlong');
    else if (longest >= 10 || queen.name.length >= 19) label.classList.add('is-long');
    return label;
  }

  // Card in the search results: click to add or remove her
  function makeCard(queen) {
    const card = make('button', 'queen-card');
    card.type = 'button';
    card.dataset.id = queen.id;
    card.title = queen.name;
    card.setAttribute('aria-pressed', 'false');

    // Tick shown on picked queens (drawn in CSS)
    const check = make('span', 'queen-check');
    check.setAttribute('aria-hidden', 'true');

    card.appendChild(makePortrait(queen));
    card.appendChild(makeNameLabel(queen));
    card.appendChild(check);
    return card;
  }

  // Card in "Your cast": same look, click to remove her
  function makeCastCard(queen) {
    const card = make('button', 'queen-card cast-card');
    card.type = 'button';
    card.dataset.id = queen.id;
    card.title = 'Remove ' + queen.name;
    card.setAttribute('aria-label', 'Remove ' + queen.name + ' from cast');

    const x = make('span', 'queen-remove', '\u00D7');
    x.setAttribute('aria-hidden', 'true');

    card.appendChild(makePortrait(queen));
    card.appendChild(makeNameLabel(queen));
    card.appendChild(x);
    return card;
  }

  // The card for a queen: made the first time it is needed, then reused
  function getCard(queen) {
    let card = cards.get(queen.id);
    if (!card) {
      card = makeCard(queen);
      cards.set(queen.id, card);
      syncCard(card, queen.id);
    }
    return card;
  }


  /* ---------- 5. Search and results ---------- */
  // "Shéa Couleé" and "Phi Phi O'Hara" become "shea coulee" and "phi phi ohara",
  // so people can search without typing accents or apostrophes.
  function normalize(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')     // remove accents
      .replace(/['\u2019`.]/g, '');        // remove apostrophes and dots
  }

  // How well a prepared queen matches the search: 0 = best, null = no match
  function matchRank(entry, term) {
    if (entry.text === term) return 0;                                   // exact name
    if (entry.text.indexOf(term) === 0) return 1;                        // name starts with it
    if (entry.words.some(function (word) { return word.indexOf(term) === 0; })) return 2;   // a word starts with it
    if (entry.text.indexOf(term) !== -1) return 3;                       // contains it
    return null;
  }

  // All matches for a search, best first (ties in A-Z order)
  function findMatches(term) {
    const ranked = [];
    searchIndex.forEach(function (entry) {
      const rank = matchRank(entry, term);
      if (rank !== null) ranked.push({ queen: entry.queen, rank: rank });
    });
    ranked.sort(function (a, b) {
      return a.rank - b.rank || a.queen.name.localeCompare(b.queen.name);
    });
    return ranked.map(function (item) { return item.queen; });
  }

  // Put the given queens in the results grid
  function renderResults(queens) {
    const fragment = document.createDocumentFragment();
    queens.forEach(function (queen) { fragment.appendChild(getCard(queen)); });
    grid.textContent = '';
    grid.appendChild(fragment);
  }

  // Add queens to the search (used at start-up, and when the secret code unlocks more)
  function addToIndex(queens) {
    queens.forEach(function (queen) {
      queensById.set(queen.id, queen);
      const text = normalize(queen.name);
      searchIndex.push({ queen: queen, text: text, words: text.split(' ') });
    });
  }

  // The secret code was typed: load the extra queens and tell the player
  function unlockSecret() {
    searchBox.value = '';
    renderResults([]);
    resultsText.textContent = '';

    if (secretUnlocked) { showMessage('The secret queens are already unlocked.'); return; }
    if (secretLoading) return;

    secretLoading = true;
    showMessage('Unlocking\u2026');
    loadBonusQueens().then(function (added) {
      addToIndex(added);
      secretUnlocked = true;
      secretLoading = false;
      const text = 'Secret unlocked! ' + added.length + ' extra queens are now in the search.';
      showMessage(text);
      announce(text);
      refresh();
    }).catch(function (error) {
      secretLoading = false;
      console.error('Cast: could not load the secret queens.', error);
      showMessage("Couldn't load the secret queens (" + error.message + ').');
    });
  }

  function applySearch() {
    const term = normalize(searchBox.value.trim());

    // The secret code (not a search)
    if (term !== '' && term === normalize(SECRET_CODE)) { unlockSecret(); return; }

    // Nothing typed yet: empty results with a prompt
    if (term === '') {
      renderResults([]);
      resultsText.textContent = '';
      showMessage(START_MESSAGE);
      return;
    }

    const matches = findMatches(term);
    renderResults(matches.slice(0, RESULT_LIMIT));

    if (matches.length === 0) {
      resultsText.textContent = '';
      showMessage('No queens match your search. Check the spelling or try fewer letters.');
      return;
    }

    hideMessage();
    if (matches.length > RESULT_LIMIT) {
      resultsText.textContent = 'Showing the top ' + RESULT_LIMIT + ' of ' + matches.length +
                                ' matches. Keep typing to narrow it down.';
    } else {
      resultsText.textContent = matches.length === 1 ? '1 match' : matches.length + ' matches';
    }
  }


  /* ---------- 6. Cast changes ---------- */
  function isInCast(id) { return castIds.indexOf(id) !== -1; }
  function isFull()     { return castIds.length >= CAST_MAX; }

  function announce(text) { statusText.textContent = text; }

  function add(id) {
    if (isInCast(id) || isFull()) return false;
    castIds.push(id);
    refresh();
    announce('Added ' + queensById.get(id).name + '. ' + castIds.length + ' in your cast.');
    return true;
  }

  function remove(id) {
    if (!isInCast(id)) return;
    castIds = castIds.filter(function (castId) { return castId !== id; });
    refresh();
    announce('Removed ' + queensById.get(id).name + '. ' + castIds.length + ' in your cast.');
  }

  function toggle(id) {
    if (isInCast(id)) remove(id); else add(id);
  }

  function clear() {
    castIds = [];
    refresh();
    announce('Cast cleared.');
  }

  function addRandom() {
    if (isFull()) return;
    const pool = QUEENS.filter(function (queen) { return !isInCast(queen.id); });
    if (pool.length === 0) return;

    const pick = pool[Math.floor(Math.random() * pool.length)];
    add(pick.id);

    // If her card happens to be in the results, give it a little pop
    const card = cards.get(pick.id);
    if (card && card.isConnected) {
      card.classList.add('just-added');
      card.addEventListener('animationend', function () {
        card.classList.remove('just-added');
      }, { once: true });
    }
  }


  /* ---------- 7. Refreshing the cast and cards ---------- */
  // Make one card show whether its queen is picked (and lock it if the cast is full)
  function syncCard(card, id) {
    const selected = isInCast(id);
    card.classList.toggle('is-selected', selected);
    card.setAttribute('aria-pressed', selected ? 'true' : 'false');
    card.disabled = isFull() && !selected;
  }

  // The line of help under the "Your cast" title
  function hintText() {
    const n = castIds.length;
    if (n === 0) {
      return 'Pick ' + CAST_MIN + ' to ' + CAST_MAX + ' queens. Search for one or hit Random queen.';
    }
    if (n < CAST_MIN) {
      const more = CAST_MIN - n;
      return 'Pick ' + more + ' more queen' + (more === 1 ? '' : 's') + ' to continue. Click a card to remove them.';
    }
    if (n < CAST_MAX) {
      return 'You can continue, or add up to ' + (CAST_MAX - n) + ' more. Click a card to remove them.';
    }
    return 'Your cast is full. Click a card to remove them.';
  }

  // Draw "Your cast": a card for each queen picked (the box grows as she is added)
  function renderCast() {
    const fragment = document.createDocumentFragment();

    castIds.forEach(function (id) {
      let card = castCards.get(id);
      if (!card) {
        card = makeCastCard(queensById.get(id));
        castCards.set(id, card);
      }
      fragment.appendChild(card);
    });

    castGrid.textContent = '';
    castGrid.appendChild(fragment);
    castHint.textContent = hintText();
  }

  function refresh() {
    const full = isFull();

    cards.forEach(function (card, id) { syncCard(card, id); });

    renderCast();
    countText.textContent = castIds.length + ' / ' + CAST_MAX;
    randomBtn.disabled = full || QUEENS.length === 0;
    clearBtn.disabled = castIds.length === 0;
    continueBtn.disabled = castIds.length < CAST_MIN;
    syncSeasonCards();
  }


  /* ---------- 8. Predefined casts (the second tab) ----------
     Built from the "seasons" codes in queens.json, so nothing is typed in by
     hand. Codes it understands (spaces and dashes don't matter):
       US 5 / US S5 / US5      -> US, Season 5
       US AS5 / USAS5          -> US All Stars 5
       UK 1 / UK S1            -> UK, Series 1
       CAN 6 / CAN S6          -> Canada, Season 6
     Any other code like "AUS S1" gets its own franchise button, named from the
     letters in front of the number. To add a nicer name or order for one,
     add a row to FRANCHISES. */
  const FRANCHISES = [
    { id: 'us',           name: 'US',           test: /^US\s*-?\s*S?\s*(\d+)$/i,          label: 'Season ',     full: 'US Season ' },
    { id: 'us-all-stars', name: 'US All Stars', test: /^US\s*-?\s*AS\s*-?\s*(\d+)$/i,     label: 'All Stars ',  full: 'US All Stars ' },
    { id: 'uk',           name: 'UK',           test: /^UK\s*-?\s*S?\s*(\d+)$/i,          label: 'Series ',     full: 'UK Series ' },
    { id: 'canada',       name: 'Canada',       test: /^CAN(?:ADA)?\s*-?\s*S?\s*(\d+)$/i, label: 'Season ',     full: 'Canada Season ' }
  ];

  // "US AS5" -> { id, name, order, num, label, full }, or null if it has no number
  function parseSeason(code) {
    const text = String(code).trim();
    for (let i = 0; i < FRANCHISES.length; i++) {
      const match = FRANCHISES[i].test.exec(text);
      if (match) {
        const f = FRANCHISES[i];
        return { id: f.id, name: f.name, order: i, num: parseInt(match[1], 10),
                 label: f.label + match[1], full: f.full + match[1] };
      }
    }
    const num = /(\d+)\s*$/.exec(text);
    if (!num) return null;
    const prefix = text.replace(/\d+\s*$/, '').replace(/[\s-]+S$/i, '').replace(/[\s-]+$/, '').trim();
    if (!prefix) return null;
    return { id: 'x-' + prefix.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: prefix, order: 99,
             num: parseInt(num[1], 10), label: 'Season ' + num[1], full: prefix + ' Season ' + num[1] };
  }

  // Group every queen into franchise -> season
  function buildFranchises(queens) {
    const byFranchise = new Map();
    queens.forEach(function (queen) {
      (queen.seasons || []).forEach(function (code) {
        const p = parseSeason(code);
        if (!p) return;
        let fr = byFranchise.get(p.id);
        if (!fr) { fr = { id: p.id, name: p.name, order: p.order, seasonMap: new Map() }; byFranchise.set(p.id, fr); }
        let season = fr.seasonMap.get(p.num);
        if (!season) { season = { num: p.num, label: p.label, full: p.full, queens: [] }; fr.seasonMap.set(p.num, season); }
        if (season.queens.indexOf(queen) === -1) season.queens.push(queen);
      });
    });

    const list = Array.from(byFranchise.values()).map(function (fr) {
      return { id: fr.id, name: fr.name, order: fr.order,
               seasons: Array.from(fr.seasonMap.values()).sort(function (a, b) { return a.num - b.num; }) };
    });
    list.sort(function (a, b) { return a.order - b.order || a.name.localeCompare(b.name); });
    return list;
  }

  // Replace the cast with a real season's queens
  function loadSeason(season) {
    const ids = season.queens.map(function (queen) { return queen.id; });
    castIds = ids.slice(0, CAST_MAX);
    refresh();

    const left = ids.length - castIds.length;
    const text = season.full + ' loaded: ' + castIds.length + ' queens.' +
      (left > 0 ? ' ' + left + ' left out (the cast limit is ' + CAST_MAX + ').' : '') +
      ' Switch to Find your cast to add more queens.';
    predefNote.textContent = text;
    announce(text);
  }

  // A season button: its name and how many queens (hover for the names)
  function makeSeasonCard(season) {
    const card = make('button', 'season-card');
    card.type = 'button';
    card.setAttribute('aria-pressed', 'false');
    card.appendChild(make('span', 'season-name', season.label));
    card.appendChild(make('span', 'season-count', season.queens.length + ' queens'));

    card.title = season.full + ': ' + season.queens.map(function (q) { return q.name; }).join(', ');
    card.addEventListener('click', function () { loadSeason(season); });
    return card;
  }

  // Highlight the season whose queens are exactly your cast
  function syncSeasonCards() {
    seasonCards.forEach(function (entry) {
      const wanted = entry.ids.slice(0, CAST_MAX);
      const on = castIds.length === wanted.length && wanted.every(isInCast);
      entry.card.classList.toggle('is-active', on);
      entry.card.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function renderFranchiseBar() {
    franchiseBar.textContent = '';
    franchises.forEach(function (fr) {
      const b = make('button', 'franchise-pill', fr.name);
      b.type = 'button';
      b.dataset.id = fr.id;
      b.setAttribute('aria-pressed', String(fr.id === activeFranchise));
      b.addEventListener('click', function () { showFranchise(fr.id); });
      franchiseBar.appendChild(b);
    });
  }

  function showFranchise(id) {
    activeFranchise = id;
    renderFranchiseBar();
    const fr = franchises.find(function (f) { return f.id === id; });
    seasonGrid.textContent = '';
    seasonCards = [];
    if (!fr) return;
    const fragment = document.createDocumentFragment();
    fr.seasons.forEach(function (season) {
      const card = makeSeasonCard(season);
      seasonCards.push({ card: card, ids: season.queens.map(function (q) { return q.id; }) });
      fragment.appendChild(card);
    });
    seasonGrid.appendChild(fragment);
    syncSeasonCards();
  }

  function startPredefined() {
    franchises = buildFranchises(QUEENS);
    if (franchises.length === 0) {
      predefNote.textContent = 'No seasons were found in ' + QUEENS_URL + '.';
      return;
    }
    predefNote.textContent = 'Pick a season to use its cast. It replaces your current cast, and you can add more queens afterwards.';
    showFranchise(franchises[0].id);
  }

  // Switch between the two tabs ("Your cast" below them never changes)
  function showTab(name) {
    tabButtons.forEach(function (button) {
      button.setAttribute('aria-selected', String(button.dataset.tab === name));
    });
    Object.keys(tabPanels).forEach(function (key) { tabPanels[key].hidden = key !== name; });
  }


  /* ---------- 9. Start-up ---------- */
  // Runs once the queen data has loaded
  function start() {
    searchIndex = [];
    addToIndex(QUEENS);
    applySearch();
    startPredefined();
    refresh();
  }

  function showLoadError(error) {
    console.error('Cast: could not load the queens.', error);
    showMessage(
      "Couldn't load the queens (" + error.message + '). Check that ' + QUEENS_URL +
      ' exists, and open the site through a web server (GitHub Pages or VS Code Live Server), ' +
      'not by double-clicking index.html.'
    );
    resultsText.textContent = '';
  }

  function init() {
    refresh();
    showMessage('Loading queens\u2026');
    loadQueens().then(start).catch(showLoadError);

    // Click a result card to add/remove that queen
    grid.addEventListener('click', function (event) {
      const card = event.target.closest('.queen-card');
      if (card && !card.disabled) toggle(card.dataset.id);
    });

    // Click a card in "Your cast" to remove that queen
    castGrid.addEventListener('click', function (event) {
      const card = event.target.closest('.cast-card');
      if (card) remove(card.dataset.id);
    });

    // Search: wait a moment after typing stops, so big lists stay smooth
    searchBox.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(applySearch, SEARCH_DELAY);
    });
    searchBox.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {          // Escape clears the search box
        clearTimeout(searchTimer);
        searchBox.value = '';
        if (searchIndex.length) applySearch();
      }
    });

    tabButtons.forEach(function (button) {
      button.addEventListener('click', function () { showTab(button.dataset.tab); });
    });
    predefNote.textContent = 'Loading casts\u2026';

    randomBtn.addEventListener('click', addRandom);
    clearBtn.addEventListener('click', clear);

    // Placeholder: later steps will start the season from here
    continueBtn.addEventListener('click', function () {
      console.log('Cast ready:', castIds);
    });
  }

  return {
    init: init,
    get: function () { return castIds.slice(); },
    getQueens: function () { return castIds.map(function (id) { return queensById.get(id); }); },
    min: CAST_MIN,
    max: CAST_MAX
  };

})();
