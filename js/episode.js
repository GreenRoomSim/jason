/* ==========================================================================
   GreenRoom Simulator - js/episode.js
   Basic Episode screen. GRX simulates a whole episode instantly and returns
   an event list; this file turns that list into STAGES and shows one stage
   at a time (press Continue). The engine is not involved in the pacing.
   Needs grx-config.js, grx-engine.js, setup.js and cast.js loaded first.
   ========================================================================== */

'use strict';

const Episode = (function () {

  const logBox  = document.getElementById('episode-log');
  const nextBtn = document.getElementById('ep-next');
  const allBtn  = document.getElementById('ep-all');
  const newBtn  = document.getElementById('ep-new');
  const simBtn  = document.getElementById('ep-sim');

  let season = null;
  let stages = [];       // stages of the episode being shown
  let stageIndex = 0;    // next stage to show
  let finaleShown = false;

  function name(id) {
    const q = season.queens.find(function (x) { return x.id === id; });
    return q ? q.name : id;
  }
  function names(list) { return list.map(name); }


  /* ---------- Turn an episode log into stages ----------
     A stage = { title, lines: [text...], elim: true for the sashay } */
  function buildStages(log) {
    const out = [];
    const ev = {};
    log.events.forEach(function (e) { ev[e.type] = e; });
    const head = 'Episode ' + log.episode;

    if (ev.entrance) {
      out.push({ title: head + ': Entrances',
                 lines: ['The queens enter the Werk Room.'].concat(names(ev.entrance.queens)) });
    }
    out.push({ title: head + ': Maxi challenge', lines: ['This week\u2019s challenge: ' + ev.challenge.name + '.'] });
    out.push({ title: head + ': ' + ev.challenge.name, lines: ['The queens perform the ' + ev.challenge.name + ' challenge.'] });
    out.push({ title: head + ': Runway', lines: ['The queens walk the runway.'] });

    if (ev.safe.queens.length) {
      out.push({ title: head + ': Safe',
                 lines: ['The judges call the safe queens. They head to Untucked.'].concat(names(ev.safe.queens)) });
    }
    out.push({ title: head + ': Critiques',
               lines: ['Tops: ' + names(ev.critiques.tops).join(', '),
                       'Bottoms: ' + names(ev.critiques.bottoms).join(', '),
                       'The judges give their critiques.'] });

    const r = ev.results;
    const topLines = [];
    if (r.high.length) topLines.push('HIGH: ' + names(r.high).join(', '));
    topLines.push('WIN: ' + name(r.win));
    out.push({ title: head + ': Top results', lines: topLines });

    const btmLines = [];
    if (r.low) btmLines.push('LOW (safe): ' + name(r.low));
    btmLines.push('BOTTOM 2: ' + names(r.btm2).join(', '));
    out.push({ title: head + ': Bottom results', lines: btmLines });

    out.push({ title: head + ': Lip sync',
               lines: [names(ev.lipsync.queens).join(' vs ') + ' lip sync for their lives.'] });
    out.push({ title: head + ': Shantay', lines: [name(ev.lipsync.stay) + ', shantay, you stay.'] });
    out.push({ title: head + ': Sashay', lines: [name(ev.elimination.queen) + ', sashay away.'], elim: true });
    return out;
  }


  /* ---------- Drawing ---------- */
  function clear() { logBox.textContent = ''; }

  function line(text, className) {
    const p = document.createElement('p');
    p.textContent = text;
    if (className) p.className = className;
    logBox.appendChild(p);
  }

  function heading(text) {
    const h = document.createElement('h4');
    h.textContent = text;
    logBox.appendChild(h);
  }

  function showStage(stage) {
    clear();
    heading(stage.title);
    stage.lines.forEach(function (text) { line(text, stage.elim ? 'elim' : ''); });
  }

  function showFinale() {
    clear();
    heading('Final ' + season.queens.filter(function (q) { return q.status === 'active'; }).length);
    line(names(season.queens.filter(function (q) { return q.status === 'active'; }).map(function (q) { return q.id; })).join(', '));
    line('The finale is not built yet.');
    finaleShown = true;
  }

  function updateButtons() {
    const over = finaleShown;
    nextBtn.disabled = over;
    allBtn.disabled = season.done && stageIndex >= stages.length;
    nextBtn.textContent = (stageIndex >= stages.length && season.done) ? 'To the finale' : 'Continue';
  }


  /* ---------- Buttons ---------- */
  function start() {
    season = GRX.newSeason(Cast.getQueens(), Setup.get());
    stages = [];
    stageIndex = 0;
    finaleShown = false;
    clear();
    heading('Your season is ready');
    line('Seed ' + season.seed + '. Press Continue to start episode 1.');
    updateButtons();
  }

  // Show the next stage; when the episode is over, simulate the next one
  function next() {
    if (stageIndex >= stages.length) {
      if (season.done) { showFinale(); updateButtons(); return; }
      stages = buildStages(GRX.runEpisode(season));
      stageIndex = 0;
    }
    showStage(stages[stageIndex++]);
    updateButtons();
  }

  // Skip everything: print every episode's placements at once
  function skipSeason() {
    clear();
    while (!season.done) {
      const log = GRX.runEpisode(season);
      if (!log) break;
      heading('Episode ' + log.episode);
      buildStages(log).forEach(function (s) { s.lines.forEach(function (t) { line(t, s.elim ? 'elim' : ''); }); });
    }
    stages = [];
    stageIndex = 0;
    updateButtons();
  }

  // Run 300 seasons with the current cast and print a table
  function simulate() {
    const rows = GRX.simulate(300, Cast.getQueens(), Setup.get());
    clear();
    heading('300 seasons with your cast (best first)');
    const table = document.createElement('table');
    table.innerHTML = '<tr><th>Queen</th><th>Avg stat</th><th>Final 3 %</th><th>Wins/season</th><th>Lip syncs</th><th>Avg out ep</th></tr>';
    rows.forEach(function (r) {
      const tr = document.createElement('tr');
      [r.name, r.avgStat, r.final3Pct, r.winsPerSeason, r.lipSyncsPerSeason, r.avgOutEp === null ? '-' : r.avgOutEp]
        .forEach(function (v) { const td = document.createElement('td'); td.textContent = v; tr.appendChild(td); });
      table.appendChild(tr);
    });
    logBox.appendChild(table);
  }

  function init() {
    // The Continue button on the setup screen starts the season
    document.getElementById('cast-continue').addEventListener('click', function () {
      start();
      Nav.go('episode');
    });
    nextBtn.addEventListener('click', next);
    allBtn.addEventListener('click', skipSeason);
    newBtn.addEventListener('click', start);
    simBtn.addEventListener('click', simulate);
  }

  return { init: init, get: function () { return season; } };

})();
