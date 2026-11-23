/* ==========================================================================
   GreenRoom Simulator - js/track-record.js
   Builds the track record table from a season. Nothing is typed in by hand:
   everything comes from what GRX has already recorded.

   Where the information comes from (season = GRX.newSeason(...)):
     season.episodes[i]        the log of episode i+1 (queensLeft, events)
       -> challenge name       the 'challenge' event in that log
       -> queens left          used for the rank of whoever went home
     season.queens[n].placements   one placement per episode she was in
     season.queens[n].status / eliminatedEp   who is out, and when
   So the table gains one column every time an episode finishes.

   Plain script: TrackRecord is global. Needs css/track-record.css.
   Use: container.appendChild(TrackRecord.build(season, lookup))
        lookup(id) returns the queen data (for her photo), e.g. queenData().
   ========================================================================== */

'use strict';

const TrackRecord = (function () {

  const PLACEMENT_CLASS = {
    WIN: 'p-win', HIGH: 'p-high', SAFE: 'p-safe',
    LOW: 'p-low', BTM2: 'p-btm', ELIM: 'p-elim'
  };

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  // 1 -> "1st", 2 -> "2nd", 11 -> "11th" ...
  function ordinal(n) {
    const rest = n % 100;
    if (rest >= 11 && rest <= 13) return n + 'th';
    return n + (['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  }

  function challengeName(log) {
    const e = log.events.find(function (ev) { return ev.type === 'challenge'; });
    return e ? e.name : '';
  }

  // The placement shown for a queen in episode number `ep` (1-based).
  // Her last episode shows ELIM instead of BTM2. Returns null once she's gone.
  function placementFor(queen, ep) {
    if (queen.eliminatedEp && ep > queen.eliminatedEp) return null;
    if (queen.eliminatedEp === ep) return 'ELIM';
    return queen.placements[ep - 1] || null;
  }

  function count(queen, placement) {
    return queen.placements.filter(function (p) { return p === placement; }).length;
  }

  // Row order: queens still in (best record first), then the eliminated
  // queens with the latest elimination first (so 5th, 6th, 7th ...)
  function orderQueens(season) {
    const inComp = season.queens.filter(function (q) { return q.status === 'active'; });
    const out = season.queens.filter(function (q) { return q.status !== 'active'; });

    inComp.sort(function (a, b) {
      return count(b, 'WIN') - count(a, 'WIN') ||
             count(b, 'HIGH') - count(a, 'HIGH') ||
             (count(a, 'BTM2') + count(a, 'LOW')) - (count(b, 'BTM2') + count(b, 'LOW')) ||
             a.name.localeCompare(b.name);
    });
    out.sort(function (a, b) { return b.eliminatedEp - a.eliminatedEp; });
    return inComp.concat(out);
  }

  function rankLabel(season, queen) {
    if (queen.status === 'active') return 'TBA';
    const log = season.episodes[queen.eliminatedEp - 1];
    return log ? ordinal(log.queensLeft) : '';
  }

  function build(season, lookup) {
    const episodes = season.episodes;
    const table = make('table', 'track');
    table.setAttribute('aria-label', 'Track record');

    // Column widths
    const cols = make('colgroup');
    ['col-rank', 'col-name', 'col-photo'].forEach(function (c) { cols.appendChild(make('col', c)); });
    episodes.forEach(function () { cols.appendChild(make('col', 'col-ep')); });
    table.appendChild(cols);

    // Header: row 1 = Rank / Contestant / Ep. N, row 2 = challenge names
    const thead = make('thead');
    const main = make('tr', 'head-main');
    const sub  = make('tr', 'head-sub');

    const rankTh = make('th', 'col-title', 'Rank');
    rankTh.rowSpan = 2;
    const nameTh = make('th', 'col-title', 'Contestant');
    nameTh.colSpan = 2;
    nameTh.rowSpan = 2;
    main.appendChild(rankTh);
    main.appendChild(nameTh);

    episodes.forEach(function (log) {
      main.appendChild(make('th', null, 'Ep. ' + log.episode));
      sub.appendChild(make('th', null, challengeName(log)));
    });
    thead.appendChild(main);
    thead.appendChild(sub);
    table.appendChild(thead);

    // One row per queen
    const tbody = make('tbody');
    orderQueens(season).forEach(function (queen) {
      const row = make('tr');
      row.appendChild(make('td', 'cell-rank', rankLabel(season, queen)));
      row.appendChild(make('td', 'cell-name', queen.name));

      const photo = make('td', 'cell-photo');
      const data = lookup ? lookup(queen.id) : null;
      if (data && data.image) {
        const img = document.createElement('img');
        img.src = data.image;
        img.alt = '';
        img.addEventListener('error', function () { img.remove(); });
        photo.appendChild(img);
      }
      row.appendChild(photo);

      episodes.forEach(function (log) {
        const placement = placementFor(queen, log.episode);
        row.appendChild(placement
          ? make('td', PLACEMENT_CLASS[placement] || '', placement)
          : make('td', 'p-gone'));
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);

    const wrap = make('div', 'track-wrap');
    wrap.appendChild(table);
    return wrap;
  }

  return { build: build };

})();
