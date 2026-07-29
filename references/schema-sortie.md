# Format de sortie

Référence de la passe **P7 — Sortie**. Le schéma validable est dans `assets/schema.json`.

En **mode API** : JSON strict, aucun texte autour, aucun bloc de code, aucun commentaire (R14).
En **mode conversationnel** : même JSON dans un bloc de code, précédé d'une synthèse de 3 à
6 lignes (total TTC, ratio €/m², score de confiance, questions bloquantes).

---

## Structure

```json
{
  "contexte": {
    "type_bien": "appartement | maison | local tertiaire",
    "surface_m2": 68,
    "annee_construction": "1949-1992",
    "region": "IDF",
    "occupe": true,
    "hypotheses": [
      "hauteur sous plafond retenue : 2,50 m (non fournie)",
      "surface de murs estimée à S x 2,8 (logement cloisonné)"
    ]
  },
  "lots": [
    {
      "metier": "plomberie",
      "lot_label": "Plomberie - Sanitaire",
      "postes": [
        {
          "ref": "p1",
          "intitule": "Fourniture et pose d'un receveur de douche extra-plat",
          "description": "Fourniture et pose d'un receveur de douche :\n- receveur extra-plat 120 x 90 cm en resine minerale\n- etancheite peripherique SPEC sous carrelage (DTU 52.2)\n- raccordement sur evacuation Ø40 existante\n- essais d'ecoulement et joints silicone sanitaire",
          "qty": 1,
          "unit": "u",
          "qty_rationale": "1 douche prevue dans la salle d'eau",
          "prix_unitaire_ht": 620,
          "tva": 10,
          "source_prix": "catalogue | mediane_moe | estimation",
          "rationale_prix": "ouvrage catalogue correspondant, materiau et unite conformes",
          "confiance": "haute | moyenne | basse"
        }
      ]
    }
  ],
  "totaux": {
    "total_ht": 0,
    "total_tva": 0,
    "total_ttc": 0,
    "ratio_eur_m2": 0,
    "aleas": {
      "mode": "poste | provision | aucun",
      "taux_pct": 10,
      "assiette_ht": 0,
      "montant_ht": 0
    }
  },
  "alertes_regulatoires": [
    "Bati anterieur a 1997 : reperage amiante avant travaux obligatoire",
    "Modification de l'aspect exterieur : declaration prealable en mairie"
  ],
  "dispositifs_aides": [
    "MaPrimeRenov' (geste isolation) - sous conditions de ressources, artisan RGE, demande avant travaux"
  ],
  "questions_bloquantes": [
    "Le tableau electrique est-il aux normes NF C 15-100 ?",
    "Le mur a ouvrir est-il porteur ?"
  ],
  "confiance_globale": 72,
  "confiance_commentaire": "Renseigne uniquement si confiance_globale < 50 : ce qui manque pour remonter le score."
}
```

---

## Règles de calcul des totaux

- `total_ht` = somme de `qty × prix_unitaire_ht` sur tous les postes de tous les lots.
- `total_tva` = somme de `qty × prix_unitaire_ht × tva / 100`, poste par poste — un devis
  mixte porte plusieurs taux, on ne moyenne jamais.
- `total_ttc` = `total_ht + total_tva`.
- `ratio_eur_m2` = `total_ht / contexte.surface_m2`, en HT, arrondi à l'entier.
- Aléas en mode `poste` : le montant est déjà dans `total_ht` (ligne du lot `autre`).
  En mode `provision` : le montant n'est **pas** dans `total_ht`, il est déclaré à part.

---

## Notes sur deux champs ajoutés au schéma d'origine

`totaux.aleas` et `confiance_commentaire` ne figuraient pas dans le schéma initial, alors que
la méthode les impose (provision d'aléas jamais silencieuse ; explicitation en dessous de 50).
Ils ont été ajoutés pour rendre ces deux règles vérifiables par le parseur plutôt que noyées
dans `hypotheses`. Si le moteur Rapido'devis n'accepte pas ces clés, les retirer de
`assets/schema.json` et reporter l'information dans `hypotheses`.
