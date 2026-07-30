// api/health.ts
//
// Diagnostic de deploiement : le skill est-il bien embarque, le schema
// parsable, la variable d'environnement presente. Ne renvoie qu'un booleen
// pour la cle, jamais un fragment.

import { getSystemPrompt } from "../app/lib/prompt.ts";
import { MODELS } from "../app/lib/models.ts";
import { loadSchema } from "../app/lib/validate.ts";
import { env } from "../app/lib/runtime.ts";

export const config = { runtime: "edge" };

export default function handler(): Response {
  let skill: unknown = null;
  let skillError: string | null = null;
  try {
    const s = getSystemPrompt("estimation");
    skill = { files: s.parts, approxTokens: s.approxTokens, cached: s.cached };
  } catch (e) {
    skillError = (e as Error).message;
  }
  let schemaOk = true;
  try {
    loadSchema();
  } catch {
    schemaOk = false;
  }
  return Response.json({
    skill,
    skillError,
    schemaOk,
    keyPresent: Boolean(env("OPENROUTER_API_KEY")),
    models: Object.keys(MODELS).length,
    runtime: "vercel-edge",
  });
}
