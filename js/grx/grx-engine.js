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

  // How many queens are left when the regular episodes stop (the finalists)
  function finaleSizeFor(settings) {
    const size = settings && C.finaleSizes ? C.finaleSizes[settings.finale] : null;
    return size || C.finaleAt;
  }

  // Which premiere format this season uses: { id, episodes, tops }.
  // 'regular' = no special premiere (episodes: 0). A split premiere needs a
  // big enough cast, otherwise it falls back to a normal top 2 premiere.
  function premiereFor(castSize, settings) {
    const table = C.premieres || {};
    let id = settings ? settings.premiere : null;
    if (!table[id]) return { id: 'regular', episodes: 0, tops: 0 };
    if (table[id].minCast && castSize < table[id].minCast) id = 'top2';
    return { id: id, episodes: table[id].episodes, tops: table[id].tops };
  }

  // Talent Show extra: null (off), 'premiere' (episodes 1-2) or 'mid' (around 10-9 left)
  function talentModeFor(castSize, settings) {
    const X = C.talentShowExtra;
    const on = settings && X && (settings.extras || []).indexOf(X.id) !== -1;
    if (!on || castSize < X.minCast) return null;
    if (castSize <= X.premiereMaxCast) return 'premiere';
    return Math.random() < X.premiereChance ? 'premiere' : 'mid';
  }

  function newSeason(queens, settings) {
    settings = settings || {};
    // Lip Sync Legacy: Regular premiere, Top 3 finale, no extras (for now)
    const legacy = settings.format === 'lipsync-legacy';
    if (legacy) settings = Object.assign({}, settings, { premiere: 'regular', finale: 'top3', extras: [] });
    const season = seasonState(queens, settings);
    season.legacy = legacy;
    // A Talent Show premiere replaces the Premiere setting (no special premiere)
    season.premiere = season.talentMode === 'premiere'
      ? { id: 'regular', episodes: 0, tops: 0 }
      : premiereFor(queens.length, settings);
    return season;
  }

  function seasonState(queens, settings) {
    return {
      rng: Math.random,
      settings: settings || {},
      episode: 1,
      queens: queens.map(function (q) {
        return { id: q.id, name: q.name, stats: q.stats, status: 'active',
                 placements: [], lipSyncs: 0, wins: 0, eliminatedEp: null, finalRank: null, finaleCut: false, lostRound1: false };
      }),
      challengeHistory: [],
      talentMode: talentModeFor(queens.length, settings), // null / 'premiere' / 'mid' (Talent Show extra)
      premiere: null,                       // set just below (a Talent Show premiere replaces it)
      splitGroups: null,                    // split premiere: [[ids ep 1], [ids ep 2]]
      btm2Cap: btm2CapFor(queens.length),   // BTM2 appearances that get a queen sent home
      lastWinner: null,                     // id of last episode's winner
      runwayHistory: [],      // theme ids used so far
      songHistory: [],        // lip sync song ids used so far
      eliminated: [],
      rigged: false,                        // true once the user has locked in an altered result (Riggory)
      episodes: [],
      finaleAt: finaleSizeFor(settings),    // queens left when the finale begins
      finale: null,                         // the finale log, once it has been run
      winner: null,                         // id of the winner, once the finale has been run
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

  // How far through the regular season we are: 0 = first episode, 1 = last
  // episode before the finale.
  function seasonProgress(state) {
    const total = state.premiere.episodes + Math.max(0, state.queens.length - state.finaleAt);
    return total > 1 ? Math.min(1, state.episodes.length / (total - 1)) : 0;
  }

  function stageWindow(challenge) {
    if (!challenge.stages || !challenge.stages.length || !C.stages) return [0, 1];
    let lo = 1, hi = 0;
    challenge.stages.forEach(function (name) {
      const s = C.stages[name];
      if (!s) return;
      lo = Math.min(lo, s[0]); hi = Math.max(hi, s[1]);
    });
    return lo > hi ? [0, 1] : [lo, hi];
  }

  function pickChallenge(state) {
    const hist = state.challengeHistory;
    const first = state.episode === 1;
    const p = seasonProgress(state);
    // 'once' challenges (staples) that have already happened are out for good
    const available = C.challenges.filter(function (c) { return !c.special && !(c.once && hist.indexOf(c.id) !== -1); });
    const byId = function (id) { return C.challenges.find(function (c) { return c.id === id; }); };

    // Episode 1: a 'first episode only' challenge (Talent Show) is picked
    if (first) {
      const openers = available.filter(function (c) { return c.firstEpisode === 'only' || (C.openers || []).indexOf(c.id) !== -1; });
      if (openers.length) return openers[Math.floor(state.rng() * openers.length)];
    }

    const firstOk = function (c) {
      if (c.firstEpisode === 'only') return first;
      if (c.firstEpisode === 'never') return !first;
      return true;
    };
    const stageOk = function (c) { const w = stageWindow(c); return p >= w[0] && p <= w[1]; };
    const coolOk  = function (c) { return hist.slice(-C.challengeCooldown).indexOf(c.id) === -1; };

    // Strictest first; relax the stage window, then the cooldown, if nothing is left
    let pool = available.filter(function (c) { return firstOk(c) && stageOk(c) && coolOk(c); });
    if (!pool.length) pool = available.filter(function (c) { return firstOk(c) && coolOk(c); });
    if (!pool.length) pool = available.filter(firstOk);
    if (!pool.length) pool = available.length ? available.slice() : C.challenges.slice();

    // Variety: same category as last episode (or the one before) is much less likely
    const lastCat = hist.length > 0 && byId(hist[hist.length - 1]) ? byId(hist[hist.length - 1]).category : null;
    const gapCat  = hist.length > 1 && byId(hist[hist.length - 2]) ? byId(hist[hist.length - 2]).category : null;
    const weights = pool.map(function (c) {
      if (!c.category) return 1;
      if (c.category === lastCat) return C.categoryRepeatWeight;
      if (c.category === gapCat) return C.categoryGapWeight;
      return 1;
    });
    let roll = state.rng() * weights.reduce(function (a, b) { return a + b; }, 0);
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll < 0) return pool[i];
    }
    return pool[pool.length - 1];
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


  /* ---------- Premieres ---------- */
  // Split the cast in two for a split premiere (random; the first half is
  // the bigger one if the cast is odd). Returns [[ids], [ids]].
  function makeSplitGroups(state, everyone) {
    const shuffled = everyone.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(state.rng() * (i + 1));
      const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
    }
    const half = Math.ceil(shuffled.length / 2);
    const idsOf = function (list) { return list.map(function (q) { return q.id; }); };
    return [idsOf(shuffled.slice(0, half)), idsOf(shuffled.slice(half))];
  }

  // The rest of a premiere episode, after challenge + runway have been scored.
  // No bottoms and no elimination: the top of the week is SAFE/HIGH, and the
  // best two lip sync for the win (winner: WIN, loser: TOP2).
  // Returns a DRAFT (nothing is recorded until commitEpisode).
  function preparePremiere(state, everyone, active, ranked, events) {
    const topCount = Math.max(2, Math.min(state.premiere.tops, active.length));
    const tops = ranked.slice(0, topCount);
    const safe = ranked.slice(topCount);
    const pair = tops.slice(0, 2);

    const ls = pair.map(function (q) {
      return { q: q, s: roll(state, q, { lipSync: 1 }, C.lipSyncChaos) };
    }).sort(function (a, b) { return b.s - a.s; });
    const winner = ls[0].q, loser = ls[1].q;
    const song = pickFresh(state, typeof LIPSYNC_SONGS !== 'undefined' ? LIPSYNC_SONGS : [], state.songHistory);

    return { kind: 'premiere', events: events, everyone: everyone, active: active,
             tops: tops,           // everyone in the top of the week (includes the top 2)
             safe: safe, pair: pair, winner: winner, loser: loser, song: song };
  }


  /* ---------- Talent Show (two-part challenge) ---------- */
  // 0 = not a talent show episode, 1 = part 1 (starts now), 2 = part 2 (due now)
  function talentShowPhase(state, everyone, isPremiere) {
    const T = C.talentShow;
    if (!T || isPremiere || !state.talentMode) return 0;     // only with the Talent Show extra
    if (state.talentShow) return state.talentShow.done ? 0 : 2;
    if (state.talentMode === 'premiere') return state.episode === 1 ? 1 : 0;
    if (state.queens.length < T.minCast) return 0;
    if (everyone.length <= T.maxLeft && everyone.length >= T.minLeft) return 1;
    return 0;
  }

  // The BTM2 lip sync (shared logic: BTM2 cap, double shantay / sashay)
  function decideBtm2(state, btm2, n, shantayChance, sashayChance) {
    const ls = btm2.map(function (q) {
      return { q: q, s: roll(state, q, { lipSync: 1 }, C.lipSyncChaos) };
    }).sort(function (a, b) { return b.s - a.s; });
    let stay = ls[0].q, out = ls[1].q;
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
    const canDoubleSashay = n - 2 >= state.finaleAt;
    let double = null;
    const dr = state.rng();
    if (dr < shantayChance && !forcedByCap && capped.length === 0) double = 'shantay';
    else if (dr >= 1 - sashayChance && canDoubleSashay) double = 'sashay';
    return { stay: stay, out: out, forcedByCap: forcedByCap, double: double, canDoubleSashay: canDoubleSashay };
  }

  // `active` = the queens performing this week, `ranked` = them best to worst.
  function prepareTalentShow(state, part, groups, everyone, active, ranked, events) {
    const T = C.talentShow;
    const ids = function (list) { return list.map(function (q) { return q.id; }); };
    const rest = everyone.filter(function (q) { return active.indexOf(q) === -1; });
    const pair = ranked.slice(0, 2);
    const btm = ranked[ranked.length - 1];
    const safe = ranked.slice(2, ranked.length - 1);

    const ls = pair.map(function (q) {
      return { q: q, s: roll(state, q, { lipSync: 1 }, C.lipSyncChaos) };
    }).sort(function (a, b) { return b.s - a.s; });
    const winSong = pickFresh(state, typeof LIPSYNC_SONGS !== 'undefined' ? LIPSYNC_SONGS : [], state.songHistory);

    const d = { kind: part === 1 ? 'talent1' : 'talent2', groups: groups, events: events,
                everyone: everyone, active: active, n: everyone.length, rest: rest,
                pair: pair, winner: ls[0].q, loser: ls[1].q, safe: safe, btm: btm, winSong: winSong,
                prev: null, run: rest, btm2: null, double: null };
    if (part === 2) {
      const prev = everyone.find(function (q) { return q.id === state.talentShow.btm1; });
      d.prev = prev;
      d.run = rest.filter(function (q) { return q !== prev; });
      d.btm2 = [prev, btm];
      Object.assign(d, decideBtm2(state, d.btm2, everyone.length, T.doubleShantayChance, T.doubleSashayChance));
      d.song = pickFresh(state, typeof LIPSYNC_SONGS !== 'undefined' ? LIPSYNC_SONGS : [], state.songHistory);
    }
    d.talent = { part: part, performing: ids(active), raters: ids(rest) };
    return d;
  }

  function commitTalentShow(state, d) {
    const ids = function (list) { return list.map(function (q) { return q.id; }); };
    const part = d.talent.part;
    if (d.rigged) state.rigged = true;
    const placement = {};
    d.rest.forEach(function (q) { placement[q.id] = 'RUN'; });
    d.safe.forEach(function (q) { placement[q.id] = 'SAFE-C'; });     // safe, but critiqued
    placement[d.winner.id] = 'WIN';
    placement[d.loser.id] = 'TOP2';
    if (part === 1) placement[d.btm.id] = 'BTM1';
    else { placement[d.btm.id] = 'BTM2'; placement[d.prev.id] = 'BTM2'; }
    const events = d.events.concat(resultEvents(d));

    d.everyone.forEach(function (q) { q.placements.push(placement[q.id]); });
    d.winner.wins++;
    state.lastWinner = d.winner.id;

    if (part === 1) {
      state.talentShow = { groups: d.groups, btm1: d.btm.id, done: false };
    } else {
      state.talentShow.done = true;
      d.btm2.forEach(function (q) { q.lipSyncs++; });
      const goingHome = d.double === 'shantay' ? [] : d.double === 'sashay' ? [d.out, d.stay] : [d.out];
      goingHome.forEach(function (q) {
        q.status = 'eliminated';
        q.eliminatedEp = state.episode;
        state.eliminated.push({ id: q.id, episode: state.episode });
      });
    }

    const log = { episode: state.episode, queensLeft: d.n, double: part === 2 ? (d.double || null) : null,
                  talentShow: d.talent, appearing: ids(d.active), events: events };
    state.episodes.push(log);
    state.episode++;
    if (activeQueens(state).length <= state.finaleAt) state.done = true;
    return log;
  }


  /* ---------- Lip Sync Legacy ----------
     The top 2 lip sync for the win, the winner chops one bottom queen.
     `ranked` = this week's queens best to worst. Returns a DRAFT. */
  function prepareLegacy(state, active, ranked, n, events) {
    const L = C.legacy;
    const row = L.shapes.find(function (r) { return n >= r.minQueens; }) || L.shapes[L.shapes.length - 1];
    let bottom = row.bottom;
    if (row.bottom3Chance && state.rng() < row.bottom3Chance) bottom = 3;
    bottom = Math.min(bottom, n - 2);

    const pair = ranked.slice(0, 2);
    const bottoms = ranked.slice(n - bottom);          // best to worst: the weakest is last
    const safe = ranked.slice(2, n - bottom);

    const ls = pair.map(function (q) {
      return { q: q, s: roll(state, q, { lipSync: 1 }, C.lipSyncChaos) };
    }).sort(function (a, b) { return b.s - a.s; });

    // The chop: usually the weakest bottom queen, sometimes a surprise pick
    const weakest = bottoms[bottoms.length - 1];
    let chopped = weakest;
    if (bottoms.length > 1 && state.rng() < L.surpriseChance) {
      const others = bottoms.filter(function (q) { return q !== weakest; });
      chopped = others[Math.floor(state.rng() * others.length)];
    }

    const song = pickFresh(state, typeof LIPSYNC_SONGS !== 'undefined' ? LIPSYNC_SONGS : [], state.songHistory);
    return { kind: 'legacy', events: events, active: active, n: n, pair: pair,
             winner: ls[0].q, loser: ls[1].q, safe: safe, bottoms: bottoms, chopped: chopped, song: song };
  }


  /* ---------- One episode ----------
     Two stages, so the Riggory update can step in between them:
       prepareEpisode(state)        simulates the episode and returns a DRAFT
                                    (nothing is recorded yet, except the
                                    challenge/runway/song histories)
       commitEpisode(state, draft)  records the draft as the real result
     runEpisode() does both in one go, exactly as before. */
  function prepareEpisode(state) {
    const everyone = activeQueens(state);
    const isPremiere = state.episode <= state.premiere.episodes;
    const ts = talentShowPhase(state, everyone, isPremiere);   // 0 / 1 / 2
    let talentGroups = null;

    // Who is in this episode. Only a split premiere has part of the cast.
    let active = everyone;
    if (isPremiere && state.premiere.id === 'split') {
      if (!state.splitGroups) state.splitGroups = makeSplitGroups(state, everyone);
      const group = state.splitGroups[state.episode - 1];
      active = everyone.filter(function (q) { return group.indexOf(q.id) !== -1; });
    }

    // Talent show: half the cast performs each week
    if (ts) {
      talentGroups = ts === 1 ? makeSplitGroups(state, everyone) : state.talentShow.groups;
      const grp = talentGroups[ts - 1];
      active = everyone.filter(function (q) { return grp.indexOf(q.id) !== -1; });
    }

    const n = active.length;
    const shape = (isPremiere || ts) ? null : getEpisodeShape(n);
    if (state.done || (!isPremiere && !ts && !shape)) { state.done = true; return null; }

    const events = [];
    const ids = function (list) { return list.map(function (q) { return q.id; }); };

    // Queens' entrance: episode 1 (everyone, or the first half in a split),
    // and episode 2 of a split premiere (the second half)
    if (state.episode === 1 || (isPremiere && state.premiere.id === 'split')) {
      // (a Talent Show premiere: everyone enters, even though half perform)
      events.push({ type: 'entrance', queens: ids(ts && state.episode === 1 ? everyone : active) });
    }

    // Challenge + runway
    const challenge = ts ? C.challenges.find(function (c) { return c.special === 'talentShow'; }) : pickChallenge(state);
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
                  scores: scoreMap(chal), bands: bands, part: ts || null });
    const theme = pickFresh(state, typeof RUNWAY_THEMES !== 'undefined' ? RUNWAY_THEMES : [], state.runwayHistory);
    events.push({ type: 'runway', theme: theme ? { id: theme.id, name: theme.name } : null, scores: scoreMap(runway) });

    // Rank best to worst
    const ranked = active.slice().sort(function (a, b) { return total[b.id] - total[a.id]; });

    // Premieres: a draft too (top 2 lip sync for the win)
    if (isPremiere) return preparePremiere(state, everyone, active, ranked, events);
    if (ts) return prepareTalentShow(state, ts, talentGroups, everyone, active, ranked, events);

    // Lip Sync Legacy: top 2 lip sync, the winner chops a bottom queen
    if (state.legacy) return prepareLegacy(state, active, ranked, n, events);

    // Regular episode: decide the placements
    const tops = ranked.slice(0, shape.top);
    // Repeat winners: last week's winner is less likely to win again. She is
    // still in the tops, the win just goes to the next best top queen.
    if (state.lastWinner && tops.length > 1 && tops[0].id === state.lastWinner &&
        state.rng() >= C.repeatWinChance) {
      const first = tops[0]; tops[0] = tops[1]; tops[1] = first;
    }
    const bottoms = ranked.slice(n - shape.bottom);
    const safe = ranked.slice(shape.top, n - shape.bottom);
    const low = shape.bottom === 3 ? bottoms[0] : null;      // best of the bottom is called safe
    const btm2 = bottoms.filter(function (q) { return q !== low; });

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
    // Double shantay / double sashay (regular lip syncs only)
    const canDoubleSashay = n - 2 >= state.finaleAt;
    let double = null;
    const dr = state.rng();
    if (dr < C.doubleShantayChance && !forcedByCap && capped.length === 0) double = 'shantay';
    else if (dr >= 1 - C.doubleSashayChance && canDoubleSashay) double = 'sashay';

    const song = pickFresh(state, typeof LIPSYNC_SONGS !== 'undefined' ? LIPSYNC_SONGS : [], state.songHistory);

    return { kind: 'regular', double: double, canDoubleSashay: canDoubleSashay, events: events, active: active, n: n,
             tops: tops,           // [0] = winner, the rest HIGH
             safe: safe, low: low, btm2: btm2, bottoms: bottoms,
             stay: stay, out: out, forcedByCap: forcedByCap, song: song };
  }

  // The events that come after the runway (safe, critiques, results, lip sync,
  // elimination), built from a draft. Pure: records nothing. The episode screen
  // uses it to show a PREVIEW before the draft is committed (Riggory).
  function resultEvents(d) {
    const ids = function (list) { return list.map(function (q) { return q.id; }); };
    if (d.kind === 'talent1' || d.kind === 'talent2') {
      const song = function (s) { return s ? { id: s.id, title: s.title, artist: s.artist } : null; };
      const evs = [
        { type: 'talent-results', part: d.talent.part, performing: d.talent.performing, raters: d.talent.raters,
          top2: ids(d.pair), critiqued: ids(d.safe), btm: d.btm.id, prevBtm: d.prev ? d.prev.id : null, run: ids(d.run) },
        { type: 'lipsync', kind: 'top2', queens: ids(d.pair), winner: d.winner.id, loser: d.loser.id,
          stay: d.winner.id, forcedByCap: false, song: song(d.winSong) }
      ];
      if (d.kind === 'talent2') {
        evs.push({ type: 'btm-lipsync', queens: ids(d.btm2), stay: d.stay.id, double: d.double || null,
                   forcedByCap: d.double ? false : d.forcedByCap, song: song(d.song) });
        evs.push({ type: 'elimination', double: d.double || null,
                   queen: d.double === 'shantay' ? null : d.out.id,
                   queens: d.double === 'shantay' ? [] : d.double === 'sashay' ? [d.out.id, d.stay.id] : [d.out.id] });
      }
      return evs;
    }
    if (d.kind === 'legacy') {
      return [
        { type: 'safe', queens: ids(d.safe) },
        { type: 'critiques', tops: ids(d.pair), bottoms: ids(d.bottoms) },
        { type: 'results', legacy: true, win: d.winner.id, high: [], low: null, btm2: ids(d.bottoms), top2: ids(d.pair) },
        { type: 'lipsync', kind: 'top2', queens: ids(d.pair), winner: d.winner.id, loser: d.loser.id,
          stay: d.winner.id, forcedByCap: false,
          song: d.song ? { id: d.song.id, title: d.song.title, artist: d.song.artist } : null },
        { type: 'chop', winner: d.winner.id, bottoms: ids(d.bottoms), chopped: d.chopped.id },
        { type: 'elimination', double: null, queen: d.chopped.id, queens: [d.chopped.id] }
      ];
    }
    if (d.kind === 'premiere') {
      const others = d.tops.filter(function (q) { return q !== d.winner && q !== d.loser; });
      return [
        { type: 'safe', queens: ids(d.safe) },
        { type: 'critiques', tops: ids(d.tops), bottoms: [] },
        { type: 'results', win: null, high: ids(others), low: null, btm2: [],
          top2: ids(d.pair), premiere: true },
        // kind 'top2' = lip sync for the win (no one goes home). stay/winner = the winner.
        { type: 'lipsync', kind: 'top2', queens: ids(d.pair), winner: d.winner.id,
          loser: d.loser.id, stay: d.winner.id, forcedByCap: false,
          song: d.song ? { id: d.song.id, title: d.song.title, artist: d.song.artist } : null }
      ];
    }
    return [
      { type: 'safe', queens: ids(d.safe) },
      { type: 'critiques', tops: ids(d.tops), bottoms: ids(d.bottoms) },
      { type: 'results', win: d.tops[0].id, high: ids(d.tops.slice(1)),
        low: d.low ? d.low.id : null, btm2: ids(d.btm2) },
      { type: 'lipsync', queens: ids(d.btm2), stay: d.stay.id, double: d.double || null,
        forcedByCap: d.double ? false : d.forcedByCap,
        song: d.song ? { id: d.song.id, title: d.song.title, artist: d.song.artist } : null },
      // queens = everyone sent home (none on a double shantay, two on a double sashay)
      { type: 'elimination', double: d.double || null,
        queen: d.double === 'shantay' ? null : d.out.id,
        queens: d.double === 'shantay' ? [] : d.double === 'sashay' ? [d.out.id, d.stay.id] : [d.out.id] }
    ];
  }

  function commitEpisode(state, d) {
    if (d.kind === 'talent1' || d.kind === 'talent2') return commitTalentShow(state, d);
    if (d.kind === 'legacy') {
      const idsL = function (list) { return list.map(function (q) { return q.id; }); };
      const placement = {};
      d.safe.forEach(function (q) { placement[q.id] = 'SAFE'; });
      d.bottoms.forEach(function (q) { placement[q.id] = d.bottoms.length === 3 ? 'BTM3' : 'BTM2'; });
      placement[d.winner.id] = 'WIN';
      placement[d.loser.id] = 'TOP2';
      const events = d.events.concat(resultEvents(d));

      d.active.forEach(function (q) { q.placements.push(placement[q.id]); });
      d.winner.wins++;
      state.lastWinner = d.winner.id;
      d.bottoms.forEach(function (q) { q.lipSyncs++; });      // a bottom appearance counts against her record
      d.chopped.status = 'eliminated';
      d.chopped.eliminatedEp = state.episode;
      state.eliminated.push({ id: d.chopped.id, episode: state.episode });

      const log = { episode: state.episode, queensLeft: d.n, double: null, legacy: true,
                    appearing: idsL(d.active), events: events };
      state.episodes.push(log);
      state.episode++;
      if (activeQueens(state).length <= state.finaleAt) state.done = true;
      return log;
    }
    if (d.kind === 'premiere') {
      const ids0 = function (list) { return list.map(function (q) { return q.id; }); };
      if (d.rigged) state.rigged = true;
      const placement = {};
      d.safe.forEach(function (q) { placement[q.id] = 'SAFE'; });
      d.tops.forEach(function (q) { placement[q.id] = 'HIGH'; });
      placement[d.winner.id] = 'WIN';
      placement[d.loser.id] = 'TOP2';
      const events = d.events.concat(resultEvents(d));

      // Records. Queens who weren't in this episode (the other half of a split
      // premiere) get null = a blank tile on the track record.
      d.everyone.forEach(function (q) { q.placements.push(placement[q.id] || null); });
      d.winner.wins++;
      state.lastWinner = d.winner.id;

      const log = { episode: state.episode, queensLeft: d.everyone.length, premiere: true,
                    appearing: ids0(d.active), events: events };
      state.episodes.push(log);
      state.episode++;
      if (activeQueens(state).length <= state.finaleAt) state.done = true;
      return log;
    }

    const ids = function (list) { return list.map(function (q) { return q.id; }); };
    if (d.rigged) state.rigged = true;
    const placement = {};
    d.safe.forEach(function (q) { placement[q.id] = 'SAFE'; });
    d.tops.forEach(function (q, i) { placement[q.id] = i === 0 ? 'WIN' : 'HIGH'; });
    d.bottoms.forEach(function (q) { placement[q.id] = q === d.low ? 'LOW' : 'BTM2'; });
    const events = d.events.concat(resultEvents(d));

    // Update records
    d.active.forEach(function (q) { q.placements.push(placement[q.id]); });
    d.tops[0].wins++;
    state.lastWinner = d.tops[0].id;
    d.btm2.forEach(function (q) { q.lipSyncs++; });
    const goingHome = d.double === 'shantay' ? [] : d.double === 'sashay' ? [d.out, d.stay] : [d.out];
    goingHome.forEach(function (q) {
      q.status = 'eliminated';
      q.eliminatedEp = state.episode;
      state.eliminated.push({ id: q.id, episode: state.episode });
    });

    const log = { episode: state.episode, queensLeft: d.n, double: d.double || null,
                  appearing: ids(d.active), events: events };
    state.episodes.push(log);
    state.episode++;
    if (activeQueens(state).length <= state.finaleAt) state.done = true;   // finale: see runFinale
    return log;
  }

  /* ---------- Riggory (user-altered results) ----------
     rigOptions(draft) -> who the user may pick in each slot:
       { win: [tops], low: [bottoms] (empty if no LOW this episode), out: [BTM2 queens],
         doubles: ['shantay', 'sashay'] (what 'double' may be set to) }
     applyRig(draft, edits) -> a NEW draft with the edits applied (the original
       is untouched, so Cancel = just keep using the original).
       edits (all optional):
         win: id of a top queen. She becomes WIN, the old winner drops to HIGH.
         low: id of a bottom queen. She is the one saved (LOW); the old LOW
              takes her place in the BTM2 (and her role in the lip sync).
         out: id of a BTM2 queen. She goes home, the other one stays.
     Rigged results ignore the hidden rules (BTM2 cap, repeat winners). Once
     committed they count like any other result. Regular and premiere episodes (finales come later). */
  function rigOptions(d) {
    if (!d) return null;
    if (d.kind === 'talent1' || d.kind === 'talent2') return null;     // Riggory for the talent show: not built yet
    if (d.kind === 'legacy') return null;                              // Riggory for Lip Sync Legacy: not built yet
    const ids = function (list) { return list.map(function (q) { return q.id; }); };
    if (d.kind === 'premiere') return { top2: ids(d.tops), win: ids(d.pair) };
    return { win: ids(d.tops), low: d.low ? ids(d.bottoms) : [], out: ids(d.btm2),
             doubles: d.canDoubleSashay ? ['shantay', 'sashay'] : ['shantay'] };
  }

  // Premiere: top2 = [id, id] from the tops (they lip sync for the win);
  // win = id of one of the two (she gets WIN, the other TOP2).
  function applyPremiereRig(d, edits) {
    const r = Object.assign({}, d);
    const pick = function (list, id, slot) {
      const q = list.find(function (x) { return x.id === id; });
      if (!q) throw new Error('applyRig: "' + id + '" can\'t be chosen for ' + slot + ' here.');
      return q;
    };
    if (edits.top2) {
      if (!Array.isArray(edits.top2) || edits.top2.length !== 2 || edits.top2[0] === edits.top2[1]) {
        throw new Error('applyRig: top2 needs two different queens.');
      }
      const a = pick(d.tops, edits.top2[0], 'top2'), b = pick(d.tops, edits.top2[1], 'top2');
      r.pair = [a, b];
      // Keep the old winner if she is still in the pair, otherwise the first pick wins
      r.winner = r.pair.indexOf(d.winner) !== -1 ? d.winner : a;
      r.loser = r.pair.find(function (q) { return q !== r.winner; });
    }
    if (edits.win) {
      r.winner = pick(r.pair, edits.win, 'win');
      r.loser = r.pair.find(function (q) { return q !== r.winner; });
    }
    r.rigged = !!d.rigged || r.winner !== d.winner || r.loser !== d.loser;
    return r;
  }

  function applyRig(d, edits) {
    if (!d) throw new Error('applyRig: no draft.');
    edits = edits || {};
    if (d.kind === 'premiere') return applyPremiereRig(d, edits);
    const r = Object.assign({}, d, { tops: d.tops.slice(), btm2: d.btm2.slice() });
    const pick = function (list, id, slot) {
      const q = list.find(function (x) { return x.id === id; });
      if (!q) throw new Error('applyRig: "' + id + '" can\'t be chosen for ' + slot + ' here.');
      return q;
    };

    if (edits.win) {
      const q = pick(r.tops, edits.win, 'win');
      const i = r.tops.indexOf(q), old = r.tops[0];
      r.tops[0] = q; r.tops[i] = old;                       // old winner drops to HIGH
    }
    if (edits.low) {
      if (!r.low) throw new Error('applyRig: this episode has no LOW to change.');
      const q = pick(d.bottoms, edits.low, 'low'), old = r.low;
      if (q !== old) {
        r.btm2[r.btm2.indexOf(q)] = old;                    // old LOW joins the BTM2
        if (r.out === q) r.out = old; else if (r.stay === q) r.stay = old;   // and takes her lip sync role
        r.low = q;
        r.forcedByCap = false;
      }
    }
    if (edits.out) {
      const q = pick(r.btm2, edits.out, 'out');
      r.out = q;
      r.stay = r.btm2.find(function (x) { return x !== q; });
      r.forcedByCap = false;
    }

    // edits.double: 'shantay' (save both), 'sashay' (eliminate both) or null (normal)
    if ('double' in edits) {
      if (edits.double === 'sashay' && !d.canDoubleSashay) throw new Error('applyRig: a double sashay would leave too few queens.');
      r.double = edits.double || null;
      if (r.double) r.forcedByCap = false;
    }

    r.rigged = !!d.rigged || r.tops[0] !== d.tops[0] || r.low !== d.low || r.out !== d.out ||
               (r.double || null) !== (d.double || null);
    return r;
  }

  function runEpisode(state) {
    const draft = prepareEpisode(state);
    return draft ? commitEpisode(state, draft) : null;
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


  /* ---------- Lip Sync For The Crown ---------- */
  // 4 queens, 3 lip syncs: two random pairs, then the two winners for the
  // crown. Judged mostly on track record (see GRX_CONFIG.crownFinale).
  function runCrownFinale(state, entrants, guests) {
    const K = C.crownFinale;
    const ids = function (list) { return list.map(function (q) { return q.id; }); };
    const byId = function (id) { return entrants.find(function (q) { return q.id === id; }); };
    const songOf = function () {
      const s = pickFresh(state, typeof LIPSYNC_SONGS !== 'undefined' ? LIPSYNC_SONGS : [], state.songHistory);
      return s ? { id: s.id, title: s.title, artist: s.artist } : null;
    };

    // A queen's season record (stats, wins and bottom 2s)
    const record = function (q) {
      const keys = Object.keys(q.stats);
      const avg = keys.reduce(function (s, k) { return s + q.stats[k]; }, 0) / keys.length;
      return avg + q.wins * K.winBonus - q.lipSyncs * K.btm2Penalty;
    };
    const score = function (q) {
      const sync = roll(state, q, { lipSync: 1 }, C.lipSyncChaos);
      return sync * K.lipSyncShare + (record(q) + gauss(state.rng) * K.recordChaos) * (1 - K.lipSyncShare);
    };
    const duel = function (a, b) {
      const winner = score(a) >= score(b) ? a : b;
      const loser = winner === a ? b : a;
      return { queens: [a.id, b.id], winner: winner.id, loser: loser.id, song: songOf() };
    };

    // Random pairs
    const order = entrants.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(state.rng() * (i + 1));
      const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    const m1 = duel(order[0], order[1]);
    const m2 = duel(order[2], order[3]);
    const final = duel(byId(m1.winner), byId(m2.winner));

    // Placings: winner 1st, loser of the final 2nd, the two first-round losers 3rd
    const semiLosers = [byId(m1.loser), byId(m2.loser)].sort(function (a, b) { return record(b) - record(a); });
    byId(final.winner).finalRank = 1;
    byId(final.loser).finalRank = 2;
    semiLosers.forEach(function (q) { q.finalRank = 3; q.lostRound1 = true; });
    entrants.forEach(function (q) { q.placements.push(q.finalRank === 1 ? 'WINNER' : 'RUNNER UP'); });

    const log = {
      finale: true,
      format: 'crown',
      entrants: ids(entrants),
      finalists: ids(entrants),
      cut: null,
      guests: guests,
      matches: [m1, m2, final],
      song: final.song,
      winner: final.winner,
      runnersUp: [final.loser].concat(ids(semiLosers))
    };
    state.winner = log.winner;
    state.finale = log;
    return log;
  }


  /* ---------- The finale ---------- */
  // Runs once the regular episodes are done (state.done). Every finalist lip
  // syncs; the best total (see GRX_CONFIG.finale) is crowned, the rest are
  // runners-up. In a Top 4 finale one queen is cut first (weakest resume).
  // Returns a log (and stores it in state.finale):
  //   { finale: true, entrants: [ids of everyone left at the start],
  //     finalists: [ids who lip sync], cut: id or null,
  //     guests: [ids, in elimination order],
  //     song, winner: id, runnersUp: [ids, best first] }
  function runFinale(state) {
    if (state.finale) return state.finale;
    if (!state.done) return null;

    const F = C.finale;
    const ids = function (list) { return list.map(function (q) { return q.id; }); };
    const entrants = activeQueens(state);
    const guests = state.eliminated.map(function (e) { return e.id; });

    if (state.settings.finale === 'crown' && entrants.length === 4) {
      return runCrownFinale(state, entrants, guests);
    }

    const entries = entrants.map(function (q) {
      const statAvg = Object.keys(q.stats).reduce(function (s, k) { return s + q.stats[k]; }, 0) /
                      Object.keys(q.stats).length;
      const resume = statAvg + q.wins * F.winBonus - q.lipSyncs * F.btm2Penalty + gauss(state.rng) * C.chaos;
      return { q: q, resume: resume };
    });

    // Top 4 finale: the weakest resume is cut before the final lip sync
    const cuts = (C.finaleCuts && C.finaleCuts[state.settings.finale]) || 0;
    let cut = null;
    let contenders = entries;
    if (cuts > 0 && entries.length > 3) {
      cut = entries.slice().sort(function (a, b) { return a.resume - b.resume; })[0].q;
      contenders = entries.filter(function (e) { return e.q !== cut; });
    }
    const finalists = contenders.map(function (e) { return e.q; });

    // Winner: the best track record wins with F.bestRecordChance, the rest of
    // the chance is shared by the others (better records first).
    const avgStat = function (q) {
      const k = Object.keys(q.stats);
      return k.reduce(function (s, key) { return s + q.stats[key]; }, 0) / k.length;
    };
    const trackScore = function (q) {
      return q.wins * F.trackWinWeight - q.lipSyncs * F.trackBtm2Penalty + avgStat(q) * 0.01;
    };
    const byRecord = contenders.map(function (e) { return e.q; })
      .sort(function (a, b) { return trackScore(b) - trackScore(a); });
    const kN = byRecord.length;
    const share = (1 - F.bestRecordChance) / ((kN * (kN - 1)) / 2 || 1);
    let pickRoll = state.rng();
    let winIdx = kN - 1;
    for (let i = 0; i < kN; i++) {
      pickRoll -= i === 0 ? F.bestRecordChance : share * (kN - i);
      if (pickRoll < 0) { winIdx = i; break; }
    }
    const order = [byRecord[winIdx]].concat(byRecord.filter(function (q, i) { return i !== winIdx; }));
    const scored = order.map(function (q) { return { q: q }; });

    const song = pickFresh(state, typeof LIPSYNC_SONGS !== 'undefined' ? LIPSYNC_SONGS : [], state.songHistory);

    scored.forEach(function (item, i) {
      item.q.finalRank = i + 1;
      item.q.placements.push(i === 0 ? 'WINNER' : 'RUNNER UP');
    });

    // The cut queen is out, with a finale-only ELIM (not added to the guests)
    if (cut) {
      cut.status = 'eliminated';
      cut.eliminatedEp = state.episodes.length + 1;
      cut.finaleCut = true;
      cut.finalRank = entrants.length;
    }

    const log = {
      finale: true,
      entrants: ids(entrants),
      finalists: ids(finalists),
      cut: cut ? cut.id : null,
      guests: guests,
      song: song ? { id: song.id, title: song.title, artist: song.artist } : null,
      winner: scored[0].q.id,
      runnersUp: ids(scored.slice(1).map(function (s) { return s.q; }))
    };
    state.winner = log.winner;
    state.finale = log;
    return log;
  }



  /* ---------- Riggory for finales (Top 3, Top 4 and Lip Sync For The Crown) ----------
     finaleRigOptions(state) -> { cut: [ids] (empty if no cut), win: [ids] } or null
     applyFinaleRig(state, { cut: id, win: id })
       cut: (Top 4 only) the queen sent home before the final lip sync. The old
            cut queen re-enters as a finalist.
       win: the winner. Everyone else keeps their order as runners-up.
     The finale is already recorded when this runs, so it undoes the old
     result and records the new one. */
  function finaleRigOptions(state) {
    const f = state.finale;
    if (!f) return null;
    if (f.format === 'crown') {
      return { cut: [], ls1: f.matches[0].queens.slice(), ls2: f.matches[1].queens.slice(),
               win: f.matches[2].queens.slice() };
    }
    return { cut: f.cut ? f.entrants.slice() : [], win: f.finalists.slice() };
  }

  // Lip Sync For The Crown: edits = { ls1: id, ls2: id, win: id }
  //   ls1 / ls2: who wins the first / second lip sync (goes through)
  //   win: who wins the final lip sync (one of the two who went through)
  function applyCrownRig(state, edits) {
    const f = state.finale;
    const K = C.crownFinale;
    const byId = function (id) { return state.queens.find(function (q) { return q.id === id; }); };
    const ids = function (list) { return list.map(function (q) { return q.id; }); };
    const record = function (q) {
      const keys = Object.keys(q.stats);
      const avg = keys.reduce(function (s, k) { return s + q.stats[k]; }, 0) / keys.length;
      return avg + q.wins * K.winBonus - q.lipSyncs * K.btm2Penalty;
    };
    const m1 = f.matches[0], m2 = f.matches[1], fin = f.matches[2];
    const before = [m1.winner, m2.winner, fin.winner].join();
    const finalWonFrom = fin.winner === m1.winner ? m1 : m2;     // the match the old champion came through

    function setWinner(m, id, slot) {
      if (m.queens.indexOf(id) === -1) throw new Error('applyFinaleRig: "' + id + '" isn\'t in ' + slot + '.');
      m.winner = id;
      m.loser = m.queens.find(function (x) { return x !== id; });
    }
    if (edits.ls1) setWinner(m1, edits.ls1, 'lip sync one');
    if (edits.ls2) setWinner(m2, edits.ls2, 'lip sync two');

    // The final is between the two who went through. Keep the old champion if
    // she is still in it, otherwise whoever replaced her.
    const oldChamp = fin.winner;
    fin.queens = [m1.winner, m2.winner];
    fin.winner = fin.queens.indexOf(oldChamp) !== -1 ? oldChamp : finalWonFrom.winner;
    if (edits.win) {
      if (fin.queens.indexOf(edits.win) === -1) throw new Error('applyFinaleRig: "' + edits.win + '" isn\'t in the final.');
      fin.winner = edits.win;
    }
    fin.loser = fin.queens.find(function (x) { return x !== fin.winner; });

    // Undo the old result, record the new one
    f.entrants.forEach(function (id) {
      const q = byId(id);
      q.placements.pop();
      q.finalRank = null;
      q.lostRound1 = false;
    });
    const semiLosers = [byId(m1.loser), byId(m2.loser)].sort(function (a, b) { return record(b) - record(a); });
    byId(fin.winner).finalRank = 1;
    byId(fin.loser).finalRank = 2;
    semiLosers.forEach(function (q) { q.finalRank = 3; q.lostRound1 = true; });
    f.entrants.forEach(function (id) {
      const q = byId(id);
      q.placements.push(q.finalRank === 1 ? 'WINNER' : 'RUNNER UP');
    });

    f.winner = fin.winner;
    f.runnersUp = [fin.loser].concat(ids(semiLosers));
    state.winner = fin.winner;
    if ([m1.winner, m2.winner, fin.winner].join() !== before) { state.rigged = true; f.rigged = true; }
    return f;
  }

  function applyFinaleRig(state, edits) {
    const f = state.finale;
    if (!f) throw new Error('applyFinaleRig: nothing to rig here.');
    if (f.format === 'crown') return applyCrownRig(state, edits || {});
    edits = edits || {};
    const byId = function (id) { return state.queens.find(function (q) { return q.id === id; }); };
    const oldCut = f.cut, oldWinner = f.winner;

    let cut = oldCut;
    if (edits.cut) {
      if (!oldCut || f.entrants.indexOf(edits.cut) === -1) throw new Error('applyFinaleRig: "' + edits.cut + '" can\'t be cut here.');
      cut = edits.cut;
    }
    const finalists = f.entrants.filter(function (id) { return id !== cut; });

    // Finishing order: the old order, anyone new (the re-entering queen) at the end
    let order = [f.winner].concat(f.runnersUp).filter(function (id) { return finalists.indexOf(id) !== -1; });
    finalists.forEach(function (id) { if (order.indexOf(id) === -1) order.push(id); });
    if (edits.win) {
      if (order.indexOf(edits.win) === -1) throw new Error('applyFinaleRig: "' + edits.win + '" isn\'t a finalist.');
      order = [edits.win].concat(order.filter(function (id) { return id !== edits.win; }));
    }

    // Undo the old result
    f.finalists.forEach(function (id) { byId(id).placements.pop(); });
    if (oldCut) {
      const q = byId(oldCut);
      q.status = 'active'; q.eliminatedEp = null; q.finaleCut = false;
    }
    f.entrants.forEach(function (id) { byId(id).finalRank = null; });

    // Record the new one
    order.forEach(function (id, i) {
      const q = byId(id);
      q.finalRank = i + 1;
      q.placements.push(i === 0 ? 'WINNER' : 'RUNNER UP');
    });
    if (cut) {
      const q = byId(cut);
      q.status = 'eliminated'; q.eliminatedEp = state.episodes.length + 1;
      q.finaleCut = true; q.finalRank = f.entrants.length;
    }

    f.cut = cut;
    f.finalists = finalists;
    f.winner = order[0];
    f.runnersUp = order.slice(1);
    state.winner = order[0];
    if (cut !== oldCut || order[0] !== oldWinner) { state.rigged = true; f.rigged = true; }
    return f;
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

  return { newSeason: newSeason, prepareEpisode: prepareEpisode, commitEpisode: commitEpisode, applyRig: applyRig, resultEvents: resultEvents, rigOptions: rigOptions, runEpisode: runEpisode, runSeason: runSeason, runFinale: runFinale, applyFinaleRig: applyFinaleRig, finaleRigOptions: finaleRigOptions,
           simulate: simulate, getEpisodeShape: getEpisodeShape };

})();
