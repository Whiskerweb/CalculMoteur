// api/models.ts
//
// Presets et tarifs. Ne renvoie jamais la cle API.

import { DEPLOYED_DEFAULT_MODEL, publicModelList } from "../app/lib/models";

export const config = { runtime: "edge" };

export default function handler(): Response {
  return Response.json(
    { models: publicModelList(), default: DEPLOYED_DEFAULT_MODEL, deployed: true },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
