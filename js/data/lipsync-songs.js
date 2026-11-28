/* ==========================================================================
   GreenRoom Simulator - js/data/lipsync-songs.js
   The lip sync song library. GRX picks one per lip sync (no repeats until
   every song has been used). These are starter picks: swap in your own.
     id: unique, lowercase, no spaces      title / artist: shown on screen
   Plain script: LIPSYNC_SONGS is global. Load before grx-engine.js.
   ========================================================================== */

'use strict';

const LIPSYNC_SONGS = [
  { id: 'since-u-been-gone', title: 'Since U Been Gone',  artist: 'Kelly Clarkson' },
  { id: 'toxic',             title: 'Toxic',              artist: 'Britney Spears' },
  { id: 'born-this-way',     title: 'Born This Way',      artist: 'Lady Gaga' },
  { id: 'dancing-queen',     title: 'Dancing Queen',      artist: 'ABBA' },
  { id: 'hung-up',           title: 'Hung Up',            artist: 'Madonna' },
  { id: 'physical',          title: 'Physical',           artist: 'Dua Lipa' },
  { id: 'rain-on-me',        title: 'Rain on Me',         artist: 'Lady Gaga & Ariana Grande' },
  { id: 'dont-stop-me-now',  title: 'Don\u2019t Stop Me Now', artist: 'Queen' },
  { id: 'padam-padam', title: 'Padam Padam', artist: 'Kylie Minogue' },
  { id: 'bad-romance', title: 'Bad Romance', artist: 'Lady Gaga' },
  { id: 'super-bass', title: 'Super Bass', artist: 'Nicki Magaj' },
  { id: 'i-will-survive', title: 'I Will Survive', artist: 'Gloria Gaynor' },
  { id: 'dont-start-now', title: "Don't Start Now", artist: 'Dua Lipa' },
  { id: 'total-eclipse-of-the-heart', title: 'Total Eclipse of the Heart', artist: 'Bonnie Tyler' },
  { id: 'gimme-more', title: 'Gimme More', artist: 'Britney Spears' },
  { id: 'murder-on-the-dancefloor', title: 'Murder on the Dancefloor', artist: 'Sophie Ellis-Bextor' },
  { id: 'crazy-in-love', title: 'Crazy in Love', artist: 'Beyoncé ft. Jay-Z' },
  { id: 'we-found-love', title: 'We Found Love', artist: 'Rihanna' },
  { id: 'believe', title: 'Believe', artist: 'Cher' },
  { id: 'girls-just-want-to-have-fun', title: 'Girls Just Want to Have Fun', artist: 'Cyndi Lauper' },
  { id: 'applause', title: 'Applause', artist: 'Lady Gaga' },
  { id: 'rhythm-of-the-night', title: 'The Rhythm of the Night', artist: 'Corona' },
  { id: 'levitating', title: 'Levitating', artist: 'Dua Lipa' },
  { id: 'circus', title: 'Circus', artist: 'Britney Spears' },
  { id: 'cuff-it', title: 'CUFF IT', artist: 'Beyoncé' },
  { id: 'strong-enough-cher', title: 'Strong Enough', artist: 'Cher' },
  { id: 'juice', title: 'Juice', artist: 'Lizzo' },
  { id: 'heart-of-glass', title: 'Heart of Glass', artist: 'Blondie' },
  { id: 'only-girl-in-the-world', title: 'Only Girl (In the World)', artist: 'Rihanna' },
  { id: 'holding-out-for-a-hero', title: 'Holding Out for a Hero', artist: 'Bonnie Tyler' },
  { id: 'telephone', title: 'Telephone', artist: 'Lady Gaga ft. Beyoncé' },
  { id: 'finally', title: 'Finally', artist: 'CeCe Peniston' },
  { id: 'get-outta-my-way', title: 'Get Outta My Way', artist: 'Kylie Minogue' },
  { id: 'single-ladies', title: 'Single Ladies (Put a Ring on It)', artist: 'Beyoncé' },
  { id: 'disturbia', title: 'Disturbia', artist: 'Rihanna' },
  { id: 'unwritten', title: 'Unwritten', artist: 'Natasha Bedingfield' },
  { id: 'starships', title: 'Starships', artist: 'Nicki Magaj' },
  { id: 'spinning-around', title: 'Spinning Around', artist: 'Kylie Minogue' },
  { id: 'womanizer', title: 'Womanizer', artist: 'Britney Spears' },
  { id: 'show-me-love', title: 'Show Me Love', artist: 'Robin S.' },
  { id: 'dance-the-night', title: 'Dance the Night', artist: 'Dua Lipa' },
  { id: 'i-love-rock-n-roll', title: "I Love Rock 'N Roll", artist: 'Joan Jett & the Blackhearts' },
  { id: 'run-the-world-girls', title: 'Run the World (Girls)', artist: 'Beyoncé' },
  { id: 'stronger', title: 'Stronger', artist: 'Britney Spears' },
  { id: 'its-raining-men', title: "It's Raining Men", artist: 'The Weather Girls' },
  { id: 'houdini', title: 'Houdini', artist: 'Dua Lipa' },
  { id: 'if-i-could-turn-back-time', title: 'If I Could Turn Back Time', artist: 'Cher' },
  { id: 'shut-up-and-drive', title: 'Shut Up and Drive', artist: 'Rihanna' },
  { id: 'the-edge-of-glory', title: 'The Edge of Glory', artist: 'Lady Gaga' },
  { id: 'im-so-excited', title: "I'm So Excited", artist: 'The Pointer Sisters' },
  { id: 'man-i-feel-like-a-woman', title: 'Man! I Feel Like a Woman!', artist: 'Shania Twain' },
  { id: 'cant-get-you-out-of-my-head', title: "Can't Get You Out of My Head", artist: 'Kylie Minogue' },
  { id: 'good-as-hell', title: 'Good as Hell', artist: 'Lizzo' },
  { id: 'alejandro', title: 'Alejandro', artist: 'Lady Gaga' },
  { id: 'groove-is-in-the-heart', title: 'Groove Is in the Heart', artist: 'Deee-Lite' },
  { id: 'physical-dua', title: 'Physical', artist: 'Dua Lipa' },
  { id: 'call-me', title: 'Call Me', artist: 'Blondie' }
];
