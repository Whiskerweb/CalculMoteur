// app/lib/runtime.ts
//
// Couche d'abstraction minimale entre les deux cibles d'execution :
//
//   - local  : Deno, acces disque, edition a chaud du skill
//   - Vercel : runtime Edge, aucun systeme de fichiers, skill embarque
//
// Tout le reste du code (openrouter, prompt, validate) passe par ici et ignore
// sur quelle plateforme il tourne.

import { SKILL_FILES } from "./skill-source";

// deno-lint-ignore no-explicit-any
const g = globalThis as any;

/** Variable d'environnement, quelle que soit la plateforme. */
export function env(name: string): string | undefined {
  try {
    if (g.Deno?.env?.get) return g.Deno.env.get(name);
  } catch { /* permission refusee */ }
  return g.process?.env?.[name];
}

/** Vrai si on peut lire les fichiers du skill sur disque. */
export function hasFileAccess(): boolean {
  return Boolean(g.Deno?.readTextFileSync && g.Deno?.statSync);
}

const ROOT = (() => {
  try {
    return new URL("../../", import.meta.url).pathname;
  } catch {
    return "";
  }
})();

/**
 * Contenu d'un fichier du skill.
 *
 * Le disque est prioritaire quand il est accessible : c'est ce qui permet
 * d'editer une reference et de relancer une estimation sans redemarrer ni
 * regenerer le bundle. Sur Vercel, on retombe sur le contenu embarque.
 */
export function readSkillFile(rel: string): string {
  if (hasFileAccess()) {
    try {
      return g.Deno.readTextFileSync(`${ROOT}${rel}`);
    } catch { /* fichier absent ou permission refusee -> bundle */ }
  }
  const bundled = SKILL_FILES[rel];
  if (bundled === undefined) {
    throw new Error(
      `fichier de skill introuvable : ${rel} (ni sur disque, ni dans le bundle — regenerer avec app/lib/build-source.ts)`,
    );
  }
  return bundled;
}

/**
 * Date de derniere modification, pour invalider le cache de prompt.
 * Retourne 0 quand il n'y a pas de disque : le bundle est fige, donc le cache
 * memoire n'a jamais besoin d'etre invalide sur Vercel.
 */
export function skillFileMtime(rel: string): number {
  if (!hasFileAccess()) return 0;
  try {
    return g.Deno.statSync(`${ROOT}${rel}`).mtime?.getTime() ?? 0;
  } catch {
    return -1;
  }
}
