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

  /* Double shantay (both bottom queens stay) and double sashay (both go home).
     Regular lip syncs only: never in premieres, never in finales. Chances are
     per regular episode (0.05 = 5%, 0.0005 = 0.05%). A double sashay never
     happens if it would take the season below the finale size. A double shantay
     never happens when a queen has hit the BTM2 cap and has to go. */
  doubleShantayChance: 0.05,
  doubleSashayChance: 0.0005,

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
     acting, lipSync) and should add up to 1.

     Filtering (all optional):
       category:     'acting' | 'design' | 'performance'. The same category is
                     very unlikely twice in a row (see categoryRepeatWeight).
       stages:       when in the season it can appear, from the `stages` list
                     below, e.g. ['start', 'middle']. Leave out = anywhere.
       once:         true = can only appear once per season (the staples)
       firstEpisode: 'only'  = episode 1 only (and it is picked there)
                     'never' = anywhere except episode 1
                     leave out = no rule */
  challenges: [
    { id: 'talent-show', once: true, name: 'Talent Show', category: 'performance', special: 'talentShow',
      weights: { performance: 0.7, lipSync: 0.3 } },
    { id: 'design',      name: 'Design',      category: 'design',
      weights: { design: 1 } },
    { id: 'acting',      name: 'Acting',      category: 'acting', firstEpisode: 'never',
      weights: { acting: 0.6, comedy: 0.4 } },
    { id: 'improv',      name: 'Improv',      category: 'acting', firstEpisode: 'never',
      weights: { comedy: 0.6, acting: 0.4 } },
    { id: 'rusical', once: true,     name: 'Rusical',     category: 'performance', stages: ['middle'],
      weights: { performance: 0.7, acting: 0.3 } },
    { id: 'snatch-game', once: true, name: 'Snatch Game', category: 'acting', stages: ['middle'],
      weights: { comedy: 1 } },
    { id: 'girl-groups', once: true, name: 'Girl Groups', category: 'performance', stages: ['start', 'middle'],
      weights: { performance: 0.5, lipSync: 0.5 } },
    { id: 'advert',      name: 'Advert',      category: 'acting', firstEpisode: 'never',
      weights: { acting: 0.5, comedy: 0.5 } },
    { id: 'ball', once: true,        name: 'Ball',        category: 'design', firstEpisode: 'never',
      weights: { design: 1 } },
    { id: 'makeover', once: true,    name: 'Makeover',    category: 'design', stages: ['end'],
      weights: { design: 0.7, performance: 0.3 } }
  ],

  /* Challenges that can open the season (episode 1, premiere or not). */
  openers: ['design', 'girl-groups'],

  /* TALENT SHOW: a special two-part challenge (never picked normally).
     Only when the season STARTED with minCast+ queens. Part 1 begins at the
     first episode with between minLeft and maxLeft queens left; part 2 is the
     very next episode. Half the cast performs each week (the other half
     rate them, placement RUN). Each week: top 2 lip sync for the win and
     one BTM1. The two BTM queens (week 1 + week 2) lip sync in part 2.
     Double shantay / sashay chances are for part 2 only (0.0005 = 0.05%). */
  talentShow: {
    minCast: 12,
    maxLeft: 10,
    minLeft: 9,
    doubleShantayChance: 0.0005,
    doubleSashayChance: 0.0001
  },

  /* TALENT SHOW EXTRA (Extras on the setup screen, off by default). The
     Talent Show only happens when the extra is switched on:
       10-11 queens: always a PREMIERE Talent Show (episodes 1 and 2, nobody
                     goes home in episode 1, one queen in episode 2).
       12+ queens:   premiereChance = chance it is a premiere Talent Show,
                     otherwise it is the mid-season one above (maxLeft/minLeft).
     A Talent Show premiere replaces the Premiere setting. It works exactly
     like the mid-season one (top 2 lip sync, BTM1 in week one, BTM2 lip sync
     in week two). Fewer than minCast queens can't use the extra at all. */
  talentShowExtra: {
    id: 'talentshow',        // id of the extra in data/options.js
    minCast: 10,
    premiereMaxCast: 11,     // 10-11 queens: always the premiere
    premiereChance: 0.5      // 12+ queens
  },

  /* LIP SYNC LEGACY format (Format on the setup screen). No winner from the
     critiques: the TOP 2 lip sync for the win, and the winner CHOPS one of the
     bottom queens (nobody else lip syncs). Bottom queens are marked BTM2 / BTM3.
     shapes: the first row with queensLeft >= minQueens is used.
       bottom:        queens in the bottom (the rest are SAFE)
       bottom3Chance: chance the bottom is 3 instead (some bottom 3s mid season)
     At 5 left everyone not in the top 2 is in the bottom, at 4 left too.
     surpriseChance: the winner usually chops the weakest bottom queen (the
     lowest score of the week), but with this chance picks another bottom queen.
     Forced for now: Regular premiere, Top 3 finale, no extras. */
  legacy: {
    shapes: [
      { minQueens: 10, bottom: 2 },
      { minQueens: 7,  bottom: 2, bottom3Chance: 0.5 },
      { minQueens: 5,  bottom: 3 },
      { minQueens: 4,  bottom: 2 }
    ],
    surpriseChance: 0.25
  },

  /* Season stages, as how far through the regular season it is:
     0 = first episode, 1 = last episode before the finale. They overlap on
     purpose so a challenge has a few episodes of room. A challenge with several
     stages can appear from the earliest start to the latest end
     (['start','middle'] = 0 to 0.7). */
  stages: {
    start:  [0,    0.35],
    middle: [0.30, 0.70],
    end:    [0.65, 1]
  },

  /* Variety: how likely a challenge is compared with normal (1) when it is in
     the same category as the challenge LAST episode / the one before that. */
  categoryRepeatWeight: 0.1,
  categoryGapWeight: 0.5,

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
    /* WINNER (Top 3 / Top 4 finale): the finalist with the best TRACK RECORD
       wins with this chance. The rest of the chance is shared between the
       others, better records first (3 finalists: 75% / ~17% / ~8%).
       Track record = wins * trackWinWeight - BTM2s * trackBtm2Penalty
       (average stats only break exact ties). */
    bestRecordChance: 0.75,
    trackWinWeight: 1,
    trackBtm2Penalty: 0.5,

    lipSyncShare: 0.5,
    winBonus: 0.5,
    btm2Penalty: 0.25
  }
};
