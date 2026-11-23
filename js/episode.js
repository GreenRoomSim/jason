/* ==========================================================================
   GreenRoom Simulator - js/episode.js
   The Episode screen. GRX simulates a whole episode instantly and returns an
   event list; this file turns that list into SCENES and plays one scene per
   screen (press Continue). Pacing and visuals are all here, the engine is
   not involved. Animations are in css/episode.css.

   Sections:
     1. Elements and state
     2. Building scenes from an episode log
     3. Drawing a scene
     4. Buttons and start-up
   Needs grx-config.js, grx-engine.js, queens.js, setup.js, cast.js first.

   A scene looks like:
     { kicker, title, text, big,                    all optional
       groups: [ { label, big, vs, items: [ { id, tag, tone, fx } ] } ] }
     tone: 'win' | 'high' | 'low' | 'btm' | 'elim'     (colour of the tag)
     fx:   'winner' | 'glow' | 'out'                   (special card effect)
   ========================================================================== */

'use strict';

const Episode = (function () {

  /* ---------- 1. Elements and state ---------- */
  const stageBox = document.getElementById('episode-stage');
  const nextBtn  = document.getElementById('ep-next');

  const STEP = 0.35;        // seconds between queens appearing one by one

  let season = null;
  let scenes = [];          // scenes of the episode being shown
  let sceneIndex = 0;
  let finaleShown = false;

  function queenData(id) { return QUEENS.find(function (q) { return q.id === id; }); }
  function name(id) { return queenData(id).name; }
  function item(id, tag, tone, fx) { return { id: id, tag: tag, tone: tone, fx: fx }; }
  function plain(ids) { return ids.map(function (id) { return item(id); }); }


  /* ---------- 2. Building scenes ---------- */
  function buildScenes(log) {
    const ev = {};
    log.events.forEach(function (e) { ev[e.type] = e; });
    const kicker = 'Episode ' + log.episode;
    const out = [];

    // Everyone still in the competition this week
    const everyone = ev.safe.queens.concat(ev.critiques.tops, ev.critiques.bottoms);

    if (ev.entrance) {
      out.push({ kicker: kicker, title: 'Welcome to the Werk Room',
                 text: 'The queens enter one by one.',
                 groups: [{ items: plain(ev.entrance.queens) }] });
    }

    out.push({ kicker: kicker, title: 'This week\u2019s maxi challenge', big: ev.challenge.name });
    out.push({ kicker: kicker, title: ev.challenge.name,
               text: 'The queens give it everything.' });
    out.push({ kicker: kicker, title: 'The runway',
               text: 'The queens walk the runway.',
               groups: [{ items: plain(everyone) }] });

    if (ev.safe.queens.length) {
      out.push({ kicker: kicker, title: 'Safe',
                 text: 'These queens are safe and head to Untucked.',
                 groups: [{ items: ev.safe.queens.map(function (id) { return item(id, 'SAFE'); }) }] });
    }

    out.push({ kicker: kicker, title: 'The critiques',
               text: 'The judges give their critiques.',
               groups: [{ label: 'Tops', items: plain(ev.critiques.tops) },
                        { label: 'Bottoms', items: plain(ev.critiques.bottoms) }] });

    const r = ev.results;
    const topItems = r.high.map(function (id) { return item(id, 'HIGH', 'high'); });
    topItems.push(item(r.win, 'WIN', 'win', 'winner'));
    out.push({ kicker: kicker, title: 'The top queens',
               text: r.high.length ? 'The highs are called safe, and the winner of the week is...' : 'The winner of the week is...',
               groups: [{ items: topItems }] });

    const btmItems = [];
    if (r.low) btmItems.push(item(r.low, 'LOW', 'low'));
    r.btm2.forEach(function (id) { btmItems.push(item(id, 'BOTTOM 2', 'btm')); });
    out.push({ kicker: kicker, title: 'The bottom queens',
               text: 'One bottom queen is safe. The other two lip sync for their lives.',
               groups: [{ items: btmItems }] });

    out.push({ kicker: kicker, title: 'Lip sync for your life',
               groups: [{ big: true, vs: true, items: ev.lipsync.queens.map(function (id) { return item(id, null, null, 'glow'); }) }] });

    out.push({ kicker: kicker, title: 'Shantay, you stay',
               text: name(ev.lipsync.stay) + ', shantay, you stay.',
               groups: [{ big: true, items: [item(ev.lipsync.stay, 'STAYS', 'win', 'winner')] }] });

    out.push({ kicker: kicker, title: 'Sashay away',
               text: name(ev.elimination.queen) + ', sashay away.',
               groups: [{ big: true, items: [item(ev.elimination.queen, 'ELIMINATED', 'elim', 'out')] }] });

    return out;
  }


  /* ---------- 3. Drawing a scene ---------- */
  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function makeQueenCard(id, delay, fx) {
    const queen = queenData(id);
    const card = make('div', 'queen-card scene-card' + (fx === 'winner' ? ' is-winner' : '') +
                             (fx === 'glow' ? ' is-glow' : '') + (fx === 'out' ? ' is-out' : ''));
    card.style.setProperty('--d', delay.toFixed(2) + 's');

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

    let count = 0;                       // queens drawn so far, sets the reveal delay
    (scene.groups || []).forEach(function (group) {
      if (group.label) stageBox.appendChild(make('h4', 'scene-group-label', group.label));
      const row = make('div', 'scene-row' + (group.big ? ' is-big' : ''));

      group.items.forEach(function (it, i) {
        if (group.vs && i === 1) row.appendChild(make('span', 'scene-vs', 'VS'));
        const delay = 0.2 + count++ * STEP;
        const wrap = make('div', 'scene-item');
        wrap.appendChild(makeQueenCard(it.id, delay, it.fx));
        if (it.tag) wrap.appendChild(make('span', 'scene-tag ' + (it.tone || ''), it.tag));
        row.appendChild(wrap);
      });
      stageBox.appendChild(row);
    });

    // Restart the entrance animation of the title and text
    stageBox.classList.remove('is-new');
    void stageBox.offsetWidth;
    stageBox.classList.add('is-new');
  }

  function showFinaleScene() {
    const left = season.queens.filter(function (q) { return q.status === 'active'; }).map(function (q) { return q.id; });
    drawScene({ kicker: 'The finale', title: 'Final ' + left.length,
                text: 'The finale is coming soon.',
                groups: [{ big: true, items: plain(left) }] });
    finaleShown = true;
  }


  /* ---------- 4. Buttons and start-up ---------- */
  function updateButton() {
    nextBtn.disabled = finaleShown;
    nextBtn.textContent = (sceneIndex >= scenes.length && season.done) ? 'To the finale' : 'Continue';
  }

  function start() {
    season = GRX.newSeason(Cast.getQueens(), Setup.get());
    scenes = [];
    sceneIndex = 0;
    finaleShown = false;
    drawScene({ kicker: 'GreenRoom', title: 'Your season begins',
                text: 'Press Continue to enter the Werk Room.' });
    updateButton();
  }

  // Show the next scene; when the episode is over, simulate the next one
  function next() {
    if (sceneIndex >= scenes.length) {
      if (season.done) { showFinaleScene(); updateButton(); return; }
      scenes = buildScenes(GRX.runEpisode(season));
      sceneIndex = 0;
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
