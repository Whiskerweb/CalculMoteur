// app/lib/openrouter.ts
//
// Client minimal OpenRouter. Meme forme que
// Rapido2/supabase/functions/_shared/ai-router.ts, sans la couche providers.

import { estimateCost, getPreset } from "./models.ts";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
// Un devis complet fait 6-12k tokens de sortie : mesure a 180 s coupait Sonnet 5
// en plein milieu. 10 min laisse de la marge y compris sur un gros chantier.
const TIMEOUT_MS = Number(Deno.env.get("OPENROUTER_TIMEOUT_MS") ?? 600_000);

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface Message {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface CallResult {
  text: string;
  finishReason: string;
  usage: { in: number; out: number };
  costUsd: number;
  durationMs: number;
}

export interface CallParams {
  model: string;
  system?: string;
  messages: Message[];
  maxTokens?: number;
  temperature?: number;
  /** Force response_format json_object. Ignore si le preset declare jsonMode "none". */
  json?: boolean;
}

function apiKey(): string {
  const k = Deno.env.get("OPENROUTER_API_KEY");
  if (!k) throw new Error("OPENROUTER_API_KEY absente de l'environnement");
  return k;
}

async function once(p: CallParams): Promise<CallResult> {
  const preset = getPreset(p.model);
  const messages: Message[] = p.system
    ? [{ role: "system", content: p.system }, ...p.messages]
    : p.messages;

  const body: Record<string, unknown> = {
    model: p.model,
    messages,
    temperature: p.temperature ?? 0.2,
    max_tokens: p.maxTokens ?? preset?.maxTokens ?? 16000,
  };

  // Anthropic n'a pas de mode JSON : envoyer response_format est au mieux
  // ignore, au pire une erreur 400. On s'appuie sur le rappel R14 en pied de
  // prompt et sur l'echelle d'extraction de extract.ts.
  const supportsJson = !preset || preset.jsonMode === "object";
  if (p.json && supportsJson) body.response_format = { type: "json_object" };

  // Raisonnement etendu coupe par defaut : voir le commentaire de ModelPreset.
  // Un modele qui reflechit 16 000 tokens puis renvoie un content vide coute
  // le prix plein et ne produit rien.
  if ((preset?.reasoning ?? "off") === "off") {
    body.reasoning = { enabled: false };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const started = Date.now();

  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        authorization: `Bearer ${apiKey()}`,
        "content-type": "application/json",
        "HTTP-Referer": "http://127.0.0.1",
        "X-Title": "CalculMoteur - createur d'estimation",
      },
      body: JSON.stringify(body),
    });

    const raw = await r.text();
    if (!r.ok) {
      const err = new Error(`OpenRouter ${r.status} : ${raw.slice(0, 300)}`);
      (err as any).status = r.status;
      throw err;
    }

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`Reponse OpenRouter illisible : ${raw.slice(0, 200)}`);
    }
    if (data.error) {
      throw new Error(`OpenRouter : ${data.error.message ?? JSON.stringify(data.error)}`);
    }

    const choice = data.choices?.[0] ?? {};
    const usage = {
      in: data.usage?.prompt_tokens ?? 0,
      out: data.usage?.completion_tokens ?? 0,
    };

    return {
      text: choice.message?.content ?? "",
      finishReason: choice.finish_reason ?? "unknown",
      usage,
      costUsd: estimateCost(p.model, usage),
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Un seul retry, sur 429 et 5xx uniquement. */
export async function callOpenRouter(p: CallParams): Promise<CallResult> {
  try {
    return await once(p);
  } catch (e) {
    const status = (e as any).status;
    const retryable = status === 429 || (status >= 500 && status < 600);
    if (!retryable) throw e;
    await new Promise((r) => setTimeout(r, 2000));
    return await once(p);
  }
}
