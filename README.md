# CalculMoteur

Skill de chiffrage tous corps d'état (TCE) pour Rapido'devis, et une mini interface locale
qui l'exécute.

Le dépôt contient deux choses :

- **le skill** (`SKILL.md` + `references/` + `assets/schema.json`) — la méthode de chiffrage en
  7 passes, les tables de référence métier et le contrat de sortie JSON ;
- **l'app** (`app/`) — un serveur local qui envoie ce skill à un modèle via OpenRouter et affiche
  le devis produit dans le navigateur.

---

## Le skill

`SKILL.md` porte la méthode (P0 qualification → P7 sortie) et les 14 règles dures. Les tables
lourdes sont dans `references/`, chargées à la demande quand un agent lit le skill :

| Fichier | Contenu |
|---|---|
| `references/lots.md` | Nomenclature des 14 lots, interfaces, tableau des lots induits |
| `references/metres.md` | Formules de métré, coefficients de chute, bornes de vraisemblance |
| `references/prix.md` | Ratios €/m², prix unitaires repères, coefficient de vente, aléas |
| `references/tva-reglementation.md` | TVA 5,5 / 10 / 20, DTU, diagnostics, autorisations, aides |
| `references/redaction.md` | Format imposé des intitulés et descriptions |
| `references/controle.md` | Checklist qualité P6, barème du score de confiance |
| `references/schema-sortie.md` | Schéma commenté, règles de calcul des totaux |
| `assets/schema.json` | JSON Schema draft 2020-12 de la sortie |

Le dossier est symlié dans `~/.claude/skills/calcul-moteur`, donc éditer un fichier ici modifie
le skill actif.

---

## L'app — créateur d'estimation

### Installation

```bash
cp .env.example .env      # puis renseigner OPENROUTER_API_KEY
```

Prérequis : **Deno** (testé sur 2.7.14). Aucune dépendance à installer, aucun bundler.

### Lancement

```bash
deno run --allow-env --allow-net --allow-read --allow-write --env-file=.env app/server.ts
```

Puis ouvrir **http://127.0.0.1:8788/**.

En local, le modèle par défaut est Sonnet 5 : aucune limite de durée ne s'applique.

`--allow-write` ne sert qu'au dump de diagnostic en cas d'échec de parsing (`.debug/`, ignoré par
git). Le serveur tourne sans, mais on perd cette trace.

> **Ce serveur local écoute sur `127.0.0.1`** et n'a ni authentification ni limite de débit. Ne pas
> le rendre accessible depuis un réseau. Pour un accès public, passer par le déploiement Vercel
> ci-dessous, et poser un plafond de crédit sur la clé.

### Déploiement Vercel

Le dépôt est déployable en l'état. Vercel détecte `public/index.html` comme site statique et
`api/*.ts` comme fonctions Edge.

**Une étape manuelle est obligatoire, sinon le site renvoie une erreur à chaque estimation :**

> Dans Vercel → Settings → Environment Variables, ajouter `OPENROUTER_API_KEY` avec la clé,
> pour les trois environnements (Production, Preview, Development), puis redéployer.

`.env` n'est pas versionné, donc Vercel ne peut pas la deviner. `/api/health` répond
`keyPresent: false` tant que ce n'est pas fait.

#### Le skill est embarqué dans le bundle

Le runtime Edge n'a pas de système de fichiers. `app/lib/skill-source.ts` contient donc une copie
du skill, générée et versionnée. **Après toute modification de `SKILL.md`, `references/` ou
`assets/schema.json`, il faut la régénérer** :

```bash
npm run bundle      # ou : deno run --allow-read --allow-write app/lib/build-source.ts
```

Sans ça, le site en ligne continue de servir l'ancienne version du skill alors que le local est à
jour. En local, le disque reste prioritaire, donc l'édition à chaud fonctionne toujours.

#### Modèle par défaut différent en ligne

Une fonction serverless a une durée d'exécution bornée. Sonnet 5 met environ 75 s par estimation,
ce qui dépasse ou frôle la limite selon le plan Vercel. La version déployée démarre donc sur
**Gemini 3.1 Flash Lite** (8 s mesurées). Sonnet reste sélectionnable, avec un avertissement
affiché dans l'interface.

C'est une contrainte de plateforme, pas un choix de qualité : Gemini produit des devis moins
complets (voir le tableau des modèles).

#### Accès libre, et ce que ça implique

Le site est en accès libre, sans mot de passe : c'est un choix assumé. Conséquence directe —
**n'importe qui connaissant l'URL peut déclencher des estimations facturées sur ta clé**, sans
limite.

L'application ne peut pas plafonner la dépense : une fonction Edge n'a pas d'état persistant entre
les appels. La protection doit donc être posée à la source :

> Sur [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys), donner à la clé un
> **plafond de crédit** (par exemple 20 $). Au-delà, OpenRouter refuse les appels et le site
> renvoie une erreur au lieu de continuer à dépenser.

C'est la seule protection réellement efficace ici, et elle prend trente secondes.

### Ce que fait un run

1. Le prompt système est assemblé depuis `SKILL.md` + `references/` + `schema.json`
   (~13 800 tokens), avec un cache revalidé par `mtime` : éditer une référence et relancer suffit,
   pas besoin de redémarrer.
2. Le brief client et le contexte P0 partent en message utilisateur. Les champs laissés vides sont
   signalés comme non fournis, pour que le skill les traite en hypothèse ou en question bloquante.
3. Un appel OpenRouter produit le devis en JSON.
4. Le serveur extrait, normalise, valide contre le schéma, **et recalcule tous les totaux**.
5. Passe P6 facultative : un second appel relit le devis et propose des corrections ciblées, que
   le serveur applique mécaniquement avec des garde-fous.

### Modèles

Sélectionnables dans l'interface. Tarifs relevés le 2026-07-29, en $/M tokens.

| Modèle | In | Out | Vision | Coût mesuré |
|---|---|---|---|---|
| `anthropic/claude-sonnet-5` *(défaut)* | 2,00 | 10,00 | oui | **0,11 $** |
| `x-ai/grok-4.20` | 1,25 | 2,50 | oui | ~0,03 $ |
| `openai/gpt-5-mini` | 0,25 | 2,00 | oui | ~0,02 $ |
| `google/gemini-3.1-flash-lite` | 0,25 | 1,50 | oui | ~0,01 $ |
| `deepseek/deepseek-v4-pro` | 0,43 | 0,87 | non | ~0,01 $ |

DeepSeek est le seul sans vision : les photos passent alors par une pré-passe sur
`qwen/qwen3-vl-30b-a3b-instruct`. Sur les autres, elles sont envoyées directement au modèle
principal, qui les voit pendant qu'il chiffre.

---

## Deux garde-fous qui ont déjà servi

### Les totaux ne viennent jamais du modèle

Un LLM n'additionne pas 40 lignes de façon fiable. Sur le premier run réussi, Sonnet 5 annonçait
**10 508 € HT** alors que la somme de ses propres lignes faisait **13 820 €** — 24 % d'écart. Les
valeurs affichées sont toujours celles recalculées en JS ; celles du modèle sont conservées dans
`totaux_llm` et l'écart est affiché.

La TVA est recalculée poste par poste au taux du poste, jamais par un taux moyen : un devis de
rénovation porte légitimement plusieurs taux.

### Le raisonnement étendu est coupé

Mesuré le 2026-07-29 : avec le raisonnement actif, Sonnet 5 a consommé **48 000 tokens de sortie
en renvoyant un contenu vide**, `finish_reason: length`, pour 0,61 $. Tout le budget partait en
réflexion avant d'écrire quoi que ce soit, et la boucle de continuation relançait sur du vide.

Deux correctifs : `reasoning: {enabled: false}` sur tous les presets, et arrêt immédiat de la
continuation si un appel ne produit aucun contenu. Le skill *est* déjà une procédure de
raisonnement explicite en 7 passes — la refaire en amont ne produit rien d'exploitable.

---

## Endpoints

| Méthode | Chemin | Rôle |
|---|---|---|
| `GET` | `/` | l'interface |
| `GET` | `/api/models` | presets et tarifs — **jamais la clé** |
| `GET` | `/api/health` | fichiers du skill chargés, taille, présence de la clé (booléen) |
| `POST` | `/api/estimate` | flux SSE d'une estimation |

Vérification rapide que tout est en place :

```bash
curl -s http://127.0.0.1:8788/api/health | python3 -m json.tool
```

---

## Limites connues

- **Aucun catalogue de prix.** Les prix viennent des fourchettes de `references/prix.md`. Ils sont
  plausibles, pas exacts. Un en-tête injecté force `source_prix: "estimation"` et neutralise la
  pénalité de confiance « postes hors catalogue » du barème, qui sinon tomberait à chaque run.
- **Le ratio €/m² est trompeur sur un chantier mono-pièce.** Le modèle renseigne
  `contexte.surface_m2` avec la surface *traitée* (5 m² pour une salle de bains), pas la surface du
  logement. Le ratio sort alors mécaniquement hors des fourchettes de `prix.md`, qui sont calibrées
  pour des opérations à l'échelle du logement. Le contrôle de plausibilité le signale ; ce n'est
  pas une erreur de calcul.
- **Le schéma ne sait pas exprimer un refus.** `lots` et `postes` portent `minItems: 1`, et `qty`
  comme `prix_unitaire_ht` sont en `exclusiveMinimum: 0`. Sur un brief hors périmètre (« chiffre un
  pont »), le modèle refuse correctement dans `hypotheses` et `questions_bloquantes`, mais doit
  fabriquer un poste factice à 0,01 € pour satisfaire le contrat. À corriger côté schéma si le refus
  doit être exploitable en aval — par exemple un champ `hors_perimetre: true` avec `lots` autorisé
  à être vide dans ce cas.
- **Sortie JSON invalide occasionnelle.** Observé une fois sur trois runs. L'échelle d'extraction
  (direct → bloc de code → découpe équilibrée → réparation de troncature) rattrape la plupart des
  cas ; quand elle échoue, la sortie brute est écrite dans `.debug/last-failed-raw.txt`.
- **Une estimation prend 60 à 80 secondes** sur Sonnet 5, doublé avec la passe P6. Pas de file
  d'attente, pas de bouton d'annulation : fermer l'onglet abandonne un appel déjà facturé.
- **Pas de tests automatisés.** La validation systématique contre le schéma à chaque run en tient
  partiellement lieu, et sert de test de non-régression du skill lui-même.

---

## Sécurité de la clé

`.env` est dans `.gitignore` dès la première ligne. La clé ne quitte jamais le serveur : le
navigateur ne la reçoit pas, `/api/models` ne renvoie que des identifiants et des tarifs,
`/api/health` ne renvoie qu'un booléen.

Si une clé a fui — collée dans un chat, un ticket, une capture — la révoquer sur
[openrouter.ai/keys](https://openrouter.ai/keys) et en générer une neuve. Une clé exposée reste
exposée.
