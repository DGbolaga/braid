import createClient from "openapi-fetch";
import type { components, paths } from "./types";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/v1";

export const api = createClient<paths>({
  baseUrl,
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  // Resolved per call rather than captured at construction, so a fetch
  // installed later — MSW does exactly this — is still used.
  fetch: (request) => globalThis.fetch(request),
});

export type Schemas = components["schemas"];
export type Problem = Schemas["Problem"];
