/* ==========================================================================
   GreenRoom Simulator - data/options.js
   The season settings shown on the LEFT of the setup screen.
   They are recorded (Setup.get()) but don't change the season yet.

   Everything on the left panel is built from SETUP_OPTIONS below, so to add,
   remove or rename a setting you only edit this list. No other file changes.

   Each group looks like this:

     {
       id:       'format',          unique, lowercase, no spaces
       label:    'Format',          heading shown on screen
       type:     'single',          'single' = pick one, 'multi' = switch several on/off
       help:     'Short sentence',  optional, shown under the heading
       default:  'regular',         single only: the id picked at the start
       defaults: ['some-id'],       multi only: ids switched on at the start (optional)
       choices: [
         { id: 'regular', label: 'Regular', note: 'Optional small text' }
       ]
     }

   A choice can force other settings: add  forces: { groupId: value }  (a single
   group's id, or [] to switch every extra off). The forced groups are locked while
   that choice is picked, and put back when another choice is picked. Optional
   forcesNote: 'text'  is shown on the setup screen while it is forcing.

   A choice can be locked while it is in development: add  locked: true  to it.
   It shows blurred with a lock icon, and clicking it opens a "coming soon"
   popup instead of selecting it. Delete the line to unlock it.

   Choice ids are what the simulation engine will read later, so keep them
   short and stable (changing an id later means changing the engine too).

   Not added yet (planned for later): a "Returning format" group and a
   "Twists" group. Twists would be a 'multi' group, for example:
     { id: 'twists', label: 'Twists', type: 'multi', defaults: [],
       choices: [ { id: 'some-twist', label: 'Some twist' } ] }

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
      { id: 'regular',          label: 'Regular' },
      { id: 'lipsync-legacy',   label: 'Lip Sync Legacy',
        note: 'Top 2 lip sync, the winner chops',
        forces: { premiere: 'regular', finale: 'top3', extras: [] },
        forcesNote: 'Lip Sync Legacy uses a Regular premiere and a Top 3 finale, with no extras for now.' },
      { id: 'lipsync-assassin', label: 'Lip Sync Assassin', locked: true }
    ]
  },

  {
    id: 'premiere',
    label: 'Premiere',
    type: 'single',
    help: 'How the season opens.',
    default: 'regular',
    choices: [
      { id: 'regular',          label: 'Regular Premiere' },
      { id: 'top2',             label: 'Top 2 Premiere' },
      { id: 'split',            label: 'Split Premiere' }
    ]
  },

  {
    id: 'finale',
    label: 'Finale',
    type: 'single',
    help: 'How the season ends.',
    default: 'top3',
    choices: [
      { id: 'top3',             label: 'Top 3 Finale' },
      { id: 'top4',             label: 'Top 4 Finale' },
      { id: 'crown',            label: 'Lip Sync For The Crown' }
    ]
  },

  {
    id: 'extras',
    label: 'Extras',
    type: 'multi',
    help: 'Optional extras. Everything here is off by default.',
    defaults: [],
    choices: [
      { id: 'riggory',    label: 'User Riggory', note: 'Choose the outcome of each episode if you want to' },
      { id: 'talentshow', label: 'Talent Show',  note: 'Needs 10+ queens' }
    ]
  }

];
