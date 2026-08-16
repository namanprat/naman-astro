# Contributing to Lumos For Astro

Thanks for wanting to help. This project is small and opinionated by design, so
a quick issue before a large pull request usually saves everyone time.

## Contributor License Agreement

Before your first pull request can be merged, you need to sign the
[Contributor License Agreement](CLA.md). This is a one-time step — once signed,
it covers all of your future contributions.

Signing happens on the pull request itself. A bot will comment when you open
one; read [CLA.md](CLA.md) and then reply with exactly:

> I have read the CLA Document and I hereby sign the CLA

The bot records your signature and marks the check as passed. If the check is
still failing afterwards, comment `recheck` to run it again.

**Why:** Lumos For Astro is MIT licensed, and there is a paid commercial tier.
Under MIT alone, contributors retain copyright over their own contributions,
which would prevent that code from being used in the commercial tier. The CLA
grants a sublicensable license so the project can be maintained as a single
coherent codebase.

**What it does not do:** it does not transfer your copyright. You keep full
ownership of your work and can use it however you like elsewhere.

## Scope

The free tier is deliberately a small set of unopinionated primitives. Pull
requests that add primitives, fix bugs, improve accessibility, or improve
documentation are very welcome. Pull requests that add opinionated features or
new dependencies are likely to be declined — please open an issue first so we
can talk about whether it belongs here.

## Development

```
npm install
npm run dev
```

Before opening a pull request:

```
npm run format
npm run check
npm run build
```

## Commit messages

Write a short imperative summary line, then a body explaining _why_ the change
is needed if it isn't obvious from the diff.
