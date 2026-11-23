/* ==========================================================================
   GreenRoom Simulator - js/episode.js
   Very basic Episode screen: starts a season from the setup screen and prints
   what GRX returns as plain text. Replace with the real Episode UI later.
   Needs grx-config.js, grx-engine.js, setup.js and cast.js loaded first.
   ========================================================================== */

'use strict';

const Episode = (function () {

  const logBox = document.getElementById('episode-log');
  const nextBtn = document.getElementById('ep-next');
  const allBtn  = document.getElementById('ep-all');
  const newBtn  = document.getElementById('ep-new');
  const simBtn  = document.getElementById('ep-sim');
  let season = null;

  function name(id) {
    const q = season.queens.find(function (x) { return x.id === id; });
    return q ? q.name : id;
  }
  function names(list) { return list.map(name).join(', ') || 'none'; }

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

  function showEpisode(log) {
    heading('Episode ' + log.episode + ' (' + log.queensLeft + ' queens)');
    log.events.forEach(function (e) {
      if (e.type === 'entrance')    line('The queens enter the Werk Room: ' + names(e.queens));
      if (e.type === 'challenge')   line('Challenge: ' + e.name);
      if (e.type === 'safe' && e.queens.length) line('SAFE: ' + names(e.queens));
      if (e.type === 'critiques')   line('Tops: ' + names(e.tops) + '  |  Bottoms: ' + names(e.bottoms));
      if (e.type === 'results') {
        line('WIN: ' + name(e.win));
        if (e.high.length) line('HIGH: ' + names(e.high));
        if (e.low) line('LOW: ' + name(e.low));
        line('BTM2: ' + names(e.btm2));
      }
      if (e.type === 'lipsync')     line(names(e.queens) + ' lip sync. ' + name(e.stay) + ' shantays.');
      if (e.type === 'elimination') line(name(e.queen) + ' sashays away.', 'elim');
    });
  }

  function updateButtons() {
    const done = !season || season.done;
    nextBtn.disabled = done;
    allBtn.disabled = done;
  }

  function finishedNote() {
    if (season.done) {
      heading('Top ' + season.queens.filter(function (q) { return q.status === 'active'; }).length + ' reached');
      line('Finale: ' + names(season.queens.filter(function (q) { return q.status === 'active'; }).map(function (q) { return q.id; })) +
           ' (finale not built yet)');
    }
  }

  function start() {
    season = GRX.newSeason(Cast.getQueens(), Setup.get());
    logBox.textContent = '';
    line('New season (seed ' + season.seed + '). Press Next episode or Run whole season.');
    updateButtons();
  }

  function next() {
    const log = GRX.runEpisode(season);
    if (log) showEpisode(log);
    finishedNote();
    updateButtons();
  }

  function all() {
    while (!season.done) { const log = GRX.runEpisode(season); if (log) showEpisode(log); }
    finishedNote();
    updateButtons();
  }

  // Run 300 seasons with the current cast and print a table
  function simulate() {
    const rows = GRX.simulate(300, Cast.getQueens(), Setup.get());
    logBox.textContent = '';
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
    allBtn.addEventListener('click', all);
    newBtn.addEventListener('click', start);
    simBtn.addEventListener('click', simulate);
  }

  return { init: init, get: function () { return season; } };

})();
