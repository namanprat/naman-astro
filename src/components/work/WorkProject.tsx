/**
 * Scroll shell for `/work/[slug]`.
 *
 * Markup-only, so the case study itself is server-rendered as a sibling in
 * `WorkProject.astro` — same split `PortfolioHome.astro` uses. It cannot be a
 * child of this island: `client:only` puts slot content in an inert
 * `<template data-astro-template>`, so nothing paints until React boots.
 * `SiteScroll` mounts `<ReactLenis root>`, which attaches to the document, so
 * the copy does not need to sit inside the tree.
 */
import { SiteScroll } from "@/lib/site/lenisBoot";
import "./Work.css";

export default function WorkProjectScroll() {
  return <SiteScroll>{null}</SiteScroll>;
}
