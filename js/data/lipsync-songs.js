/* ==========================================================================
   GreenRoom Simulator - js/data/lipsync-songs.js
   The lip sync song library. GRX picks one per lip sync (no repeats until
   every song has been used). These are starter picks: swap in your own.
     id: unique, lowercase, no spaces      title / artist: shown on screen
   Plain script: LIPSYNC_SONGS is global. Load before grx-engine.js.
   ========================================================================== */

'use strict';

const LIPSYNC_SONGS = [
  { id: 'since-u-been-gone', title: 'Since U Been Gone',  artist: 'Kelly Clarkson' },
  { id: 'toxic',             title: 'Toxic',              artist: 'Britney Spears' },
  { id: 'born-this-way',     title: 'Born This Way',      artist: 'Lady Gaga' },
  { id: 'dancing-queen',     title: 'Dancing Queen',      artist: 'ABBA' },
  { id: 'hung-up',           title: 'Hung Up',            artist: 'Madonna' },
  { id: 'physical',          title: 'Physical',           artist: 'Dua Lipa' },
  { id: 'rain-on-me',        title: 'Rain on Me',         artist: 'Lady Gaga & Ariana Grande' },
  { id: 'dont-stop-me-now',  title: 'Don\u2019t Stop Me Now', artist: 'Queen' }
];
