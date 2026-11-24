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
     8. Start-up

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
  const SECRET_CODE = 'secret';


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

  const cards = new Map();        // queen id -> result card (made on first use)
  const castCards = new Map();    // queen id -> card shown in "Your cast"
  const queensById = new Map();   // queen id -> queen data
  let searchIndex = [];           // [{ queen, text, words }] prepared for searching
  let castIds = [];               // ids picked so far, in order
  let searchTimer = null;
  let secretUnlocked = false;     // true once the code has been typed (this visit only)
  let secretLoading = false;


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
  }


  /* ---------- 8. Start-up ---------- */
  // Runs once the queen data has loaded
  function start() {
    searchIndex = [];
    addToIndex(QUEENS);
    applySearch();
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
