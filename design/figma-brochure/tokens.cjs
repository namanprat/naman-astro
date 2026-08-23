/*
 * AART Estate brochure — design tokens
 *
 * Every value is measured from the reference PDF (AART_BROCHURE.pdf, 595.3 x 841.9 pt)
 * and scaled to the Figma artboard (1240 x 1754 px = A4 at 150 dpi).
 *
 *   SCALE = 1240 / 595.3 = 2.0833   (1 pt = 2.0833 px)
 *
 * Fonts in the reference are ArialMT / CourierNewPSMT / Georgia for the live text and
 * OUTLINED VECTORS for every display line. The outlines are Marcellus — identified from
 * the inscriptional flared caps, the splayed M, the spurred G and the swash Q in "SQ YD".
 * Marcellus is already the display face in the Figma file, so the deck stays on:
 *
 *   display -> Marcellus Regular      (reference: outlined Marcellus)
 *   sans    -> Arimo Regular / Bold   (reference: ArialMT — Arimo is metric-compatible)
 *   mono    -> Courier New Regular    (reference: CourierNewPSMT)
 */

const SCALE = 1240 / 595.3;

/** points -> artboard px */
const pt = (v) => Math.round(v * SCALE * 100) / 100;

/** "#RRGGBB" -> Figma {r,g,b} in 0..1 */
function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

const COLOR = {
  ink:   '#082A13', // deep forest — dark page ground          (Figma var 4:3)
  panel: '#0B3319', // raised green — image plate on dark pages
  cream: '#FFFBE9', // cream — light page ground                (Figma var 4:6)
  sand:  '#EFE9D2', // warm grey — image plate on light pages
  green: '#005D30', // mid green — accent tiles + light-page kickers (Figma var 4:4)
  gold:  '#E0B257', // gold — kickers on dark pages, stat numerals
};

/* Page geometry ------------------------------------------------------------ */
const PAGE = {
  w: 1240,
  h: 1754,
  marginX: pt(38.4),   //  80
  contentW: pt(517.8), // 1079
  kickerTop: pt(43.0), //  90
  footerTop: pt(793.8),// 1654
};

/* Type ramp ---------------------------------------------------------------- */
// size / lineHeight / letterSpacing, all in artboard px.
//
// `anchor:'cap'` means the y in deck.cjs is the CAP TOP, not the text-box top.
// Display copy in the reference is outlined vector, so the only y that can be
// measured off it is the cap top; the renderer converts. Sans and mono copy is
// live text there, whose span bbox top already lines up with a Figma box top.
const CAP_RATIO = { Marcellus: 0.70, Arimo: 0.716, 'Courier New': 0.571 };

const TYPE = {
  // display — Marcellus
  wordmarkTop:  { font: ['Marcellus', 'Regular'], size: pt(53),    lh: pt(56),   ls: pt(23.7), anchor: 'cap' },
  wordmarkMain: { font: ['Marcellus', 'Regular'], size: pt(65),    lh: pt(68),   ls: pt(5.8) , anchor: 'cap' },
  locality:     { font: ['Marcellus', 'Regular'], size: pt(21.4),  lh: pt(26),   ls: pt(4.3) , anchor: 'cap' },
  tagline:      { font: ['Marcellus', 'Regular'], size: pt(19),    lh: pt(26.4), ls: 0, anchor: 'cap' },
  headline:     { font: ['Marcellus', 'Regular'], size: pt(41.5),  lh: pt(44.2), ls: 0, anchor: 'cap' },
  headlineSm:   { font: ['Marcellus', 'Regular'], size: pt(35.4),  lh: pt(41.7), ls: 0, anchor: 'cap' },
  statNumber:   { font: ['Marcellus', 'Regular'], size: pt(44),    lh: pt(46),   ls: 0, anchor: 'cap' },
  statUnit:     { font: ['Marcellus', 'Regular'], size: pt(26),    lh: pt(30),   ls: 0, anchor: 'cap' },
  promise:      { font: ['Marcellus', 'Regular'], size: pt(18.4),  lh: pt(22),   ls: 0, anchor: 'cap' },
  mosaicDesc:   { font: ['Marcellus', 'Regular'], size: pt(15.4),  lh: pt(18.5), ls: 0, anchor: 'cap' },
  closingLine:  { font: ['Marcellus', 'Regular'], size: pt(23),    lh: pt(27),   ls: 0, anchor: 'cap' },
  cardTitle:    { font: ['Marcellus', 'Regular'], size: pt(17),    lh: pt(21),   ls: 0, anchor: 'cap' },

  // sans — Arimo. `ls` reproduces the reference's letterspaced caps, which were faked
  // there with literal spaces between characters; here it is real tracking.
  kicker:       { font: ['Arimo', 'Bold'],    size: pt(9.59),  lh: pt(13), ls: pt(3.3) },
  label:        { font: ['Arimo', 'Bold'],    size: pt(9.11),  lh: pt(12), ls: pt(3.1) },
  labelSm:      { font: ['Arimo', 'Bold'],    size: pt(8.15),  lh: pt(11), ls: pt(2.8) },
  bodyLg:       { font: ['Arimo', 'Regular'], size: pt(13.9),  lh: pt(22.5), ls: pt(0.1) },
  body:         { font: ['Arimo', 'Regular'], size: pt(13.43), lh: pt(21.6), ls: pt(0.1) },
  bodyMd:       { font: ['Arimo', 'Regular'], size: pt(12.95), lh: pt(20.7), ls: pt(0.1) },
  bodySm:       { font: ['Arimo', 'Regular'], size: pt(12.47), lh: pt(19.6), ls: pt(0.1) },
  bodyXs:       { font: ['Arimo', 'Regular'], size: pt(11.99), lh: pt(20.6), ls: pt(0.1) },
  bodyXxs:      { font: ['Arimo', 'Regular'], size: pt(11.03), lh: pt(16.8), ls: pt(0.1) },
  footnote:     { font: ['Arimo', 'Regular'], size: pt(9.11),  lh: pt(14),   ls: pt(0.1) },

  // mono — plate captions. Only used on plates with no photograph behind them.
  caption:      { font: ['Courier New', 'Regular'], size: pt(7.19), lh: pt(9.8), ls: pt(0.5) },
  captionSm:    { font: ['Courier New', 'Regular'], size: pt(6.71), lh: pt(9.2), ls: pt(0.5) },
};

/* Vertical rhythm ---------------------------------------------------------- */
const GAP = {
  kickerToHeadline: pt(23.9), // 50
  headlineToLead:   pt(22.6), // 47
  headlineToBody:   pt(39.7), // 83
  leadToGrid:       pt(29.1), // 61
  gridGutter:       pt(9.6),  // 20
  gridGutterWide:   pt(17.3), // 36
  blockToClosing:   pt(25.4), // 53
};

module.exports = { SCALE, pt, hex, COLOR, PAGE, TYPE, GAP, CAP_RATIO };
