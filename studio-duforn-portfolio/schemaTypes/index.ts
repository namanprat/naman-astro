import { archiveItem } from "./archiveItem";
import {
  aboutSettings,
  footerSettings,
  marqueeSettings,
  siteSettings,
} from "./singletons";
import { workPanelImage, workPanelText, workProject } from "./workProject";

export const schemaTypes = [
  workProject,
  workPanelText,
  workPanelImage,
  archiveItem,
  siteSettings,
  footerSettings,
  aboutSettings,
  marqueeSettings,
];
