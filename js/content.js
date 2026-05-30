/**
 * content.js: everything visible on the site lives here.
 * Edit this file to update the page. No framework knowledge needed.
 */

window.CONTENT = {

  // ── Hero ────────────────────────────────────────────────────────────────────
  name:    'Jordan Fluitt',
  tagline: 'Technical program manager. Senior software engineer. Translator. Metal vocalist. Astronomy nerd. Dog lover. Used em-dashes long before AI did.',

  links: [
    { href: 'https://github.com/o-i-z-y-s',                   img: './assets/github.png',   label: 'GitHub'   },
    { href: 'https://www.linkedin.com/in/jordan-fluitt/',     img: './assets/linkedin.svg', label: 'LinkedIn' },
    { href: 'mailto:jordanf.tpm@gmail.com',                   img: './assets/letter.svg',   label: 'Email'    },
  ],

  // ── Ocean: short bio ─────────────────────────────────────────────────────────
  bio: 'I lead R&D initiatives and the engineers that build them. <a href="https://www.caci.com/space" target="_blank" rel="noopener noreferrer">We put things in space.</a>',

  // ── Ocean: status cards ──────────────────────────────────────────────────────
  statusCards: [
    {
      label: 'Currently',
      title: 'Technical Program Manager',
      body:  'Own a portfolio of five R&D projects, driving products from inception to market. Steward the budget and report directly to executives.',
    },
    {
      label: 'Previously',
      title: 'Senior Software Engineer',
      body:  'Developed mission-essential software for space launch. Took a sledgehammer to old UI. Also built cables on an island in Alaska.',
    },
    {
      label: 'Learning',
      title: 'M.S. Computer Science',
      body:  'Graduate Certificate in Artificial Intelligence. Remotely&nbsp;at&nbsp;University of Colorado Boulder. In&nbsp;progress.',
    },
    {
      label: 'Exploring',
      title: 'Agentic AI',
      body:  'Working daily with agents on projects both professional and ridiculous. Also writing comparative evaluations of frontier models.',
    },
    {
      label: 'Recently',
      title: 'PMP Certified',
      body:  'Above target across the board. The seven-hour YouTube videos work!',
    },
  ],

  // ── Ocean: projects ──────────────────────────────────────────────────────────
  projects: [
    {
      title: 'hoverleser',
      body:  'On-hover German-to-English dictionary overlay for reading in the browser. Zero latency. Works on Firefox, Chrome, and Edge.',
      href:  'https://github.com/o-i-z-y-s/hoverleser',
    },
    {
      title: 'This site!',
      body:  'Vanilla JS, real-time celestial body positioning, dynamic sky and ocean theming, canvas stars/bubbles. Did you check the moon phase?',
      href:  'https://github.com/o-i-z-y-s/coastal-yearning',
    },
  ],

  // ── Ocean: also (small cards, edit title and body freely) ─────────────────
  also: [
    { title: 'Linguistics',         body: 'UC Santa Barbara. Studied abroad in Tokyo. This actually came in handy building hoverleser.' },
    { title: 'Localization',        body: 'Untangle Japanese works in translation when new volumes drop. I\'ve done over 50! And a game!' },
    { title: 'German',              body: 'Fully understands videos on geopolitics, but cannot summarize them back to you.' },
    { title: 'Japanese',            body: 'Could survive outside Tokyo with no phone, but it would not be fun for anyone involved.' },
  ],


  footerText: 'Built by me in a dark bedroom. I miss the coast.',

};
