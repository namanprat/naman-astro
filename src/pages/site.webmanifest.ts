import type { APIRoute } from "astro";
import { SITE_DESCRIPTION, SITE_NAME } from "@/consts.ts";
import { THEME_COLOR_DARK } from "@/lib/site/themeColor.ts";

/**
 * Install / splash icons are the cream mark only: `background_color` is the
 * dark bar, and the manifest has no colour-scheme picker. Dark-mark files
 * would vanish on that splash.
 */
export const GET: APIRoute = () => {
  const body = {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    id: "/",
    display: "standalone",
    background_color: THEME_COLOR_DARK,
    theme_color: THEME_COLOR_DARK,
    icons: [
      {
        src: "/favicon/favicon-light.png",
        sizes: "1000x1000",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon/favicon-light.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };

  return new Response(`${JSON.stringify(body)}\n`, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
    },
  });
};
