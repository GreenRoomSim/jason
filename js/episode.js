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
     fx:   'winner' | 'glow' | 'out'                         (card effect)
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
  let finaleShown = false;
  let currentLog = null;    // the episode log being played (for the dev panel)
  let devPanel = null;

  function queenData(id) { return QUEENS.find(function (q) { return q.id === id; }); }
  function name(id) { return queenData(id).name; }
  function names(ids) { return ids.map(name).join(', '); }
  function item(id, tag, tone, fx) { return { id: id, tag: tag, tone: tone, fx: fx }; }
  function plain(ids) { return ids.map(function (id) { return item(id); }); }


  /* ---------- 2. Building scenes ---------- */
  function buildScenes(log) {
    const ev = {};
    log.events.forEach(function (e) { ev[e.type] = e; });
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

    out.push({ id: 'shantay', title: 'Shantay, you stay',
               text: name(ev.lipsync.stay) + ', shantay, you stay.',
               groups: [{ big: true, items: [item(ev.lipsync.stay, null, null, 'glow')] }] });

    out.push({ id: 'sashay', title: 'Sashay away',
               text: name(ev.elimination.queen) + ', sashay away.',
               groups: [{ big: true, items: [item(ev.elimination.queen, 'ELIMINATED', 'elim', 'out')] }] });

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
                             (fx === 'glow' ? ' is-glow' : '') + (fx === 'out' ? ' is-out' : ''));

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
        if (group.vs && i === 1) row.appendChild(make('span', 'scene-vs', 'VS'));
        const wrap = make('div', 'scene-item');
        wrap.style.setProperty('--d', t.toFixed(2) + 's');           // card AND tag read this
        if (scene.together) wrap.style.setProperty('--tag-gap', '0s');
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

    // Track record table (built from the season so far)
    if (scene.track) stageBox.appendChild(TrackRecord.build(season, queenData));

    // Restart the entrance animation of the title and text
    stageBox.classList.toggle('is-tight', !!scene.together);
    stageBox.classList.remove('is-new');
    void stageBox.offsetWidth;
    stageBox.classList.add('is-new');

    updateDev(scene);
  }

  function showFinaleScene() {
    const left = season.queens.filter(function (q) { return q.status === 'active'; }).map(function (q) { return q.id; });
    episodeTag.textContent = 'The finale';
    drawScene({ id: 'finale', kicker: 'The finale', title: 'Final ' + left.length,
                text: 'The finale is coming soon.',
                groups: [{ big: true, items: plain(left) }],
                track: true });
    finaleShown = true;
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
    if (inEpisode) {
      const ev = {};
      currentLog.events.forEach(function (e) { ev[e.type] = e; });
      lines.push('Episode ' + currentLog.episode + ' (' + currentLog.queensLeft + ' at start)');
      lines.push('Challenge: ' + ev.challenge.name);
      lines.push('Runway: ' + (ev.runway.theme ? ev.runway.theme.name : '-'));
      lines.push('Song: ' + (ev.lipsync.song ? ev.lipsync.song.title : '-'));
      lines.push('BTM2 cap: ' + season.btm2Cap + (ev.lipsync.forcedByCap ? '  (elimination forced by cap)' : ''));
    }
    devPanel.textContent = lines.join('\n');
  }


  /* ---------- 5. Buttons and start-up ---------- */
  function updateButton() {
    nextBtn.disabled = finaleShown;
    nextBtn.textContent = (sceneIndex >= scenes.length && season.done) ? 'To the finale' : 'Continue';
  }

  function start() {
    season = GRX.newSeason(Cast.getQueens(), Setup.get());
    scenes = [];
    sceneIndex = 0;
    finaleShown = false;
    currentLog = null;
    episodeTag.textContent = '';
    drawScene({ id: 'start', kicker: 'GreenRoom', title: 'Your season begins',
                text: 'Press Continue to enter the Werk Room.' });
    updateButton();
  }

  // Show the next scene; when the episode is over, simulate the next one
  function next() {
    if (sceneIndex >= scenes.length) {
      if (season.done) { showFinaleScene(); updateButton(); return; }
      currentLog = GRX.runEpisode(season);
      scenes = buildScenes(currentLog);
      sceneIndex = 0;
      episodeTag.textContent = 'Episode ' + currentLog.episode;   // stays put, never fades
    }
    drawScene(scenes[sceneIndex++]);
    updateButton();
  }

  function init() {
    // The Continue button on the setup screen starts the season
    document.getElementById('cast-continue').addEventListener('click', function () {
      start();
      Nav.go('episode');
    });
    nextBtn.addEventListener('click', next);
  }

  return { init: init, get: function () { return season; } };

})();
