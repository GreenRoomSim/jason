/* ==========================================================================
   GreenRoom Simulator - js/episode.js
   The Episode screen. GRX simulates a whole episode instantly and returns an
   event list; this file turns that list into numbered SCENES and plays one
   scene per screen (press Continue). Animations are in css/episode.css.

   Sections:
     1. Elements and state
     2. Building scenes from an episode log
     3. Drawing a scene
     4. Developer panel (switch off in js/dev.js)
     5. Buttons and start-up
   Needs grx-config.js, grx-engine.js, queens.js, dev.js, track-record.js, setup.js, cast.js.

   A scene looks like:
     { id, kicker, title, text, big, together, cats, track,  all optional
       groups: [ { label, big, vs, text, items: [ { id, tag, tone, fx } ] } ] }
     group.text appears after that group's queens have been revealed.
     tone: 'safe' | 'high' | 'win' | 'low' | 'btm' | 'elim'  (tag colour)
     fx:   'winner' | 'glow' | 'out' | 'crown' | 'cut'                         (card effect)
   ========================================================================== */

'use strict';

const Episode = (function () {

  /* ---------- 1. Elements and state ---------- */
  const stageBox   = document.getElementById('episode-stage');
  const nextBtn    = document.getElementById('ep-next');
  const episodeTag = document.getElementById('episode-label');

  const STEP = 0.35;        // seconds between queens appearing one by one

  // What the judges say about each performance band (ids from grx-config.js)
  const BAND_TEXT = {
    slayed: 'Slayed the challenge!',
    good:   'Had a good performance!',
    okay:   'Had an okay performance.',
    bad:    'Had a bad performance.',
    flop:   'Flopped The Challenge...'
  };
  function C_BANDS() { return GRX_CONFIG.performanceBands.map(function (b) { return b.id; }); }

  let season = null;
  let scenes = [];          // scenes of the episode being shown
  let sceneIndex = 0;       // how many scenes of this episode have been shown
  let currentLog = null;    // the episode log being played (for the dev panel)
  let devPanel = null;

  // Riggory (only when the "User Riggory" extra is switched on in Setup)
  let rigOn = false;        // is riggory on for this season?
  let draft = null;         // the episode being shown, simulated but NOT recorded yet
  let shownId = null;       // id of the scene on screen
  let rigBtn = null;        // the small "Choose Outcome" button

  function queenData(id) { return QUEENS.find(function (q) { return q.id === id; }); }
  function name(id) { return queenData(id).name; }
  function names(ids) { return ids.map(name).join(', '); }
  function item(id, tag, tone, fx) { return { id: id, tag: tag, tone: tone, fx: fx }; }
  function plain(ids) { return ids.map(function (id) { return item(id); }); }


  /* ---------- 2. Building scenes ---------- */
  // Premiere episodes (top 2 / split): nobody is eliminated. The top 2 queens
  // lip sync for the win instead. GRX marks these logs with log.premiere.
  function buildPremiereScenes(log, ev) {
    const out = [];
    const appearing = log.appearing;
    const isSplit = season.premiere.id === 'split';
    const r = ev.results;
    const winner = ev.lipsync.winner;
    const loser = ev.lipsync.loser;

    if (ev.entrance) {
      const second = isSplit && log.episode === 2;
      out.push({ id: 'entrance', title: 'Welcome to the Werk Room',
                 text: !isSplit ? 'The queens enter one by one.'
                                : (second ? 'The second group of queens enters.'
                                          : 'The first group of queens enters.'),
                 groups: [{ items: plain(ev.entrance.queens) }] });
    }

    out.push({ id: 'challenge', title: 'This week\u2019s maxi challenge', big: ev.challenge.name });
    const cats = [];
    C_BANDS().forEach(function (id) {
      if (ev.challenge.bands[id].length) cats.push({ ids: ev.challenge.bands[id], text: BAND_TEXT[id] });
    });
    out.push({ id: 'challenge-perform', kicker: 'The main challenge', title: ev.challenge.name, cats: cats });

    out.push({ id: 'runway', kicker: 'The runway',
               title: ev.runway.theme ? ev.runway.theme.name : 'The runway',
               text: 'The queens walk the runway.',
               groups: [{ items: plain(appearing) }] });

    if (ev.safe.queens.length) {
      out.push({ id: 'safe', title: 'Safe',
                 text: 'These queens are safe and head to Untucked.',
                 groups: [{ items: ev.safe.queens.map(function (id) { return item(id, 'SAFE', 'safe'); }) }] });
    }

    // The tops (no bottoms in a premiere)
    out.push({ id: 'critiques', title: 'The critiques',
               text: 'The judges give their critiques.',
               groups: [{ label: 'Tops', items: plain(ev.critiques.tops) }] });

    // The other tops are safe; the top 2 are named
    const topGroups = [];
    if (r.high.length) {
      topGroups.push({ size: 'compact',
                       items: r.high.map(function (id) { return item(id, 'HIGH', 'high'); }),
                       text: 'Excellent work this week, you are safe.' });
    }
    topGroups.push({ size: 'mid',
                     items: r.top2.map(function (id) { return item(id, 'TOP 2', 'top2'); }),
                     text: names(r.top2) + ', you are the top two of the week.' });
    out.push({ id: 'top2', kicker: 'The top queens', together: true, groups: topGroups });

    const song = ev.lipsync.song;
    out.push({ id: 'lipsync', title: 'Lip sync for the win',
               text: song ? '\u266A ' + song.title + ' \u2013 ' + song.artist + ' \u266A' : '',
               groups: [{ big: true, vs: true, items: ev.lipsync.queens.map(function (id) { return item(id, null, null, 'glow'); }) }] });

    out.push({ id: 'winner', kicker: 'The winner of the lip sync', together: true,
               groups: [{ size: 'mid', items: [item(winner, 'WIN', 'win', 'winner')],
                          text: name(winner) + ', condragulations, you are the winner of this week\u2019s challenge!!' },
                        { size: 'compact', items: [item(loser, 'TOP 2', 'top2')],
                          text: name(loser) + ', you were fierce tonight. You are safe.' }] });

    out.push({ id: 'no-elimination', title: 'No one goes home tonight',
               text: isSplit && log.episode === 1
                     ? 'The other half of the cast arrives next week.'
                     : 'Everyone stays for another week.' });

    out.push({ id: 'track', title: 'Track record', track: true });
    return out;
  }

  // Talent Show (two parts). Part 1: top 2 lip sync for the win, one BTM1 is
  // safe for now. Part 2: same, then the two BTM queens lip sync for their lives.
  function buildTalentScenes(log, ev) {
    const out = [];
    const t = ev['talent-results'];
    const part = t.part;
    const performing = t.performing, raters = t.raters;
    const winner = ev.lipsync.winner, loser = ev.lipsync.loser;

    // Talent Show premiere: the queens enter first
    if (ev.entrance) {
      out.push({ id: 'entrance', title: 'Welcome to the Werk Room',
                 text: 'The queens enter one by one.',
                 groups: [{ items: plain(ev.entrance.queens) }] });
    }

    out.push({ id: 'challenge', title: 'This week\u2019s maxi challenge', big: 'Talent Show',
               text: part === 1 ? 'This is a two part challenge! Half of the queens perform this week, and the other half perform next week.'
                                : 'Part two of the Talent Show! The second group performs tonight.',
               groups: part === 1
                 ? [{ label: 'Week one', size: 'compact', items: plain(performing) },
                    { label: 'Week two', size: 'compact', items: plain(raters) }]
                 : [{ label: 'Performing tonight', size: 'compact', items: plain(performing) }] });

    const cats = [];
    C_BANDS().forEach(function (id) {
      if (ev.challenge.bands[id].length) cats.push({ ids: ev.challenge.bands[id], text: BAND_TEXT[id] });
    });
    out.push({ id: 'challenge-perform', kicker: part === 1 ? 'Talent Show: week one' : 'Talent Show: week two',
               title: 'Talent Show', cats: cats });

    out.push({ id: 'rate', kicker: 'It\u2019s time for', title: 'Rate A Queen',
               text: 'The queens who are not performing rate tonight\u2019s performers.',
               groups: [{ label: 'Rating', size: 'compact', items: plain(raters) }] });

    out.push({ id: 'runway', kicker: 'The runway',
               title: ev.runway.theme ? ev.runway.theme.name : 'The runway',
               text: 'The performing queens walk the runway.',
               groups: [{ items: plain(performing) }] });

    if (t.critiqued.length) {
      out.push({ id: 'safe', title: 'Safe',
                 text: 'These queens are safe.',
                 groups: [{ items: t.critiqued.map(function (id) { return item(id, 'SAFE', 'safe'); }) }] });
    }

    out.push({ id: 'top2', kicker: 'The top queens', together: true,
               groups: [{ size: 'mid', items: t.top2.map(function (id) { return item(id, 'TOP 2', 'top2'); }),
                          text: names(t.top2) + ', you are the top two of the week.' }] });

    // The bottom queen is named before the top 2 lip sync
    if (part === 1) {
      out.push({ id: 'btm1', kicker: 'The bottom queen', together: true,
                 groups: [{ size: 'mid', items: [item(t.btm, 'BTM1', 'btm')],
                            text: name(t.btm) + ', you are safe this week. But next week, you will lip sync for your life against next week\u2019s bottom queen.' }] });
    } else {
      out.push({ id: 'bottom', kicker: 'The bottom queens', together: true,
                 groups: [{ size: 'mid', items: [t.btm, t.prevBtm].map(function (id) { return item(id, 'BTM2', 'btm'); }),
                            text: name(t.btm) + ', you are this week\u2019s bottom queen, and you will be lip syncing for your life against last week\u2019s bottom queen, ' + name(t.prevBtm) + '.' }] });
    }

    const song = ev.lipsync.song;
    out.push({ id: 'lipsync', title: 'Lip sync for the win',
               text: song ? '\u266A ' + song.title + ' \u2013 ' + song.artist + ' \u266A' : '',
               groups: [{ big: true, vs: true, items: ev.lipsync.queens.map(function (id) { return item(id, null, null, 'glow'); }) }] });

    out.push({ id: 'winner', kicker: 'The winner of the lip sync', together: true,
               groups: [{ size: 'mid', items: [item(winner, 'WIN', 'win', 'winner')],
                          text: name(winner) + ', condragulations, you are the winner of this week\u2019s challenge!!' },
                        { size: 'compact', items: [item(loser, 'TOP 2', 'top2')],
                          text: name(loser) + ', you were fierce tonight. You are safe.' }] });

    if (part === 2) {
      const bl = ev['btm-lipsync'];
      const bsong = bl.song;
      out.push({ id: 'lipsync-life', title: 'Lip sync for your life',
                 text: bsong ? '\u266A ' + bsong.title + ' \u2013 ' + bsong.artist + ' \u266A' : '',
                 groups: [{ big: true, vs: true, items: bl.queens.map(function (id) { return item(id, null, null, 'glow'); }) }] });
      if (bl.double === 'shantay') {
        out.push({ id: 'shantay', title: 'Double shantay',
                   text: bl.queens.map(name).join(' and ') + ', shantay, you both stay.',
                   groups: [{ big: true, items: bl.queens.map(function (id) { return item(id, null, null, 'glow'); }) }] });
      } else if (bl.double === 'sashay') {
        out.push({ id: 'double-sashay', title: 'Double sashay',
                   text: ev.elimination.queens.map(name).join(' and ') + ', sashay away.',
                   groups: [{ big: true, items: ev.elimination.queens.map(function (id) { return item(id, 'ELIMINATED', 'elim', 'out'); }) }] });
      } else {
        out.push({ id: 'shantay', title: 'Shantay, you stay',
                   text: name(bl.stay) + ', shantay, you stay.',
                   groups: [{ big: true, items: [item(bl.stay, null, null, 'glow')] }] });
        out.push({ id: 'sashay', title: 'Sashay away',
                   text: name(ev.elimination.queen) + ', sashay away.',
                   groups: [{ big: true, items: [item(ev.elimination.queen, 'ELIMINATED', 'elim', 'out')] }] });
      }
    }

    out.push({ id: 'track', title: 'Track record', track: true,
               text: part === 1 ? 'No one goes home tonight. The other half of the cast performs next week.' : '' });
    return out;
  }

  // Lip Sync Legacy: the top 2 lip sync for the win, and the winner chops one
  // of the bottom queens (nobody else lip syncs).
  function buildLegacyScenes(log, ev) {
    const out = [];
    const everyone = ev.safe.queens.concat(ev.critiques.tops, ev.critiques.bottoms);
    const r = ev.results, ch = ev.chop;
    const winner = ev.lipsync.winner, loser = ev.lipsync.loser;

    if (ev.entrance) {
      out.push({ id: 'entrance', title: 'Welcome to the Werk Room',
                 text: 'The queens enter one by one.',
                 groups: [{ items: plain(ev.entrance.queens) }] });
    }

    out.push({ id: 'challenge', title: 'This week\u2019s maxi challenge', big: ev.challenge.name });
    const cats = [];
    C_BANDS().forEach(function (id) {
      if (ev.challenge.bands[id].length) cats.push({ ids: ev.challenge.bands[id], text: BAND_TEXT[id] });
    });
    out.push({ id: 'challenge-perform', kicker: 'The main challenge', title: ev.challenge.name, cats: cats });

    out.push({ id: 'runway', kicker: 'The runway',
               title: ev.runway.theme ? ev.runway.theme.name : 'The runway',
               text: 'The queens walk the runway.',
               groups: [{ items: plain(everyone) }] });

    if (ev.safe.queens.length) {
      out.push({ id: 'safe', title: 'Safe',
                 text: 'These queens are safe and head to Untucked.',
                 groups: [{ items: ev.safe.queens.map(function (id) { return item(id, 'SAFE', 'safe'); }) }] });
    }

    out.push({ id: 'critiques', title: 'The critiques',
               text: 'The judges give their critiques.',
               groups: [{ label: 'Tops', items: plain(ev.critiques.tops) },
                        { label: 'Bottoms', items: plain(ev.critiques.bottoms) }] });

    out.push({ id: 'top', kicker: 'The top queens', together: true,
               groups: [{ size: 'mid', items: r.top2.map(function (id) { return item(id, 'TOP 2', 'top2'); }),
                          text: r.top2.map(name).join(' and ') + ', you are the top two of the week. You will lip sync for your legacy!' }] });

    out.push({ id: 'bottom', kicker: 'The bottom queens', together: true,
               groups: [{ size: 'compact',
                          items: r.btm2.map(function (id) { return item(id, 'BTM' + r.btm2.length, 'btm'); }),
                          text: r.btm2.map(name).join(', ') + ', I\u2019m sorry my dear, but you are up for elimination. ' +
                                'The winner of the lip sync will decide who goes home.' }] });

    const song = ev.lipsync.song;
    out.push({ id: 'lipsync', title: 'Lip sync for your legacy',
               text: song ? '\u266A ' + song.title + ' \u2013 ' + song.artist + ' \u266A' : '',
               groups: [{ big: true, vs: true, items: ev.lipsync.queens.map(function (id) { return item(id, null, null, 'glow'); }) }] });

    out.push({ id: 'winner', kicker: 'The winner of the lip sync', together: true,
               groups: [{ size: 'mid', items: [item(winner, 'WIN', 'win', 'winner')],
                          text: name(winner) + ', condragulations, you are the winner of this week\u2019s challenge!! ' +
                                'You have the power to chop one of the bottom queens.' },
                        { size: 'compact', items: [item(loser, 'TOP 2', 'top2')],
                          text: name(loser) + ', you were fierce tonight. You are safe.' }] });

    out.push({ id: 'chop', title: 'The chop',
               text: name(winner) + ', who will you chop?',
               groups: [{ big: true, items: ch.bottoms.map(function (id) { return item(id, null, null, 'glow'); }) }] });

    out.push({ id: 'sashay', title: 'Sashay away',
               text: name(winner) + ' has chosen to chop ' + name(ch.chopped) + '. ' + name(ch.chopped) + ', sashay away.',
               groups: [{ big: true, items: [item(ch.chopped, 'ELIMINATED', 'elim', 'out')] }] });

    out.push({ id: 'track', title: 'Track record', track: true });
    return out;
  }

  function buildScenes(log) {
    const ev = {};
    log.events.forEach(function (e) { ev[e.type] = e; });
    if (log.talentShow) return buildTalentScenes(log, ev);
    if (log.legacy) return buildLegacyScenes(log, ev);
    if (log.premiere) return buildPremiereScenes(log, ev);
    const out = [];

    // Everyone still in the competition this week
    const everyone = ev.safe.queens.concat(ev.critiques.tops, ev.critiques.bottoms);

    if (ev.entrance) {
      out.push({ id: 'entrance', title: 'Welcome to the Werk Room',
                 text: 'The queens enter one by one.',
                 groups: [{ items: plain(ev.entrance.queens) }] });
    }

    out.push({ id: 'challenge', title: 'This week\u2019s maxi challenge', big: ev.challenge.name });
    const cats = [];
    C_BANDS().forEach(function (id) {
      if (ev.challenge.bands[id].length) cats.push({ ids: ev.challenge.bands[id], text: BAND_TEXT[id] });
    });
    out.push({ id: 'challenge-perform', kicker: 'The main challenge', title: ev.challenge.name, cats: cats });

    out.push({ id: 'runway', kicker: 'The runway',
               title: ev.runway.theme ? ev.runway.theme.name : 'The runway',
               text: 'The queens walk the runway.',
               groups: [{ items: plain(everyone) }] });

    if (ev.safe.queens.length) {
      out.push({ id: 'safe', title: 'Safe',
                 text: 'These queens are safe and head to Untucked.',
                 groups: [{ items: ev.safe.queens.map(function (id) { return item(id, 'SAFE', 'safe'); }) }] });
    }

    out.push({ id: 'critiques', title: 'The critiques',
               text: 'The judges give their critiques.',
               groups: [{ label: 'Tops', items: plain(ev.critiques.tops) },
                        { label: 'Bottoms', items: plain(ev.critiques.bottoms) }] });

    // Top results: winner on top, highs underneath
    const r = ev.results;
    const topGroups = [{
      size: 'mid',
      items: [item(r.win, 'WIN', 'win', 'winner')],
      text: name(r.win) + ', condragulations you are the winner of this week\u2019s challenge!!'
    }];
    if (r.high.length) {
      topGroups.push({
        size: 'compact',
        items: r.high.map(function (id) { return item(id, 'HIGH', 'high'); }),
        text: 'Excellent work this week, you are safe.'
      });
    }
    out.push({ id: 'top', kicker: 'The top queens', together: true, groups: topGroups });

    // Bottom results: the safe LOW queen on top, the bottom 2 underneath
    const btmGroups = [];
    if (r.low) {
      btmGroups.push({
        size: 'mid',
        items: [item(r.low, 'LOW', 'low')],
        text: name(r.low) + ', you are... safe.'
      });
    }
    btmGroups.push({
      size: 'compact',
      items: r.btm2.map(function (id) { return item(id, 'BTM2', 'btm'); }),
      text: r.btm2.map(name).join(', ') + ', I\u2019m sorry my dear, but you are up for elimination.'
    });
    out.push({ id: 'bottom', kicker: 'The bottom queens', together: true, groups: btmGroups });

    const song = ev.lipsync.song;
    out.push({ id: 'lipsync', title: 'Lip sync for your life',
               text: song ? '\u266A ' + song.title + ' \u2013 ' + song.artist + ' \u266A' : '',
               groups: [{ big: true, vs: true, items: ev.lipsync.queens.map(function (id) { return item(id, null, null, 'glow'); }) }] });

    if (ev.lipsync.double === 'shantay') {
      // Double shantay: both stay, nobody goes home
      out.push({ id: 'shantay', title: 'Double shantay',
                 text: ev.lipsync.queens.map(name).join(' and ') + ', shantay, you both stay.',
                 groups: [{ big: true, items: ev.lipsync.queens.map(function (id) { return item(id, null, null, 'glow'); }) }] });
    } else if (ev.lipsync.double === 'sashay') {
      // Double sashay: both go home
      out.push({ id: 'double-sashay', title: 'Double sashay',
                 text: ev.elimination.queens.map(name).join(' and ') + ', sashay away.',
                 groups: [{ big: true, items: ev.elimination.queens.map(function (id) { return item(id, 'ELIMINATED', 'elim', 'out'); }) }] });
    } else {
      out.push({ id: 'shantay', title: 'Shantay, you stay',
                 text: name(ev.lipsync.stay) + ', shantay, you stay.',
                 groups: [{ big: true, items: [item(ev.lipsync.stay, null, null, 'glow')] }] });

      out.push({ id: 'sashay', title: 'Sashay away',
                 text: name(ev.elimination.queen) + ', sashay away.',
                 groups: [{ big: true, items: [item(ev.elimination.queen, 'ELIMINATED', 'elim', 'out')] }] });
    }

    // Recap of every episode so far (gains one column per episode)
    out.push({ id: 'track', title: 'Track record', track: true });

    return out;
  }


  /* ---------- 3. Drawing a scene ---------- */
  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function makeQueenCard(id, fx) {
    const queen = queenData(id);
    const card = make('div', 'queen-card scene-card' + (fx === 'winner' ? ' is-winner' : '') +
                             (fx === 'glow' ? ' is-glow' : '') + (fx === 'out' ? ' is-out' : '') +
                             (fx === 'crown' ? ' is-crowned' : '') + (fx === 'cut' ? ' is-cut' : ''));

    const portrait = make('span', 'portrait');
    if (queen.image) {
      const img = document.createElement('img');
      img.src = queen.image;
      img.alt = '';
      img.addEventListener('error', function () { img.remove(); });
      portrait.appendChild(img);
    }
    const label = make('span', 'queen-name', queen.name);
    if (queen.name.length >= 16) label.classList.add('is-xlong');
    else if (queen.name.length >= 11) label.classList.add('is-long');

    card.appendChild(portrait);
    card.appendChild(label);
    return card;
  }

  function drawScene(scene) {
    stageBox.textContent = '';
    if (scene.kicker) stageBox.appendChild(make('p', 'scene-kicker', scene.kicker));
    if (scene.title)  stageBox.appendChild(make('h3', 'scene-title', scene.title));
    if (scene.big)    stageBox.appendChild(make('p', 'scene-big', scene.big));
    if (scene.text)   stageBox.appendChild(make('p', 'scene-text', scene.text));

    // Performance categories: one row per category, each row appears as one piece
    if (scene.cats) {
      const box = make('div', 'scene-cats');
      scene.cats.forEach(function (cat, i) {
        const row = make('div', 'scene-cat');
        row.style.setProperty('--d', (0.2 + i * 0.45).toFixed(2) + 's');
        const cards = make('div', 'scene-cat-cards');
        cat.ids.forEach(function (id) { cards.appendChild(makeQueenCard(id)); });
        row.appendChild(cards);
        row.appendChild(make('span', 'scene-cat-text', cat.text));
        box.appendChild(row);
      });
      stageBox.appendChild(box);
    }

    // Groups of queens. scene.together = everything (cards, tags, text) at once.
    let t = 0.2;                         // reveal clock (seconds) for this scene
    (scene.groups || []).forEach(function (group) {
      if (group.label) stageBox.appendChild(make('h4', 'scene-group-label', group.label));
      const row = make('div', 'scene-row' + (group.big ? ' is-big' : '') + (group.size ? ' is-' + group.size : ''));

      let lastDelay = t;
      group.items.forEach(function (it, i) {
        if (group.vs && i > 0) row.appendChild(make('span', 'scene-vs', 'VS'));
        const wrap = make('div', 'scene-item');
        wrap.style.setProperty('--d', t.toFixed(2) + 's');           // card AND tag read this
        if (scene.together) wrap.style.setProperty('--tag-gap', '0s');
        if (it.fx === 'crown') wrap.appendChild(make('span', 'scene-crown'));
        wrap.appendChild(makeQueenCard(it.id, it.fx));
        if (it.tag) wrap.appendChild(make('span', 'scene-tag ' + (it.tone || ''), it.tag));
        row.appendChild(wrap);
        lastDelay = t;
        if (!scene.together) t += STEP;
      });
      stageBox.appendChild(row);

      // Text for this group
      if (group.text) {
        const late = make('p', 'scene-text scene-late', group.text);
        const delay = scene.together ? 0.2 : lastDelay + 1.1;
        late.style.setProperty('--d', delay.toFixed(2) + 's');
        stageBox.appendChild(late);
        if (!scene.together) t = delay + 0.8;
      }
    });

    // Season recap boxes: scene.recap = [ [label, value], ... ]
    if (scene.recap) {
      const list = make('dl', 'scene-recap');
      scene.recap.forEach(function (row) {
        const box = make('div');
        box.appendChild(make('dt', null, row[0]));
        box.appendChild(make('dd', null, row[1]));
        list.appendChild(box);
      });
      stageBox.appendChild(list);
    }

    // Track record table (built from the season so far)
    if (scene.track) stageBox.appendChild(TrackRecord.build(season, queenData));

    // Confetti for the winner reveal
    if (scene.confetti) stageBox.appendChild(makeConfetti());

    // Restart the entrance animation of the title and text
    stageBox.classList.toggle('is-tight', !!scene.together);
    stageBox.classList.remove('is-new');
    void stageBox.offsetWidth;
    stageBox.classList.add('is-new');

    updateDev(scene);
  }

  /* ---------- Finale scenes ---------- */
  const CONFETTI_COLORS = ['#ffd100', '#fff3a6', '#4cbd88', '#8ce6b9', '#ffffff', '#286a52'];

  function makeConfetti() {
    const box = make('div', 'confetti');
    box.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 44; i++) {
      const bit = make('i');
      bit.style.setProperty('--x',  (Math.random() * 100).toFixed(1) + '%');
      bit.style.setProperty('--dx', Math.round(Math.random() * 160 - 80) + 'px');
      bit.style.setProperty('--r',  Math.round(360 + Math.random() * 720) + 'deg');
      bit.style.setProperty('--t',  (3 + Math.random() * 2.5).toFixed(2) + 's');
      bit.style.setProperty('--dl', (0.4 + Math.random() * 2.2).toFixed(2) + 's');
      bit.style.setProperty('--c',  CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
      box.appendChild(bit);
    }
    return box;
  }

  function numberWord(n) { return ['zero', 'one', 'two', 'three', 'four', 'five', 'six'][n] || String(n); }

  // Row size for the finalists: 1-2 big, 3 trio, 4+ mid
  function finalistSize(n) { return n <= 2 ? 'big' : (n === 3 ? 'trio' : 'mid'); }

  // Tag for the two queens who lose their first lip sync in Lip Sync For The Crown
  const LOST_R1 = 'LOST\n1ST\nROUND';

  // Lip Sync For The Crown: rules, two lip syncs (each followed by who goes
  // through), then the final lip sync for the crown. Adds the scenes to `out`
  // and returns the two queens in the final.
  function crownScenes(out, fin) {
    const WORDS = ['one', 'two'];
    out.push({ id: 'finale-crown-rules', kicker: 'The finale format', title: 'Lip Sync For The Crown',
               text: 'Two lip syncs first. The two winners then lip sync head to head for the crown.' });

    fin.matches.slice(0, 2).forEach(function (m, i) {
      const song = m.song ? '\u266A ' + m.song.title + ' \u2013 ' + m.song.artist + ' \u266A' : '';
      out.push({ id: 'crown-ls-' + (i + 1), kicker: 'Lip sync ' + WORDS[i] + ' of three',
                 title: i === 0 ? 'The first lip sync' : 'The second lip sync', text: song,
                 groups: [{ size: 'big', vs: true, items: m.queens.map(function (id) { return item(id, null, null, 'glow'); }) }] });
      out.push({ id: 'crown-result-' + (i + 1), kicker: 'Through to the final lip sync', together: true,
                 groups: [{ size: 'mid', items: [item(m.winner, 'THROUGH', 'win', 'winner')],
                            text: name(m.winner) + ', you are going to the final lip sync for the crown!' },
                          { size: 'compact', items: [item(m.loser, LOST_R1, 'lost-r1')],
                            text: name(m.loser) + ', you will not be wearing the crown tonight.' }] });
    });

    const last = fin.matches[2];
    out.push({ id: 'finale-lipsync', kicker: 'It\u2019s time for', title: 'The lip sync for the crown',
               text: last.song ? '\u266A ' + last.song.title + ' \u2013 ' + last.song.artist + ' \u266A' : '',
               groups: [{ size: 'big', vs: true, items: last.queens.map(function (id) { return item(id, null, null, 'glow'); }) }] });
    return last.queens;
  }

  // The finale screens, from the log made by GRX.runFinale
  function buildFinaleScenes(fin) {
    const out = [];
    const count = fin.finalists.length;                          // queens in the final lip sync
    const total = (fin.entrants || fin.finalists).length;        // queens left when the finale starts
    const winner = fin.winner;
    const queens = season.queens;

    // 1. Announcement
    out.push({ id: 'finale-announce', kicker: 'It all comes down to this', big: 'The Finale',
               text: 'After ' + season.episodes.length + ' episodes, only ' + numberWord(total) +
                     ' queens are left. One of them will be crowned the winner of this season.' });

    // 2. The eliminated queens return as guests
    out.push({ id: 'finale-guests', title: 'Welcome back to the stage',
               text: 'The queens of this season!',
               groups: [{ size: fin.guests.length > 8 ? 'compact' : 'mid',
                          items: fin.guests.map(function (id) { return item(id, 'GUEST', 'guest'); }) }] });

    // 2b. Top 4 finale: one queen is cut before the final lip sync
    if (fin.cut) {
      out.push({ id: 'finale-cut-announce', kicker: 'But wait', title: 'Only ' + numberWord(count) + ' will make it',
                 text: 'Only ' + numberWord(count) + ' of you will be making it to the final lip sync.',
                 groups: [{ size: 'mid', items: plain(fin.entrants) }] });
      out.push({ id: 'finale-cut', kicker: 'Not tonight', title: name(fin.cut),
                 text: name(fin.cut) + ', I\u2019m sorry my dear, but you will not be making it to the final lip sync.',
                 groups: [{ big: true, items: [item(fin.cut, 'ELIM', 'finale-elim', 'cut')] }] });
    }

    // 3. The finalists
    out.push({ id: 'finale-finalists', kicker: 'The finalists',
               title: 'Now it\u2019s time for the top ' + count,
               text: 'The finalists enter the stage.',
               groups: [{ size: finalistSize(count), items: plain(fin.finalists) }] });

    // 4. The final lip sync (Lip Sync For The Crown plays three, see crownScenes)
    let pair = fin.finalists;
    if (fin.matches) {
      pair = crownScenes(out, fin);
    } else {
      out.push({ id: 'finale-lipsync', kicker: 'It\u2019s time for', title: 'The final lip sync',
                 text: fin.song ? '\u266A ' + fin.song.title + ' \u2013 ' + fin.song.artist + ' \u266A' : '',
                 groups: [{ size: finalistSize(count), vs: true,
                            items: fin.finalists.map(function (id) { return item(id, null, null, 'glow'); }) }] });
    }

    // 5. Before the winner is named
    out.push({ id: 'finale-decision', title: 'Ladies, I\u2019ve made my decision.',
               groups: [{ size: 'mid',
                          items: pair.map(function (id) { return item(id, null, null, 'glow'); }),
                          text: 'The winner of this season is\u2026' }] });

    // 6. The winner (crown, gold ring, confetti), runners-up underneath
    const winGroups = [{
      size: 'hero',
      items: [item(winner, 'WINNER', 'winner', 'crown')],
      text: 'Condragulations ' + name(winner) + ', you are the winner of this season!'
    }];
    if (fin.runnersUp.length) {
      winGroups.push({ size: 'compact',
                       items: fin.runnersUp.map(function (id) {
                         const lostFirst = fin.matches && fin.matches.slice(0, 2).some(function (m) { return m.loser === id; });
                         return lostFirst ? item(id, LOST_R1, 'lost-r1') : item(id, 'RUNNER UP', 'runner');
                       }) });
    }
    out.push({ id: 'finale-winner', kicker: 'Your winner', confetti: true, groups: winGroups });

    // 7. Recap + track record
    const mostOf = function (key) {
      const max = Math.max.apply(null, queens.map(function (q) { return q[key]; }));
      if (max === 0) return 'Nobody';
      return queens.filter(function (q) { return q[key] === max; })
                   .map(function (q) { return q.name; }).join(', ') + ' (' + max + ')';
    };
    out.push({ id: 'recap', kicker: 'Season recap', title: name(winner) + ' wins!',
               recap: [
                 ['Winner', name(winner)],
                 ['Runner' + (fin.runnersUp.length === 1 ? '-up' : 's-up'), names(fin.runnersUp)],
                 ['Most challenge wins', mostOf('wins')],
                 ['Most bottom 2s', mostOf('lipSyncs')],
                 ['First out', name(season.eliminated[0].id)],
                 ['Episodes', String(season.episodes.length + 1)]
               ],
               track: true });
    return out;
  }


  /* ---------- 4. Developer panel ---------- */
  function updateDev(scene) {
    if (!DEV.enabled) return;
    if (!devPanel) {
      devPanel = make('aside', 'dev-panel');
      devPanel.setAttribute('aria-hidden', 'true');
      document.querySelector('[data-screen="episode"]').appendChild(devPanel);
    }

    const lines = ['DEV MODE'];
    const inEpisode = currentLog && scenes.indexOf(scene) !== -1;
    lines.push(inEpisode
      ? 'Screen ' + (scenes.indexOf(scene) + 1) + ' / ' + scenes.length + '  (' + scene.id + ')'
      : 'Screen: ' + scene.id);

    if (season) {
      lines.push('Queens left: ' + season.queens.filter(function (q) { return q.status === 'active'; }).length);
    }
    if (inEpisode && currentLog.finale) {
      lines.push('Finalists: ' + currentLog.finalists.length +
                 (currentLog.cut ? '  (cut: ' + name(currentLog.cut) + ')' : ''));
      lines.push('Winner: ' + name(currentLog.winner));
    } else if (inEpisode) {
      const ev = {};
      currentLog.events.forEach(function (e) { ev[e.type] = e; });
      lines.push('Episode ' + currentLog.episode + ' (' + currentLog.queensLeft + ' at start)');
      lines.push('Challenge: ' + ev.challenge.name);
      lines.push('Runway: ' + (ev.runway.theme ? ev.runway.theme.name : '-'));
      lines.push('Song: ' + (ev.lipsync.song ? ev.lipsync.song.title : '-'));
      if (currentLog.premiere) {
        lines.push('Premiere: ' + season.premiere.id + '  (' + currentLog.appearing.length + ' queens in this episode)');
      } else {
        if (ev.lipsync.double) lines.push('DOUBLE ' + ev.lipsync.double.toUpperCase());
        lines.push('BTM2 cap: ' + season.btm2Cap + (ev.lipsync.forcedByCap ? '  (elimination forced by cap)' : ''));
      }
    }
    devPanel.textContent = lines.join('\n');
  }


  /* ---------- Riggory: Choose Outcome ----------
     With the "User Riggory" extra on, a regular episode is simulated into a
     DRAFT (GRX.prepareEpisode) and shown as a preview. The Choose Outcome
     button appears on two scenes:
       'critiques'  before the results: pick the winner, then who is LOW
       'lipsync'    before the lip sync result: pick who stays
     Nothing changes until Lock In. After Lock In the remaining scenes are
     rebuilt from the edited draft. The draft is recorded for real (placements,
     wins, elimination) just before the 'shantay' scene. */
  function previewLog(d) {
    const log = { episode: season.episode,
                  queensLeft: d.kind === 'premiere' ? d.everyone.length : d.n,
                  appearing: d.active.map(function (q) { return q.id; }),
                  events: d.events.concat(GRX.resultEvents(d)) };
    if (d.kind === 'premiere') log.premiere = true;
    if (d.talent) log.talentShow = d.talent;
    return log;
  }

  // A pickable queen: same look as the cast cards (photo, name, green ring + tick)
  function rigCard(id, selected) {
    const queen = queenData(id);
    const card = make('button', 'queen-card rig-pick' + (selected ? ' is-selected' : ''));
    card.type = 'button';
    card.setAttribute('aria-pressed', String(selected));
    card.setAttribute('aria-label', queen.name);

    const portrait = make('span', 'portrait');
    if (queen.image) {
      const img = document.createElement('img');
      img.src = queen.image;
      img.alt = '';
      img.addEventListener('error', function () { img.remove(); });
      portrait.appendChild(img);
    }
    const label = make('span', 'queen-name', queen.name);
    if (queen.name.length >= 16) label.classList.add('is-xlong');
    else if (queen.name.length >= 11) label.classList.add('is-long');

    card.appendChild(portrait);
    card.appendChild(label);
    card.appendChild(make('span', 'queen-check'));
    return card;
  }

  let rigDialog = null, rigTitle = null, rigText = null, rigGrid = null, rigExtra = null, rigActions = null;

  function ensureRigDialog() {
    if (rigDialog) return;
    rigDialog = make('dialog', 'modal modal--rig');
    rigDialog.setAttribute('aria-labelledby', 'rig-title');
    rigTitle = make('h3', 'modal-title');
    rigTitle.id = 'rig-title';
    rigText = make('p', 'modal-text');
    rigGrid = make('div', 'rig-grid');
    rigExtra = make('div', 'rig-double');     // Save both / Eliminate both (lip sync pick only), sits under Cancel / Lock In
    rigActions = make('div', 'rig-actions');
    // Escape closes the popup only (it must not also send you back to Home)
    rigDialog.addEventListener('keydown', function (event) { event.stopPropagation(); });
    rigDialog.addEventListener('click', function (event) { if (event.target === rigDialog) rigDialog.close(); });
    // While the popup is open, the animations behind it are paused (keeps it smooth)
    rigDialog.addEventListener('close', function () { document.body.classList.remove('rig-open'); });
    [rigTitle, rigText, rigGrid, rigActions, rigExtra].forEach(function (n) { rigDialog.appendChild(n); });
    document.body.appendChild(rigDialog);
  }

  // Which pick screens the popup has for this draft ([] = nothing to change)
  function rigStepsFor(mode, opts) {
    const steps = [];
    if (!opts) return steps;
    if (draft.kind === 'premiere') {
      if (mode === 'lipsync') steps.push('lswin');
      else if (opts.top2.length > 2) steps.push('top2');
    } else if (mode === 'lipsync') {
      steps.push('stay');
    } else {
      if (opts.win.length > 1) steps.push('win');
      if (opts.low.length > 1) steps.push('low');
    }
    return steps;
  }

  function openRig(mode) {
    if (!draft) return;
    const opts = GRX.rigOptions(draft);
    const steps = rigStepsFor(mode, opts);
    if (!steps.length) return;
    ensureRigDialog();

    const premiere = draft.kind === 'premiere';
    const pick = premiere
      ? { top2: draft.pair.map(function (q) { return q.id; }), lswin: draft.winner.id }
      : { win: draft.tops[0].id, low: draft.low ? draft.low.id : null, stay: draft.stay.id, double: draft.double || null };
    let step = 0;
    let moreOpen = !!pick.double;         // the More options menu starts open if a double is already set

    const TEXT = premiere ? {
      top2:  ['Choose the top 2', 'Pick the two queens who lip sync for the win. The other tops will be HIGH.', opts.top2],
      lswin: ['Choose the winner', 'Pick who wins the lip sync. The other queen is TOP 2.', opts.win]
    } : {
      win:  ['Choose the winner', 'Pick who wins this week\u2019s challenge. The other top queens will be HIGH.', opts.win],
      low:  ['Choose who is safe', 'Pick the queen who is safe from the bottom (LOW). The other two are up for elimination.', opts.low],
      stay: ['Choose who stays', 'Pick the queen who stays, or save or eliminate both.', opts.out]
    };

    function button(label, className, onClick) {
      const b = make('button', 'btn small ' + className, label);
      b.type = 'button';
      b.addEventListener('click', onClick);
      return b;
    }

    function lockIn() {
      const edits = {};
      if (steps.indexOf('win') !== -1) edits.win = pick.win;
      if (steps.indexOf('low') !== -1) edits.low = pick.low;
      if (steps.indexOf('stay') !== -1) {
        edits.double = pick.double;                 // null = a normal lip sync
        if (!pick.double) edits.out = opts.out.find(function (id) { return id !== pick.stay; });
      }
      if (steps.indexOf('top2') !== -1) edits.top2 = pick.top2;
      if (steps.indexOf('lswin') !== -1) edits.win = pick.lswin;
      draft = GRX.applyRig(draft, edits);
      currentLog = previewLog(draft);
      scenes = buildScenes(currentLog);              // same scenes, new results
      updateDev(scenes[sceneIndex - 1]);
      rigDialog.close();
    }

    function render() {
      const kind = steps[step];
      const multi = kind === 'top2';                 // pick exactly 2
      rigTitle.textContent = TEXT[kind][0];
      rigText.textContent = TEXT[kind][1];
      rigDialog.classList.toggle('modal--wide', multi);

      // Buttons first, so a pick can switch Next / Lock In on and off
      rigActions.textContent = '';
      rigActions.appendChild(button('Cancel', 'rig-cancel', function () { rigDialog.close(); }));
      if (step > 0) rigActions.appendChild(button('Back', 'rig-back', function () { step--; render(); }));
      const last = step === steps.length - 1;
      const go = last ? button('Lock In', 'rig-lock', lockIn)
                      : button('Next', 'rig-next', function () { step++; render(); });
      rigActions.appendChild(go);
      function ready() { go.disabled = multi && pick.top2.length !== 2; }
      ready();

      rigGrid.textContent = '';
      rigGrid.dataset.kind = multi ? 'top2' : (kind === 'lswin' ? 'win' : kind);   // colours the glow
      function paint() {
        Array.from(rigGrid.children).forEach(function (child, i) {
          const id = TEXT[kind][2][i];
          const on = multi ? pick.top2.indexOf(id) !== -1
                   : (kind === 'stay' && pick.double) ? false : pick[kind] === id;
          child.classList.toggle('is-selected', on);
          child.setAttribute('aria-pressed', String(on));
        });
      }
      // "More options" (regular lip syncs only): opens Save Both / Eliminate Both
      function drawDoubles() {
        rigExtra.textContent = '';
        if (kind !== 'stay') return;
        const toggle = make('button', 'rig-more', 'More options');
        toggle.type = 'button';
        toggle.setAttribute('aria-expanded', String(moreOpen));
        toggle.addEventListener('click', function () { moreOpen = !moreOpen; drawDoubles(); });
        rigExtra.appendChild(toggle);
        if (!moreOpen) return;

        const panel = make('div', 'rig-more-panel');
        [['shantay', 'Save Both Queens'], ['sashay', 'Eliminate Both Queens']].forEach(function (entry) {
          if (opts.doubles.indexOf(entry[0]) === -1) return;
          const b = make('button', 'rig-opt rig-opt--' + entry[0], entry[1]);
          b.type = 'button';
          b.setAttribute('aria-pressed', String(pick.double === entry[0]));
          b.addEventListener('click', function () {
            pick.double = pick.double === entry[0] ? null : entry[0];   // click again = back to normal
            paint();
            drawDoubles();
          });
          panel.appendChild(b);
        });
        rigExtra.appendChild(panel);
      }
      TEXT[kind][2].forEach(function (id) {
        const b = rigCard(id, false);
        b.addEventListener('click', function () {
          if (multi) {
            const at = pick.top2.indexOf(id);
            if (at !== -1) pick.top2.splice(at, 1);            // click again = unpick
            else { pick.top2.push(id); if (pick.top2.length > 2) pick.top2.shift(); }
          } else {
            pick[kind] = id;
            if (kind === 'stay') pick.double = null;           // picking a queen cancels save/eliminate both
          }
          paint();
          ready();
          drawDoubles();
        });
        rigGrid.appendChild(b);
      });
      paint();
      drawDoubles();
    }

    render();
    document.body.classList.add('rig-open');
    rigDialog.showModal();
  }


  /* ---------- Riggory: finale (Top 3 / Top 4) ----------
     'finale-cut-announce' (Top 4): choose who is cut.
     'crown-ls-1' / 'crown-ls-2' (Lip Sync For The Crown): who wins each lip sync.
     'finale-decision': choose the winner.
     The finale is already recorded, so Lock In patches it (GRX.applyFinaleRig)
     and rebuilds the finale scenes, keeping the current position. */
  function finaleRigKind() {
    if (!rigOn || !season || !season.finale || !currentLog || !currentLog.finale) return null;
    const opts = GRX.finaleRigOptions(season);
    if (!opts) return null;
    if (shownId === 'crown-ls-1') return 'ls1';
    if (shownId === 'crown-ls-2') return 'ls2';
    if (shownId === 'finale-cut-announce' && opts.cut.length) return 'cut';
    if (shownId === 'finale-decision' && opts.win.length > 1) return 'win';
    return null;
  }

  function openFinaleRig(kind) {
    const opts = GRX.finaleRigOptions(season);
    if (!opts) return;
    ensureRigDialog();
    const ids = opts[kind];
    const TEXT = {
      cut: ['Choose who is cut', 'Pick the queen who does not make it to the final lip sync.'],
      win: ['Choose the winner', 'Pick the queen who wins the season. The others are runners-up.'],
      ls1: ['Lip sync one', 'Pick who wins the first lip sync and goes through to the final.'],
      ls2: ['Lip sync two', 'Pick who wins the second lip sync and goes through to the final.']
    };
    let picked = kind === 'cut' ? currentLog.cut
               : kind === 'ls1' ? currentLog.matches[0].winner
               : kind === 'ls2' ? currentLog.matches[1].winner
               : currentLog.winner;

    rigTitle.textContent = TEXT[kind][0];
    rigText.textContent = TEXT[kind][1];
    rigDialog.classList.toggle('modal--wide', ids.length > 3);
    rigGrid.textContent = '';
    rigExtra.textContent = '';
    // Glow = the colour of the placement she will get (see riggory.css)
    rigGrid.dataset.kind = kind === 'cut' ? 'finale-cut' : kind === 'win' ? 'finale-win' : 'crown-ls';

    function paint() {
      Array.from(rigGrid.children).forEach(function (child, i) {
        child.classList.toggle('is-selected', ids[i] === picked);
        child.setAttribute('aria-pressed', String(ids[i] === picked));
      });
    }
    ids.forEach(function (id) {
      const b = rigCard(id, false);
      b.addEventListener('click', function () { picked = id; paint(); });
      rigGrid.appendChild(b);
    });
    paint();

    rigActions.textContent = '';
    const cancel = make('button', 'btn small rig-cancel', 'Cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', function () { rigDialog.close(); });
    const lock = make('button', 'btn small rig-lock', 'Lock In');
    lock.type = 'button';
    lock.addEventListener('click', function () {
      const edits = {};
      edits[kind] = picked;
      GRX.applyFinaleRig(season, edits);
      currentLog = season.finale;
      scenes = buildFinaleScenes(currentLog);                 // same scenes, new result
      updateDev(scenes[sceneIndex - 1]);
      rigDialog.close();
    });
    rigActions.appendChild(cancel);
    rigActions.appendChild(lock);

    document.body.classList.add('rig-open');
    rigDialog.showModal();
  }


  /* ---------- 5. Buttons and start-up ---------- */
  function updateButton() {
    const allShown = sceneIndex >= scenes.length;
    if (season.finale && allShown) nextBtn.textContent = 'New season';
    else nextBtn.textContent = (allShown && season.done) ? 'To the finale' : 'Continue';
    // Choose Outcome: only with riggory on, on the scenes just before a result
    if (rigBtn) {
      const mode = shownId === 'lipsync' ? 'lipsync' : 'results';
      const episodeRig = draft && (shownId === 'critiques' || shownId === 'lipsync') &&
                         rigStepsFor(mode, GRX.rigOptions(draft)).length;
      rigBtn.hidden = !(episodeRig || finaleRigKind());
    }
  }

  function start() {
    season = GRX.newSeason(Cast.getQueens(), Setup.get());
    rigOn = (season.settings.extras || []).indexOf('riggory') !== -1;
    draft = null;
    shownId = 'start';
    scenes = [];
    sceneIndex = 0;
    currentLog = null;
    episodeTag.textContent = '';
    drawScene({ id: 'start', kicker: 'GreenRoom', title: 'Your season begins',
                text: 'Press Continue to enter the Werk Room.' });
    updateButton();
  }

  // Show the next scene; when the episode is over, simulate the next one
  function next() {
    if (sceneIndex >= scenes.length) {
      if (season.finale) { Nav.go('setup'); return; }            // season over: back to setup
      if (season.done) {
        currentLog = GRX.runFinale(season);
        scenes = buildFinaleScenes(currentLog);
        sceneIndex = 0;
        episodeTag.textContent = 'The finale';
      } else {
        if (rigOn) {
          const d = GRX.prepareEpisode(season);
          if (d) { draft = d; currentLog = previewLog(d); }          // recorded later (see below)
          else currentLog = null;
        } else {
          currentLog = GRX.runEpisode(season);
        }
        scenes = buildScenes(currentLog);
        sceneIndex = 0;
        episodeTag.textContent = 'Episode ' + currentLog.episode;   // stays put, never fades
      }
    }
    const scene = scenes[sceneIndex++];
    // The result is final now: record it (regular: before 'shantay' / 'double-sashay', premiere: before 'winner')
    if (draft && (scene.id === 'shantay' || scene.id === 'double-sashay' || scene.id === 'winner')) {
      currentLog = GRX.commitEpisode(season, draft);
      draft = null;
    }
    shownId = scene.id;
    drawScene(scene);
    updateButton();
  }

  function init() {
    // The Continue button on the setup screen starts the season
    const continueBtn = document.getElementById('cast-continue');

    // Red message under the cast hint, made here so index.html needn't change
    const errorBox = document.createElement('p');
    errorBox.className = 'cast-error';
    errorBox.id = 'cast-error';
    errorBox.setAttribute('role', 'alert');
    errorBox.hidden = true;
    document.getElementById('cast-hint').after(errorBox);

    function showError(text) { errorBox.textContent = text; errorBox.hidden = false; }
    function hideError() { errorBox.hidden = true; }

    // Clear the message as soon as the cast or a setting changes
    document.addEventListener('click', function (event) {
      if (!event.target.closest('#cast-continue')) hideError();
    });
    document.getElementById('settings').addEventListener('change', hideError);

    continueBtn.addEventListener('click', function () {
      // Some settings need a minimum cast size
      const settings = Setup.get();
      const rule = GRX_CONFIG.premieres && GRX_CONFIG.premieres[settings.premiere];
      const cast = Cast.getQueens().length;
      if (rule && rule.minCast && cast < rule.minCast) {
        showError('You must have at least ' + rule.minCast + ' queens in your cast to use the Split Premiere. ' +
                  'You have ' + cast + '. Add more queens or pick a different premiere.');
        return;
      }
      // The Talent Show extra needs a minimum cast too
      const X = GRX_CONFIG.talentShowExtra;
      if (X && (settings.extras || []).indexOf(X.id) !== -1 && cast < X.minCast) {
        showError('You must have at least ' + X.minCast + ' queens in your cast to use the Talent Show extra. ' +
                  'You have ' + cast + '. Add more queens or switch the Talent Show off.');
        return;
      }
      hideError();
      start();
      Nav.go('episode');
    });
    nextBtn.addEventListener('click', next);

    // Choose Outcome button (made here so index.html needn't change)
    rigBtn = document.createElement('button');
    rigBtn.className = 'btn small rig-btn';
    rigBtn.type = 'button';
    rigBtn.textContent = 'Choose Outcome';
    rigBtn.hidden = true;
    rigBtn.addEventListener('click', function () {
      const fk = finaleRigKind();
      if (fk) openFinaleRig(fk);
      else openRig(shownId === 'lipsync' ? 'lipsync' : 'results');
    });
    nextBtn.before(rigBtn);
  }

  return { init: init, get: function () { return season; } };

})();
