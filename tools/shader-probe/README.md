# shader probe

A browser harness for the TSL ports. `npm run check` typechecks a node graph;
only a real backend proves it *codegens* — and the ASCII fragment graph is
discard-heavy, so a wrong `Discard` compiles, renders, reports success and draws
nothing. Every probe here therefore asserts pixel coverage, not just absence of
an exception.

```sh
npm run probe          # http://localhost:4399
```

Open it in any browser, or drive it headless:

```sh
npm i --no-save playwright-core
node -e '
  const { chromium } = require("playwright-core");
  chromium.launch({
    executablePath: process.env.CHROME,
    args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
  }).then(async (b) => {
    const p = await b.newPage();
    p.on("console", (m) => console.log(m.text()));
    await p.goto("http://localhost:4399");
    await p.waitForFunction(() => /^(OK|FAIL)/.test(document.title), { timeout: 45000 });
    console.log(await p.title());
    await b.close();
  });
'
```

Probes run against `forceWebGL: true` on purpose. TSL compiles to both WGSL and
GLSL, but TSL *compute* has no WebGL2 path at all, so the fallback backend is
where an accidental `storage()` or `computeAsync()` shows up — and it is the
backend Safari below 26 and older Firefox actually get.
