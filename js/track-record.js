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
    WIN: 'p-win', TOP2: 'p-top2', HIGH: 'p-high', SAFE: 'p-safe',
    LOW: 'p-low', BTM2: 'p-btm', ELIM: 'p-elim',
    WINNER: 'p-winner', 'RUNNER UP': 'p-runner', GUEST: 'p-guest'
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

  // Best to worst, used to order the rows
  const PLACEMENT_ORDER = ['WIN', 'TOP2', 'HIGH', 'SAFE', 'LOW', 'BTM2', 'ELIM'];
  function placementRank(p) {
    const i = PLACEMENT_ORDER.indexOf(p);
    return i === -1 ? PLACEMENT_ORDER.length : i;
  }

  // Row order:
  //  1. Queens still in, by their MOST RECENT placement:
  //     WIN, HIGH, SAFE, LOW, BTM2. Queens with the same placement are
  //     split by the episode before that, then the one before, and so on.
  //  2. Eliminated queens underneath, in elimination order: the first queen
  //     out is the very bottom row, the second out is the row above her...
  function orderQueens(season) {
    const inComp = season.queens.filter(function (q) { return q.status === 'active'; });
    const out = season.queens.filter(function (q) { return q.status !== 'active'; });

    inComp.sort(function (a, b) {
      if (season.finale) return a.finalRank - b.finalRank;     // after the finale: winner first
      // Split premiere: queens who were in the LATEST episode go on top,
      // and queens who weren't (blank tile) go underneath them.
      const last = season.episodes.length - 1;
      const aIn = a.placements[last] ? 0 : 1;
      const bIn = b.placements[last] ? 0 : 1;
      if (aIn !== bIn) return aIn - bIn;

      // Compare most recent placements first. Blank episodes (null: a split
      // premiere episode she wasn't in) are skipped, so both halves of a
      // split cast sort together.
      const pa = a.placements.filter(Boolean).reverse();
      const pb = b.placements.filter(Boolean).reverse();
      for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
        const diff = placementRank(pa[i]) - placementRank(pb[i]);
        if (diff !== 0) return diff;
      }
      return a.name.localeCompare(b.name);
    });
    out.sort(function (a, b) { return b.eliminatedEp - a.eliminatedEp; });
    return inComp.concat(out);
  }

  // Rank shown for a finalist, always as numbers. Tied queens share their places:
  //   winner 1st; two runners-up 2nd/3rd; Lip Sync For The Crown: final loser 2nd,
  //   the two first-round losers 3rd/4th.
  function finalistRank(season, queen) {
    if (queen.finalRank === 1) return ordinal(1);
    const crown = season.finale && season.finale.format === 'crown';
    const tier = function (q) { return crown ? q.finalRank : 2; };       // who ties with who
    const group = season.queens.filter(function (q) {
      return q.status === 'active' && q.finalRank && q.finalRank !== 1 && tier(q) === tier(queen);
    });
    const places = [];
    for (let i = 0; i < group.length; i++) places.push(ordinal(tier(queen) + i));
    return places.join('/');
  }

  function rankLabel(season, queen) {
    if (queen.status === 'active') {
      if (!season.finale) return 'TBA';
      return finalistRank(season, queen);
    }
    if (queen.finaleCut) return ordinal(queen.finalRank);      // cut in a Top 4 finale: 4th
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
    if (season.finale) cols.appendChild(make('col', 'col-finale'));
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
    if (season.finale) {
      main.appendChild(make('th', null, 'Finale'));
      sub.appendChild(make('th', null, 'Lip Sync'));
    }
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

      // Finale column: finalists WINNER / RUNNER UP, everyone else GUEST
      if (season.finale) {
        if (queen.finaleCut) {
          row.appendChild(make('td', 'p-finale-elim', 'ELIM'));     // cut before the final lip sync
        } else {
          if (queen.lostRound1) {
            row.appendChild(make('td', 'p-lost-r1', 'LOST\n1ST\nROUND'));   // Lip Sync For The Crown
          } else {
            const fin = queen.status === 'active'
              ? (queen.finalRank === 1 ? 'WINNER' : 'RUNNER UP')
              : 'GUEST';
            row.appendChild(make('td', PLACEMENT_CLASS[fin], fin));
          }
        }
      }
      tbody.appendChild(row);
    });
    table.appendChild(tbody);

    const wrap = make('div', 'track-wrap');
    wrap.appendChild(table);
    return wrap;
  }

  return { build: build };

})();
