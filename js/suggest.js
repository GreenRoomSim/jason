/* ==========================================================================
   GreenRoom Simulator - js/suggest.js
   The "Suggest a feature" screen. The message is sent to a Google Form (the
   answers land in its linked Google Sheet). Needs the form in index.html.

   TO FINISH SETTING UP: replace ENTRY_ID below with the question's id (it
   looks like entry.123456789). How to find it:
     Google Form > three dots > Get pre-filled link > type "test" in the
     question > Get link > copy it. The link contains ...&entry.123456789=test
   Plain script: Suggest is global.
   ========================================================================== */

'use strict';

const Suggest = (function () {

  const FORM_ID  = '1FAIpQLSd8m-zYcSjKhoCZSPxJZ93o9N-IRtN4BBuGB8J_HOd2gxhkxQ';
  const ENTRY_ID = 'entry.1665870597';
  const SEND_URL = 'https://docs.google.com/forms/d/e/' + FORM_ID + '/formResponse';

  const MIN_LENGTH  = 10;                       // shortest message accepted
  const COOLDOWN_MS = 60 * 1000;                // one message per minute per browser
  const COOLDOWN_KEY = 'greenroom-suggest-last';

  const form    = document.getElementById('suggest-form');
  if (!form) return {};
  const text    = document.getElementById('suggest-text');
  const count   = document.getElementById('suggest-count');
  const trap    = document.getElementById('suggest-trap');
  const status  = document.getElementById('suggest-status');
  const sendBtn = document.getElementById('suggest-send');
  const thanks  = document.getElementById('suggest-thanks');
  const again   = document.getElementById('suggest-again');

  function say(message, isError) {
    status.textContent = message;
    status.classList.toggle('is-error', !!isError);
  }

  function lastSent() {
    try { return Number(localStorage.getItem(COOLDOWN_KEY)) || 0; } catch (e) { return 0; }
  }
  function markSent() {
    try { localStorage.setItem(COOLDOWN_KEY, String(Date.now())); } catch (e) { /* private mode: ignore */ }
  }

  text.addEventListener('input', function () {
    count.textContent = text.value.length + ' / ' + text.maxLength;
    if (status.classList.contains('is-error')) say('');
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    if (trap.value) { showThanks(); return; }             // a bot filled the trap: pretend it worked

    const message = text.value.trim();
    if (message.length < MIN_LENGTH) {
      say('Please write at least ' + MIN_LENGTH + ' characters.', true);
      text.focus();
      return;
    }
    const wait = COOLDOWN_MS - (Date.now() - lastSent());
    if (wait > 0) {
      say('Please wait ' + Math.ceil(wait / 1000) + ' seconds before sending another message.', true);
      return;
    }
    if (ENTRY_ID.indexOf('XXXX') !== -1) {
      console.warn('suggest.js: ENTRY_ID is not set yet, see the notes at the top of the file.');
      say('The form is not connected yet. Please try again later.', true);
      return;
    }
    if (navigator.onLine === false) {
      say('You seem to be offline. Check your connection and try again.', true);
      return;
    }

    const type = form.querySelector('input[name="type"]:checked');
    const body = new URLSearchParams();
    body.append(ENTRY_ID, '[' + (type ? type.value : 'Suggestion') + '] ' + message);

    sendBtn.disabled = true;
    say('Sending...');
    // no-cors: Google doesn't let a web page read the reply, so "no error" = sent
    fetch(SEND_URL, { method: 'POST', mode: 'no-cors', body: body })
      .then(function () {
        markSent();
        showThanks();
      })
      .catch(function () {
        say('Something went wrong sending your message. Please try again.', true);
      })
      .then(function () { sendBtn.disabled = false; });
  });

  function showThanks() {
    form.hidden = true;
    thanks.hidden = false;
    text.value = '';
    count.textContent = '0 / ' + text.maxLength;
    say('');
    again.focus();
  }

  again.addEventListener('click', function () {
    thanks.hidden = true;
    form.hidden = false;
    text.focus();
  });

  return {};

})();
