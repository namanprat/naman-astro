import { createClient, type SanityClient } from "@sanity/client";
import {
  SANITY_API_VERSION,
  SANITY_DATASET,
  SANITY_PROJECT_ID,
} from "./config";

let client: SanityClient | null = null;

export function getSanityClient(): SanityClient {
  client ??= createClient({
    projectId: SANITY_PROJECT_ID,
    dataset: SANITY_DATASET,
    apiVersion: SANITY_API_VERSION,
    useCdn: true,
    token: process.env.SANITY_API_TOKEN,
    perspective: "published",
  });
  return client;
}
