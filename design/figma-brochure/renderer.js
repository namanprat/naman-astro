/*
 * Runs INSIDE Figma via the `use_figma` MCP tool (Figma Plugin API).
 * generate.js inlines TOKENS + one page of the DECK spec above this body.
 *
 * Contract with the harness (see figma-use skill):
 *   - top-level await is allowed; do not wrap in an async IIFE
 *   - return is the only output channel
 *   - never call figma.notify() / figma.closePlugin()
 *   - colours are 0..1; fills are read-only arrays (clone, don't mutate)
 *   - load every font before touching any text node
 */

const S = 1240 / 595.3;
const px = (v) => v * S;

// Cap height as a fraction of em, per family. Display copy in the reference is
// outlined vector, so its measured y is the CAP TOP; Figma positions by box top.
const CAP_RATIO = { Marcellus: 0.70, Arimo: 0.716, 'Courier New': 0.571 };

/** How far the box top sits above the cap top for a given style. */
function capOffset(st, scale) {
  if (st.anchor !== 'cap') return 0;
  const ratio = CAP_RATIO[st.font[0]] || 0.7;
  return (st.lh * scale - ratio * st.size * scale) / 2;
}

function solid(hexStr, opacity) {
  const n = parseInt(hexStr.slice(1), 16);
  const p = { type: 'SOLID', color: { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 } };
  if (opacity != null && opacity !== 1) p.opacity = opacity;
  return p;
}

function imageFill(hash) {
  return { type: 'IMAGE', scaleMode: 'FILL', imageHash: hash, scalingFactor: 1, rotation: 0 };
}

/* Font loading ------------------------------------------------------------- */
async function loadFonts(styles) {
  const want = new Map();
  for (const k of Object.keys(styles)) {
    const [family, style] = styles[k].font;
    want.set(family + '|' + style, { family, style });
  }
  const available = await figma.listAvailableFontsAsync();
  const have = new Set(available.map((f) => f.fontName.family + '|' + f.fontName.style));

  // Fall back gracefully when a family is missing on this machine.
  const SUBS = {
    'Marcellus|Regular':   ['Cormorant Garamond|Regular', 'EB Garamond|Regular', 'Georgia|Regular', 'Times New Roman|Regular'],
    'Arimo|Regular':       ['Arial|Regular', 'Helvetica Neue|Regular', 'Inter|Regular'],
    'Arimo|Bold':          ['Arial|Bold', 'Helvetica Neue|Bold', 'Inter|Bold'],
    'Courier New|Regular': ['Roboto Mono|Regular', 'IBM Plex Mono|Regular', 'Space Mono|Regular'],
  };

  const resolved = {};
  const missing = [];
  for (const [key, fontName] of want) {
    let pick = have.has(key) ? key : null;
    if (!pick) for (const alt of SUBS[key] || []) if (have.has(alt)) { pick = alt; break; }
    if (!pick) { missing.push(key); continue; }
    const [family, style] = pick.split('|');
    resolved[key] = { family, style };
  }
  for (const f of Object.values(resolved)) await figma.loadFontAsync(f);
  return { resolved, missing };
}

/* Text ---------------------------------------------------------------------- */
function makeText(spec, styles, palette, fonts) {
  const st = styles[spec.style];
  const key = st.font[0] + '|' + st.font[1];
  const t = figma.createText();
  t.fontName = fonts.resolved[key];

  const scale = spec.sizeScale || 1;
  t.fontSize = Math.max(1, Math.round(st.size * scale));
  t.lineHeight = { unit: 'PIXELS', value: Math.round(st.lh * scale) };
  t.letterSpacing = { unit: 'PIXELS', value: (st.ls || 0) * scale };
  t.textAlignHorizontal = spec.align || 'LEFT';

  // Wrapping text needs an explicit width AND HEIGHT auto-resize, otherwise the
  // default WIDTH_AND_HEIGHT mode ignores the width and collapses the node.
  t.textAutoResize = 'HEIGHT';
  t.resize(Math.max(1, px(spec.w)), t.height);
  t.characters = spec.text;

  t.fills = [solid(palette[spec.fill] || spec.fill, spec.opacity)];
  t.x = px(spec.x);
  t.y = px(spec.y) - capOffset(st, scale);
  t.name = spec.style;
  return t;
}

/* Plates -------------------------------------------------------------------- */
function makePlate(spec, styles, palette, fonts, images) {
  const f = figma.createFrame();
  f.name = spec.img ? 'Image · ' + spec.img : 'Panel';
  f.resize(px(spec.w), px(spec.h));
  f.x = px(spec.x);
  f.y = px(spec.y);
  f.clipsContent = true;

  const hash = spec.img && images[spec.img];
  f.fills = hash ? [imageFill(hash)] : [solid(palette[spec.fill])];

  const pad = px(13.4);

  // Placeholder caption — only when no photograph landed in this slot.
  // Tiles that also carry a label or title park the caption at the top so the two
  // never collide; standalone plates centre it, as the reference does.
  if (!hash && spec.cap && spec.cap.length) {
    const top = spec.capTop || spec.label || spec.title;
    const cap = makeText(
      { x: 0, y: 0, w: spec.w - 26.8, style: 'caption', text: spec.cap.join('\n'),
        fill: spec.capFill || (spec.fill === 'sand' || spec.fill === 'cream' ? 'ink' : 'cream'),
        opacity: 0.45, align: top ? 'LEFT' : 'CENTER' },
      styles, palette, fonts
    );
    cap.x = pad;
    cap.y = top ? pad : px(spec.h) / 2 - cap.height / 2;
    f.appendChild(cap);
  }

  // Mosaic caption block pinned to the bottom-left of the tile.
  if (spec.label || spec.desc) {
    const stack = figma.createAutoLayout('VERTICAL', { name: 'Caption', itemSpacing: px(4) });
    stack.fills = [];
    f.appendChild(stack);
    if (spec.label) stack.appendChild(makeText({ x: 0, y: 0, w: spec.w - 26.8, style: 'label', text: spec.label.text, fill: spec.label.fill }, styles, palette, fonts));
    if (spec.desc)  stack.appendChild(makeText({ x: 0, y: 0, w: spec.w - 26.8, style: 'mosaicDesc', text: spec.desc.text, fill: spec.desc.fill }, styles, palette, fonts));
    stack.x = pad;
    stack.y = px(spec.h) - stack.height - pad;
  }

  // Card title pinned bottom-left (design-language tiles).
  if (spec.title) {
    const ttl = makeText({ x: 0, y: 0, w: spec.w - 26.8, style: 'cardTitle', text: spec.title, fill: 'cream' }, styles, palette, fonts);
    f.appendChild(ttl);
    ttl.x = pad;
    ttl.y = px(spec.h) - ttl.height - pad;
  }

  return f;
}

/* Composite blocks ---------------------------------------------------------- */
function makeTable(spec, styles, palette, fonts) {
  const g = figma.createFrame();
  g.name = 'Distance table';
  g.fills = [];
  g.x = px(spec.x);
  g.y = px(spec.y);
  g.resize(px(spec.w), px(spec.pitch * spec.rows.length));
  g.clipsContent = false;

  spec.rows.forEach(([name, value], i) => {
    const top = px(spec.pitch * i);
    const rule = figma.createRectangle();
    rule.resize(px(spec.w), 1);
    rule.y = top + px(spec.pitch) - 1;
    rule.fills = [solid(palette[spec.fill], 0.18)];
    rule.name = 'Rule';
    g.appendChild(rule);

    const n = makeText({ x: 0, y: 0, w: spec.w - 70, style: 'bodySm', text: name, fill: spec.fill }, styles, palette, fonts);
    n.x = 0; n.y = top + px(6);
    g.appendChild(n);

    const v = makeText({ x: 0, y: 0, w: 70, style: 'statUnit', text: value, fill: spec.fill, align: 'RIGHT', sizeScale: 0.62 }, styles, palette, fonts);
    v.x = px(spec.w) - v.width; v.y = top;
    g.appendChild(v);
  });
  return g;
}

function makeList(spec, styles, palette, fonts) {
  const g = figma.createFrame();
  g.name = 'Feature list';
  g.fills = [];
  g.x = px(spec.x);
  g.y = px(spec.y);
  g.resize(px(spec.w), px(spec.pitch * spec.items.length + 8));
  g.clipsContent = false;

  spec.items.forEach((item, i) => {
    const top = px(spec.pitch * i);
    const top_rule = figma.createRectangle();
    top_rule.resize(px(spec.w), 1);
    top_rule.y = top;
    top_rule.fills = [solid(palette[spec.fill], 0.18)];
    top_rule.name = 'Rule';
    g.appendChild(top_rule);

    const t = makeText({ x: 0, y: 0, w: spec.w, style: spec.style, text: item, fill: spec.fill }, styles, palette, fonts);
    t.x = 0; t.y = top + px(9);
    g.appendChild(t);
  });

  const last = figma.createRectangle();
  last.resize(px(spec.w), 1);
  last.y = px(spec.pitch * spec.items.length);
  last.fills = [solid(palette[spec.fill], 0.18)];
  last.name = 'Rule';
  g.appendChild(last);
  return g;
}

function makePillar(spec, styles, palette, fonts) {
  const g = figma.createAutoLayout('VERTICAL', { name: 'Pillar ' + spec.n, itemSpacing: px(6) });
  g.fills = [];

  const head = figma.createAutoLayout('HORIZONTAL', { name: 'Head', itemSpacing: px(7) });
  head.fills = [];
  head.counterAxisAlignItems = 'CENTER';
  head.appendChild(makeText({ x: 0, y: 0, w: 16, style: 'statUnit', text: spec.n, fill: 'gold', sizeScale: 0.42 }, styles, palette, fonts));
  head.appendChild(makeText({ x: 0, y: 0, w: spec.w - 24, style: 'label', text: spec.label, fill: 'cream' }, styles, palette, fonts));
  g.appendChild(head);

  g.appendChild(makeText({ x: 0, y: 0, w: spec.w, style: 'promise', text: spec.promise, fill: 'cream' }, styles, palette, fonts));
  const sup = makeText({ x: 0, y: 0, w: spec.w, style: 'bodyXxs', text: spec.support, fill: 'cream', opacity: 0.78 }, styles, palette, fonts);
  g.appendChild(sup);

  g.x = px(spec.x);
  g.y = px(spec.y);
  return g;
}

function makeRule(spec, palette) {
  const r = figma.createRectangle();
  r.name = 'Rule';
  r.resize(px(spec.w), Math.max(1, px(spec.h || 0.5)));
  r.x = px(spec.x);
  r.y = px(spec.y);
  r.fills = [solid(palette[spec.fill], spec.opacity)];
  return r;
}

function makeLogo(spec, palette, images) {
  const f = figma.createFrame();
  f.name = 'AART Group lockup';
  f.resize(px(spec.w), px(spec.h));
  f.x = px(spec.x);
  f.y = px(spec.y);
  f.fills = images.aartLogo ? [{ type: 'IMAGE', scaleMode: 'FIT', imageHash: images.aartLogo, scalingFactor: 1, rotation: 0 }] : [];
  f.clipsContent = true;
  return f;
}

/* Page ---------------------------------------------------------------------- */
async function buildPage(page, styles, palette, images, origin) {
  const fonts = await loadFonts(styles);

  const frame = figma.createFrame();
  frame.name = page.name;
  frame.resize(1240, 1754);
  frame.x = origin.x;
  frame.y = origin.y;
  frame.clipsContent = true;
  frame.fills = [solid(palette[page.bg])];
  figma.currentPage.appendChild(frame);

  const ids = [];
  for (const e of page.el) {
    let node = null;
    if (e.k === 'band' || e.k === 'plate') node = makePlate(e, styles, palette, fonts, images);
    else if (e.k === 'text')   node = makeText(e, styles, palette, fonts);
    else if (e.k === 'rule')   node = makeRule(e, palette);
    else if (e.k === 'table')  node = makeTable(e, styles, palette, fonts);
    else if (e.k === 'list')   node = makeList(e, styles, palette, fonts);
    else if (e.k === 'pillar') node = makePillar(e, styles, palette, fonts);
    else if (e.k === 'logo')   node = makeLogo(e, palette, images);
    if (!node) continue;
    frame.appendChild(node);
    ids.push(node.id);
  }

  return { pageFrameId: frame.id, createdNodeIds: ids, fontsMissing: fonts.missing, name: page.name };
}
