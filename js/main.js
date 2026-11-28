/* ==========================================================================
   GreenRoom Simulator - main.js
   App start-up. Needs the other scripts to load first (see index.html).

   Sections:
     1. Button clicks (anything with data-goto="screen-name")
     2. Keyboard shortcuts
     3. Online indicator
     4. Start the app

   Plain scripts (no modules), so index.html also works when opened
   straight from a folder, not just from GitHub Pages.
   ========================================================================== */

'use strict';


/* ---------- 1. Button clicks ----------
   One listener for the whole page: any element with data-goto="name"
   switches to that screen. To add a new button, just give it data-goto. */
document.addEventListener('click', function (event) {
  const trigger = event.target.closest('[data-goto]');
  if (!trigger) return;
  Nav.go(trigger.dataset.goto);
});


/* ---------- 2. Keyboard shortcuts ---------- */
document.addEventListener('keydown', function (event) {
  // Escape = back to the home screen (not while typing in a text box)
  if (event.target.matches('input, textarea')) return;
  if (event.key === 'Escape' && Nav.current() !== 'home') {
    Nav.go('home');
  }
});


/* ---------- 3. Online indicator (home screen, top right) ----------
   Shows ONLINE with a glowing dot, or OFFLINE if the browser loses its connection. */
(function () {
  const box = document.getElementById('net-status');
  if (!box) return;
  const text = box.querySelector('.status-text');
  function update() {
    const online = navigator.onLine !== false;
    box.classList.toggle('is-offline', !online);
    text.textContent = online ? 'ONLINE' : 'OFFLINE';
  }
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
})();


/* ---------- 4. Start the app ---------- */
Setup.init();    // build the season settings (left of the setup screen)
Cast.init();     // build the queen cards (right of the setup screen)
Episode.init();  // basic episode screen (GRX test UI)
Nav.init();      // show the right screen
