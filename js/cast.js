/* ==========================================================================
   GreenRoom Simulator - cast.js
   The RIGHT half of the setup screen: search, random pick, the search results
   and "Your cast" underneath them.
   Needs js/data/queens.js (loadQueens, QUEENS, QUEENS_URL) loaded first.

   How the search works: nothing is shown until you type. Then only the best
   matches appear (see RESULT_LIMIT), best first. Names that start with what
   you typed come first, then names with a word that starts with it, then
   names that contain it anywhere.

   Sections:
     1. Settings (edit these)
     2. Elements and state
     3. Messages (loading / errors / no results)
     4. Building the cards
     5. Search and results
     6. Cast changes (add / remove / random / clear)
     7. Refreshing the cast and cards
     8. Start-up

   Handy in the browser console (F12):
     Cast.get()         ids of the queens picked so far
     Cast.getQueens()   the full queen objects picked so far
     Cast.size          how many queens the cast needs
   ========================================================================== */

'use strict';

const Cast = (function () {

  /* ---------- 1. Settings ---------- */
  const CAST_SIZE = 12;      // queens needed for a season
  const RESULT_LIMIT = 10;   // search results shown (the grid is 5 wide x 2 tall)
  const SEARCH_DELAY = 120;  // ms to wait after typing before searching
  const START_MESSAGE = 'Start searching to find your cast.';


  /* ---------- 2. Elements and state ---------- */
  const grid        = document.getElementById('queen-grid');
  const message     = document.getElementById('grid-message');
  const searchBox   = document.getElementById('queen-search');
  const randomBtn   = document.getElementById('random-queen');
  const resultsText = document.getElementById('results-count');
  const countText   = document.getElementById('cast-count');
  const chipList    = document.getElementById('cast-chips');
  const clearBtn    = document.getElementById('cast-clear');
  const continueBtn = document.getElementById('cast-continue');
  const statusText  = document.getElementById('cast-status');

  const cards = new Map();        // queen id -> card element (made on first use)
  const queensById = new Map();   // queen id -> queen data
  let searchIndex = [];           // [{ queen, text, words }] prepared for searching
  let castIds = [];               // ids picked so far, in order
  let searchTimer = null;


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

  function makeCard(queen) {
    const card = make('button', 'queen-card');
    card.type = 'button';
    card.dataset.id = queen.id;
    card.title = queen.name;
    card.setAttribute('aria-pressed', 'false');

    // Portrait: photo if there is one, otherwise the CSS silhouette
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

    // Name sits over the bottom of the photo (cut after 2 lines if very long)
    const name = make('span', 'queen-name', queen.name);

    // Tick shown on picked queens (drawn in CSS)
    const check = make('span', 'queen-check');
    check.setAttribute('aria-hidden', 'true');

    card.appendChild(portrait);
    card.appendChild(name);
    card.appendChild(check);
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

  function applySearch() {
    const term = normalize(searchBox.value.trim());

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
  function isFull()     { return castIds.length >= CAST_SIZE; }

  function announce(text) { statusText.textContent = text; }

  function add(id) {
    if (isInCast(id) || isFull()) return false;
    castIds.push(id);
    refresh();
    announce('Added ' + queensById.get(id).name + '. ' + castIds.length + ' of ' + CAST_SIZE + ' picked.');
    return true;
  }

  function remove(id) {
    if (!isInCast(id)) return;
    castIds = castIds.filter(function (castId) { return castId !== id; });
    refresh();
    announce('Removed ' + queensById.get(id).name + '. ' + castIds.length + ' of ' + CAST_SIZE + ' picked.');
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

  function renderChips() {
    chipList.textContent = '';

    if (castIds.length === 0) {
      chipList.appendChild(make('li', 'cast-hint', 'No queens yet. Search for one or hit Random queen.'));
      return;
    }

    castIds.forEach(function (id) {
      const chip = make('button', 'chip', queensById.get(id).name + '  \u00D7');
      chip.type = 'button';
      chip.dataset.id = id;
      chip.setAttribute('aria-label', 'Remove ' + queensById.get(id).name);
      const item = document.createElement('li');
      item.appendChild(chip);
      chipList.appendChild(item);
    });
  }

  function refresh() {
    const full = isFull();

    cards.forEach(function (card, id) { syncCard(card, id); });

    renderChips();
    countText.textContent = castIds.length + ' / ' + CAST_SIZE;
    randomBtn.disabled = full || QUEENS.length === 0;
    clearBtn.disabled = castIds.length === 0;
    continueBtn.disabled = !full;
  }


  /* ---------- 8. Start-up ---------- */
  // Runs once the queen data has loaded
  function start() {
    QUEENS.forEach(function (queen) {
      queensById.set(queen.id, queen);
    });
    searchIndex = QUEENS.map(function (queen) {
      const text = normalize(queen.name);
      return { queen: queen, text: text, words: text.split(' ') };
    });
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

    // Click a chip in "Your cast" to remove that queen
    chipList.addEventListener('click', function (event) {
      const chip = event.target.closest('.chip');
      if (chip) remove(chip.dataset.id);
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
    size: CAST_SIZE
  };

})();
