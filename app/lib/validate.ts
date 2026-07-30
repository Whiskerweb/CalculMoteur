// app/lib/validate.ts
//
// Coercition puis validation contre assets/schema.json.
// Validateur ecrit a la main : le schema n'utilise qu'un sous-ensemble reduit de
// mots-cles, ca evite un import reseau et ca permet de choisir la severite
// par mot-cle (ce qu'ajv ne donne pas).
//
// Regle de conduite : on ne rejette jamais un devis. Une violation s'affiche,
// elle ne fait pas disparaitre le resultat.

import { readSkillFile, skillFileMtime } from "./runtime.ts";

export interface Fix {
  path: string;
  from: string;
  to: string;
  reason: string;
}

export interface Violation {
  path: string;
  keyword: string;
  message: string;
  severity: "error" | "warn";
}

// ------------------------------------------------------------------ schema

let schemaCache: { value: any; mtime: number } | null = null;

export function loadSchema(): any {
  const mtime = skillFileMtime("assets/schema.json");
  if (schemaCache && schemaCache.mtime === mtime) return schemaCache.value;
  const value = JSON.parse(readSkillFile("assets/schema.json"));
  schemaCache = { value, mtime };
  return value;
}

// ------------------------------------------------------------- coercition

const UNITS = ["m2", "ml", "u", "ens", "forfait", "h"];
const METIERS = [
  "demolition", "assainissement", "toiture", "isolation_ext", "menuiserie",
  "isolation_int", "platrerie", "electricite", "plomberie", "chauffage",
  "ventilation", "carrelage", "peinture", "autre",
];

function deaccent(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normKey(s: string): string {
  return deaccent(String(s).toLowerCase().trim());
}

/** "1 200,50 €" -> 1200.5 */
function toNumber(v: any): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const cleaned = v
    .replace(/ /g, "")
    .replace(/[€%\s]/g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function coerceUnit(v: any): string | null {
  const k = normKey(v).replace(/\.$/, "");
  const map: Record<string, string> = {
    "m2": "m2", "m²": "m2", "m^2": "m2", "metre carre": "m2", "metres carres": "m2",
    "ml": "ml", "m": "ml", "metre lineaire": "ml", "metres lineaires": "ml",
    "u": "u", "unite": "u", "unites": "u", "piece": "u", "pieces": "u", "pce": "u",
    "ens": "ens", "ensemble": "ens",
    "forfait": "forfait", "fft": "forfait", "ft": "forfait", "ff": "forfait",
    "h": "h", "heure": "h", "heures": "h",
  };
  return map[k] ?? (UNITS.includes(k) ? k : null);
}

function coerceMetier(v: any): string | null {
  const k = normKey(v).replace(/[\s'-]+/g, "_");
  if (METIERS.includes(k)) return k;
  const map: Record<string, string> = {
    "isolation_exterieure": "isolation_ext", "ite": "isolation_ext",
    "isolation_interieure": "isolation_int", "iti": "isolation_int",
    "menuiseries": "menuiserie", "electricite_generale": "electricite",
    "platrerie_cloisons": "platrerie", "plomberie_sanitaire": "plomberie",
    "vmc": "ventilation", "couverture": "toiture", "demolitions": "demolition",
    "carrelage_faience": "carrelage", "peintures": "peinture",
  };
  return map[k] ?? null;
}

function coerceConfiance(v: any): string | null {
  const k = normKey(v);
  const map: Record<string, string> = {
    haute: "haute", high: "haute", elevee: "haute", forte: "haute",
    moyenne: "moyenne", medium: "moyenne", moderee: "moyenne",
    basse: "basse", low: "basse", faible: "basse",
  };
  return map[k] ?? null;
}

function snapTva(n: number): number | null {
  // 0.1 / 0.055 / 0.2 -> pourcentages
  const v = n > 0 && n < 1 ? n * 100 : n;
  for (const t of [5.5, 10, 20]) if (Math.abs(v - t) < 0.26) return t;
  return null;
}

/** Normalise en place une copie profonde, et journalise chaque substitution. */
export function coerce(input: any): { value: any; fixes: Fix[] } {
  const fixes: Fix[] = [];
  const v = structuredClone(input);
  if (!v || typeof v !== "object") return { value: v, fixes };

  const num = (obj: any, key: string, path: string) => {
    if (obj[key] === undefined) return;
    if (typeof obj[key] === "number") return;
    const n = toNumber(obj[key]);
    if (n !== null) {
      fixes.push({ path, from: String(obj[key]), to: String(n), reason: "chaine convertie en nombre" });
      obj[key] = n;
    }
  };

  if (v.contexte) num(v.contexte, "surface_m2", "contexte.surface_m2");

  if (Array.isArray(v.lots)) {
    v.lots.forEach((lot: any, li: number) => {
      if (!lot || typeof lot !== "object") return;
      const lp = `lots[${li}]`;

      if (lot.metier !== undefined && !METIERS.includes(lot.metier)) {
        const c = coerceMetier(lot.metier);
        if (c) {
          fixes.push({ path: `${lp}.metier`, from: String(lot.metier), to: c, reason: "metier normalise" });
          lot.metier = c;
        }
      }

      if (!Array.isArray(lot.postes)) return;
      lot.postes.forEach((p: any, pi: number) => {
        if (!p || typeof p !== "object") return;
        const pp = `${lp}.postes[${pi}]`;

        num(p, "qty", `${pp}.qty`);
        num(p, "prix_unitaire_ht", `${pp}.prix_unitaire_ht`);

        if (p.unit !== undefined && !UNITS.includes(p.unit)) {
          const c = coerceUnit(p.unit);
          if (c) {
            fixes.push({ path: `${pp}.unit`, from: String(p.unit), to: c, reason: "unite normalisee" });
            p.unit = c;
          }
        }

        if (p.tva !== undefined && ![5.5, 10, 20].includes(p.tva)) {
          const n = toNumber(p.tva);
          const s = n === null ? null : snapTva(n);
          if (s !== null) {
            fixes.push({ path: `${pp}.tva`, from: String(p.tva), to: String(s), reason: "taux de TVA normalise" });
            p.tva = s;
          }
        }

        if (p.confiance !== undefined && !["haute", "moyenne", "basse"].includes(p.confiance)) {
          const c = coerceConfiance(p.confiance);
          if (c) {
            fixes.push({ path: `${pp}.confiance`, from: String(p.confiance), to: c, reason: "niveau de confiance normalise" });
            p.confiance = c;
          }
        }

        // Aucun catalogue n'est connecte : toute autre source est inventee.
        if (p.source_prix !== undefined && p.source_prix !== "estimation") {
          fixes.push({
            path: `${pp}.source_prix`,
            from: String(p.source_prix),
            to: "estimation",
            reason: "aucun catalogue connecte dans ce mode — source ramenee a estimation",
          });
          p.source_prix = "estimation";
        }
      });
    });
  }

  if (v.confiance_globale !== undefined) {
    const n = toNumber(v.confiance_globale);
    if (n !== null) {
      const r = Math.max(0, Math.min(100, Math.round(n)));
      if (r !== v.confiance_globale) {
        fixes.push({ path: "confiance_globale", from: String(v.confiance_globale), to: String(r), reason: "arrondi et borne 0-100" });
        v.confiance_globale = r;
      }
    }
  }

  return { value: v, fixes };
}

// -------------------------------------------------------------- validation

// additionalProperties et pattern en warn : les modeles ajoutent volontiers un
// total_ligne_ht par poste, ca ne rend pas le devis inexploitable.
const WARN_KEYWORDS = new Set(["additionalProperties", "pattern"]);

function sev(keyword: string): "error" | "warn" {
  return WARN_KEYWORDS.has(keyword) ? "warn" : "error";
}

function typeOf(v: any): string {
  if (Array.isArray(v)) return "array";
  if (v === null) return "null";
  if (Number.isInteger(v)) return "integer";
  return typeof v;
}

function typeMatches(v: any, t: string): boolean {
  if (t === "integer") return Number.isInteger(v);
  if (t === "number") return typeof v === "number" && Number.isFinite(v);
  if (t === "array") return Array.isArray(v);
  if (t === "object") return v !== null && typeof v === "object" && !Array.isArray(v);
  return typeOf(v) === t;
}

function walk(value: any, schema: any, path: string, out: Violation[]): void {
  if (!schema || typeof schema !== "object") return;

  const add = (keyword: string, message: string) =>
    out.push({ path: path || "(racine)", keyword, message, severity: sev(keyword) });

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t: string) => typeMatches(value, t))) {
      add("type", `attendu ${types.join("|")}, recu ${typeOf(value)}`);
      return; // inutile de descendre sur un type faux
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    add("enum", `valeur "${value}" hors de [${schema.enum.join(", ")}]`);
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      add("minimum", `${value} < ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      add("maximum", `${value} > ${schema.maximum}`);
    }
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      add("exclusiveMinimum", `${value} doit etre > ${schema.exclusiveMinimum}`);
    }
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      add("minLength", `chaine vide ou trop courte (min ${schema.minLength})`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      add("pattern", `"${value}" ne respecte pas le format attendu`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      add("minItems", `${value.length} element(s), minimum ${schema.minItems}`);
    }
    if (schema.items) {
      value.forEach((it, i) => walk(it, schema.items, `${path}[${i}]`, out));
    }
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const req of schema.required ?? []) {
      if (value[req] === undefined) add("required", `champ obligatoire manquant : "${req}"`);
    }
    const props = schema.properties ?? {};
    for (const [k, v] of Object.entries(value)) {
      const sub = `${path ? path + "." : ""}${k}`;
      if (props[k]) walk(v, props[k], sub, out);
      else if (schema.additionalProperties === false) {
        out.push({
          path: sub,
          keyword: "additionalProperties",
          message: `champ hors schema : "${k}"`,
          severity: "warn",
        });
      }
    }
  }

  for (const sub of schema.allOf ?? []) {
    if (sub.if && sub.then) {
      const probe: Violation[] = [];
      walk(value, sub.if, path, probe);
      if (!probe.some((v) => v.severity === "error")) walk(value, sub.then, path, out);
    } else {
      walk(value, sub, path, out);
    }
  }
}

export function validate(value: any, schema: any): Violation[] {
  const out: Violation[] = [];
  walk(value, schema, "", out);
  return out;
}
