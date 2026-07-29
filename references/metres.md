# Métrés et ratios quantitatifs

Référence des passes **P1 — Métrés** et **P4 — Quantitatif**.

Le métré est le **premier vecteur d'erreur**, loin devant le prix unitaire. Une quantité
fausse d'un facteur 3 est invisible dans une ligne et détruit le total.

---

## Métrés de base

| Métré | Formule | Défaut si non fourni |
|---|---|---|
| Surface au sol `S` | donnée projet | surface habitable déclarée |
| Hauteur sous plafond `H` | donnée | 2,50 m courant · 2,70 m avant 1949 · 2,30 m sous combles |
| Périmètre d'une pièce `P` | `4 × √S` si approximativement carrée | — |
| Surface de murs d'une pièce | `P × H × 0,85` | le 0,85 déduit forfaitairement portes et fenêtres |
| Surface de murs d'un logement | `S × 2,5` à `S × 3,0` | logement cloisonné courant — à déclarer en hypothèse |
| Surface de plafond | `S` | — |

---

## Dimensions de référence

Faïence salle d'eau : 1,20 m (mi-hauteur) · 2,00 m (hauteur douche) · 2,50 m (toute hauteur).
Crédence de cuisine : 0,60 m sur le linéaire de meubles.
Plinthes : périmètre au sol moins ~0,80 m par passage de porte.
Fenêtre standard : 1 vantail 0,60 × 1,00 m · 2 vantaux 1,20 × 1,20 m.
Porte intérieure : 0,83 × 2,04 m · porte d'entrée : 0,90 × 2,15 m.
Douche : receveur 90 × 90 ou 120 × 90 · baignoire 170 × 70.

---

## Coefficients de chute et de perte

À appliquer sur la quantité **posée** pour obtenir la quantité **commandée**. La plupart des
prix catalogue les intègrent déjà : ne les applique pas deux fois.

| Ouvrage | Coefficient |
|---|---|
| Carrelage droit grand format | 1,05 |
| Carrelage en diagonale, petit format, pièce complexe | 1,10 à 1,15 |
| Parquet flottant | 1,07 |
| Isolant en panneaux | 1,05 |
| Isolant en rouleau ou soufflé | 1,10 |
| Pare-vapeur (recouvrements) | 1,10 |
| Plaques de plâtre | 1,08 |
| Canalisations et gaines | 1,10 |
| Peinture | 1,00 — la perte est dans le rendement, pas dans la chute |

---

## Ratios par lot

**Peinture** — 2 couches sur mur préparé ≈ 0,25 L/m², rendement 10 à 12 m²/L par couche.
Ratio surface peinte / surface au sol d'un logement : **2,8 à 3,5**. Un rebouchage ponctuel
sur plus de 30 % de la surface n'en est plus un : c'est un enduit de lissage complet, poste
distinct au m².

**Plâtrerie** — 1 m² de cloison 72/48 = 2 m² de plaque (deux parements). Ossature : 1 rail/ml
au sol et au plafond, montants tous les 0,60 m. Bande à joints ≈ 3 ml par m² de plaque.

**Isolation** — ITI : ossature = surface nette, isolant = surface × 1,05, parement = surface
nette. Combles perdus soufflés : surface de **plancher**, pas de rampant. Rampants : surface
au sol × 1,15 à 1,30 selon pente. ITE : périmètre extérieur × hauteur, ouvertures déduites
seulement si elles dépassent 15 % (usage professionnel : plein pour vide en deçà).

**Électricité** — ~1 prise pour 4 m², minimum 3 par pièce de vie, 6 au séjour, 6 en cuisine
dont 4 sur plan de travail (NF C 15-100). 1 point lumineux par pièce, 2 au-delà de 15 m².
Cuisine : 4 circuits spécialisés (plaque, four, lave-vaisselle, lave-linge). Tableau : une
rangée de 13 modules par tranche de ~40 m², 20 % de réserve obligatoire.

**Plomberie** — 4 à 6 ml de PER par appareil sanitaire (EF + ECS depuis nourrice).
Évacuations : Ø40 lavabo/douche/machine, Ø50 évier, Ø100 WC. Pente horizontale 1 à 3 cm/m
(contrainte de faisabilité, à signaler si non tenable).

**Chauffage** — Émetteurs : ~100 W/m² en bâti ancien non isolé, ~60 W/m² après isolation,
~40 W/m² en construction récente. PAC air/eau maison individuelle : 6 à 12 kW pour 80 à
140 m² selon isolation. Un dimensionnement hors de ces plages se signale, ne se chiffre pas.

**Carrelage** — Sol : surface nette de la pièce. Faïence : linéaire de mur concerné × hauteur
retenue. Plinthes : périmètre moins les passages. Chape ou ragréage : même surface que le
revêtement, en poste distinct.

**Menuiserie** — Ouvrants comptés **à l'unité**, jamais au m² sauf grande baie sur mesure.
Habillage de tableau : 4 à 5 ml par fenêtre standard. Appui, seuil, rejingot : 1 u par ouvrant.

**Démolition et évacuation** — Gravats : cloison plâtre ~25 kg/m² · cloison brique ~90 kg/m² ·
carrelage + chape ~60 kg/m². Une benne de 8 m³ absorbe ~40 à 60 m² de cloisons légères.
Étage sans ascenseur au-delà du 2ᵉ : majoration de main d'œuvre, **pas** une quantité
supplémentaire.

---

## Bornes de vraisemblance

Aucune quantité ne franchit ces bornes sans justification explicite :

- Surface d'un poste ≤ surface au sol du bien — sauf murs, plafonds, rampants et ITE
- Surface de murs ≤ `S × 4`
- Nombre d'appareils sanitaires ≤ 2 × nombre de pièces d'eau déclarées
- Linéaire de réseau ≤ `P × 3`
- Poste unitaire sur ouvrage unique (tableau, ballon, PAC, receveur) : quantité = 1, sauf
  mention explicite de plusieurs occurrences

Une quantité hors borne est soit une erreur d'unité, soit un doublon inter-lots. Dans les
deux cas : corrige **et** signale.

---

## Unités canoniques

| Unité | Emploi |
|---|---|
| `m2` | surfaces |
| `ml` | linéaires |
| `u` | appareils et ouvrants |
| `ens` | ensemble indissociable |
| `forfait` | installation, évacuation, nettoyage |
| `h` | interventions ponctuelles uniquement |

Une seule unité par poste (R9). Ne mets jamais `1` par défaut sur un poste en `m2` ou en `ml`.
