/* ==========================================================================
   GreenRoom Simulator - js/grx/grx-engine.js
   GRX: simulates a regular season. No DOM, no text: returns plain data
   (an event log per episode) that any UI can play back.
   Needs js/grx/grx-config.js first.

   Console (F12):
     const s = GRX.newSeason(Cast.getQueens(), Setup.get());
     GRX.runEpisode(s);   GRX.runSeason(s);
     GRX.simulate(500, Cast.getQueens());   // table of results
   ========================================================================== */

'use strict';

const GRX = (function () {

  const C = GRX_CONFIG;

  /* ---------- Random numbers ---------- */
  // Every random roll uses Math.random (no seeds, so seasons can't be replayed)

  // Bell-curve random number: mostly near 0, sometimes far away
  function gauss(rng) {
    return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  }

  function round(n) { return Math.round(n * 100) / 100; }


  /* ---------- Season state ---------- */
  function btm2CapFor(castSize) {
    const row = C.btm2Cap.find(function (r) { return castSize >= r.minCast; });
    return row ? row.cap : 3;
  }

  function newSeason(queens, settings) {
    return {
      rng: Math.random,
      settings: settings || {},
      episode: 1,
      queens: queens.map(function (q) {
        return { id: q.id, name: q.name, stats: q.stats, status: 'active',
                 placements: [], lipSyncs: 0, wins: 0, eliminatedEp: null };
      }),
      challengeHistory: [],
      btm2Cap: btm2CapFor(queens.length),   // BTM2 appearances that get a queen sent home
      lastWinner: null,                     // id of last episode's winner
      runwayHistory: [],      // theme ids used so far
      songHistory: [],        // lip sync song ids used so far
      eliminated: [],
      episodes: [],
      done: false
    };
  }

  function activeQueens(state) {
    return state.queens.filter(function (q) { return q.status === 'active'; });
  }

  function getEpisodeShape(n) {
    const row = C.episodeShapes.find(function (r) { return n >= r.minQueens; });
    if (!row) return null;
    return {
      safe: row.safe === 'rest' ? n - row.top - row.bottom : row.safe,
      top: row.top,
      bottom: row.bottom
    };
  }


  /* ---------- Scoring ---------- */
  function statMix(queen, weights) {
    let total = 0;
    Object.keys(weights).forEach(function (key) { total += queen.stats[key] * weights[key]; });
    return total;
  }

  function roll(state, queen, weights, sd) {
    return statMix(queen, weights) + gauss(state.rng) * sd;
  }

  function pickChallenge(state) {
    const hist = state.challengeHistory;
    const recent = hist.slice(-C.challengeCooldown);
    let pool = C.challenges.filter(function (c) { return recent.indexOf(c.id) === -1; });

    if (pool.length === 0) {             // cooldown too big: least recently used
      pool = C.challenges.slice().sort(function (a, b) {
        return hist.lastIndexOf(a.id) - hist.lastIndexOf(b.id);
      }).slice(0, 1);
    }
    return pool[Math.floor(state.rng() * pool.length)];
  }


  // Pick from a library (RUNWAY_THEMES, LIPSYNC_SONGS), not repeating until
  // every entry has been used. Returns null if the library is empty.
  function pickFresh(state, list, used) {
    if (!list || list.length === 0) return null;
    let pool = list.filter(function (item) { return used.indexOf(item.id) === -1; });
    if (pool.length === 0) {
      const last = used[used.length - 1];
      used.length = 0;
      pool = list.length > 1 ? list.filter(function (item) { return item.id !== last; }) : list.slice();
    }
    const pick = pool[Math.floor(state.rng() * pool.length)];
    used.push(pick.id);
    return pick;
  }


  /* ---------- One episode ---------- */
  function runEpisode(state) {
    const active = activeQueens(state);
    const n = active.length;
    const shape = getEpisodeShape(n);
    if (state.done || !shape) { state.done = true; return null; }

    const events = [];
    const ids = function (list) { return list.map(function (q) { return q.id; }); };

    if (state.episode === 1) events.push({ type: 'entrance', queens: ids(active) });

    // Challenge + runway
    const challenge = pickChallenge(state);
    state.challengeHistory.push(challenge.id);
    const chal = {}, runway = {}, total = {};
    active.forEach(function (q) {
      chal[q.id]   = roll(state, q, challenge.weights, C.chaos);
      runway[q.id] = roll(state, q, C.runwayWeights, C.chaos);
      total[q.id]  = chal[q.id] * C.challengeShare + runway[q.id] * (1 - C.challengeShare);
    });
    const bands = {};
    C.performanceBands.forEach(function (band) { bands[band.id] = []; });
    active.slice().sort(function (a, b) { return chal[b.id] - chal[a.id]; }).forEach(function (q) {
      const band = C.performanceBands.find(function (b) { return chal[q.id] >= b.min; });
      bands[band.id].push(q.id);
    });
    events.push({ type: 'challenge', id: challenge.id, name: challenge.name,
                  scores: scoreMap(chal), bands: bands });
    const theme = pickFresh(state, typeof RUNWAY_THEMES !== 'undefined' ? RUNWAY_THEMES : [], state.runwayHistory);
    events.push({ type: 'runway', theme: theme ? { id: theme.id, name: theme.name } : null, scores: scoreMap(runway) });

    // Rank best to worst, then hand out placements
    const ranked = active.slice().sort(function (a, b) { return total[b.id] - total[a.id]; });
    const placement = {};
    const tops = ranked.slice(0, shape.top);
    // Repeat winners: last week's winner is less likely to win again. She is
    // still in the tops, the win just goes to the next best top queen.
    if (state.lastWinner && tops.length > 1 && tops[0].id === state.lastWinner &&
        state.rng() >= C.repeatWinChance) {
      const first = tops[0]; tops[0] = tops[1]; tops[1] = first;
    }
    const bottoms = ranked.slice(n - shape.bottom);
    const safe = ranked.slice(shape.top, n - shape.bottom);

    safe.forEach(function (q) { placement[q.id] = 'SAFE'; });
    tops.forEach(function (q, i) { placement[q.id] = i === 0 ? 'WIN' : 'HIGH'; });
    const low = shape.bottom === 3 ? bottoms[0] : null;      // best of the bottom is called safe
    bottoms.forEach(function (q) { placement[q.id] = q === low ? 'LOW' : 'BTM2'; });
    const btm2 = bottoms.filter(function (q) { return q !== low; });

    events.push({ type: 'safe', queens: ids(safe) });
    events.push({ type: 'critiques', tops: ids(tops), bottoms: ids(bottoms) });
    events.push({ type: 'results', win: tops[0].id, high: ids(tops.slice(1)),
                  low: low ? low.id : null, btm2: ids(btm2) });

    // Lip sync for your life
    const ls = btm2.map(function (q) {
      return { q: q, s: roll(state, q, { lipSync: 1 }, C.lipSyncChaos) };
    }).sort(function (a, b) { return b.s - a.s; });
    let stay = ls[0].q, out = ls[1].q;

    // Unspoken rule: on her Nth BTM2 (the cap) a queen goes home even if she
    // wins the lip sync. If both are at the cap, the one with more BTM2s goes
    // home; if they are level, the lip sync decides.
    const capped = btm2.filter(function (q) { return q.lipSyncs + 1 >= state.btm2Cap; });
    let target = null;
    if (capped.length === 1) target = capped[0];
    else if (capped.length === 2 && btm2[0].lipSyncs !== btm2[1].lipSyncs) {
      target = btm2[0].lipSyncs > btm2[1].lipSyncs ? btm2[0] : btm2[1];
    }
    let forcedByCap = false;
    if (target && target !== out) {
      out = target;
      stay = btm2.find(function (q) { return q !== out; });
      forcedByCap = true;
    }
    const song = pickFresh(state, typeof LIPSYNC_SONGS !== 'undefined' ? LIPSYNC_SONGS : [], state.songHistory);
    events.push({ type: 'lipsync', queens: ids(btm2), stay: stay.id, forcedByCap: forcedByCap,
                  song: song ? { id: song.id, title: song.title, artist: song.artist } : null });
    events.push({ type: 'elimination', queen: out.id });

    // Update records
    active.forEach(function (q) { q.placements.push(placement[q.id]); });
    tops[0].wins++;
    state.lastWinner = tops[0].id;
    btm2.forEach(function (q) { q.lipSyncs++; });
    out.status = 'eliminated';
    out.eliminatedEp = state.episode;
    state.eliminated.push({ id: out.id, episode: state.episode });

    const log = { episode: state.episode, queensLeft: n, events: events };
    state.episodes.push(log);
    state.episode++;
    if (activeQueens(state).length <= C.finaleAt) state.done = true;   // finale: later
    return log;
  }

  function scoreMap(obj) {
    const out = {};
    Object.keys(obj).forEach(function (id) { out[id] = round(obj[id]); });
    return out;
  }

  function runSeason(state) {
    while (!state.done) runEpisode(state);
    return state;
  }


  /* ---------- Testing: run many seasons ---------- */
  // Returns one row per queen, best "final 3" rate first.
  function simulate(count, queens, settings) {
    const rows = {};
    queens.forEach(function (q) {
      const avg = Object.keys(q.stats).reduce(function (s, k) { return s + q.stats[k]; }, 0) / 5;
      rows[q.id] = { name: q.name, avgStat: round(avg), final3: 0, wins: 0, lipSyncs: 0, avgOutEp: 0, outCount: 0 };
    });

    for (let i = 0; i < count; i++) {
      const s = runSeason(newSeason(queens, settings));
      s.queens.forEach(function (q) {
        const r = rows[q.id];
        if (q.status === 'active') r.final3++;
        r.wins += q.wins;
        r.lipSyncs += q.lipSyncs;
        if (q.eliminatedEp) { r.avgOutEp += q.eliminatedEp; r.outCount++; }
      });
    }

    const table = Object.keys(rows).map(function (id) {
      const r = rows[id];
      return { name: r.name, avgStat: r.avgStat,
               final3Pct: round(r.final3 / count * 100),
               winsPerSeason: round(r.wins / count),
               lipSyncsPerSeason: round(r.lipSyncs / count),
               avgOutEp: r.outCount ? round(r.avgOutEp / r.outCount) : null };
    });
    return table.sort(function (a, b) { return b.final3Pct - a.final3Pct; });
  }

  return { newSeason: newSeason, runEpisode: runEpisode, runSeason: runSeason,
           simulate: simulate, getEpisodeShape: getEpisodeShape };

})();
