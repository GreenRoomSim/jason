/* ==========================================================================
   GreenRoom Simulator - data/options.js
   The season settings shown on the LEFT of the setup screen.
   PLACEHOLDER options: they are recorded but don't change the season yet.

   Everything on the left panel is built from SETUP_OPTIONS below, so to add,
   remove or rename a setting you only edit this list. No other file changes.

   Each group looks like this:

     {
       id:       'format',          unique, lowercase, no spaces
       label:    'Format',          heading shown on screen
       type:     'single',          'single' = pick one, 'multi' = switch several on/off
       help:     'Short sentence',  optional, shown under the heading
       default:  'regular',         single only: the id picked at the start
       defaults: ['twist-id'],      multi only: ids switched on at the start (optional)
       choices: [
         { id: 'regular', label: 'Regular season', note: 'Optional small text' }
       ]
     }

   Choice ids are what the simulation engine will read later, so keep them
   short and stable (changing an id later means changing the engine too).

   Plain script (no modules): SETUP_OPTIONS is global.
   ========================================================================== */

'use strict';

const SETUP_OPTIONS = [

  {
    id: 'format',
    label: 'Format',
    type: 'single',
    help: 'The kind of season you are simulating.',
    default: 'regular',
    choices: [
      { id: 'regular',    label: 'Regular season' },
      { id: 'allstars',   label: 'All Stars' },
      { id: 'global',     label: 'Global All Stars' }
    ]
  },

  {
    id: 'premiere',
    label: 'Premiere type',
    type: 'single',
    help: 'How the season opens.',
    default: 'standard',
    choices: [
      { id: 'standard',   label: 'Standard premiere' },
      { id: 'two-part',   label: 'Two-part premiere' },
      { id: 'split',      label: 'Split premiere' }
    ]
  },

  {
    id: 'finale',
    label: 'Finale type',
    type: 'single',
    help: 'How the season ends.',
    default: 'top3',
    choices: [
      { id: 'top3',       label: 'Top 3 finale' },
      { id: 'top4',       label: 'Top 4 finale' },
      { id: 'tournament', label: 'Lip sync tournament' }
    ]
  },

  {
    id: 'returning',
    label: 'Returning format',
    type: 'single',
    help: 'Whether past queens come back.',
    default: 'none',
    choices: [
      { id: 'none',       label: 'No returning queens' },
      { id: 'comeback',   label: 'Eliminated queens can return' },
      { id: 'joins',      label: 'Returning queens join the cast' }
    ]
  },

  {
    id: 'twists',
    label: 'Twists',
    type: 'multi',
    help: 'Switch on any extras.',
    defaults: [],
    choices: [
      { id: 'double-elim',   label: 'Double elimination' },
      { id: 'non-elim',      label: 'Non-elimination episode' },
      { id: 'assassin',      label: 'Lip sync assassin' },
      { id: 'immunity',      label: 'Immunity prize' },
      { id: 'teams',         label: 'Team challenges' },
      { id: 'snatch',        label: 'Snatch Game episode' }
    ]
  }

];
