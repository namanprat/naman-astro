import { archiveItem } from "./archiveItem";
import {
  aboutSettings,
  faqSettings,
  navSettings,
  processSettings,
  siteSettings,
} from "./singletons";
import { workPanelImage, workPanelText, workPanelVideo, workProject } from "./workProject";

export const schemaTypes = [
  workProject,
  workPanelText,
  workPanelImage,
  workPanelVideo,
  archiveItem,
  siteSettings,
  aboutSettings,
  faqSettings,
  processSettings,
  navSettings,
];
