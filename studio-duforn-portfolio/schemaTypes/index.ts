import { archiveItem } from "./archiveItem";
import { footer, marquee, site, siteSettings, social } from "./singletons";
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
  siteSettings,
];
