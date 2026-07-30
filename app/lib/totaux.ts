// app/lib/totaux.ts
//
// Recalcul integral des totaux. Ce que l'UI affiche vient TOUJOURS d'ici, jamais
// de l'arithmetique du modele : un LLM n'additionne pas 40 lignes de facon fiable.
// Les totaux annonces par le modele sont conserves pour comparaison.

export interface LotTotal {
  metier: string;
  lot_label: string;
  ht: number;
  tva: number;
  ttc: number;
  nbPostes: number;
}

export interface TauxTotal {
  taux: number;
  base_ht: number;
  tva: number;
}

export interface Divergence {
  champ: string;
  llm: number | null;
  recalcule: number;
  ecart_abs: number;
  ecart_pct: number | null;
}

export interface Recompute {
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  ratio_eur_m2: number | null;
  parLot: LotTotal[];
  parTaux: TauxTotal[];
  aleas: { mode: string; montant_ht: number | null } | null;
  divergences: Divergence[];
  plausibilite: string[];
  nbPostes: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Ecart significatif : plus de 0,50 € ET plus de 0,1 %. */
function isDivergent(llm: number, calc: number): boolean {
  const abs = Math.abs(llm - calc);
  if (abs <= 0.5) return false;
  const pct = calc === 0 ? Infinity : (abs / Math.abs(calc)) * 100;
  return pct > 0.1;
}

export function recompute(est: any): Recompute {
  const parLot: LotTotal[] = [];
  const tauxMap = new Map<number, { base: number; tva: number }>();
  const plausibilite: string[] = [];

  let totalHt = 0;
  let totalTva = 0;
  let nbPostes = 0;

  const lots = Array.isArray(est?.lots) ? est.lots : [];

  for (const lot of lots) {
    let lotHt = 0;
    let lotTva = 0;
    let n = 0;
    const postes = Array.isArray(lot?.postes) ? lot.postes : [];

    for (const p of postes) {
      const qty = typeof p?.qty === "number" && Number.isFinite(p.qty) ? p.qty : 0;
      const pu = typeof p?.prix_unitaire_ht === "number" && Number.isFinite(p.prix_unitaire_ht)
        ? p.prix_unitaire_ht
        : 0;
      const taux = [5.5, 10, 20].includes(p?.tva) ? p.tva : 10;

      const ht = qty * pu;
      const tva = ht * (taux / 100);

      lotHt += ht;
      lotTva += tva;
      n++;

      const cur = tauxMap.get(taux) ?? { base: 0, tva: 0 };
      cur.base += ht;
      cur.tva += tva;
      tauxMap.set(taux, cur);

      // Controles de plausibilite bon marche.
      if (qty > 1000) {
        plausibilite.push(`Quantite hors norme : ${p?.intitule ?? "poste"} — ${qty} ${p?.unit ?? ""}`);
      }
      if (pu > 50000) {
        plausibilite.push(`Prix unitaire hors norme : ${p?.intitule ?? "poste"} — ${r2(pu)} € HT`);
      }
      if (qty <= 0) {
        plausibilite.push(`Quantite nulle ou negative (R8) : ${p?.intitule ?? "poste"}`);
      }
    }

    totalHt += lotHt;
    totalTva += lotTva;
    nbPostes += n;

    parLot.push({
      metier: lot?.metier ?? "?",
      lot_label: lot?.lot_label ?? lot?.metier ?? "Lot sans nom",
      ht: r2(lotHt),
      tva: r2(lotTva),
      ttc: r2(lotHt + lotTva),
      nbPostes: n,
    });
  }

  const surface = typeof est?.contexte?.surface_m2 === "number" && est.contexte.surface_m2 > 0
    ? est.contexte.surface_m2
    : null;
  const ratio = surface ? Math.round(totalHt / surface) : null;

  // Aleas : en mode "provision" le montant est HORS total_ht, on ne le somme pas.
  let aleas: Recompute["aleas"] = null;
  const a = est?.totaux?.aleas;
  if (a && typeof a === "object" && a.mode && a.mode !== "aucun") {
    aleas = {
      mode: a.mode,
      montant_ht: typeof a.montant_ht === "number" ? r2(a.montant_ht) : null,
    };
    if (a.mode === "poste" && typeof a.montant_ht === "number" && a.montant_ht > 0) {
      const lotAutre = parLot.find((l) => l.metier === "autre");
      if (!lotAutre) {
        plausibilite.push(
          "Aleas declares en mode 'poste' mais aucun lot 'autre' ne les porte.",
        );
      }
    }
  }

  // Ratios globaux : bornes larges tirees de references/prix.md (200 a 2500 €/m²),
  // elargies pour ne pas crier sur un chantier atypique.
  if (ratio !== null && (ratio < 150 || ratio > 2600)) {
    plausibilite.push(
      `Ratio global ${ratio} €/m² hors des fourchettes de references/prix.md (150-2600).`,
    );
  }

  const parTaux: TauxTotal[] = [...tauxMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([taux, v]) => ({ taux, base_ht: r2(v.base), tva: r2(v.tva) }));

  // Comparaison avec ce qu'a annonce le modele.
  const divergences: Divergence[] = [];
  const llm = est?.totaux ?? {};
  const pairs: Array<[string, number | null, number]> = [
    ["total_ht", typeof llm.total_ht === "number" ? llm.total_ht : null, totalHt],
    ["total_tva", typeof llm.total_tva === "number" ? llm.total_tva : null, totalTva],
    ["total_ttc", typeof llm.total_ttc === "number" ? llm.total_ttc : null, totalHt + totalTva],
  ];
  if (ratio !== null) {
    pairs.push([
      "ratio_eur_m2",
      typeof llm.ratio_eur_m2 === "number" ? llm.ratio_eur_m2 : null,
      ratio,
    ]);
  }
  for (const [champ, v, calc] of pairs) {
    if (v === null || !isDivergent(v, calc)) continue;
    divergences.push({
      champ,
      llm: r2(v),
      recalcule: r2(calc),
      ecart_abs: r2(v - calc),
      ecart_pct: calc === 0 ? null : Math.round(((v - calc) / calc) * 1000) / 10,
    });
  }

  return {
    total_ht: r2(totalHt),
    total_tva: r2(totalTva),
    total_ttc: r2(totalHt + totalTva),
    ratio_eur_m2: ratio,
    parLot,
    parTaux,
    aleas,
    divergences,
    plausibilite,
    nbPostes,
  };
}

/**
 * Ecrase estimation.totaux avec les valeurs recalculees.
 *
 * Les totaux annonces par le modele sont retournes **a cote**, jamais greffes
 * dans l'objet estimation : le schema pose additionalProperties:false, donc une
 * cle totaux_llm ajoutee la ferait echouer la validation de mon propre fait, et
 * la passe P6 perdait son temps a signaler ce champ intrus.
 */
export function applyRecompute(
  est: any,
  rc: Recompute,
): { estimation: any; totaux_llm: any } {
  const out = structuredClone(est);
  const totaux_llm = est?.totaux ?? null;
  out.totaux = {
    total_ht: rc.total_ht,
    total_tva: rc.total_tva,
    total_ttc: rc.total_ttc,
    ratio_eur_m2: rc.ratio_eur_m2 ?? 0,
    ...(est?.totaux?.aleas ? { aleas: est.totaux.aleas } : {}),
  };
  return { estimation: out, totaux_llm };
}
