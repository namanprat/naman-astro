/*
 * AART Estate brochure — deck spec
 *
 * Every coordinate below is in REFERENCE PDF POINTS, measured directly out of
 * AART_BROCHURE.pdf. build.js scales them to the 1240x1754 Figma artboard.
 *
 * Element vocabulary
 *   { k:'band',  x,y,w,h, fill, img }        full-bleed colour band / hero plate
 *   { k:'plate', x,y,w,h, fill, img, cap }   image plate; `cap` shows only when no photo
 *   { k:'text',  x,y,w, style, text, fill, align }
 *   { k:'rule',  x,y,w, fill, opacity, h }
 *   { k:'logo',  x,y,w,h }                   AART GROUP lockup
 *
 * `img` names a slot in IMAGE_SLOTS. build.js resolves each slot to an imageHash
 * harvested from the existing Figma file — the user's instruction was to use the
 * photography from the other brochure rather than the reference's grey placeholders.
 * Any slot that cannot be resolved falls back to the reference's flat plate + caption,
 * so a partial image set still produces a complete, coherent deck.
 */

const M = 38.4;        // left margin (pt)
const R = 556.2;       // right edge (pt)
const CW = R - M;      // 517.8 content width
const KICKER_Y = 43.0;
const HEAD_Y = 77.6;

/* Slots are listed in priority order: if the file yields fewer photographs than
 * slots, the earliest slots win the available images. */
const IMAGE_SLOTS = [
  'hero',         // 01 cover — full bleed
  'aerial',       // 02 aerial landscape band
  'dusk',         // 10 closing band
  'trekking',     // 03 mosaic — tall left
  'horseRiding',  // 03 mosaic — wide top right
  'devi',         // 03 mosaic
  'sport',        // 03 mosaic
  'family',       // 03 mosaic
  'villaRender',  // 04 pre-designed villas
  'customVilla',  // 04 design your own
  'designLang1',  // 05 villa architecture
  'designLang2',  // 05 villa interiors
  'designLang3',  // 05 landscape & gardens
  'designLang4',  // 05 clubhouse architecture
  'materialBoard',// 05 material & palette board
  'regionalMap',  // 06 regional map
  'insetMap',     // 06 local inset map
  'pillar1',      // 07 scenic approach road
  'pillar2',      // 07 yoga · pool · nature
  'pillar3',      // 07 residents · common area
  'pillar4',      // 07 outdoor dining · sport
  'ownerApp',     // 08 owner app dashboard
  'masterPlan',   // 09 master plan
];

/* helpers ------------------------------------------------------------------ */
const kicker = (text, fill) => ({ k: 'text', x: M, y: KICKER_Y, w: CW, style: 'kicker', text, fill });
const headline = (lines, fill, y) => ({ k: 'text', x: M, y: y ?? HEAD_Y, w: CW, style: 'headline', text: lines.join('\n'), fill });
const footer = (folio, fill, withWordmark, y) => {
  const out = [{ k: 'text', x: M, y: y ?? 793.8, w: CW, style: 'labelSm', text: folio, fill, align: 'RIGHT' }];
  if (withWordmark) out.unshift({ k: 'text', x: M, y: y ?? 793.8, w: CW, style: 'labelSm', text: 'AART ESTATE', fill, opacity: 0.55 });
  return out;
};

/* pages -------------------------------------------------------------------- */
const PAGES = [

/* 01 ─────────────────────────────────────────────────────── COVER ───────── */
{
  name: '01 Cover', bg: 'ink',
  el: [
    { k: 'band', x: 0, y: 0, w: 594.5, h: 584.4, fill: 'panel', img: 'hero',
      cap: ['HERO IMAGE', 'ESTATE · FOREST · RIVER · HILLS'] },
    { k: 'logo', x: 248.3, y: 36, w: 98, h: 30 },
    { k: 'text', x: M, y: 512.5, w: CW, style: 'kicker', text: 'AART GROUP PRESENTS', fill: 'gold', align: 'CENTER' },
    { k: 'text', x: M, y: 541, w: CW, style: 'wordmarkTop',  text: 'AART',   fill: 'cream', align: 'CENTER' },
    { k: 'text', x: M, y: 587, w: CW, style: 'wordmarkMain', text: 'ESTATE', fill: 'cream', align: 'CENTER' },
    { k: 'rule', x: 148, y: 651, w: 298, h: 2.6, fill: 'cream' },
    { k: 'text', x: M, y: 670, w: CW, style: 'locality', text: 'SHAKUMBHARI HILLS', fill: 'cream', align: 'CENTER' },
    { k: 'rule', x: 274.3, y: 725.4, w: 46, h: 0.5, fill: 'gold' },
    { k: 'text', x: M, y: 743, w: CW, style: 'tagline',
      text: 'We don’t sell square feet.\nWe curate the hours you can’t get anywhere else.',
      fill: 'cream', align: 'CENTER' },
  ],
},

/* 02 ───────────────────────────────────────────────── THE POSITIONING ───── */
{
  name: '02 The Positioning', bg: 'ink',
  el: [
    { k: 'band', x: 0, y: 0, w: 594.5, h: 394.1, fill: 'panel', img: 'aerial',
      cap: ['AERIAL LANDSCAPE', 'WHERE THE PLAINS MEET THE HILLS'] },
    kicker('THE POSITIONING', 'gold'),
    headline(['WHERE THE HILLS BEGIN,', 'LIFE CHANGES PACE.'], 'cream', 478),
    { k: 'text', x: M, y: 597, w: 413.5, style: 'bodyLg', fill: 'cream',
      text: 'A private hillside in the Shivaliks where the home is yours to shape, the days are centered around you, and the home looked after for you so the place you bought for the next generation is still worth handing over.' },
    ...footer('02', 'cream', true),
  ],
},

/* 03 ───────────────────────────────────────── LIFE AT AART ESTATE ───────── */
{
  name: '03 Life at AART Estate', bg: 'cream',
  el: [
    kicker('LIFE AT AART ESTATE', 'green'),
    headline(['LIFE HERE IS MADE', 'OF MOMENTS.'], 'ink'),

    { k: 'plate', x: M,     y: 186.0, w: 200.9, h: 393.6, fill: 'sand', img: 'trekking',
      cap: ['TREKKING · HILL TRAILS'],
      label: { text: 'INTO THE HILLS', fill: 'green' },
      desc:  { text: 'Trekking. Horse riding. Nature trails.', fill: 'ink' } },

    { k: 'plate', x: 248.8, y: 186.0, w: 307.3, h: 213.4, fill: 'sand', img: 'horseRiding',
      cap: ['HORSE RIDING · FOREST TRAIL'] },

    { k: 'plate', x: 248.8, y: 408.9, w: 149.1, h: 170.7, fill: 'ink',
      label: { text: 'CLOSER TO YOURSELF', fill: 'gold' },
      desc:  { text: 'Quiet mornings. Reflection. Spiritual connection.', fill: 'cream' } },

    { k: 'plate', x: 407.6, y: 408.9, w: 148.6, h: 170.7, fill: 'sand', img: 'devi',
      cap: ['SHAKUMBHARI DEVI ·', 'REFLECTION'] },

    { k: 'plate', x: M,     y: 589.2, w: 200.9, h: 170.7, fill: 'green',
      label: { text: 'WELLNESS, CURATED', fill: 'gold' },
      desc:  { text: 'Yoga. Movement. Mindfulness.', fill: 'cream' } },

    { k: 'plate', x: 248.8, y: 589.2, w: 149.1, h: 170.7, fill: 'sand', img: 'sport',
      cap: ['SPORT · POOL · TENNIS'],
      label: { text: 'DAYS SPENT TOGETHER', fill: 'green' },
      desc:  { text: 'Swimming. Badminton. Clubhouse life.', fill: 'ink' } },

    { k: 'plate', x: 407.6, y: 589.2, w: 148.6, h: 170.7, fill: 'sand', img: 'family',
      cap: ['FAMILY · VERANDAH'],
      label: { text: 'THE MOMENTS IN BETWEEN', fill: 'green' },
      desc:  { text: 'Family time. Slow evenings.', fill: 'ink' } },

    { k: 'text', x: M, y: 780, w: CW, style: 'closingLine', text: 'This is life with more room in it.', fill: 'ink' },
    ...footer('03', 'ink', false, 794.2),
  ],
},

/* 04 ─────────────────────────────────────────────────────── THE HOMES ───── */
{
  name: '04 The Homes', bg: 'cream',
  el: [
    kicker('THE HOMES', 'green'),
    headline(['ONE VISION. TWO WAYS', 'TO MAKE IT YOURS.'], 'ink'),

    { k: 'plate', x: M,     y: 194.1, w: 250.3, h: 433.4, fill: 'sand', img: 'villaRender',
      cap: ['VILLA RENDER', 'ESTATE DESIGN LANGUAGE'] },
    { k: 'plate', x: 305.9, y: 194.1, w: 250.3, h: 433.4, fill: 'ink', img: 'customVilla',
      cap: ['DRAWINGS · MATERIALS', 'CUSTOM VILLA CONCEPT'], capFill: 'cream' },

    { k: 'rule', x: M,     y: 644, w: 250.3, h: 0.5, fill: 'ink', opacity: 0.25 },
    { k: 'rule', x: 305.9, y: 644, w: 250.3, h: 0.5, fill: 'ink', opacity: 0.25 },

    { k: 'text', x: M,     y: 653, w: 250.3, style: 'closingLine', text: 'Pre-designed villas', fill: 'ink' },
    { k: 'text', x: 305.9, y: 653, w: 250.3, style: 'closingLine', text: 'Design your own',    fill: 'ink' },

    { k: 'text', x: M,     y: 692, w: 235, style: 'bodySm', fill: 'ink',
      text: 'Homes created within the AART Estate design language — ready to choose, personalise and make your own.' },
    { k: 'text', x: 305.9, y: 692, w: 250.3, style: 'bodySm', fill: 'ink',
      text: 'Shape your villa and interiors around the way you live, within architectural guidelines that preserve the character of the estate.' },

    { k: 'text', x: M, y: 780, w: CW, style: 'closingLine', text: 'Different homes. One unmistakable estate.', fill: 'green' },
    ...footer('04', 'ink', false, 794.2),
  ],
},

/* 05 ─────────────────────────────────────────── THE DESIGN LANGUAGE ─────── */
{
  name: '05 The Design Language', bg: 'ink',
  el: [
    kicker('THE DESIGN LANGUAGE', 'gold'),
    headline(['FREEDOM INSIDE', 'GUIDELINES.'], 'cream'),

    { k: 'text', x: M, y: 166, w: 420, style: 'bodyMd', fill: 'cream',
      text: 'Owners shape their own homes, while an estate-wide design language keeps the whole community visually coherent and premium.' },

    { k: 'plate', x: M,     y: 242.1, w: 164.9, h: 261.3, fill: 'panel', img: 'designLang1',
      cap: ['PLACEHOLDER'], title: 'Villa architecture' },
    { k: 'plate', x: 214.8, y: 242.1, w: 164.9, h: 261.3, fill: 'panel', img: 'designLang2',
      cap: ['PLACEHOLDER'], title: 'Villa interiors' },
    { k: 'plate', x: 391.3, y: 242.1, w: 164.9, h: 261.3, fill: 'panel', img: 'designLang3',
      cap: ['PLACEHOLDER'], title: 'Landscape & gardens' },
    { k: 'plate', x: M,     y: 514.9, w: 164.9, h: 261.8, fill: 'panel', img: 'designLang4',
      cap: ['PLACEHOLDER'], title: 'Clubhouse architecture' },
    { k: 'plate', x: 214.8, y: 514.9, w: 341.4, h: 261.8, fill: 'green', img: 'materialBoard',
      cap: ['MATERIAL & PALETTE BOARD'], title: 'Estate-wide material and visual language' },

    ...footer('05', 'cream', true, 797.6),
  ],
},

/* 06 ──────────────────────────────────────────── LOCATION & ACCESS ──────── */
{
  name: '06 Location & Access', bg: 'cream',
  el: [
    kicker('LOCATION & ACCESS', 'green'),
    headline(['CLOSE ENOUGH TO USE.', 'FAR ENOUGH TO FEEL', 'DIFFERENT.'], 'ink'),

    { k: 'text', x: M, y: 210, w: CW, style: 'closingLine', fill: 'green',
      text: 'The hills are no longer only for holidays.' },

    { k: 'plate', x: M, y: 257.4, w: 267.5, h: 342.8, fill: 'sand', img: 'regionalMap',
      cap: ['REGIONAL MAP', 'DELHI · SAHARANPUR · DEHRADUN'] },

    { k: 'text', x: 323.4, y: 257.3, w: 232.8, style: 'label', text: 'THE LOCATION', fill: 'green' },
    { k: 'table', x: 323.4, y: 281, w: 232.8, pitch: 35.5, fill: 'ink', rows: [
      ['Behat', '16 km'],
      ['Saharanpur City & Railhead', '40 km'],
      ['Dehradun', '70 km'],
      ['Jolly Grant Airport', '95 km'],
      ['Haridwar', '110 km'],
      ['Delhi', '250 km'],
    ] },
    { k: 'text', x: 323.4, y: 492, w: 232.8, style: 'footnote', text: 'All distances approximate.', fill: 'ink', opacity: 0.65 },

    { k: 'plate', x: M,     y: 621.3, w: 163.5, h: 142.9, fill: 'ink',
      label: { text: 'A LANDMARK ALREADY KNOWN', fill: 'gold' },
      desc:  { text: 'Near the revered Shakumbhari Devi Shakti Peeth.', fill: 'cream' } },
    { k: 'plate', x: 215.3, y: 621.3, w: 164.0, h: 142.9, fill: 'ink',
      label: { text: 'BUILT ON SOMETHING REAL', fill: 'gold' },
      desc:  { text: 'Surveyed land. Master planning underway.', fill: 'cream' } },
    { k: 'plate', x: 392.7, y: 621.3, w: 163.5, h: 142.9, fill: 'sand', img: 'insetMap',
      cap: ['LOCAL INSET MAP', 'ESTATE · BEHAT · DEVI'] },

    { k: 'text', x: M, y: 784, w: CW, style: 'closingLine', fill: 'ink',
      text: 'Nature when you want distance. Connectivity when you need it.' },
    ...footer('06', 'ink', false, 795.2),
  ],
},

/* 07 ───────────────────────────────────────────── THE FIVE PILLARS ──────── */
{
  name: '07 The Five Pillars', bg: 'ink',
  el: [
    kicker('THE FIVE PILLARS', 'gold'),
    headline(['BUILT AROUND THE WAY', 'YOU WANT TO LIVE.'], 'cream'),

    { k: 'plate', x: M,     y: 189.3, w: 252.2, h: 214.8, fill: 'panel', img: 'pillar1', cap: ['SCENIC APPROACH ROAD'], capTop: true },
    { k: 'plate', x: 304.0, y: 189.3, w: 252.2, h: 197.5, fill: 'panel', img: 'pillar2', cap: ['YOGA · POOL · NATURE'], capTop: true },
    { k: 'plate', x: M,     y: 490.0, w: 252.2, h: 195.1, fill: 'panel', img: 'pillar3', cap: ['RESIDENTS · COMMON AREA'], capTop: true },
    { k: 'plate', x: 304.0, y: 490.0, w: 252.2, h: 178.4, fill: 'panel', img: 'pillar4', cap: ['OUTDOOR DINING · SPORT'], capTop: true },

    { k: 'pillar', x: M,     y: 414, w: 252.2, n: '01', label: 'ACCESSIBILITY',
      promise: 'Escape without disappearing.', support: 'Connected enough to return to regularly.' },
    { k: 'pillar', x: 304.0, y: 397, w: 252.2, n: '02', label: 'WELLNESS',
      promise: 'Wellbeing becomes part of the environment.', support: 'Nature, movement and curated wellness experiences.' },
    { k: 'pillar', x: M,     y: 695, w: 252.2, n: '03', label: 'COMMUNITY',
      promise: 'Privacy when you want it. Belonging when you seek it.', support: 'A more intentional residential community.' },
    { k: 'pillar', x: 304.0, y: 678, w: 252.2, n: '04', label: 'LIFESTYLE',
      promise: 'There should always be something worth staying back for.', support: 'Sports, trails, clubhouse life and outdoor experiences.' },

    ...footer('07', 'cream', true, 797.6),
  ],
},

/* 08 ─────────────────────────────────── TURNKEY ASSET MANAGEMENT ────────── */
{
  name: '08 Turnkey Asset Management', bg: 'cream',
  el: [
    { k: 'text', x: M, y: KICKER_Y, w: 20, style: 'kicker', text: '05', fill: 'gold' },
    { k: 'text', x: 57.8, y: KICKER_Y, w: CW - 19.4, style: 'kicker', text: 'TURNKEY ASSET MANAGEMENT', fill: 'green' },
    headline(['ENJOY THE HOME.', 'WE HELP TAKE', 'CARE OF THE REST.'], 'ink', 81.1),

    { k: 'text', x: M, y: 223, w: 400, style: 'body', fill: 'ink',
      text: 'Property maintenance and housekeeping, with support to list and manage the home for short-term rentals when you are away.' },

    { k: 'list', x: M, y: 443, w: 205, pitch: 36.9, fill: 'ink', style: 'body', items: [
      'Maintenance requests', 'Housekeeping status', 'Booking calendar', 'Occupancy', 'Rental earnings',
    ] },

    { k: 'plate', x: 301.6, y: 298.6, w: 254.6, h: 478.0, fill: 'ink', img: 'ownerApp',
      cap: ['OWNER APP DASHBOARD', 'MOCKUP PLACEHOLDER'], capFill: 'cream' },

    ...footer('08', 'ink', false, 797.6),
  ],
},

/* 09 ──────────────────────────────────────────────────── THE OFFERING ───── */
{
  name: '09 The Offering', bg: 'ink',
  el: [
    kicker('THE OFFERING', 'gold'),
    headline(['EIGHTY HOMESITES.', 'ONE CONSIDERED WAY OF', 'LIVING.'], 'cream'),

    { k: 'text', x: M,     y: 232, w: 150, style: 'statNumber', text: '14', fill: 'gold' },
    { k: 'text', x: 197.1, y: 232, w: 150, style: 'statNumber', text: '80', fill: 'gold' },
    { k: 'text', x: M,     y: 281, w: 150, style: 'label', text: 'ACRES (APPROX.)',   fill: 'cream' },
    { k: 'text', x: 197.1, y: 281, w: 160, style: 'label', text: 'RESIDENTIAL PLOTS', fill: 'cream' },

    { k: 'rule', x: M, y: 318.7, w: CW, h: 0.5, fill: 'cream', opacity: 0.22 },

    { k: 'text', x: M,     y: 337, w: 250, style: 'statUnit', text: '250 SQ YD', fill: 'cream' },
    { k: 'text', x: 305.9, y: 337, w: 250, style: 'statUnit', text: '500 SQ YD', fill: 'cream' },
    { k: 'text', x: M,     y: 371, w: 250, style: 'label', text: '45 PLOTS', fill: 'gold' },
    { k: 'text', x: 305.9, y: 371, w: 250, style: 'label', text: '35 PLOTS', fill: 'gold' },
    { k: 'text', x: M,     y: 392, w: 250, style: 'bodyXs', text: 'Designed for compact luxury.', fill: 'cream' },
    { k: 'text', x: 305.9, y: 392, w: 250, style: 'bodyXs', text: 'More room to make it yours.', fill: 'cream' },

    { k: 'plate', x: M, y: 433.4, w: CW, h: 257.0, fill: 'panel', img: 'masterPlan',
      cap: ['MASTER PLAN — WORKING VERSION', '250 SQ YD / 500 SQ YD DIFFERENTIATED'] },

    { k: 'text', x: M, y: 707, w: CW, style: 'label', text: 'BEYOND YOUR PLOT', fill: 'gold' },
    { k: 'text', x: M, y: 726, w: CW, style: 'bodyXs', fill: 'cream',
      text: 'Clubhouse   ·   Sports & Recreation   ·   Wellness Experiences   ·\nLandscaped Streets & Trails   ·   Community Spaces' },

    { k: 'text', x: M, y: 784, w: CW, style: 'closingLine', fill: 'cream',
      text: 'A home for now. An asset for what comes next.' },
    ...footer('09', 'cream', false, 795.2),
  ],
},

/* 10 ───────────────────────────────────────────────────────── CLOSING ───── */
{
  name: '10 Closing', bg: 'ink',
  el: [
    { k: 'band', x: 0, y: 0, w: 594.5, h: 249.3, fill: 'panel', img: 'dusk',
      cap: ['DUSK IMAGE', 'ESTATE ENTRANCE / CLUBHOUSE'] },

    { k: 'text', x: M, y: 289, w: CW, style: 'headlineSm', fill: 'cream', align: 'CENTER',
      text: 'A PLACE TO RETURN TO.\nA LIFE TO GROW INTO.' },

    { k: 'text', x: M, y: 392, w: CW, style: 'wordmarkTop',  text: 'AART',   fill: 'cream', align: 'CENTER', sizeScale: 0.62 },
    { k: 'text', x: M, y: 421, w: CW, style: 'wordmarkMain', text: 'ESTATE', fill: 'cream', align: 'CENTER', sizeScale: 0.62 },
    { k: 'rule', x: 205, y: 462, w: 185, h: 1.8, fill: 'cream' },
    { k: 'text', x: M, y: 476, w: CW, style: 'locality', text: 'SHAKUMBHARI HILLS', fill: 'cream', align: 'CENTER', sizeScale: 0.69 },

    { k: 'text', x: M, y: 518, w: CW, style: 'bodySm', fill: 'cream', align: 'CENTER',
      text: 'Discover the estate. Explore the vision.\nBegin the conversation.' },

    { k: 'plate', x: 246.9, y: 586.3, w: 100.7, h: 100.7, fill: 'cream', cap: ['QR CODE'], capFill: 'ink' },

    { k: 'text', x: M, y: 695, w: CW, style: 'label', text: 'SCAN TO EXPLORE AART ESTATE', fill: 'gold', align: 'CENTER' },
    { k: 'text', x: M, y: 721, w: CW, style: 'bodyXs', text: 'www.aartestate.com', fill: 'cream', align: 'CENTER' },
    { k: 'logo', x: 248.3, y: 758, w: 98, h: 28 },
    { k: 'text', x: M, y: 794, w: CW, style: 'label', text: 'A DEVELOPMENT BY AART GROUP', fill: 'cream', align: 'CENTER', opacity: 0.7 },
  ],
},

];

module.exports = { PAGES, IMAGE_SLOTS, M, R, CW };
