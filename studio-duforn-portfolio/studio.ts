import { renderStudio } from "sanity";
import studioConfig from "./sanity.config";

const root = document.getElementById("sanity");
if (!root) {
  throw new Error("Sanity Studio mount node #sanity is missing");
}

renderStudio(root, studioConfig, { reactStrictMode: false, basePath: "/" });
