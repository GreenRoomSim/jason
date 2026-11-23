/* ==========================================================================
   GreenRoom Simulator - navigation.js
   Switches between screens. Loaded before main.js.

   How it works:
     - Every screen in index.html is <section class="screen" data-screen="name">.
     - Nav.go('setup') changes the page address to #setup AND shows that
       screen straight away (it does not wait for the browser to report the
       address change, because some viewers, like VS Code's built-in browser,
       report it late or not at all).
     - Browser Back/Forward, or typing index.html#setup, are picked up by
       the hashchange/popstate listeners, which show the matching screen.

   Handy in the browser console (F12):
     Nav.go('credits')      Nav.current()      Nav.active()      Nav.screens()
   ========================================================================== */

'use strict';

const Nav = (function () {

  const DEFAULT_SCREEN = 'home';
  const screenElements = document.querySelectorAll('.screen');

  // Names of all screens, e.g. ['home', 'cast', 'changelog', ...]
  function screens() {
    return Array.from(screenElements).map(function (el) { return el.dataset.screen; });
  }

  function findScreen(name) {
    return document.querySelector('.screen[data-screen="' + name + '"]');
  }

  // Show one screen, hide the rest. moveFocus = false on first page load.
  function show(name, moveFocus) {
    let target = findScreen(name);

    if (!target) {
      console.warn('Nav: no screen called "' + name + '", showing "' + DEFAULT_SCREEN + '" instead.');
      name = DEFAULT_SCREEN;
      target = findScreen(name);
    }

    screenElements.forEach(function (el) {
      el.classList.toggle('is-active', el === target);
    });

    window.scrollTo(0, 0);

    // Put keyboard focus on the new screen's main element
    if (moveFocus) {
      const focusTarget = target.querySelector('[data-autofocus]');
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    }
  }

  // Go to a screen by name: update the address and show the screen right now
  function go(name) {
    if (current() !== name) window.location.hash = name;
    show(name, true);
  }

  // Name of the screen currently in the address (home if there is none)
  function current() {
    return window.location.hash.slice(1) || DEFAULT_SCREEN;
  }

  // Name of the screen that is visible right now
  function active() {
    const visible = document.querySelector('.screen.is-active');
    return visible ? visible.dataset.screen : null;
  }

  // Make the visible screen match the address (Back/Forward, edited address).
  // Does nothing if they already match, so go() followed by the browser's own
  // hashchange event doesn't show the screen twice.
  function syncWithAddress() {
    if (active() !== current()) show(current(), true);
  }

  function init() {
    window.addEventListener('hashchange', syncWithAddress);
    window.addEventListener('popstate', syncWithAddress);
    show(current(), false);      // first load
  }

  return { init: init, go: go, show: show, current: current, active: active, screens: screens };

})();
