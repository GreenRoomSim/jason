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

  // A locked choice (locked: true in options.js): blurred, with a lock icon.
  // It is a plain button, so clicking it (or Enter/Space) opens the popup.
  const LOCK_ICON =
    '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zm-7-2a2 2 0 0 1 4 0v2h-4V7z"/>' +
    '</svg>';

  function makeLockedChoice(choice) {
    const button = make('button', 'opt opt--locked');
    button.type = 'button';
    button.setAttribute('aria-label', choice.label + ' (locked, coming soon)');

    const box = make('span', 'opt-box');
    const text = make('span', 'opt-text');
    text.appendChild(make('span', 'opt-label', choice.label));
    box.appendChild(text);

    const lock = make('span', 'opt-lock');
    lock.innerHTML = LOCK_ICON;

    button.appendChild(box);
    button.appendChild(lock);
    button.addEventListener('click', function () { showComingSoon(choice.label); });
    return button;
  }

  // The "coming soon" popup: made once, the first time it is needed
  let dialog = null;
  let dialogText = null;

  function showComingSoon(label) {
    if (typeof HTMLDialogElement === 'undefined') {            // very old browsers
      window.alert(label + ': this feature is still in development and is coming soon.');
      return;
    }
    if (!dialog) {
      dialog = make('dialog', 'modal');
      dialog.setAttribute('aria-labelledby', 'modal-title');

      const icon = make('span', 'modal-icon');
      icon.innerHTML = LOCK_ICON;
      const title = make('h3', 'modal-title', 'Coming soon');
      title.id = 'modal-title';
      dialogText = make('p', 'modal-text');
      const dismiss = make('button', 'btn small modal-dismiss', 'Dismiss');
      dismiss.type = 'button';
      dismiss.addEventListener('click', function () { dialog.close(); });

      // Escape closes the popup only (it must not also send you back to Home)
      dialog.addEventListener('keydown', function (event) { event.stopPropagation(); });
      // Clicking the dark area outside the box closes it too
      dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });

      dialog.appendChild(icon);
      dialog.appendChild(title);
      dialog.appendChild(dialogText);
      dialog.appendChild(dismiss);
      document.body.appendChild(dialog);
    }
    dialogText.textContent = label + ': this feature is still in development and is coming soon.';
    dialog.showModal();
  }

  function makeChoice(group, choice) {
    if (choice.locked) return makeLockedChoice(choice);

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
