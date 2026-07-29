// app/lib/extract.ts
//
// Extraction du JSON dans une reponse LLM sale. Echelle a 4 barreaux, chaque
// barreau franchi est journalise pour que l'UI puisse afficher a quel point la
// sortie du modele etait propre.

export interface ExtractResult {
  ok: boolean;
  value?: any;
  method: "direct" | "fence" | "slice" | "repair" | "echec";
  repairs: string[];
  error?: string;
}

/**
 * Trouve l'objet JSON equilibre a partir du premier '{'.
 * Un indexOf('{') + lastIndexOf('}') naif casse des qu'une accolade apparait
 * dans une description — ce qui arrive, les descriptions citent des formats.
 */
function sliceBalanced(s: string): string | null {
  const start = s.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;

  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === "\\") {
      if (inStr) esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Sortie tronquee : on rembobine jusqu'au dernier element de tableau complet,
 * on jette l'element incomplet et on referme les niveaux ouverts.
 */
function closeTruncated(s: string): { text: string; dropped: number } {
  const start = s.indexOf("{");
  if (start === -1) return { text: s, dropped: 0 };

  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  // Dernier offset ou la pile etait "propre" (fin d'un element de tableau)
  let lastSafe = -1;
  let dropped = 0;

  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === "\\") {
      if (inStr) esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;

    if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") {
      stack.pop();
      // Un objet ferme a l'interieur d'un tableau = point de reprise sur.
      if (c === "}" && stack[stack.length - 1] === "[") lastSafe = i;
    }
  }

  if (!stack.length) return { text: s.slice(start), dropped: 0 };

  let body: string;
  if (lastSafe > 0) {
    body = s.slice(start, lastSafe + 1);
    dropped = 1;
  } else {
    // Rien de recuperable dans un tableau : on coupe a la derniere virgule saine.
    const cut = s.lastIndexOf(",");
    body = cut > start ? s.slice(start, cut) : s.slice(start);
  }

  // Recalcule la pile sur le corps retenu, puis referme.
  const stack2: string[] = [];
  let inStr2 = false;
  let esc2 = false;
  for (const c of body) {
    if (esc2) {
      esc2 = false;
      continue;
    }
    if (c === "\\") {
      if (inStr2) esc2 = true;
      continue;
    }
    if (c === '"') {
      inStr2 = !inStr2;
      continue;
    }
    if (inStr2) continue;
    if (c === "{" || c === "[") stack2.push(c);
    else if (c === "}" || c === "]") stack2.pop();
  }
  if (inStr2) body += '"';
  const closers = stack2.reverse().map((c) => (c === "{" ? "}" : "]")).join("");
  return { text: body + closers, dropped };
}

function tryParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function extractJson(raw: string, truncated = false): ExtractResult {
  const repairs: string[] = [];
  const text = (raw ?? "").trim();

  if (!text) {
    return {
      ok: false,
      method: "echec",
      repairs,
      error: "reponse vide du modele",
    };
  }

  // 1. Direct
  const direct = tryParse(text);
  if (direct && typeof direct === "object") {
    return { ok: true, value: direct, method: "direct", repairs };
  }

  // 2. Bloc de code. On prend le PLUS GRAND : redaction.md contient un exemple
  //    fence que le modele recopie parfois avant le vrai payload.
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)]
    .map((m) => m[1].trim())
    .sort((a, b) => b.length - a.length);
  for (const f of fences) {
    const v = tryParse(f);
    if (v && typeof v === "object") {
      repairs.push("JSON extrait d'un bloc de code markdown");
      return { ok: true, value: v, method: "fence", repairs };
    }
  }

  // 3. Decoupe equilibree
  const sliced = sliceBalanced(text);
  if (sliced) {
    const v = tryParse(sliced);
    if (v && typeof v === "object") {
      repairs.push("prose retiree autour du JSON");
      return { ok: true, value: v, method: "slice", repairs };
    }
  }

  // 4. Reparation de troncature
  const { text: closed, dropped } = closeTruncated(text);
  const v = tryParse(closed);
  if (v && typeof v === "object") {
    repairs.push(
      truncated
        ? `sortie tronquee par le modele, ${dropped} poste incomplet supprime, structure refermee`
        : `JSON malforme repare, ${dropped} element incomplet supprime`,
    );
    return { ok: true, value: v, method: "repair", repairs };
  }

  return {
    ok: false,
    method: "echec",
    repairs,
    error: truncated
      ? "sortie tronquee et irrecuperable — relancer avec un budget de tokens superieur"
      : "aucun objet JSON exploitable dans la reponse",
  };
}
