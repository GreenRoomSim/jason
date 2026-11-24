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

  /* Premiere formats (ids from data/options.js). Nobody goes home in a
     premiere. The TOP 2 queens of each premiere episode lip sync for the win:
     the winner gets a WIN, the loser gets TOP2.
       tops:    queens in the top of the week (includes the top 2; the
                other tops are HIGH, everyone else is SAFE)
       episodes: how many premiere episodes there are
       minCast: smallest cast allowed (the setup screen blocks Continue below it)
     split: half the cast enters in episode 1, the other half in episode 2.
     Eliminations start the episode after the premiere(s). */
  premieres: {
    top2:  { episodes: 1, tops: 5 },
    split: { episodes: 2, tops: 4, minCast: 12 }   // needs at least 12 queens (checked on the setup screen)
  },

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

  /* Regular episodes stop when this many queens are left; those queens are
     the finalists. Used if the Finale setting isn't recognised. */
  finaleAt: 3,

  /* Finalists per Finale setting (ids from data/options.js). */
  finaleSizes: { top3: 3, top4: 4, crown: 4 },

  /* Queens cut BEFORE the final lip sync, per Finale setting (default 0).
     Top 4 finale: the queen with the weakest season "resume" (see finale
     below, no lip sync involved) is sent home and gets a special ELIM; the
     other three lip sync for the crown. */
  finaleCuts: { top4: 1 },

  /* How the winner is chosen. All finalists lip sync, and each gets
       total = lip sync roll * lipSyncShare + season "resume" * (1 - lipSyncShare)
     where resume = average stat + wins * winBonus - BTM2s * btm2Penalty + a
     random roll. Raise lipSyncShare to make the final lip sync matter more,
     lower it to reward the queen with the stronger season. */
  /* LIP SYNC FOR THE CROWN: 4 queens, 3 lip syncs. Two random pairs lip sync,
     the two winners lip sync for the crown. Each lip sync is scored:
       score = lip sync roll * lipSyncShare + (season record + a random roll) * (1 - lipSyncShare)
     record = average stat + wins * winBonus - BTM2s * btm2Penalty.
     lipSyncShare 0.3 = 30% lip sync ability, 70% track record. Raise
     winBonus / lower recordChaos to make the better track record win more
     often; do the opposite for more upsets. */
  crownFinale: {
    lipSyncShare: 0.3,
    winBonus: 2,        // 3 wins vs 1 win: the 3-win queen goes through ~86% (equal lip sync), ~57% (vs an amazing lip syncer)
    btm2Penalty: 0.5,
    recordChaos: 2
  },

  finale: {
    lipSyncShare: 0.5,
    winBonus: 0.5,
    btm2Penalty: 0.25
  }
};
