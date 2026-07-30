// app/lib/build-source.ts
//
// Regenere app/lib/skill-source.ts depuis les fichiers du skill.
// A relancer apres toute modification de SKILL.md, references/* ou schema.json :
//
//   deno run --allow-read --allow-write app/lib/build-source.ts
//
// Sur Vercel (runtime Edge) il n'y a pas de systeme de fichiers : le skill doit
// etre embarque dans le bundle JavaScript. En local, prompt.ts prefere le
// disque quand il y a acces, ce qui preserve l'edition a chaud.

import { SKILL_FILE_ORDER } from "./skill-files.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const OUT = new URL("./skill-source.ts", import.meta.url).pathname;

const header = `// app/lib/skill-source.ts
//
// FICHIER GENERE — ne pas editer a la main.
// Regenerer apres toute modification du skill :
//   deno run --allow-read --allow-write app/lib/build-source.ts
//
// Raison d'etre : sur Vercel (runtime Edge) il n'y a pas de systeme de
// fichiers. Le contenu du skill doit donc etre embarque dans le bundle.
// En local, prompt.ts relit les fichiers du disque quand il y a acces, ce
// qui preserve l'edition a chaud du skill.

export const SKILL_FILES: Record<string, string> = {
`;

const lines: string[] = [];
let total = 0;
for (const f of SKILL_FILE_ORDER) {
  const body = Deno.readTextFileSync(`${ROOT}${f}`);
  total += body.length;
  lines.push(`  ${JSON.stringify(f)}: ${JSON.stringify(body)},`);
}

Deno.writeTextFileSync(OUT, `${header}${lines.join("\n")}\n};\n`);
console.log(
  `skill-source.ts regenere : ${SKILL_FILE_ORDER.length} fichiers, ${total} caracteres de skill`,
);
