import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: {
    projectId: "dj9l9mvw",
    dataset: "production",
  },
  /** duforn.sanity.studio — without this `sanity deploy` asks for it every time. */
  studioHost: "duforn",
  deployment: {
    autoUpdates: false,
    appId: "jb1wu8t1ox6fcxv68lmnij1n",
  },
});
