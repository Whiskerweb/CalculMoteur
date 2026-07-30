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

/**
 * Ecrit une trace de diagnostic dans .debug/ et retourne son chemin.
 * No-op silencieux quand il n'y a pas de disque, c'est-a-dire sur Vercel.
 *
 * Centralise ici pour la meme raison que ROOT : aucun appel a
 * `new URL(litteral, import.meta.url)` ne doit subsister dans le graphe
 * d'imports des fonctions Edge, sous peine de faire echouer le deploiement.
 */
export function writeDebugDump(name: string, content: string): string | null {
  if (!hasFileAccess() || !ROOT) return null;
  try {
    const dir = `${ROOT}.debug/`;
    g.Deno.mkdirSync(dir, { recursive: true });
    const path = `${dir}${name}`;
    g.Deno.writeTextFileSync(path, content);
    return path;
  } catch {
    return null;
  }
}

/**
 * Racine du depot, deduite de l'URL de ce module.
 *
 * Volontairement calculee par manipulation de chaine, et NON par
 * `new URL("../../", import.meta.url)` : le bundler de Vercel analyse
 * statiquement ce motif et le prend pour une reference d'asset a embarquer
 * (`vc-blob-asset:../../`), ce qui fait echouer le deploiement de la fonction
 * Edge. Ici on ne fait que du texte, rien a analyser.
 *
 * Retourne "" hors contexte fichier (Edge), ou le repli bundle prend le relais.
 */
const ROOT = (() => {
  try {
    const u = import.meta.url;
    if (!u.startsWith("file://")) return "";
    const marker = "/app/lib/";
    const i = u.lastIndexOf(marker);
    if (i === -1) return "";
    return decodeURIComponent(u.slice("file://".length, i + 1));
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
