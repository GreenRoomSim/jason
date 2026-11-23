/* ==========================================================================
   GreenRoom Simulator - cast.js
   The RIGHT half of the setup screen: queen cards, search, random pick and
   the "Your cast" bar.
   Needs js/data/queens.js (loadQueens, QUEENS, STATS, STAT_MAX) loaded first.

   Built for a big database: cards are only created when they are shown, in
   batches (see BATCH_SIZE), and photos load lazily as you scroll.

   Sections:
     1. Settings (edit these)
     2. Elements and state
     3. Messages (loading / errors / no results)
     4. Building the cards
     5. Showing cards (search + "Show more")
     6. Cast changes (add / remove / random / clear)
     7. Refreshing the cast bar and cards
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
  const BATCH_SIZE = 48;     // cards shown at first, and added by each "Show more"
  const SEARCH_DELAY = 120;  // ms to wait after typing before searching


  /* ---------- 2. Elements and state ---------- */
  const grid        = document.getElementById('queen-grid');
  const message     = document.getElementById('grid-message');
  const moreBtn     = document.getElementById('show-more');
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
  let searchIndex = [];           // [{ queen, text }] with text ready for searching
  let filtered = [];              // queens matching the current search
  let shownCount = 0;             // how many of `filtered` are on screen
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
    card.setAttribute('aria-pressed', 'false');

    // Portrait: photo if there is one, otherwise the CSS silhouette
    const portrait = make('span', 'portrait');
    if (queen.image) {
      const img = document.createElement('img');
      img.src = queen.image;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      // Missing photo? Remove the broken image so the silhouette shows instead
      img.addEventListener('error', function () { img.remove(); });
      portrait.appendChild(img);
    }

    // Name (long names are cut after 2 lines; the full name shows on hover)
    const name = make('span', 'queen-name', queen.name);
    name.title = queen.name;

    // Seasons, e.g. "US S2 · US AS1"
    const seasons = make('span', 'queen-seasons', queen.seasons.join(' \u00B7 '));
    seasons.title = queen.seasons.join(', ');

    // One bar per stat
    const miniStats = make('span', 'mini-stats');
    STATS.forEach(function (stat) {
      const value = queen.stats[stat.key];

      const row = make('span', 'mini');
      row.appendChild(make('span', 'mini-label', stat.label));

      const bar = make('span', 'mini-bar');
      bar.setAttribute('role', 'img');
      bar.setAttribute('aria-label', stat.label + ' ' + value + ' out of ' + STAT_MAX);
      const fill = document.createElement('i');
      fill.style.width = (value / STAT_MAX * 100) + '%';
      bar.appendChild(fill);

      row.appendChild(bar);
      miniStats.appendChild(row);
    });

    card.appendChild(portrait);
    card.appendChild(name);
    card.appendChild(seasons);
    card.appendChild(miniStats);
    card.appendChild(make('span', 'queen-badge', 'In cast'));
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


  /* ---------- 5. Showing cards (search + "Show more") ---------- */
  // "Shéa Couleé" and "Phi Phi O'Hara" become "shea coulee" and "phi phi ohara",
  // so people can search without typing accents or apostrophes.
  function normalize(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')     // remove accents
      .replace(/['\u2019`.]/g, '');        // remove apostrophes and dots
  }

  function updateMoreButton() {
    const left = filtered.length - shownCount;
    moreBtn.hidden = left <= 0;
    if (left > 0) moreBtn.textContent = 'Show more (' + left + ' left)';
  }

  // Draw the first batch of the current search results
  function renderGrid() {
    shownCount = Math.min(BATCH_SIZE, filtered.length);

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < shownCount; i++) {
      fragment.appendChild(getCard(filtered[i]));
    }
    grid.textContent = '';
    grid.appendChild(fragment);

    if (filtered.length === 0) {
      showMessage('No queens match your search. Check the spelling or try fewer letters.');
    } else {
      hideMessage();
    }
    updateMoreButton();
  }

  // Add the next batch below the cards already shown
  function showMore() {
    const from = shownCount;
    shownCount = Math.min(shownCount + BATCH_SIZE, filtered.length);

    const fragment = document.createDocumentFragment();
    for (let i = from; i < shownCount; i++) {
      fragment.appendChild(getCard(filtered[i]));
    }
    grid.appendChild(fragment);
    updateMoreButton();
  }

  function applySearch() {
    const term = normalize(searchBox.value.trim());

    filtered = searchIndex
      .filter(function (entry) { return term === '' || entry.text.indexOf(term) !== -1; })
      .map(function (entry) { return entry.queen; });

    resultsText.textContent = term === ''
      ? QUEENS.length + ' queens'
      : filtered.length + ' of ' + QUEENS.length + ' queens match';

    renderGrid();
  }


  /* ---------- 6. Cast changes ---------- */
  function isInCast(id) { return castIds.indexOf(id) !== -1; }
  function isFull()     { return castIds.length >= CAST_SIZE; }

  function announce(message) { statusText.textContent = message; }

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

    // Show which queen was picked, if her card is on screen right now
    const card = cards.get(pick.id);
    if (card && card.isConnected) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      card.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
      card.classList.add('just-added');
      card.addEventListener('animationend', function () {
        card.classList.remove('just-added');
      }, { once: true });
    }
  }


  /* ---------- 7. Refreshing the cast bar and cards ---------- */
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
      chipList.appendChild(make('li', 'cast-hint', 'No queens yet. Pick a card or hit Random queen.'));
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
      return { queen: queen, text: normalize(queen.name) };
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

    // Click a card to add/remove that queen
    grid.addEventListener('click', function (event) {
      const card = event.target.closest('.queen-card');
      if (card && !card.disabled) toggle(card.dataset.id);
    });

    // Click a chip in the cast bar to remove that queen
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
        applySearch();
      }
    });

    moreBtn.addEventListener('click', showMore);
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
