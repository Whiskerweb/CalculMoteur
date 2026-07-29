# Rédaction des postes

Référence de la passe **P3 — Décomposition en postes**.

---

## Intitulé

Court et actionnable :

- « Fourniture et pose d'un tableau électrique »
- « Dépose et remplacement de la fenêtre du séjour »
- « Réalisation d'une chape de ravoirage »

---

## Description — format imposé

La description distingue un devis professionnel d'une liste de prix.

1. une **phrase d'introduction** terminée par « : » — « Fourniture et pose de… »,
   « Dépose et remplacement de… », « Réalisation de… », « Mise en conformité de… » ;
2. **3 à 5 puces techniques** `- …` couvrant, dans cet ordre quand c'est pertinent :
   matériau / dimension / format · norme ou DTU applicable · étapes de mise en œuvre ·
   dépose et évacuation si nécessaire · essais, réglages et finitions.

### Exemple

```
Fourniture et pose d'un tableau électrique en tête d'installation :
- coffret 3 rangées 13 modules conforme NF C 15-100
- borniers phase / neutre / terre, peignes de raccordement
- pose, câblage et repérage de l'ensemble des circuits
- protections différentielles 30 mA et disjoncteurs divisionnaires
- essais, mise sous tension et remise du schéma de l'installation
```

Dans le JSON de sortie, les puces sont séparées par `\n` dans la chaîne `description`.

---

## Interdits de rédaction

- **Aucune marque ni modèle** sauf si le client les a nommés explicitement. Sinon,
  description générique par caractéristique technique.
- Pas de superlatif commercial, pas d'emoji, pas de promesse de délai.
- Pas de « bancable ». Le délai de **48 h** désigne uniquement la vérification par le maître
  d'œuvre, jamais un délai de travaux.
- Une estimation n'est pas un devis contractuel : elle reste indicative tant qu'un maître
  d'œuvre ne l'a pas vérifiée.
- Jamais de ligne « main d'œuvre » séparée : la pose est incluse dans le prix unitaire.
- Jamais un pack (« salle de bains complète », « logement rénové ») sauf demande explicite
  de forfait par le client.
