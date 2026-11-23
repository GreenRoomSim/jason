/* ==========================================================================
   GreenRoom Simulator - setup.js
   The LEFT half of the setup screen: season settings (format, premiere,
   finale, ...). Built from SETUP_OPTIONS in js/data/options.js, so adding a
   setting never needs a change here.

   Sections:
     1. Elements and state
     2. Building the panel
     3. Reading and updating settings
     4. Start-up

   Handy in the browser console (F12):
     Setup.get()    the current settings, e.g.
                    { format: 'regular', premiere: 'regular', finale: 'top3' }
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
    const section = make('section', 'group');
    section.dataset.group = group.id;

    section.appendChild(make('h4', 'group-title', group.label));
    if (group.help) section.appendChild(make('p', 'group-help', group.help));

    const options = make('div', 'options');
    options.setAttribute('role', group.type === 'multi' ? 'group' : 'radiogroup');
    options.setAttribute('aria-label', group.label);
    group.choices.forEach(function (choice) {
      options.appendChild(makeChoice(group, choice));
    });
    section.appendChild(options);

    return section;
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
