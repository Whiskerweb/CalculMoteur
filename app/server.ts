// app/server.ts
//
// Serveur LOCAL du createur d'estimation. Ecoute sur 127.0.0.1.
//
// La logique vit dans app/lib/estimate.ts, partagee avec les fonctions Vercel
// de api/. Ce fichier ne fait que du routage et sert public/index.html.
//
// USAGE :
//   deno run --allow-env --allow-net --allow-read --allow-write --env-file=.env app/server.ts
//   puis http://127.0.0.1:8788/

import { getSystemPrompt } from "./lib/prompt";
import { DEFAULT_MODEL, MODELS, publicModelList } from "./lib/models";
import { loadSchema } from "./lib/validate";
import { handleEstimate } from "./lib/estimate";
import { env } from "./lib/runtime";

const PORT = Number(env("PORT") ?? 8788);
const HOST = "127.0.0.1";
const HTML_PATH = new URL("../public/index.html", import.meta.url).pathname;

function handleHealth(): Response {
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
    runtime: "deno-local",
  });
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (req.method === "POST" && url.pathname === "/api/estimate") return handleEstimate(req);
  if (req.method === "GET" && url.pathname === "/api/models") {
    return Response.json({ models: publicModelList(), default: DEFAULT_MODEL });
  }
  if (req.method === "GET" && url.pathname === "/api/health") return handleHealth();
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    try {
      // Relu a chaque requete : editer l'UI + rafraichir, sans redemarrage.
      return new Response(Deno.readTextFileSync(HTML_PATH), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    } catch (e) {
      return new Response(`UI introuvable : ${(e as Error).message}`, { status: 500 });
    }
  }
  return new Response("Not found", { status: 404 });
}

if (!env("OPENROUTER_API_KEY")) {
  console.error("ERREUR : OPENROUTER_API_KEY absente.");
  console.error("  cp .env.example .env  puis renseigner la cle, et relancer avec --env-file=.env");
  Deno.exit(1);
}

try {
  const s = getSystemPrompt("estimation");
  console.log(`\nSkill charge : ${s.parts.length} fichiers, ~${s.approxTokens} tokens`);
  for (const p of s.parts) console.log(`  ${p.name.padEnd(34)} ${String(p.chars).padStart(6)} car.`);
} catch (e) {
  console.error(`ERREUR : impossible de charger le skill — ${(e as Error).message}`);
  Deno.exit(1);
}

console.log(`\nServeur local : http://${HOST}:${PORT}/`);
console.log("Ne jamais exposer ce serveur sur un reseau.\n");
Deno.serve({ port: PORT, hostname: HOST, onListen: () => {} }, handler);
