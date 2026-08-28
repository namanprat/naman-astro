import { cpus } from "node:os";
import { defineConfig, type Project } from "@playwright/test";

/**
 * One project per device class the CSS and the scripts actually branch on:
 *
 * - `(width >= 48rem)` / 768px — the desktop nav and the BACK affordance on
 *   `/work` (`tablet` sits above this cut, `phone` below it).
 * - `(width >= 64rem)` / 1024px — the 12-column grid, and the only width where
 *   the hero gooey melt runs (`heroIntro.ts`).
 * - `(width < 48rem)` / 768px — the work grid's phone layout and its
 *   centre-tracked label (`Slider.ts`).
 * - `prefers-reduced-motion` — every entrance module branches on it, so the
 *   reduced path needs its own pass or it is only ever exercised by accident.
 */
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  laptop: { width: 1280, height: 800 },
  tablet: { width: 820, height: 1024 },
  phone: { width: 390, height: 844 },
};

const projects: Project[] = [
  { name: "desktop", use: { viewport: VIEWPORTS.desktop } },
  { name: "laptop", use: { viewport: VIEWPORTS.laptop } },
  {
    name: "tablet",
    use: { viewport: VIEWPORTS.tablet, hasTouch: true, isMobile: true },
  },
  {
    name: "phone",
    use: { viewport: VIEWPORTS.phone, hasTouch: true, isMobile: true },
  },
  {
    name: "reduced-motion",
    use: { viewport: VIEWPORTS.desktop, reducedMotion: "reduce" },
  },
];

/**
 * Set when the machine's Chromium is not where Playwright expects it — the
 * cloud dev container ships one at `/opt/pw-browsers/chromium` and blocks
 * `playwright install`. Unset locally, where the normal install applies.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  /**
   * Half the cores, not all of them.
   *
 * `stubWebGL` only takes the fluid canvas and the hero glass island out of
 * the frame budget — the team carousel and the About dither are three.js too,
 * and nulling their context takes the islands down with them. On a machine with no GPU those run
   * through software rendering, so one worker per core leaves every browser
   * fighting for the same CPU and rAF starves: entrance animations that finish
   * in under a second normally stall long enough to time out. The suite was
   * only ever flaky at full occupancy and is stable at half.
   */
  workers: Math.max(1, Math.floor(cpus().length / 2)),
  reporter: process.env.CI ? "line" : "list",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://127.0.0.1:4321",
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: projects.map((project) => ({
    ...project,
    use: { ...project.use, browserName: "chromium" },
  })),
  webServer: {
    command: "npm run build && node tests/serve.mjs",
    url: "http://127.0.0.1:4321",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
  },
});
