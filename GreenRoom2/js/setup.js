/* ==========================================================================
   GreenRoom Simulator - setup.js
   The LEFT half of the setup screen: season settings (format, premiere,
   finale, returning format, twists). Built from SETUP_OPTIONS in
   js/data/options.js, so adding a setting never needs a change here.

   Sections:
     1. Elements and state
     2. Building the panel
     3. Reading and updating settings
     4. Start-up

   Handy in the browser console (F12):
     Setup.get()    the current settings, e.g.
                    { format: 'regular', premiere: 'standard', ..., twists: ['assassin'] }
   ========================================================================== */

'use strict';

const Setup = (function () {

  /* ---------- 1. Elements and state ---------- */
  const container = document.getElementById('settings');
  const state = {};     // group id -> chosen id (single) or array of ids (multi)


  /* ---------- 2. Building the panel ---------- */
  // Small helper: make an element with a class and optional text
  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function makeChoice(group, choice) {
    const isMulti = group.type === 'multi';

    const label = make('label', isMulti ? 'opt opt--multi' : 'opt');

    const input = document.createElement('input');
    input.type = isMulti ? 'checkbox' : 'radio';
    input.name = group.id;
    input.value = choice.id;
    input.checked = isMulti
      ? state[group.id].indexOf(choice.id) !== -1
      : state[group.id] === choice.id;

    const box = make('span', 'opt-box');
    const text = make('span', 'opt-text');
    text.appendChild(make('span', 'opt-label', choice.label));
    if (choice.note) text.appendChild(make('span', 'opt-note', choice.note));
    box.appendChild(text);

    label.appendChild(input);
    label.appendChild(box);
    return label;
  }

  function makeGroup(group) {
    const details = make('details', 'group');
    details.open = true;
    details.dataset.group = group.id;

    // Heading row: title, current choice, chevron (the chevron is CSS)
    const summary = document.createElement('summary');
    summary.appendChild(make('span', 'group-title', group.label));
    summary.appendChild(make('span', 'group-value', describe(group)));
    details.appendChild(summary);

    if (group.help) details.appendChild(make('p', 'group-help', group.help));

    const options = make('div', 'options');
    options.setAttribute('role', group.type === 'multi' ? 'group' : 'radiogroup');
    options.setAttribute('aria-label', group.label);
    group.choices.forEach(function (choice) {
      options.appendChild(makeChoice(group, choice));
    });
    details.appendChild(options);

    return details;
  }

  function build() {
    const fragment = document.createDocumentFragment();
    SETUP_OPTIONS.forEach(function (group) {
      fragment.appendChild(makeGroup(group));
    });
    container.appendChild(fragment);
  }


  /* ---------- 3. Reading and updating settings ---------- */
  function findGroup(id) {
    return SETUP_OPTIONS.find(function (group) { return group.id === id; });
  }

  // Short text for the heading row, e.g. "Regular season" or "2 on"
  function describe(group) {
    if (group.type === 'multi') {
      const count = state[group.id].length;
      return count === 0 ? 'None' : count + ' on';
    }
    const chosen = group.choices.find(function (choice) {
      return choice.id === state[group.id];
    });
    return chosen ? chosen.label : '';
  }

  function updateSummary(group) {
    const value = container.querySelector('[data-group="' + group.id + '"] .group-value');
    if (value) value.textContent = describe(group);
  }

  // Runs whenever any radio button or checkbox changes
  function onChange(event) {
    const input = event.target;
    if (!input.matches('input')) return;

    const group = findGroup(input.name);
    if (!group) return;

    if (group.type === 'multi') {
      const others = state[group.id].filter(function (id) { return id !== input.value; });
      state[group.id] = input.checked ? others.concat(input.value) : others;
    } else {
      state[group.id] = input.value;
    }

    updateSummary(group);
  }

  // A copy of the current settings (changing the copy changes nothing)
  function get() {
    return JSON.parse(JSON.stringify(state));
  }


  /* ---------- 4. Start-up ---------- */
  function init() {
    SETUP_OPTIONS.forEach(function (group) {
      state[group.id] = group.type === 'multi'
        ? (group.defaults || []).slice()
        : group.default;
    });
    build();
    container.addEventListener('change', onChange);
  }

  return { init: init, get: get };

})();
