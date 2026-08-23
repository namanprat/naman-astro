#!/usr/bin/env node
/*
 * Renders deck.cjs to an HTML proof sheet.
 *
 *   node design/figma-brochure/preview.cjs > out/preview.html
 *
 * The point is that this reads the SAME spec the Figma scripts read, so what the
 * proof shows and what lands on the artboard cannot drift. If a measurement looks
 * wrong here, fix deck.cjs / tokens.cjs and both outputs move together.
 */

const { TYPE, COLOR, SCALE, CAP_RATIO } = require('./tokens.cjs');
const { PAGES } = require('./deck.cjs');

const S = SCALE;                 // pt -> artboard px
const px = (v) => +(v * S).toFixed(2);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const FAMILY = {
  Marcellus: "'Marcellus', 'Cormorant Garamond', Georgia, serif",
  Arimo: "'Arimo', Arial, Helvetica, sans-serif",
  'Courier New': "'Courier New', 'Roboto Mono', ui-monospace, monospace",
};

/** Box top sits this far above the cap top — mirrors renderer.js capOffset(). */
function capOffset(styleName, scale = 1) {
  const t = TYPE[styleName];
  if (t.anchor !== 'cap') return 0;
  const ratio = CAP_RATIO[t.font[0]] || 0.7;
  return (t.lh * scale - ratio * t.size * scale) / 2;
}

function typeCss(styleName, scale = 1) {
  const t = TYPE[styleName];
  return [
    `font-family:${FAMILY[t.font[0]]}`,
    `font-weight:${t.font[1] === 'Bold' ? 700 : 400}`,
    `font-size:${(t.size * scale).toFixed(2)}px`,
    `line-height:${(t.lh * scale).toFixed(2)}px`,
    `letter-spacing:${((t.ls || 0) * scale).toFixed(2)}px`,
  ].join(';');
}

const fill = (name, opacity) => {
  const hex = COLOR[name] || name;
  if (opacity == null || opacity === 1) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${opacity})`;
};

/* element renderers — mirror renderer.js ----------------------------------- */

function text(e, styleOverride) {
  const st = styleOverride || e.style;
  const s = [
    `position:absolute`,
    `left:${px(e.x)}px`, `top:${(px(e.y) - capOffset(st, e.sizeScale || 1)).toFixed(2)}px`, `width:${px(e.w)}px`,
    typeCss(st, e.sizeScale || 1),
    `color:${fill(e.fill, e.opacity)}`,
    `text-align:${(e.align || 'LEFT').toLowerCase()}`,
    `white-space:pre-wrap`,
  ].join(';');
  return `<div style="${s}">${esc(e.text)}</div>`;
}

function rule(e) {
  return `<div style="position:absolute;left:${px(e.x)}px;top:${px(e.y)}px;width:${px(e.w)}px;height:${Math.max(1, px(e.h || 0.5))}px;background:${fill(e.fill, e.opacity)}"></div>`;
}

function plate(e, images) {
  const pad = px(13.4);
  const hash = e.img && images[e.img];
  const bg = hash
    ? `background:url('${hash}') center/cover no-repeat`
    : `background:${fill(e.fill)}`;
  let inner = '';

  if (!hash && e.cap && e.cap.length) {
    const capFill = e.capFill || (e.fill === 'sand' || e.fill === 'cream' ? 'ink' : 'cream');
    const top = e.capTop || e.label || e.title;
    const place = top
      ? `top:${pad}px;text-align:left`
      : `top:50%;transform:translateY(-50%);text-align:center`;
    inner += `<div style="position:absolute;left:${pad}px;right:${pad}px;${place};${typeCss('caption')};color:${fill(capFill, 0.45)};white-space:pre-wrap">${esc(e.cap.join('\n'))}</div>`;
  }
  if (e.label || e.desc) {
    inner += `<div style="position:absolute;left:${pad}px;right:${pad}px;bottom:${pad}px;display:flex;flex-direction:column;gap:${px(4)}px">`;
    if (e.label) inner += `<div style="${typeCss('label')};color:${fill(e.label.fill)}">${esc(e.label.text)}</div>`;
    if (e.desc) inner += `<div style="${typeCss('mosaicDesc')};color:${fill(e.desc.fill)}">${esc(e.desc.text)}</div>`;
    inner += `</div>`;
  }
  if (e.title) {
    inner += `<div style="position:absolute;left:${pad}px;right:${pad}px;bottom:${pad}px;${typeCss('cardTitle')};color:${fill('cream')}">${esc(e.title)}</div>`;
  }

  return `<div style="position:absolute;left:${px(e.x)}px;top:${px(e.y)}px;width:${px(e.w)}px;height:${px(e.h)}px;overflow:hidden;${bg}">${inner}</div>`;
}

function table(e) {
  let out = `<div style="position:absolute;left:${px(e.x)}px;top:${px(e.y)}px;width:${px(e.w)}px">`;
  e.rows.forEach(([name, value], i) => {
    const top = px(e.pitch * i);
    out += `<div style="position:absolute;top:${top + px(e.pitch) - 1}px;left:0;width:100%;height:1px;background:${fill(e.fill, 0.18)}"></div>`;
    out += `<div style="position:absolute;top:${top + px(6)}px;left:0;${typeCss('bodySm')};color:${fill(e.fill)}">${esc(name)}</div>`;
    out += `<div style="position:absolute;top:${top}px;right:0;text-align:right;${typeCss('statUnit', 0.62)};color:${fill(e.fill)}">${esc(value)}</div>`;
  });
  return out + `</div>`;
}

function list(e) {
  let out = `<div style="position:absolute;left:${px(e.x)}px;top:${px(e.y)}px;width:${px(e.w)}px">`;
  e.items.forEach((item, i) => {
    const top = px(e.pitch * i);
    out += `<div style="position:absolute;top:${top}px;left:0;width:100%;height:1px;background:${fill(e.fill, 0.18)}"></div>`;
    out += `<div style="position:absolute;top:${top + px(9)}px;left:0;${typeCss(e.style)};color:${fill(e.fill)}">${esc(item)}</div>`;
  });
  out += `<div style="position:absolute;top:${px(e.pitch * e.items.length)}px;left:0;width:100%;height:1px;background:${fill(e.fill, 0.18)}"></div>`;
  return out + `</div>`;
}

function pillar(e) {
  return `<div style="position:absolute;left:${px(e.x)}px;top:${px(e.y)}px;width:${px(e.w)}px;display:flex;flex-direction:column;gap:${px(6)}px">
    <div style="display:flex;align-items:center;gap:${px(7)}px">
      <span style="${typeCss('statUnit', 0.42)};color:${fill('gold')}">${esc(e.n)}</span>
      <span style="${typeCss('label')};color:${fill('cream')}">${esc(e.label)}</span>
    </div>
    <div style="${typeCss('promise')};color:${fill('cream')}">${esc(e.promise)}</div>
    <div style="${typeCss('bodyXxs')};color:${fill('cream', 0.78)}">${esc(e.support)}</div>
  </div>`;
}

function logo(e) {
  return `<div style="position:absolute;left:${px(e.x)}px;top:${px(e.y)}px;width:${px(e.w)}px;height:${px(e.h)}px;display:flex;align-items:center;justify-content:center;${typeCss('label')};color:${fill('cream', 0.55)}">AART GROUP</div>`;
}

function spread(page, images) {
  const body = page.el.map((e) => {
    if (e.k === 'band' || e.k === 'plate') return plate(e, images);
    if (e.k === 'text') return text(e);
    if (e.k === 'rule') return rule(e);
    if (e.k === 'table') return table(e);
    if (e.k === 'list') return list(e);
    if (e.k === 'pillar') return pillar(e);
    if (e.k === 'logo') return logo(e);
    return '';
  }).join('\n');
  return `<div class="artboard" style="background:${fill(page.bg)}">${body}</div>`;
}

/* page --------------------------------------------------------------------- */
const IMAGES = {}; // proof sheet renders placeholders; Figma gets the real photos

const spreads = PAGES.map((p, i) => `
<figure class="spread">
  <figcaption>
    <span class="folio">${String(i + 1).padStart(2, '0')}</span>
    <span class="sname">${esc(p.name.replace(/^\d+\s/, ''))}</span>
    <span class="sground">${p.bg === 'ink' ? 'dark ground' : 'cream ground'}</span>
  </figcaption>
  <div class="stage">${spread(p, IMAGES)}</div>
</figure>`).join('\n');

const tokenRows = Object.entries(COLOR).map(([k, v]) => `
  <div class="swatch">
    <span class="chip" style="background:${v}"></span>
    <span class="cname">${k}</span>
    <span class="chex">${v}</span>
  </div>`).join('');

const typeRows = [
  ['Headline', 'headline', 'Marcellus', 41.5],
  ['Cover wordmark', 'wordmarkMain', 'Marcellus', 65],
  ['Closing line', 'closingLine', 'Marcellus', 23],
  ['Section kicker', 'kicker', 'Arimo Bold', 9.59],
  ['Lead body', 'bodyLg', 'Arimo', 13.9],
  ['Body', 'bodySm', 'Arimo', 12.47],
  ['Plate caption', 'caption', 'Courier New', 7.19],
].map(([label, key, face, refPt]) => `
  <tr>
    <td>${label}</td>
    <td class="mono">${face}</td>
    <td class="mono num">${refPt} pt</td>
    <td class="mono num">${TYPE[key].size.toFixed(0)} px</td>
    <td class="mono num">${TYPE[key].lh.toFixed(0)} px</td>
    <td class="mono num">${(TYPE[key].ls || 0).toFixed(1)}</td>
  </tr>`).join('');

process.stdout.write(`<title>AART Brochure Rebuild</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Marcellus&family=Arimo:wght@400;700&display=swap">
<style>
  :root{
    --ground:#F2F0E6; --raised:#FFFFFF; --edge:#D9D5C4;
    --fg:#141A15; --fg-dim:#5C6659; --accent:#005D30; --gold:#9A7526;
    --shadow:0 1px 2px rgba(8,42,19,.06), 0 12px 32px rgba(8,42,19,.10);
  }
  :root:not([data-theme="light"]){ @media (prefers-color-scheme: dark){
    --ground:#0C1410; --raised:#141E17; --edge:#26332A;
    --fg:#EDEFE6; --fg-dim:#9AA795; --accent:#5FBF8A; --gold:#E0B257;
    --shadow:0 1px 2px rgba(0,0,0,.5), 0 18px 44px rgba(0,0,0,.55);
  }}
  :root[data-theme="dark"]{
    --ground:#0C1410; --raised:#141E17; --edge:#26332A;
    --fg:#EDEFE6; --fg-dim:#9AA795; --accent:#5FBF8A; --gold:#E0B257;
    --shadow:0 1px 2px rgba(0,0,0,.5), 0 18px 44px rgba(0,0,0,.55);
  }

  body{ background:var(--ground); color:var(--fg);
    font-family:'Arimo',Arial,sans-serif; margin:0;
    padding:clamp(24px,5vw,72px) clamp(16px,4vw,56px); }
  .wrap{ max-width:1180px; margin:0 auto; display:flex; flex-direction:column; gap:clamp(40px,6vw,72px); }

  header h1{ font-family:'Marcellus',Georgia,serif; font-weight:400;
    font-size:clamp(34px,5.2vw,58px); line-height:1.06; margin:0 0 14px;
    text-wrap:balance; letter-spacing:-.01em; }
  header p{ margin:0; max-width:62ch; color:var(--fg-dim); font-size:16px; line-height:1.65; }
  .eyebrow{ font-size:12px; font-weight:700; letter-spacing:.18em; text-transform:uppercase;
    color:var(--accent); margin:0 0 18px; }

  .note{ border-left:2px solid var(--gold); padding:2px 0 2px 18px; margin-top:26px;
    color:var(--fg-dim); font-size:14.5px; line-height:1.65; max-width:64ch; }
  .note strong{ color:var(--fg); font-weight:700; }

  h2{ font-family:'Marcellus',Georgia,serif; font-weight:400; font-size:26px;
    margin:0 0 4px; letter-spacing:.005em; }
  .sub{ color:var(--fg-dim); font-size:14px; margin:0 0 22px; }

  .swatches{ display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; }
  .swatch{ display:flex; align-items:center; gap:10px; background:var(--raised);
    border:1px solid var(--edge); border-radius:2px; padding:10px 12px; }
  .chip{ width:26px; height:26px; border-radius:1px; flex:none;
    box-shadow:inset 0 0 0 1px rgba(0,0,0,.14); }
  .cname{ font-size:13.5px; font-weight:700; }
  .chex{ font-size:12px; color:var(--fg-dim); margin-left:auto;
    font-family:'Courier New',monospace; }

  .tablewrap{ overflow-x:auto; border:1px solid var(--edge); border-radius:2px; background:var(--raised); }
  table{ border-collapse:collapse; width:100%; min-width:560px; font-size:13.5px; }
  th,td{ text-align:left; padding:9px 14px; border-bottom:1px solid var(--edge); }
  th{ font-size:11px; letter-spacing:.13em; text-transform:uppercase; color:var(--fg-dim); font-weight:700; }
  tr:last-child td{ border-bottom:0; }
  .mono{ font-family:'Courier New',monospace; }
  .num{ text-align:right; font-variant-numeric:tabular-nums; }

  .spreads{ display:flex; flex-direction:column; gap:clamp(32px,4.5vw,56px); }
  .spread{ margin:0; }
  figcaption{ display:flex; align-items:baseline; gap:12px; margin-bottom:12px;
    padding-bottom:9px; border-bottom:1px solid var(--edge); }
  .folio{ font-family:'Courier New',monospace; font-size:13px; color:var(--gold); }
  .sname{ font-family:'Marcellus',Georgia,serif; font-size:19px; }
  .sground{ margin-left:auto; font-size:11px; letter-spacing:.13em;
    text-transform:uppercase; color:var(--fg-dim); }

  /* Artboard is authored at true 1240x1754 and scaled down, so every measured
     value stays literal and the proof cannot drift from the Figma output. */
  .stage{ width:100%; aspect-ratio:1240/1754; position:relative; overflow:hidden;
    box-shadow:var(--shadow); border-radius:1px; }
  .artboard{ position:absolute; top:0; left:0; width:1240px; height:1754px;
    transform-origin:top left; overflow:hidden; }

  @media (min-width:900px){
    .spreads{ display:grid; grid-template-columns:1fr 1fr; gap:44px 40px; }
  }
</style>

<div class="wrap">
  <header>
    <p class="eyebrow">Measured from AART_BROCHURE.pdf</p>
    <h1>Estate Brochure&nbsp;— rebuild proof</h1>
    <p>All ten spreads, drawn from the same spec file the Figma build scripts read.
       Geometry, type and colour come straight out of the reference PDF at
       1&nbsp;pt&nbsp;=&nbsp;2.0833&nbsp;px against a 1240&nbsp;×&nbsp;1754 artboard.
       Check anything that looks off here before it costs a Figma call.</p>
    <p class="note"><strong>Plates show placeholders.</strong> In Figma each one resolves
       to photography already in the file; slots with no photo keep the flat plate and its
       caption, exactly as drawn here.</p>
  </header>

  <section>
    <h2>Palette</h2>
    <p class="sub">Three of the six already exist as Figma variables and match the reference exactly.</p>
    <div class="swatches">${tokenRows}</div>
  </section>

  <section>
    <h2>Type ramp</h2>
    <p class="sub">Reference sizes in points, artboard sizes in pixels. Tracking reproduces the reference's letterspaced caps as real tracking rather than literal spaces.</p>
    <div class="tablewrap">
      <table>
        <thead><tr><th>Role</th><th>Face</th><th class="num">Reference</th><th class="num">Size</th><th class="num">Leading</th><th class="num">Track</th></tr></thead>
        <tbody>${typeRows}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>Spreads</h2>
    <p class="sub">Rendered at true proportion.</p>
    <div class="spreads">${spreads}</div>
  </section>
</div>

<script>
  // Scale each 1240px artboard to whatever width its column got.
  const fitAll = () => {
    for (const stage of document.querySelectorAll('.stage')) {
      const board = stage.firstElementChild;
      if (board) board.style.transform = 'scale(' + stage.clientWidth / 1240 + ')';
    }
  };
  fitAll();
  addEventListener('resize', fitAll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);
</script>
`);
