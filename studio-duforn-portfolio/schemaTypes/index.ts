import { archiveItem } from "./archiveItem";
import {
  aboutSettings,
  faqSettings,
  navSettings,
  processSettings,
  siteSettings,
} from "./singletons";
import { workPanelImage, workPanelText, workProject } from "./workProject";

export const schemaTypes = [
  workProject,
  workPanelText,
  workPanelImage,
  archiveItem,
  siteSettings,
  aboutSettings,
  faqSettings,
  processSettings,
  navSettings,
];
