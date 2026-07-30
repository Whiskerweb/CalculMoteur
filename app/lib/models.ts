// app/lib/models.ts
//
// Presets de modeles OpenRouter. Tarifs en $/M tokens releves sur
// https://openrouter.ai/api/v1/models le 2026-07-29.
//
// jsonMode:
//   "object" -> le provider supporte response_format:{type:"json_object"}
//   "none"   -> pas de mode JSON (Anthropic) : on s'appuie sur le rappel R14
//               en pied de prompt + l'echelle d'extraction de lib/extract.ts

export interface ModelPreset {
  id: string;
  label: string;
  priceIn: number; // $/M tokens entree
  priceOut: number; // $/M tokens sortie
  vision: boolean;
  jsonMode: "object" | "none";
  maxTokens: number;
  /**
   * "off" -> on envoie reasoning:{enabled:false} a OpenRouter.
   *
   * C'est le defaut ici, et ce n'est pas une economie de bouts de chandelle :
   * mesure le 2026-07-29, Sonnet 5 avec le raisonnement actif a consomme les
   * 16 000 tokens de sortie **entierement en raisonnement** sur un brief de
   * salle de bains, en renvoyant un content vide et finish_reason "length".
   * Le skill est deja une procedure de raisonnement explicite en 7 passes :
   * la refaire en amont ne produit rien d'exploitable.
   */
  reasoning: "off" | "default";
  /**
   * Duree typique d'une estimation, mesuree. Sert a avertir l'utilisateur sur
   * la version deployee : une fonction serverless a une duree bornee, et un
   * modele lent peut depasser la limite.
   */
  typicalSeconds: number;
  note: string;
}

export const MODELS: Record<string, ModelPreset> = {
  "anthropic/claude-sonnet-5": {
    id: "anthropic/claude-sonnet-5",
    label: "Claude Sonnet 5 — qualite (defaut)",
    priceIn: 2.0,
    priceOut: 10.0,
    vision: true,
    jsonMode: "none",
    maxTokens: 16000,
    reasoning: "off",
    typicalSeconds: 75,
    note: "Reference sur instructions longues et contraintes. Pas de mode JSON natif.",
  },
  "x-ai/grok-4.20": {
    id: "x-ai/grok-4.20",
    label: "Grok 4.20 — raisonnement",
    priceIn: 1.25,
    priceOut: 2.5,
    vision: true,
    jsonMode: "object",
    maxTokens: 16000,
    reasoning: "off",
    typicalSeconds: 40,
    note: "Bon compromis raisonnement/prix, sortie longue peu couteuse.",
  },
  "openai/gpt-5-mini": {
    id: "openai/gpt-5-mini",
    label: "GPT-5 mini — equilibre",
    priceIn: 0.25,
    priceOut: 2.0,
    vision: true,
    jsonMode: "object",
    maxTokens: 16000,
    reasoning: "off",
    typicalSeconds: 30,
    note: "Mode JSON natif, bon suivi d'instructions pour son prix.",
  },
  "google/gemini-3.1-flash-lite": {
    id: "google/gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash Lite — rapide",
    priceIn: 0.25,
    priceOut: 1.5,
    vision: true,
    jsonMode: "object",
    maxTokens: 16000,
    reasoning: "off",
    typicalSeconds: 8,
    note: "Le plus rapide. Moins fiable sur les regles metier francaises.",
  },
  "deepseek/deepseek-v4-pro": {
    id: "deepseek/deepseek-v4-pro",
    label: "DeepSeek V4 Pro — eco",
    priceIn: 0.43,
    priceOut: 0.87,
    vision: false,
    jsonMode: "object",
    maxTokens: 16000,
    reasoning: "off",
    typicalSeconds: 25,
    note: "Le moins cher. Texte seul : les photos passent par une pre-passe vision.",
  },
};

/** Defaut en local, ou la duree n'est pas bornee : on privilegie la qualite. */
export const DEFAULT_MODEL = "anthropic/claude-sonnet-5";

/**
 * Defaut sur la version deployee.
 *
 * Ce n'est pas un choix de qualite mais une contrainte de plateforme : une
 * fonction serverless a une duree d'execution bornee, et Sonnet 5 met 75 s en
 * moyenne. Gemini Flash Lite est mesure a 8 s, ce qui passe partout. Sonnet
 * reste selectionnable, avec un avertissement dans l'interface.
 */
export const DEPLOYED_DEFAULT_MODEL = "google/gemini-3.1-flash-lite";

/** Au-dela, un modele risque de depasser la limite de duree en serverless. */
export const SERVERLESS_SAFE_SECONDS = 20;

/** Modele utilise pour la pre-passe vision quand le modele principal est texte seul. */
export const VISION_FALLBACK = "qwen/qwen3-vl-30b-a3b-instruct";
const VISION_FALLBACK_PRICING = { priceIn: 0.15, priceOut: 0.6 };

export function getPreset(id: string): ModelPreset | null {
  return MODELS[id] ?? null;
}

export function estimateCost(
  modelId: string,
  usage: { in: number; out: number },
): number {
  const p = MODELS[modelId];
  const pricing = p
    ? { priceIn: p.priceIn, priceOut: p.priceOut }
    : modelId === VISION_FALLBACK
    ? VISION_FALLBACK_PRICING
    : null;
  if (!pricing) return 0;
  return (usage.in * pricing.priceIn + usage.out * pricing.priceOut) / 1_000_000;
}

/** Liste serialisable pour l'UI. Ne contient jamais la cle API. */
export function publicModelList() {
  return Object.values(MODELS).map((m) => ({
    id: m.id,
    label: m.label,
    priceIn: m.priceIn,
    priceOut: m.priceOut,
    vision: m.vision,
    jsonMode: m.jsonMode,
    typicalSeconds: m.typicalSeconds,
    note: m.note,
  }));
}
