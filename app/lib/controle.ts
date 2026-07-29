// app/lib/controle.ts
//
// Passe P6 : le modele PROPOSE des corrections, le serveur DISPOSE.
// Les corrections sont adressees par `ref` (garanti present et unique par le
// schema) plutot que par JSON Pointer, qui casse au moindre reindex.
//
// Chaque correction refusee est journalisee et affichee : on veut pouvoir juger
// si la passe de controle aide ou nuit.

const CHAMPS_POSTE = new Set([
  "qty", "unit", "prix_unitaire_ht", "tva", "intitule", "description",
  "qty_rationale", "rationale_prix", "confiance",
]);
const CHAMPS_ESTIMATION = new Set(["confiance_globale", "confiance_commentaire"]);
const LISTES = new Set([
  "questions_bloquantes", "alertes_regulatoires", "dispositifs_aides", "hypotheses",
]);

const UNITS = ["m2", "ml", "u", "ens", "forfait", "h"];

const MAX_CORRECTIONS = 40;
const MAX_SUPPRESSION_PCT = 0.2;

export interface AppliedLog {
  ref?: string;
  cible: string;
  champ?: string;
  from?: any;
  to?: any;
  motif?: string;
}

export interface RejectedLog {
  ref?: string;
  cible: string;
  champ?: string;
  raison: string;
}

export interface ApplyResult {
  estimation: any;
  applied: AppliedLog[];
  rejected: RejectedLog[];
}

function findPoste(est: any, ref: string): { lot: any; poste: any; index: number } | null {
  for (const lot of est?.lots ?? []) {
    const i = (lot?.postes ?? []).findIndex((p: any) => p?.ref === ref);
    if (i !== -1) return { lot, poste: lot.postes[i], index: i };
  }
  return null;
}

/** La nouvelle valeur doit satisfaire sa propre contrainte de champ. */
function valeurValide(champ: string, v: any): string | null {
  switch (champ) {
    case "qty":
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
        return "quantite non numerique ou <= 0";
      }
      return null;
    case "prix_unitaire_ht":
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
        return "prix unitaire non numerique ou <= 0";
      }
      return null;
    case "tva":
      if (![5.5, 10, 20].includes(v)) return "taux de TVA hors 5,5 / 10 / 20";
      return null;
    case "unit":
      if (!UNITS.includes(v)) return `unite hors ${UNITS.join(", ")}`;
      return null;
    case "confiance":
      if (!["haute", "moyenne", "basse"].includes(v)) return "niveau de confiance invalide";
      return null;
    case "confiance_globale":
      if (typeof v !== "number" || v < 0 || v > 100) return "score hors 0-100";
      return null;
    default:
      if (typeof v !== "string" || !v.trim()) return "valeur textuelle vide";
      return null;
  }
}

/** Garde-fou : une variation de plus de x10 ou moins de /10 est suspecte. */
function variationAberrante(champ: string, from: any, to: any): boolean {
  if (champ !== "qty" && champ !== "prix_unitaire_ht") return false;
  if (typeof from !== "number" || typeof to !== "number" || from <= 0 || to <= 0) return false;
  const r = to / from;
  return r > 10 || r < 0.1;
}

export function applyCorrections(est: any, envelope: any): ApplyResult {
  const out = structuredClone(est);
  const applied: AppliedLog[] = [];
  const rejected: RejectedLog[] = [];

  const corrections = Array.isArray(envelope?.corrections) ? envelope.corrections : [];
  const totalPostes = (out.lots ?? []).reduce(
    (n: number, l: any) => n + (l.postes?.length ?? 0),
    0,
  );
  const maxSuppressions = Math.floor(totalPostes * MAX_SUPPRESSION_PCT);
  let suppressions = 0;

  for (const c of corrections.slice(0, MAX_CORRECTIONS)) {
    const cible = c?.cible ?? "?";

    // ---- suppression d'un poste
    if (cible === "poste" && c?.action === "supprimer") {
      if (suppressions >= maxSuppressions) {
        rejected.push({ ref: c.ref, cible, raison: `plafond de suppressions atteint (${maxSuppressions})` });
        continue;
      }
      const hit = findPoste(out, c.ref);
      if (!hit) {
        rejected.push({ ref: c.ref, cible, raison: "ref inconnue" });
        continue;
      }
      hit.lot.postes.splice(hit.index, 1);
      suppressions++;
      // Le schema impose minItems 1 sur postes : un lot vide disparait.
      if (hit.lot.postes.length === 0) {
        out.lots = out.lots.filter((l: any) => l !== hit.lot);
      }
      applied.push({ ref: c.ref, cible, champ: "(suppression)", motif: c.motif });
      continue;
    }

    // ---- modification d'un champ de poste
    if (cible === "poste") {
      const hit = findPoste(out, c?.ref);
      if (!hit) {
        rejected.push({ ref: c?.ref, cible, raison: "ref inconnue" });
        continue;
      }
      if (!CHAMPS_POSTE.has(c?.champ)) {
        rejected.push({ ref: c.ref, cible, champ: c?.champ, raison: "champ non modifiable" });
        continue;
      }
      const err = valeurValide(c.champ, c.nouvelle_valeur);
      if (err) {
        rejected.push({ ref: c.ref, cible, champ: c.champ, raison: err });
        continue;
      }
      const from = hit.poste[c.champ];
      if (variationAberrante(c.champ, from, c.nouvelle_valeur)) {
        rejected.push({
          ref: c.ref, cible, champ: c.champ,
          raison: `variation invraisemblable (${from} -> ${c.nouvelle_valeur})`,
        });
        continue;
      }
      hit.poste[c.champ] = c.nouvelle_valeur;
      applied.push({ ref: c.ref, cible, champ: c.champ, from, to: c.nouvelle_valeur, motif: c.motif });
      continue;
    }

    // ---- modification au niveau estimation
    if (cible === "estimation") {
      if (!CHAMPS_ESTIMATION.has(c?.champ)) {
        rejected.push({ cible, champ: c?.champ, raison: "champ non modifiable" });
        continue;
      }
      const err = valeurValide(c.champ, c.nouvelle_valeur);
      if (err) {
        rejected.push({ cible, champ: c.champ, raison: err });
        continue;
      }
      const from = out[c.champ];
      out[c.champ] = c.nouvelle_valeur;
      applied.push({ cible, champ: c.champ, from, to: c.nouvelle_valeur, motif: c.motif });
      continue;
    }

    // ---- ajout dans une liste
    if (cible === "liste") {
      if (!LISTES.has(c?.champ)) {
        rejected.push({ cible, champ: c?.champ, raison: "liste inconnue" });
        continue;
      }
      if (typeof c?.valeur !== "string" || !c.valeur.trim()) {
        rejected.push({ cible, champ: c.champ, raison: "valeur vide" });
        continue;
      }
      const target = c.champ === "hypotheses" ? (out.contexte ??= {}) : out;
      const key = c.champ === "hypotheses" ? "hypotheses" : c.champ;
      if (!Array.isArray(target[key])) target[key] = [];
      target[key].push(c.valeur);
      applied.push({ cible, champ: c.champ, to: c.valeur, motif: c.motif });
      continue;
    }

    rejected.push({ cible, raison: "cible inconnue" });
  }

  if (corrections.length > MAX_CORRECTIONS) {
    rejected.push({
      cible: "(global)",
      raison: `${corrections.length - MAX_CORRECTIONS} correction(s) ignoree(s), plafond de ${MAX_CORRECTIONS}`,
    });
  }

  // ---- postes ajoutes
  for (const add of envelope?.postes_ajoutes ?? []) {
    const p = add?.poste;
    if (!p || typeof p !== "object" || !p.intitule) {
      rejected.push({ cible: "poste_ajoute", raison: "poste incomplet" });
      continue;
    }
    const err = valeurValide("qty", p.qty) ?? valeurValide("prix_unitaire_ht", p.prix_unitaire_ht);
    if (err) {
      rejected.push({ cible: "poste_ajoute", ref: p.ref, raison: err });
      continue;
    }
    let lot = out.lots?.find((l: any) => l.metier === add.metier);
    if (!lot) {
      lot = { metier: add.metier, lot_label: add.metier, postes: [] };
      (out.lots ??= []).push(lot);
    }
    lot.postes.push(p);
    applied.push({ ref: p.ref, cible: "poste_ajoute", champ: add.metier, to: p.intitule, motif: add.motif });
  }

  return { estimation: out, applied, rejected };
}
