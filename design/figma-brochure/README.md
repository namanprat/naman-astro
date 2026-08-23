# AART Estate brochure — Figma rebuild

Rebuilds the 10-spread brochure in Figma to match `AART_BROCHURE.pdf` (the reference),
replacing the PowerPoint import that broke the layout.

Everything here is derived by measuring the reference PDF directly — no eyeballing.

## Why scripts and not direct edits

The Figma MCP connection for this file resolves to a **View seat**, which refuses writes
(`"To use MCP tools that make edits, you'll need a Full seat"`) and has a hard tool-call
quota that is currently exhausted. These scripts are the rebuild, ready to run the moment
that clears. To unblock: move the file to a team where the account holds a Full seat, or
upgrade the seat on the team that owns it.

## Files

| File | Role |
|---|---|
| `tokens.cjs` | Colour, type ramp and spacing, measured from the PDF and scaled to the artboard |
| `deck.cjs` | The 10 spreads as data — copy, geometry, image slots |
| `renderer.js` | The Plugin API code that turns a spread spec into Figma nodes |
| `generate.cjs` | Inlines tokens + deck + renderer into standalone `use_figma` payloads |
| `out/` | Generated. Do not hand-edit — change `deck.cjs`/`tokens.cjs` and regenerate |

```
node design/figma-brochure/generate.cjs
```

## Running it

Each script is pasted as the `code` argument to the Figma MCP `use_figma` tool.

1. **`out/00-discover.js`** — read-only. Returns the file's pages, every `imageHash`
   already in it (with the layers using it), which of the needed font families are
   installed, and the local variables.
2. **`out/01-setup.js`** — creates the page `Brochure — Reference Rebuild`. The rebuild
   lands there rather than on top of the broken PPT import, so the two can be compared
   before anything is deleted.
3. **`out/page-01.js` … `out/page-10.js`** — one spread each. Before running, paste the
   hashes from step 1 into that script's `IMAGES` map:

   ```js
   const IMAGES = { hero: '11eebade4f5a…', aerial: '20fa8d94c220…', /* … */ };
   ```

   Each script removes any previous copy of its own spread first, so re-running one is
   safe and a failure never leaves a half-built page.

## Scale

The reference is A4 at 595.3 × 841.9 pt. The Figma artboard is 1240 × 1754 px — A4 at
150 dpi — so **1 pt = 2.0833 px**, and every measurement in `deck.cjs` stays in
reference points. `renderer.js` does the conversion.

## Type

The reference PDF has all display lines converted to outlines, so the font name is not
recoverable from the file. The letterforms are **Marcellus** — inscriptional flared caps,
splayed `M`, spurred `G`, and the swash `Q` in "SQ YD" — which is already the display face
in the Figma file. Body text is `ArialMT`; `Arimo` is metric-compatible and is what the
file already uses. Plate captions are `Courier New`.

`renderer.js` falls back per family if one is missing on the machine running the plugin,
and reports what it substituted in `fontsMissing`.

| Role | Face | Reference | Artboard |
|---|---|---|---|
| Headline | Marcellus | 41.5 pt / 44.2 | 86 px / 92 |
| Cover wordmark `ESTATE` | Marcellus | 65 pt | 135 px |
| Closing line / card title | Marcellus | 23 pt | 48 px |
| Section kicker | Arimo Bold | 9.59 pt, +3.3 tracking | 20 px, +7 |
| Body (lead) | Arimo | 13.9 pt / 22.5 | 29 px / 47 |
| Body | Arimo | 12.5 pt / 19.6 | 26 px / 41 |
| Plate caption | Courier New | 7.19 pt | 15 px |

The reference fakes letterspaced caps by putting literal spaces between characters
(`T H E  P O S I T I O N I N G`). The rebuild uses real `letterSpacing`, so the copy stays
searchable and editable.

## Colour

| Token | Hex | Use |
|---|---|---|
| `ink` | `#082A13` | Dark page ground — already Figma variable `4:3` |
| `panel` | `#0B3319` | Image plate on dark pages |
| `cream` | `#FFFBE9` | Light page ground — already Figma variable `4:6` |
| `sand` | `#EFE9D2` | Image plate on light pages |
| `green` | `#005D30` | Accent tiles, kickers on light pages — already variable `4:4` |
| `gold` | `#E0B257` | Kickers on dark pages, stat numerals — **no variable yet** |

Three of the six already exist as variables in the file and match the reference exactly.
`gold`, `panel` and `sand` are still literals; worth promoting to variables.

## Imagery

The reference ships grey `PLACEHOLDER` plates. Per the brief, the rebuild uses the real
photography already in the Figma file instead. `deck.cjs` declares 23 image slots in
priority order; `00-discover.js` reports what is actually available. Any slot without a
photograph falls back to the reference's flat plate plus its caption, so a partial image
set still yields a complete deck rather than a hole.

## Open questions

- **`SHAKUMBHARI` vs `SHAKAMBHARI`.** The reference PDF uses `SHAKUMBHARI` throughout;
  the cover options already in the Figma file use `SHAKAMBHARI`. The scripts follow the
  reference. One spelling needs to win.
- **Running foot.** The reference prints `AART ESTATE` next to the folio on spreads 02,
  05 and 07 only. That looks like an export artefact rather than intent, but the scripts
  reproduce it exactly. Say the word and it goes on every spread.

## Verifying

`generate.cjs` output is exercised against a mock Plugin API before shipping — it catches
unloaded-font writes, zero-width text nodes, `fills` mutation and append ordering. It does
not catch visual problems; check `get_screenshot` after the first spread lands.
