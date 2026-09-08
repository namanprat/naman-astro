import { chromium } from "@playwright/test";
const SEL = process.env.GEOM_SEL.split("|");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const out = {};
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await b.newContext({ colorScheme: "dark", viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.addInitScript(() => { try { sessionStorage.setItem("preload:seen","1"); } catch {} });
  await p.goto(process.env.GEOM_URL || "http://127.0.0.1:4321/", { waitUntil: "load" });
  await p.waitForTimeout(1400);
  for (const s of SEL) {
    const loc = p.locator(s).first();
    if (!(await loc.count())) { out[`${w}|${s}`] = "MISSING"; continue; }
    const box = await loc.boundingBox();
    const txt = (await loc.innerText()).replace(/\s+/g, " ").trim();
    out[`${w}|${s}`] = box ? `${Math.round(box.width)}x${Math.round(box.height)} @${Math.round(box.x)},${Math.round(box.y)}` : "no box";
  }
  if (errs.length) out[`${w}|__errors`] = errs.join("; ");
  await ctx.close();
}
await b.close();
for (const k of Object.keys(out).sort()) console.log(k, "=>", out[k]);
