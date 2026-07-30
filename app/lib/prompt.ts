// app/lib/prompt.ts
//
// Assemble le system prompt a partir des fichiers du skill calcul-moteur.
// Cache memoire revalide par mtime : editer SKILL.md ou une reference et
// relancer une estimation suffit, pas besoin de redemarrer le serveur.

import { readSkillFile, skillFileMtime } from "./runtime.ts";
import { CONTROLE_REFS, REF_ORDER, SKILL_FILE_ORDER } from "./skill-files.ts";

export interface PromptPart {
  name: string;
  chars: number;
}

export interface BuiltPrompt {
  text: string;
  parts: PromptPart[];
  approxTokens: number;
  cached: boolean;
}

// ---------------------------------------------------------------- en-tete

/**
 * Sans cet en-tete, deux regles du skill se retournent contre nous :
 *
 * 1. P5 classe le "catalogue de prix" en source n.1. Aucun catalogue n'est
 *    branche ici -> le modele inventerait source_prix:"catalogue".
 * 2. controle.md retire 12 points quand plus de 30 % des postes sont hors
 *    catalogue. Sans catalogue la penalite tombe a chaque run et deprime
 *    confiance_globale de facon mecanique et non informative.
 */
const HEADER = `# CONTEXTE D'EXECUTION — a lire avant tout le reste

Tu tournes en **mode API sans outil et sans base de donnees**.

- Tu n'as **aucun moyen de lire un fichier** : toutes les references citees par le
  tableau "Fichiers de reference" du skill sont **deja integralement recopiees
  ci-dessous**. Ne demande jamais a en charger une, ne dis jamais que tu vas la
  consulter.
- **Aucun catalogue de prix n'est connecte** (ni BatiChiffrage, ni bibliotheque
  interne, ni historique de prix valides par un MOE). Deux consequences strictes :
  - \`source_prix\` ne peut valoir que \`"estimation"\`. N'ecris **jamais**
    \`"catalogue"\` ni \`"mediane_moe"\` : ce serait une source inventee.
  - La ligne "Plus de 30 % des postes chiffres hors catalogue : -12" du bareme de
    confiance est **neutralisee dans ce mode**. Ne l'applique pas. Les autres
    lignes du bareme s'appliquent normalement.
- Les prix viennent donc des fourchettes de \`references/prix.md\`, ajustees par la
  structure de cout et le contexte du chantier. C'est une estimation raisonnee
  assumee, pas un bordereau.

## MODE ACTIF : API

La section "MODE DE SORTIE" du skill te laisse le choix entre mode API et mode
conversationnel. **Le mode API est actif.** Applique la regle R14 sans exception :
un unique objet JSON conforme au schema, rien avant, rien apres.

---

`;

const FOOTER = `

---

# RAPPEL FINAL — FORMAT DE REPONSE

Ta reponse est **un seul objet JSON**, conforme au JSON Schema ci-dessus.

- Premier caractere : \`{\`. Dernier caractere : \`}\`.
- Aucune phrase d'introduction, aucun commentaire, aucune conclusion.
- Aucun bloc de code, aucune balise \`\`\`json.
- \`source_prix\` vaut toujours \`"estimation"\` (aucun catalogue connecte).
- Chaque poste porte une \`qty\` numerique strictement positive et un
  \`qty_rationale\` verifiable. Jamais de quantite a 0 (R8).
`;

// ---------------------------------------------------------------- lecture

function stripFrontmatter(md: string): string {
  if (!md.startsWith("---")) return md;
  const end = md.indexOf("\n---", 3);
  if (end === -1) return md;
  return md.slice(end + 4).replace(/^\n+/, "");
}

const readFile = readSkillFile;
const mtimeOf = skillFileMtime;

/** ~3,6 caracteres par token en francais (mesure sur ce corpus). */
function approxTokens(chars: number): number {
  return Math.round(chars / 3.6);
}

// ---------------------------------------------------------------- assemblage

function filesFor(variant: "estimation" | "controle"): string[] {
  if (variant === "estimation") return SKILL_FILE_ORDER;
  return ["SKILL.md", ...CONTROLE_REFS.map((r) => `references/${r}`), "assets/schema.json"];
}

function assemble(variant: "estimation" | "controle"): BuiltPrompt {
  const parts: PromptPart[] = [];
  const chunks: string[] = [HEADER];

  const skill = stripFrontmatter(readFile("SKILL.md"));
  parts.push({ name: "SKILL.md", chars: skill.length });
  chunks.push(skill);

  const refs: readonly string[] = variant === "controle" ? CONTROLE_REFS : REF_ORDER;
  for (const r of refs) {
    const body = readFile(`references/${r}`);
    parts.push({ name: `references/${r}`, chars: body.length });
    chunks.push(`\n\n===== references/${r} =====\n\n${body}`);
  }

  const schema = readFile("assets/schema.json");
  parts.push({ name: "assets/schema.json", chars: schema.length });
  chunks.push(
    `\n\n===== CONTRAT DE SORTIE — JSON Schema faisant foi =====\n\n${schema}`,
  );

  if (variant === "controle") {
    chunks.push(CONTROLE_FOOTER);
  } else {
    chunks.push(FOOTER);
  }

  const text = chunks.join("");
  return { text, parts, approxTokens: approxTokens(text.length), cached: false };
}

// ---------------------------------------------------------------- cache

interface CacheEntry {
  built: BuiltPrompt;
  mtimes: Record<string, number>;
}
const cache: Record<string, CacheEntry> = {};

function mtimesFor(variant: "estimation" | "controle"): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of filesFor(variant)) out[f] = mtimeOf(f);
  return out;
}

function sameMtimes(a: Record<string, number>, b: Record<string, number>): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}

/** Retourne le prompt assemble, reconstruit uniquement si un fichier a bouge. */
export function getSystemPrompt(
  variant: "estimation" | "controle" = "estimation",
): BuiltPrompt {
  const now = mtimesFor(variant);
  const hit = cache[variant];
  if (hit && sameMtimes(hit.mtimes, now)) {
    return { ...hit.built, cached: true };
  }
  const built = assemble(variant);
  cache[variant] = { built, mtimes: now };
  return built;
}

const CONTROLE_FOOTER = `

---

# TA MISSION : CONTROLE P6, PAS RECHIFFRAGE

On te soumet une estimation deja produite. Tu appliques la checklist de
\`references/controle.md\` et tu renvoies **uniquement des corrections ciblees**.

Tu ne reecris **jamais** le devis complet. Tu ne touches pas a ce qui est correct.

Reponds par un unique objet JSON de cette forme, rien avant, rien apres :

\`\`\`
{
  "verdict": "conforme" | "corrige" | "alerte",
  "corrections": [
    { "cible": "poste", "ref": "p7", "champ": "qty",
      "nouvelle_valeur": 24.5, "motif": "...", "regle": "bornes de vraisemblance" },
    { "cible": "poste", "action": "supprimer", "ref": "p12",
      "motif": "double compte avec p4" },
    { "cible": "estimation", "champ": "confiance_globale", "nouvelle_valeur": 64,
      "motif": "..." },
    { "cible": "liste", "champ": "questions_bloquantes", "action": "ajouter",
      "valeur": "..." }
  ],
  "postes_ajoutes": [
    { "metier": "ventilation", "motif": "lot induit manquant",
      "poste": { "ref": "c1", "intitule": "...", "description": "...", "qty": 1,
                 "unit": "u", "qty_rationale": "...", "prix_unitaire_ht": 0,
                 "tva": 10, "source_prix": "estimation", "rationale_prix": "...",
                 "confiance": "moyenne" } }
  ],
  "commentaire": "3 a 6 lignes de synthese"
}
\`\`\`

Champs modifiables sur un poste : \`qty\`, \`unit\`, \`prix_unitaire_ht\`, \`tva\`,
\`intitule\`, \`description\`, \`qty_rationale\`, \`rationale_prix\`, \`confiance\`.
Champs modifiables sur l'estimation : \`confiance_globale\`, \`confiance_commentaire\`.
Listes editables : \`questions_bloquantes\`, \`alertes_regulatoires\`,
\`dispositifs_aides\`, \`contexte.hypotheses\`.

Si tout est conforme : \`verdict: "conforme"\` et \`corrections: []\`. Ne corrige pas
pour corriger.
`;

// ---------------------------------------------------------------- user message

export interface FormInput {
  brief: string;
  typeBien?: string;
  surface?: number | null;
  annee?: string;
  codePostal?: string;
  occupe?: boolean | null;
  etage?: string;
  ascenseur?: boolean | null;
  copropriete?: boolean | null;
}

const P0_LABELS: Array<[keyof FormInput, string, (v: any) => string]> = [
  ["typeBien", "type de bien", (v) => String(v)],
  ["surface", "surface habitable", (v) => `${v} m2`],
  ["annee", "annee de construction", (v) => String(v)],
  ["codePostal", "code postal", (v) => String(v)],
  ["occupe", "logement occupe pendant les travaux", (v) => (v ? "oui" : "non")],
  ["etage", "etage", (v) => String(v)],
  ["ascenseur", "ascenseur", (v) => (v ? "oui" : "non")],
  ["copropriete", "copropriete", (v) => (v ? "oui" : "non")],
];

/**
 * Les champs non renseignes sont **omis**, jamais envoyes en "(non precise)".
 * La passe P0 du skill enumere ce dont elle a besoin : une absence reelle
 * declenche une hypothese explicite ou une question bloquante (R11), ce qui est
 * exactement le comportement qu'on veut observer.
 */
export function buildUserMessage(form: FormInput, photoAnalysis?: string): string {
  const lines: string[] = [];
  lines.push("# BRIEF CLIENT\n");
  lines.push(form.brief.trim());

  const known: string[] = [];
  const missing: string[] = [];
  for (const [key, label, fmt] of P0_LABELS) {
    const v = form[key];
    if (v === undefined || v === null || v === "") missing.push(label);
    else known.push(`- ${label} : ${fmt(v)}`);
  }

  if (known.length) {
    lines.push("\n\n# CONTEXTE STRUCTURE (saisi par le client)\n");
    lines.push(known.join("\n"));
  }
  if (missing.length) {
    lines.push(
      `\n\nDonnees de contexte **non fournies** : ${missing.join(", ")}.` +
        ` Traite chacune en hypothese explicite ou en question bloquante selon` +
        ` son impact sur le prix (R11).`,
    );
  }

  if (photoAnalysis) {
    lines.push("\n\n# ANALYSE DES PHOTOS DE CHANTIER\n");
    lines.push(photoAnalysis);
  }

  lines.push(
    "\n\nProduis l'estimation en JSON strict conforme au schema. Rien d'autre.",
  );
  return lines.join("");
}
