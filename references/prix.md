# Ordres de grandeur de prix, structure du prix et ajustements

Référence de la passe **P5 — Prix**.

**Prix de vente HT, fourniture et pose, entreprise, France métropolitaine hors Île-de-France,
calage mi-2026.** Ce sont des **garde-fous**, pas un bordereau : le catalogue prime quand il
répond. Utilise-les pour estimer un poste sans prix catalogue, et pour détecter un prix
catalogue aberrant.

---

## Hiérarchie des sources de prix

1. **Catalogue de prix** (BatiChiffrage / bibliothèque) si un ouvrage correspond **vraiment** :
   matériau, action (dépose ≠ pose ≠ mise en service), unité et échelle doivent tous coller.
   Un ouvrage « approchant » qui ne respecte pas ces quatre critères est un mauvais prix.
2. **Médiane des prix validés par un MOE** sur la région, si l'échantillon est suffisant.
3. **Estimation raisonnée** à partir des ordres de grandeur ci-dessous, ajustée par la
   structure de coût plus bas.

Le prix rendu est toujours un **PU de vente HT unitaire** : jamais un total, jamais un
déboursé sec destiné à être re-multiplié par un coefficient.

---

## Ratios globaux €/m² (surface habitable traitée)

| Type d'opération | €/m² HT |
|---|---|
| Rafraîchissement (peinture + sols) | 200 à 400 |
| Rénovation partielle (une pièce d'eau ou cuisine + peintures) | 400 à 700 |
| Rénovation complète de second œuvre | 800 à 1 400 |
| Rénovation lourde (réseaux, cloisonnement, menuiseries, structure) | 1 300 à 2 200 |
| Rénovation énergétique globale, en sus | 500 à 900 |
| Aménagement de combles | 900 à 1 600 |
| Extension maçonnée | 1 600 à 2 500 |

Forfaits pièce : salle de bains complète 4 à 6 m² → 8 000 à 16 000 € HT ·
cuisine hors mobilier → 6 000 à 12 000 € HT.

---

## Prix unitaires repères

**Démolition**
Dépose cloison plâtre 15-30 €/m² · démolition cloison brique ou parpaing 30-60 €/m² ·
dépose carrelage + chape 25-45 €/m² · benne 8 m³ évacuée 350-700 € · protection des existants
5-12 €/m².

**Plâtrerie / isolation intérieure**
Cloison 72/48 double parement 45-75 €/m² · doublage ossature + laine 100 mm 45-80 €/m² ·
faux-plafond BA13 45-80 €/m² · enduit de lissage 12-25 €/m² · ITI complète (ossature +
isolant + BA13 + bandes) 70-110 €/m² · combles perdus soufflés 20-40 €/m² · rampants isolés
50-90 €/m² · plancher bas en sous-face 35-60 €/m².

**Isolation extérieure / façade**
ITE PSE + enduit mince 130-200 €/m² · ITE laine de roche + bardage 180-280 €/m² ·
ravalement simple avec enduit 60-110 €/m² · échafaudage de façade 12-25 €/m².

**Peinture**
Murs 2 couches 25-40 €/m² · plafond 28-45 €/m² · boiserie ou porte 90-180 €/u ·
papier peint 30-50 €/m².

**Carrelage et sols**
Ragréage 15-30 €/m² · chape 25-50 €/m² · carrelage sol 60×60 60-110 €/m² · faïence
70-120 €/m² · parquet flottant 45-80 €/m² · parquet contrecollé collé 80-140 €/m² ·
sol PVC 35-65 €/m² · plinthes 12-25 €/ml · étanchéité SPEC sous carrelage 25-45 €/m².

**Menuiserie**
Fenêtre PVC 2 vantaux double vitrage 700-1 200 €/u · alu 1 100-1 900 €/u · bois
1 200-2 000 €/u · porte-fenêtre PVC 1 100-1 800 €/u · porte d'entrée 1 500-3 500 €/u ·
volet roulant électrique 700-1 400 €/u · porte intérieure 350-700 €/u · fenêtre de toit
posée 1 200-2 200 €/u.

**Électricité**
Tableau 3 rangées 900-1 800 €/u · point lumineux ou prise 90-160 €/u · rénovation électrique
complète 100-180 €/m² · mise en sécurité seule 60-100 €/m².

**Plomberie / sanitaire**
Alimentation + évacuation par appareil 250-500 €/u · WC suspendu avec bâti 700-1 300 €/u ·
WC posé 350-600 €/u · vasque + meuble 500-1 200 €/u · receveur extra-plat + paroi
900-1 800 €/u · baignoire 700-1 400 €/u · douche à l'italienne complète 2 500-5 000 €/ens ·
ballon ECS 200 L 900-1 600 €/u · chauffe-eau thermodynamique 2 800-4 500 €/u.

**Chauffage**
Radiateur eau 450-900 €/u · sèche-serviettes électrique 350-700 €/u · radiateur électrique à
inertie 400-800 €/u · chaudière gaz à condensation 4 500-7 000 €/u · PAC air/eau 8 kW
installée 12 000-18 000 €/u · poêle à granulés 4 000-7 000 €/u · plancher chauffant
hydraulique 90-140 €/m².

**Ventilation**
VMC simple flux hygro B 900-1 800 €/u · VMC double flux 4 500-8 000 €/u · extracteur de salle
d'eau 200-400 €/u.

**Toiture**
Couverture tuile (dépose + pose, hors charpente) 90-160 €/m² · ardoise 150-250 €/m² ·
zinguerie gouttière 45-90 €/ml · écran sous-toiture 12-25 €/m².

**Assainissement**
Micro-station 5 EH 8 000-13 000 € · raccordement au tout-à-l'égout 3 000-8 000 €.

---

## Test de plausibilité

Un PU hors fourchette n'est pas forcément faux, mais il exige une justification dans le
`rationale_prix`. Un PU **hors fourchette d'un facteur ≥ 3** est presque toujours l'un de ces
trois cas : mauvaise unité (m² vs u), mauvaise échelle (ouvrage collectif au lieu
d'individuel), ou total confondu avec un unitaire. Corrige plutôt que de publier.

---

## De l'ouvrage au prix de vente

`Déboursé sec (fourniture + main d'œuvre) × coefficient de vente = prix de vente HT`

Le coefficient de vente couvre frais de chantier, frais généraux, aléas et marge. Fourchette
courante du bâtiment français : **1,25 à 1,55**, selon la part de main d'œuvre du lot et la
structure de l'entreprise.

Attention : la plupart des prix de catalogue sont déjà des prix de vente ou des prix de
revient légèrement margés. **Ne remultiplie jamais un prix déjà en vente.** En cas de doute
sur la nature d'un prix source, dis-le dans le `rationale_prix`.

Taux horaire de main d'œuvre vendu, ordre de grandeur 2026 : 45 à 65 €/h HT selon le corps
d'état et la région.

---

## Ajustements de contexte

| Facteur | Effet sur le prix |
|---|---|
| Île-de-France | +10 à +20 % |
| Grandes métropoles, littoral, zones tendues | +5 à +12 % |
| Zones rurales, Centre, Grand Ouest | −5 à −10 % |
| Petit chantier (< 5 000 € HT) | +15 à +25 % (déplacements, installation non amortie) |
| Logement occupé pendant les travaux | +5 à +15 % (protections, phasage, remise en ordre) |
| Étage ≥ 3 sans ascenseur | +5 à +15 % sur les lots à forte manutention |
| Accès difficile, centre-ville, stationnement contraint | +5 à +10 % |
| Bâti avant 1949 (supports irréguliers, reprises) | +10 à +20 % sur les lots de finition |
| Copropriété (contraintes horaires, parties communes) | +5 à +10 % |
| Chantier > 100 000 € HT | −5 à −10 % (effet volume) |

N'applique jamais deux fois le même ajustement (par exemple un coefficient régional déjà
présent dans le prix catalogue).

---

## Aléas

Provision d'aléas raisonnable en rénovation : **5 à 10 %** en bâti récent et bien connu,
**10 à 15 %** en bâti ancien ou en présence d'inconnues structurelles.

Elle apparaît explicitement, jamais diluée en silence dans les prix unitaires. Deux formes
admises, à renseigner dans `totaux.aleas` du schéma de sortie :

- un **poste dédié** dans le lot `autre` (`unit: "forfait"`), quand le client accepte une
  ligne visible ;
- une **provision déclarée** dans `totaux.aleas` avec son taux et son assiette, sans ligne
  de devis.

Dans les deux cas, `totaux.aleas.taux_pct` et `totaux.aleas.mode` sont renseignés.
