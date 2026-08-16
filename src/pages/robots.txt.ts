import type { APIRoute } from "astro";
import { noindexDisallowPaths } from "@/utils/seo.ts";

export const GET: APIRoute = ({ site }) => {
  const lines = ["User-agent: *", "Allow: /"];

  for (const path of noindexDisallowPaths()) {
    lines.push(`Disallow: ${path}`);
  }

  if (site) {
    lines.push("", `Sitemap: ${new URL("sitemap-index.xml", site).href}`);
  }

  return new Response(`${lines.join("\n")}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
