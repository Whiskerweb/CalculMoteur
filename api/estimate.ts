// api/estimate.ts
//
// Fonction Vercel — runtime Edge, choisi pour le streaming SSE natif.
//
// Le flux demarre en quelques millisecondes (premier evenement "prompt"), ce qui
// evite la limite de delai avant premiere reponse. La generation elle-meme prend
// 8 a 80 s selon le modele.
//
// La logique est celle de app/lib/estimate.ts, partagee avec le serveur local.

import { handleEstimate } from "../app/lib/estimate.ts";

export const config = { runtime: "edge" };

export default function handler(req: Request): Promise<Response> | Response {
  if (req.method !== "POST") {
    return new Response("Methode non autorisee", { status: 405 });
  }
  return handleEstimate(req);
}
