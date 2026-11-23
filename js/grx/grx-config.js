/* ==========================================================================
   GreenRoom Simulator - js/grx/grx-config.js
   GRX (Greenroom Experience Engine): every tuning value lives HERE.
   Plain script: GRX_CONFIG is global. Load before grx-engine.js.
   ========================================================================== */

'use strict';

const GRX_CONFIG = {

  /* How wild results are. The random roll added to every score has this
     standard deviation (stats are 1-10). Roughly, with chaos 3:
       9 vs 4 stat -> higher stat does better ~88% of the time
       8 vs 6      -> ~65%      7 vs 6 -> ~57%
     Lower = more predictable. Higher = more upsets. */
  chaos: 3,

  /* Lip syncs are more of an upset zone, so a bigger roll. */
  lipSyncChaos: 4,

  /* Episode score = challenge * this + runway * (1 - this). */
  challengeShare: 0.6,

  /* A challenge can't appear again within this many episodes. */
  challengeCooldown: 2,

  /* How the judges rate each queen's MAIN CHALLENGE performance (shown on the
     "challenge" screen). A queen lands in the first band whose min her
     challenge score reaches. Scores are on the stat scale (about 1-10, plus
     the random roll), so raise a min to make that band harder to get. */
  performanceBands: [
    { id: 'slayed', min: 9 },
    { id: 'good',   min: 7 },
    { id: 'okay',   min: 5 },
    { id: 'bad',    min: 3 },
    { id: 'flop',   min: -Infinity }
  ],

  /* BEHIND THE SCENES (never shown on screen): the unspoken rule that you
     can't lip sync your way to the crown. A queen is sent home on her Nth
     time in the BTM2, whatever her lip sync was like, where N depends on the
     starting cast size. The first row with castSize >= minCast is used. */
  btm2Cap: [
    { minCast: 12, cap: 4 },     // 12-14 queens: eliminated on the 4th BTM2
    { minCast: 0,  cap: 3 }      // smaller casts: eliminated on the 3rd
  ],

  /* BEHIND THE SCENES: if a queen won LAST episode and would win again, she
     keeps the win with this chance (otherwise the win goes to the next best
     top queen and she is HIGH). Only the very next episode is affected, and
     her chance of being in the tops is unchanged. 1 = no effect, 0 = never. */
  repeatWinChance: 0.4,

  /* Runway is judged on this stat mix. */
  runwayWeights: { design: 1 },

  /* Maxi challenges. Add one entry to add a challenge, nothing else changes.
     weights use the stat keys from queens.js (comedy, design, performance,
     acting, lipSync) and should add up to 1. */
  challenges: [
    { id: 'design',      name: 'Design',      weights: { design: 1 } },
    { id: 'acting',      name: 'Acting',      weights: { acting: 0.6, comedy: 0.4 } },
    { id: 'improv',      name: 'Improv',      weights: { comedy: 0.6, acting: 0.4 } },
    { id: 'girl-groups', name: 'Girl Groups', weights: { performance: 0.5, lipSync: 0.5 } },
    { id: 'snatch-game', name: 'Snatch Game', weights: { comedy: 1 } },
    { id: 'ball',        name: 'Ball',        weights: { design: 1 } },
    { id: 'makeover',    name: 'Makeover',    weights: { design: 0.7, performance: 0.3 } },
    { id: 'Advert',      name: 'Advert',      weights: { acting: 0.5, comedy: 0.5 } },
    { id: 'rusical',     name: 'Rusical',     weights: { performance: 0.7, acting: 0.3 } },
    { id: 'talent-show', name: 'Talent Show', weights: { performance: 0.7, lipSync: 0.3 } },
  ],

  /* Episode shape by queens left. The first row with queensLeft >= minQueens
     is used. safe: 'rest' = everyone not in the top or bottom group.
     7 left is always 2 safe (producers never send 1 queen to Untucked alone).
     Fewer than 4 left = finale, not built yet. */
  episodeShapes: [
    { minQueens: 8, safe: 'rest', top: 3, bottom: 3 },
    { minQueens: 7, safe: 2,      top: 2, bottom: 3 },
    { minQueens: 6, safe: 0,      top: 3, bottom: 3 },
    { minQueens: 5, safe: 0,      top: 2, bottom: 3 },
    { minQueens: 4, safe: 0,      top: 2, bottom: 2 }
  ],

  /* Season stops here (finale rules come later). */
  finaleAt: 3
};
