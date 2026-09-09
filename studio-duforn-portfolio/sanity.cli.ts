import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: {
    projectId: "dj9l9mvw",
    dataset: "production",
  },
  deployment: {
    autoUpdates: false,
  },
});
