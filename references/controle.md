# Contrôle qualité

Référence de la passe **P6 — Contrôle**.

Exécute cette checklist **avant** de produire la sortie. Corrige ce qui peut l'être, signale
le reste.

---

## Cohérence globale

- [ ] Ratio €/m² du chantier dans la fourchette du type d'opération (`references/prix.md`)
- [ ] Aucun lot induit manquant (`references/lots.md`)
- [ ] Aucun lot hors du périmètre demandé par le client
- [ ] Un seul lot par `metier`, aucun recouvrement entre lots

## Quantités

- [ ] Chaque quantité est numérique, non nulle, dans son unité canonique
- [ ] Aucune quantité au-delà des bornes de vraisemblance (`references/metres.md`)
- [ ] Aucun `1` par défaut sur un poste en m² ou en ml
- [ ] Chaque quantité a un `qty_rationale` vérifiable
- [ ] Somme des surfaces d'un même type de revêtement ≤ surface disponible

## Doublons

- [ ] Pas de dépose et de repose facturées dans deux lots différents
- [ ] Un seul échafaudage, une seule évacuation, une seule installation de chantier
- [ ] Doublage isolant compté une seule fois (isolation OU plâtrerie)
- [ ] Aucun équipement compté dans deux lots (chauffe-eau, VMC, alimentation)

## Prix

- [ ] Chaque PU est unitaire, HT, fourniture et pose
- [ ] Chaque PU est dans la fourchette repère, ou justifié dans le `rationale_prix`
- [ ] Aucun prix déjà margé n'a été remultiplié par un coefficient de vente
- [ ] L'ouvrage catalogue retenu respecte matériau, action, unité **et** échelle

## TVA et réglementation

- [ ] Chaque taux de TVA est justifiable par la nature de l'ouvrage
- [ ] Aucun 5,5 % sur un ouvrage non éligible
- [ ] Diagnostics amiante / plomb signalés si l'ancienneté les impose
- [ ] Autorisations d'urbanisme signalées si l'aspect extérieur change
- [ ] Aucun montant d'aide chiffré

## Aléas

- [ ] Provision d'aléas déclarée dans `totaux.aleas` (poste dédié ou provision), jamais diluée
      en silence dans les prix unitaires

---

## Score de confiance (0-100)

Départ à 100, retire :

| Situation | Points |
|---|---|
| Surface ou métré principal non fourni (déduit) | −15 |
| Année de construction inconnue | −8 |
| Aucune photo ni visite, description courte (< 200 caractères) | −15 |
| Plus de 30 % des postes chiffrés hors catalogue | −12 |
| Un poste hors fourchette de prix repère | −5 par poste, plafonné à −20 |
| Ratio €/m² global hors fourchette | −15 |
| Incertitude structurelle (mur porteur, charpente, humidité, amiante suspectée) | −20 |
| Périmètre client ambigu ou contradictoire | −10 |

En dessous de **50**, dis-le en clair dans la sortie et liste ce qui manque pour remonter
(champ `confiance_commentaire` du schéma).
