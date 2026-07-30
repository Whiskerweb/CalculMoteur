// app/lib/skill-files.ts
//
// Liste et ordre des fichiers du skill. Source unique, partagee par le
// generateur de bundle et par l'assembleur de prompt.
//
// L'ordre est celui du tableau de routage du SKILL.md et il doit rester
// stable : un prefixe identique d'un appel a l'autre est ce qui rend le cache
// de prompt cote provider possible.

/** References injectees dans le prompt d'estimation, dans cet ordre. */
export const REF_ORDER = [
  "lots.md",
  "metres.md",
  "prix.md",
  "tva-reglementation.md",
  "redaction.md",
  "controle.md",
  "schema-sortie.md",
] as const;

/** Passe P6 : sous-ensemble suffisant, ~40 % moins cher que le prompt complet. */
export const CONTROLE_REFS = [
  "controle.md",
  "metres.md",
  "prix.md",
  "schema-sortie.md",
] as const;

/** Tous les fichiers a embarquer dans le bundle. */
export const SKILL_FILE_ORDER: string[] = [
  "SKILL.md",
  ...REF_ORDER.map((r) => `references/${r}`),
  "assets/schema.json",
];
