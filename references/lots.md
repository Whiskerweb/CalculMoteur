# Nomenclature des lots TCE

Référence de la passe **P2 — Partition en lots**.

Valeurs autorisées pour `metier` (référentiel Rapido'devis) :

`demolition` · `assainissement` · `toiture` · `isolation_ext` · `menuiserie` ·
`isolation_int` · `platrerie` · `electricite` · `plomberie` · `chauffage` · `ventilation` ·
`carrelage` · `peinture` · `autre`

---

## Périmètre de chaque lot

**demolition** — Dépose d'ouvrages non conservés, démolition de cloisons non porteuses,
curage, tri et évacuation en déchetterie agréée, protection des existants.
*Exclut* : la dépose d'un ouvrage remplacé par le même corps d'état (une fenêtre
déposée-remplacée est dans `menuiserie`). Une ouverture dans un mur **porteur** relève d'un
poste dédié avec étude structure, pas de la démolition courante.

**assainissement** — Raccordement au réseau public, fosse septique ou micro-station,
drainage, regards, tranchées, évacuation des eaux pluviales enterrées.
*Interface* : s'arrête au nu extérieur du bâtiment ; à l'intérieur c'est `plomberie`.

**toiture** — Charpente, couverture (tuile, ardoise, zinc, bac acier), écran sous-toiture,
chéneaux, gouttières, descentes, solins, faîtage, fenêtres de toit (pose et habillage
extérieur), échafaudage de couverture.
*Interface* : l'isolation des combles est dans `isolation_int`, sauf sarking qui reste ici.

**isolation_ext** — Nettoyage et préparation de façade, isolant et fixations, sous-enduit
armé, enduit de finition ou bardage, points singuliers (appuis, tableaux, acrotères,
couvertines), échafaudage de façade.
*Interface* : le remplacement des menuiseries se coordonne avec l'ITE (épaisseur au tableau)
mais reste dans `menuiserie`.

**menuiserie** — Fenêtres, portes-fenêtres, portes d'entrée, volets, stores, portes de garage,
portes intérieures, placards, escaliers. Inclut la dépose de l'ancienne menuiserie et le
calfeutrement.
*Interface* : habillage des tableaux en plâtre → `platrerie` ; peinture → `peinture` ;
parquet → `carrelage` sauf pose par le menuisier.

**isolation_int** — Isolation des murs par l'intérieur (ossature, isolant, parement),
combles perdus (soufflage), combles aménagés (rampants), plancher bas (sous-face, vide
sanitaire), pare-vapeur.
*Interface* : quand isolation et doublage sont indissociables, garde l'ensemble ici et ne
redouble pas un poste équivalent en `platrerie`.

**platrerie** — Cloisons sèches, doublages, faux-plafonds, trappes, bandes et enduits,
coffrages de descentes, habillages de gaines, ragréage de plafond.

**electricite** — Tableau et protections, distribution, prises, points lumineux,
interrupteurs, appareillage, VDI, alarme, interphone, mise à la terre, mise en conformité
NF C 15-100.
*Interface* : l'alimentation d'une PAC, d'un ballon ou d'une VMC est ici ; l'appareil
lui-même est dans `chauffage` / `plomberie` / `ventilation`.

**plomberie** — Alimentation EF/ECS, évacuations EU/EV intérieures, appareils sanitaires,
robinetterie, ballon d'eau chaude, adoucisseur, siphons de sol.
*Interface* : un chauffe-eau thermodynamique va soit en `chauffage` soit en `plomberie` —
choisis-en **un** et ne le compte pas deux fois.

**chauffage** — Chaudière, PAC air/eau et air/air, poêle, insert, radiateurs, plancher
chauffant, sèche-serviettes, réseau hydraulique, régulation, thermostat, mise en service.
*Interface* : sortie de conduit en toiture → `toiture` ; tubage → `chauffage`.

**ventilation** — VMC simple ou double flux, extracteurs, réseaux de gaines, bouches,
entrées d'air, sorties en toiture ou façade, équilibrage.

**carrelage** — Chape et ragréage, carrelage sol et mur, faïence, plinthes, sols souples
(PVC, lino), parquet flottant et collé, moquette, étanchéité sous carrelage en pièce humide
(SPEC/SEL), joints et profilés.

**peinture** — Préparation des supports (rebouchage, ponçage, enduit de lissage), impression,
peinture murs, plafonds et boiseries, papier peint, laque sur menuiseries, protection des
sols, nettoyage de fin de chantier.

**autre** — Résiduel non affectable : installation de chantier, échafaudage mutualisé entre
plusieurs lots, maîtrise d'œuvre, bureau d'études, diagnostics.

---

## Ordre d'intervention (contrôle de cohérence, pas un planning)

Démolition et curage → structure et charpente → couverture et clos → menuiseries extérieures
→ réseaux encastrés (électricité, plomberie, ventilation) → isolation et plâtrerie → chapes
→ carrelage et sols durs → peinture → sols souples et parquet → appareillage et finitions →
mise en service.

Sert de test : un poste de peinture chiffré alors qu'aucun support n'est créé ni repris, ou
un carrelage sans chape ni ragréage sur dalle brute, révèle un devis incomplet.

---

## Lots induits — réflexe obligatoire

| Le client demande | Lots induits à vérifier |
|---|---|
| Rénovation de salle de bains | plomberie, carrelage, electricite (protection + circuits), ventilation, platrerie, peinture, demolition |
| Rénovation de cuisine | plomberie, electricite (circuits spécialisés), carrelage, peinture, menuiserie, ventilation |
| Remplacement de fenêtres | menuiserie, platrerie (tableaux), peinture (finitions), ventilation (entrées d'air si VMC hygro) |
| ITE / ravalement | isolation_ext, toiture (débords, gouttières), menuiserie (appuis, tableaux), electricite (dépose et repose des équipements de façade) |
| Isolation de combles | isolation_int, electricite (rehausse de boîtiers, protection des spots), ventilation (débouché VMC) |
| PAC air/eau | chauffage, electricite (alimentation dédiée), plomberie (réseau), demolition (dépose ancienne chaudière et cuve) |
| Aménagement de combles | toiture, isolation_int, platrerie, menuiserie (fenêtres de toit, escalier), electricite, chauffage, carrelage, peinture |
| Rénovation complète | tous les lots ci-dessus + demolition + `autre` (installation de chantier, nettoyage) |

---

## Pièges de partition

- **Doublon dépose / pose** : jamais un lot « Dépose des X » et un lot « Pose des X ».
- **Doublon isolation / plâtrerie** : un doublage isolant compté dans les deux lots gonfle le
  périmètre concerné de 20 à 30 %.
- **Doublon échafaudage** : un seul poste pour toute la façade, même si `toiture` et
  `isolation_ext` l'utilisent tous les deux.
- **Doublon évacuation** : un forfait par chantier, pas un par lot, sauf volumes réellement
  distincts (gravats lourds vs déchets de second œuvre).
- **Surface comptée deux fois** : le ragréage et le carrelage partagent la même surface, c'est
  normal ; deux revêtements de sol différents sur la même pièce ne l'est pas.
