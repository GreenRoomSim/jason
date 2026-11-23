/* ==========================================================================
   GreenRoom Simulator - js/data/runway-themes.js
   The runway theme library. GRX picks one each episode (no repeats until
   every theme has been used). To add a theme, add one line to the list.
     id:   unique, lowercase, no spaces      name: shown on screen
   Plain script: RUNWAY_THEMES is global. Load before grx-engine.js.
   ========================================================================== */

'use strict';

const RUNWAY_THEMES = [
  { id: 'runway-realness', name: 'Runway Realness' },
  { id: 'gold-realness',   name: 'Gold Realness' },
  { id: 'swept-away',      name: 'Swept Away' }
];
