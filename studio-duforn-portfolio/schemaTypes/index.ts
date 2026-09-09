import { archiveItem } from "./archiveItem";
import { about, footer, marquee, site, social } from "./singletons";
import { workPanelImage, workPanelText, workProject } from "./workProject";

export const schemaTypes = [
  workProject,
  workPanelText,
  workPanelImage,
  archiveItem,
  site,
  marquee,
  social,
  footer,
  about,
];
