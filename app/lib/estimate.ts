// app/lib/estimate.ts
//
// Coeur du createur d'estimation : un POST en entree, un flux SSE en sortie.
//
// Ecrit uniquement avec des API Web standard (Request, Response, ReadableStream)
// pour tourner tel quel sur les deux cibles :
//   - local  : app/server.ts (Deno.serve)
//   - Vercel : api/estimate.ts (runtime Edge)

import { buildUserMessage, type FormInput, getSystemPrompt } from "./prompt";
import { DEFAULT_MODEL, getPreset, VISION_FALLBACK } from "./models";
import { callOpenRouter, type ContentPart, type Message } from "./openrouter";
import { extractJson } from "./extract";
import { coerce, loadSchema, validate } from "./validate";
import { applyRecompute, recompute } from "./totaux";
import { applyCorrections } from "./controle";
import { writeDebugDump } from "./runtime";

const MAX_PHOTOS = 6;
const MAX_CONTINUATIONS = 6;

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ------------------------------------------------------------------ vision

const VISION_PROMPT = `Photo de chantier. Reponds UNIQUEMENT en JSON strict :
{
  "elements_visibles": [string],
  "etat_estime": "bon" | "moyen" | "mauvais" | "a_remplacer",
  "materiaux_visibles": [string],
  "dimensions_estimees": { "largeur_m": number, "hauteur_m": number, "surface_m2": number },
  "alertes": [string],
  "quantitatifs_inferes": [{ "item": string, "quantity": number, "unit": string }]
}`;

async function analyzePhoto(dataUrl: string): Promise<{ text: string; costUsd: number; usage: { in: number; out: number } }> {
  const r = await callOpenRouter({
    model: VISION_FALLBACK,
    maxTokens: 700,
    json: true,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: dataUrl } },
        { type: "text", text: VISION_PROMPT },
      ] as ContentPart[],
    }],
  });
  return { text: r.text, costUsd: r.costUsd, usage: r.usage };
}

// ------------------------------------------------------------- continuation

/**
 * Sortie tronquee : on redemande la suite en lui donnant le debut deja produit.
 * Renvoie le texte concatene et le nombre de continuations effectuees.
 */
async function completeIfTruncated(
  model: string,
  system: string,
  baseMessages: Message[],
  first: { text: string; finishReason: string; usage: { in: number; out: number }; costUsd: number; durationMs: number },
  json: boolean,
  onPhase: (n: number) => void,
) {
  let text = first.text;
  let usage = { ...first.usage };
  let costUsd = first.costUsd;
  let durationMs = first.durationMs;
  let finishReason = first.finishReason;
  let n = 0;
  let aborted: string | null = null;

  // Garde-fou : un appel qui epuise son budget de tokens en renvoyant un
  // content vide n'a rien ecrit qu'on puisse continuer. Relancer rebrule le
  // meme budget pour le meme resultat — mesure a 48 000 tokens perdus sur un
  // seul run avant l'ajout de ce test.
  if (finishReason === "length" && !text.trim()) {
    return {
      text,
      usage,
      costUsd,
      durationMs,
      finishReason,
      continuations: 0,
      aborted:
        "budget de tokens epuise sans aucun contenu produit — continuation inutile, abandon",
    };
  }

  while (finishReason === "length" && n < MAX_CONTINUATIONS) {
    n++;
    onPhase(n);
    const r = await callOpenRouter({
      model,
      system,
      json,
      messages: [
        ...baseMessages,
        { role: "assistant", content: text },
        {
          role: "user",
          content:
            "Continue exactement ou tu t'es arrete. Ne repete rien, ne reouvre pas de bloc de code, ne recommence pas le JSON depuis le debut.",
        },
      ],
    });
    usage = { in: usage.in + r.usage.in, out: usage.out + r.usage.out };
    costUsd += r.costUsd;
    durationMs += r.durationMs;
    finishReason = r.finishReason;

    // Meme garde-fou dans la boucle : une continuation vide signifie que le
    // modele ne produit plus rien d'utile. On s'arrete avec ce qu'on a.
    if (!r.text.trim()) {
      aborted = `continuation ${n} vide — arret avec le contenu deja obtenu`;
      break;
    }
    text += r.text;
  }

  return { text, usage, costUsd, durationMs, finishReason, continuations: n, aborted };
}

// -------------------------------------------------------------- /api/estimate

export async function handleEstimate(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  if (!body) return new Response("JSON invalide", { status: 400 });

  const brief = String(body.brief ?? "").trim();
  if (!brief) return new Response("Le brief client est obligatoire", { status: 400 });

  const modelId = String(body.model ?? DEFAULT_MODEL);
  const preset = getPreset(modelId);
  if (!preset) return new Response(`Modele inconnu : ${modelId}`, { status: 400 });

  const withControle = Boolean(body.controleP6);
  const photos: string[] = Array.isArray(body.photos)
    ? body.photos.filter((p: unknown) => typeof p === "string" && p.startsWith("data:image/")).slice(0, MAX_PHOTOS)
    : [];

  const form: FormInput = {
    brief,
    typeBien: body.typeBien || undefined,
    surface: typeof body.surface === "number" && body.surface > 0 ? body.surface : null,
    annee: body.annee || undefined,
    codePostal: body.codePostal || undefined,
    occupe: typeof body.occupe === "boolean" ? body.occupe : null,
    etage: body.etage || undefined,
    ascenseur: typeof body.ascenseur === "boolean" ? body.ascenseur : null,
    copropriete: typeof body.copropriete === "boolean" ? body.copropriete : null,
  };

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(sseEvent(event, data)));
        } catch { /* client parti */ }
      };

      // Les appels durent 60-120 s : sans battement, un intermediaire peut
      // couper un corps de reponse inactif.
      let beat: number | undefined;
      const startBeat = (label: string) => {
        const t0 = Date.now();
        beat = setInterval(() => send("heartbeat", { label, elapsedMs: Date.now() - t0 }), 5000);
      };
      const stopBeat = () => {
        if (beat !== undefined) clearInterval(beat);
        beat = undefined;
      };

      const calls: Array<{ label: string; model: string; usage: { in: number; out: number }; costUsd: number; durationMs: number }> = [];

      try {
        const sys = getSystemPrompt("estimation");
        send("prompt", {
          files: sys.parts,
          approxTokens: sys.approxTokens,
          cached: sys.cached,
          model: preset.id,
          modelLabel: preset.label,
          jsonMode: preset.jsonMode,
          vision: preset.vision,
          photoCount: photos.length,
          controleP6: withControle,
        });

        // ---- pre-passe vision si le modele principal est texte seul
        let photoAnalysis: string | undefined;
        if (photos.length && !preset.vision) {
          const chunks: string[] = [];
          for (let i = 0; i < photos.length; i++) {
            send("phase", { step: "vision", label: `Analyse de la photo ${i + 1}/${photos.length}` });
            try {
              const a = await analyzePhoto(photos[i]);
              chunks.push(`Photo ${i + 1} : ${a.text}`);
              calls.push({ label: `vision ${i + 1}`, model: VISION_FALLBACK, usage: a.usage, costUsd: a.costUsd, durationMs: 0 });
            } catch (e) {
              chunks.push(`Photo ${i + 1} : analyse impossible (${(e as Error).message})`);
            }
          }
          photoAnalysis = chunks.join("\n");
        }

        // ---- message utilisateur
        const userText = buildUserMessage(form, photoAnalysis);
        const userContent: string | ContentPart[] = photos.length && preset.vision
          ? [
            { type: "text", text: userText },
            ...photos.map((p) => ({ type: "image_url" as const, image_url: { url: p } })),
          ]
          : userText;
        const baseMessages: Message[] = [{ role: "user", content: userContent }];

        // ---- appel de chiffrage
        send("phase", { step: "llm", label: "Chiffrage en cours" });
        startBeat("chiffrage");
        const first = await callOpenRouter({
          model: preset.id,
          system: sys.text,
          messages: baseMessages,
          json: true,
        });
        const done = await completeIfTruncated(
          preset.id,
          sys.text,
          baseMessages,
          first,
          true,
          (n) => send("phase", { step: "continuation", label: `Sortie tronquee, continuation ${n}`, n }),
        );
        stopBeat();

        calls.push({ label: "chiffrage", model: preset.id, usage: done.usage, costUsd: done.costUsd, durationMs: done.durationMs });
        send("llm", {
          finishReason: done.finishReason,
          continuations: done.continuations,
          aborted: done.aborted,
          usage: done.usage,
          costUsd: done.costUsd,
          durationMs: done.durationMs,
          rawChars: done.text.length,
          rawPreview: done.text.slice(0, 2000),
        });

        if (!done.text.trim()) {
          send("cost", {
            calls,
            totalCostUsd: calls.reduce((s, c) => s + c.costUsd, 0),
            totalDurationMs: calls.reduce((s, c) => s + c.durationMs, 0),
          });
          send("error", {
            fatal: true,
            stage: "llm",
            message: done.aborted
              ? `Aucun contenu produit : ${done.aborted}. ${done.usage.out} tokens de sortie facturés. Réessayer avec un autre modèle.`
              : "Le modele a renvoye une reponse vide (refus ou filtre).",
          });
          send("done", { ok: false });
          return;
        }

        // ---- extraction
        const ex = extractJson(done.text, done.finishReason === "length");
        send("parse", { ok: ex.ok, method: ex.method, repairs: ex.repairs, error: ex.error });
        if (!ex.ok) {
          // La sortie brute est ecrite sur disque : 15k caracteres dans une
          // frame SSE sont inexploitables, et sans elle on ne peut pas
          // diagnostiquer pourquoi le modele a produit du JSON invalide.
          const dump = writeDebugDump("last-failed-raw.txt", done.text);
          send("error", {
            fatal: true,
            stage: "parse",
            message: ex.error ?? "JSON illisible",
            dump,
            raw: done.text.slice(0, 4000),
          });
          send("done", { ok: false });
          return;
        }

        // ---- coercition + validation + totaux
        const schema = loadSchema();
        const c1 = coerce(ex.value);
        send("coerce", { fixes: c1.fixes });

        const v1 = validate(c1.value, schema);
        send("validate", {
          version: "initiale",
          errors: v1.filter((v) => v.severity === "error"),
          warns: v1.filter((v) => v.severity === "warn"),
        });

        const rc1 = recompute(c1.value);
        const { estimation: est1, totaux_llm: llm1 } = applyRecompute(c1.value, rc1);
        send("estimation", { version: "initiale", estimation: est1, totals: rc1, totaux_llm: llm1 });

        // ---- passe P6 optionnelle
        if (withControle) {
          send("phase", { step: "controle", label: "Passe de controle P6" });
          startBeat("controle");
          try {
            const sysC = getSystemPrompt("controle");
            const rC = await callOpenRouter({
              model: preset.id,
              system: sysC.text,
              json: true,
              messages: [{
                role: "user",
                content: `Voici l'estimation a controler :\n\n${JSON.stringify(est1, null, 1)}`,
              }],
            });
            stopBeat();
            calls.push({ label: "controle P6", model: preset.id, usage: rC.usage, costUsd: rC.costUsd, durationMs: rC.durationMs });

            const exC = extractJson(rC.text, rC.finishReason === "length");
            if (!exC.ok) {
              send("controle", { ok: false, message: exC.error ?? "enveloppe de controle illisible", costUsd: rC.costUsd, durationMs: rC.durationMs });
            } else {
              send("controle", {
                ok: true,
                verdict: exC.value?.verdict ?? "?",
                commentaire: exC.value?.commentaire ?? "",
                costUsd: rC.costUsd,
                durationMs: rC.durationMs,
                usage: rC.usage,
              });

              const ap = applyCorrections(est1, exC.value);
              send("corrections", { applied: ap.applied, rejected: ap.rejected });

              const c2 = coerce(ap.estimation);
              const v2 = validate(c2.value, schema);
              const rc2 = recompute(c2.value);
              const { estimation: est2, totaux_llm: llm2 } = applyRecompute(c2.value, rc2);

              send("validate", {
                version: "post-controle",
                errors: v2.filter((v) => v.severity === "error"),
                warns: v2.filter((v) => v.severity === "warn"),
              });
              send("estimation", {
                version: "post-controle",
                estimation: est2,
                totals: rc2,
                totaux_llm: llm2,
                delta: {
                  total_ht: Math.round((rc2.total_ht - rc1.total_ht) * 100) / 100,
                  nbPostes: rc2.nbPostes - rc1.nbPostes,
                },
              });
            }
          } catch (e) {
            stopBeat();
            send("controle", { ok: false, message: `passe de controle echouee : ${(e as Error).message}` });
          }
        }

        send("cost", {
          calls,
          totalCostUsd: calls.reduce((s, c) => s + c.costUsd, 0),
          totalDurationMs: calls.reduce((s, c) => s + c.durationMs, 0),
        });
        send("done", { ok: true });
      } catch (e) {
        stopBeat();
        send("error", { fatal: true, stage: "serveur", message: (e as Error).message });
        send("done", { ok: false });
      } finally {
        stopBeat();
        closed = true;
        try {
          controller.close();
        } catch { /* deja ferme */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "x-accel-buffering": "no",
    },
  });
}

