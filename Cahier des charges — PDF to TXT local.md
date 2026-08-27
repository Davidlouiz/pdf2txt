# Cahier des charges — PDF to TXT local

## 1. Objet du projet

Développer une application web locale permettant de déposer un grand nombre de fichiers PDF, de les convertir automatiquement en fichiers TXT avec `pdftotext`, puis de permettre leur consultation et leur téléchargement.

L'application est destinée à un **usage personnel et local uniquement**.

Aucun service externe, aucune API externe, aucun service d'IA et aucun OCR ne doit être utilisé.

La stack cible est :

- Next.js
- TypeScript
- Supabase auto-hébergé/local
- PostgreSQL via Supabase
- Supabase Storage local pour les fichiers
- `pdftotext` pour l'extraction du texte

L'application doit pouvoir être lancée uniquement lorsque nécessaire sur la machine de l'utilisateur.

---

# 2. Principes généraux

L'application doit respecter les principes suivants :

1. Aucun système de compte ou d'authentification.
2. L'application est considérée comme mono-utilisateur.
3. Les données restent entièrement sur la machine locale.
4. Aucun PDF ne doit être envoyé sur Internet.
5. Aucun traitement par API externe.
6. Aucun OCR.
7. Les fichiers sont conservés indéfiniment jusqu'à suppression manuelle.
8. Les fichiers sont indépendants les uns des autres : il n'existe pas de notion persistante de "lot".
9. Le nombre de fichiers envoyés simultanément par l'interface est limité à 100.
10. Quatre fichiers maximum doivent être traités simultanément.
11. Les autres fichiers restent en attente.
12. L'utilisateur doit pouvoir fermer l'onglet puis revenir ultérieurement sans perdre l'état des traitements.

---

# 3. Fonctionnalités principales

## 3.1 Ajouter des PDF

L'utilisateur doit pouvoir ajouter des fichiers de deux manières :

### Bouton

Un bouton :

**Ajouter des fichiers**

ouvre le sélecteur de fichiers système.

Le sélecteur doit permettre la sélection multiple.

### Drag & drop

Une zone de dépôt doit permettre de glisser-déposer plusieurs PDF.

### Contraintes

- Maximum 100 fichiers par opération d'ajout.
- Seuls les fichiers PDF doivent être acceptés.
- Un fichier de plus de 100 Mo doit être refusé.
- Les fichiers non-PDF doivent être refusés.
- Le système doit afficher clairement la raison d'un refus.

Il ne doit pas être possible de sélectionner directement un dossier.

---

# 4. Upload

L'upload doit être indépendant du traitement PDF → TXT.

Lorsqu'un fichier est ajouté :

1. Il est enregistré dans le stockage local.
2. Une entrée est créée en base de données.
3. Son statut devient `uploading`.
4. Une progression d'upload est affichée.
5. Une fois l'upload terminé, son statut devient `queued`.
6. Le système peut alors placer le fichier dans la file de traitement.

L'interface doit afficher une progression individuelle.

Exemple :

```text
document-001.pdf
Upload
████████████████░░░░ 82 %
```

Une fois terminé :

```text
document-001.pdf
En attente
```

---

# 5. Reprise après fermeture du navigateur

La fermeture de l'onglet ou du navigateur ne doit pas supprimer les fichiers ni leur état.

Lorsque l'application est rouverte :

- les fichiers déjà uploadés doivent apparaître ;
- les fichiers terminés doivent rester terminés ;
- les fichiers en attente doivent rester en attente ;
- les fichiers dont le traitement était en cours doivent être considérés comme interrompus et pouvoir reprendre ;
- les fichiers déjà convertis ne doivent pas être retraités inutilement.

L'état doit donc être persisté côté serveur/local et non uniquement dans le navigateur.

---

# 6. File de traitement

Les fichiers sont traités individuellement.

Il n'existe pas de notion persistante de "lot".

Si l'utilisateur ajoute 100 fichiers simultanément, cela crée simplement 100 fichiers indépendants dans la liste.

Exemple :

```text
document-001.pdf
document-002.pdf
document-003.pdf
...
document-100.pdf
```

Chaque fichier possède son propre état et sa propre date d'envoi.

---

# 7. Concurrence

Le système doit traiter **maximum 4 fichiers simultanément**.

Exemple :

```text
Traitement :
  document-001.pdf
  document-002.pdf
  document-003.pdf
  document-004.pdf

En attente :
  document-005.pdf
  document-006.pdf
  document-007.pdf
  ...
```

Lorsqu'un des quatre traitements se termine, le prochain fichier en attente doit automatiquement être lancé.

Le nombre de workers/conversions simultanés doit être configurable facilement dans le code, avec une valeur par défaut de `4`.

---

# 8. Conversion PDF → TXT

Le moteur de conversion doit être `pdftotext`.

Il doit être exécuté **localement sur la machine**.

Aucune API externe ne doit être utilisée.

Commande cible :

```bash
pdftotext input.pdf output.txt
```

Le développeur doit gérer proprement :

- les chemins de fichiers ;
- les espaces dans les noms ;
- les caractères spéciaux ;
- les erreurs de processus ;
- les codes de retour ;
- les PDF illisibles ;
- les PDF protégés ;
- les PDF sans texte exploitable.

---

# 9. Extraction du texte

L'objectif est d'obtenir le meilleur texte possible avec `pdftotext`, sans OCR.

La priorité est :

1. extraire le texte ;
2. préserver autant que raisonnablement possible la structure originale ;
3. conserver les paragraphes et retours à la ligne ;
4. conserver autant que possible les espaces et séparations entre blocs ;
5. ne pas chercher à reproduire visuellement le PDF.

Le système ne doit pas tenter de reconstruire parfaitement la mise en page.

Les tableaux, colonnes, images ou éléments complexes peuvent donc produire un résultat imparfait.

C'est acceptable.

Aucun traitement supplémentaire complexe n'est requis en première version.

---

# 10. Gestion des erreurs

Un fichier qui échoue ne doit pas bloquer les autres fichiers.

Exemple :

```text
document-001.pdf    Terminé
document-002.pdf    Terminé
document-003.pdf    Échec
document-004.pdf    Traitement
document-005.pdf    En attente
```

Le fichier en erreur doit conserver son statut.

L'interface doit permettre de connaître la raison de l'échec lorsque celle-ci est disponible.

Exemple :

```text
Échec
Impossible d'extraire le texte du PDF.
```

ou :

```text
Échec
pdftotext a retourné le code d'erreur 1.
```

---

# 11. Relance des erreurs

Il ne doit y avoir **aucune relance automatique**.

L'utilisateur doit disposer :

### D'une action individuelle

Sur un fichier en erreur :

```text
[ Relancer ]
```

Cette action remet uniquement ce fichier dans la file d'attente.

### D'une action globale

Un bouton doit permettre :

```text
[ Relancer tous les échecs ]
```

Cette action remet tous les fichiers actuellement en erreur dans la file d'attente.

Les fichiers réussis ne doivent jamais être retraités par cette action.

---

# 12. Annulation

L'utilisateur doit pouvoir annuler le traitement d'un fichier.

Pour un fichier en attente :

```text
[ Annuler ]
```

Pour un fichier en cours de traitement :

```text
[ Annuler ]
```

L'implémentation doit tenter d'arrêter proprement le processus `pdftotext`.

Un traitement annulé ne doit pas produire un TXT considéré comme valide.

Le fichier PDF original doit être conservé.

L'état doit devenir :

```text
cancelled
```

Un fichier annulé peut ensuite être relancé manuellement.

---

# 13. Interface utilisateur

L'interface doit être simple et orientée productivité.

Une seule page principale est suffisante pour le MVP.

Structure proposée :

```text
┌─────────────────────────────────────────────────────────────┐
│ PDF → TXT                                                   │
│                                                             │
│  [ Ajouter des fichiers ]                                  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │       Glissez-déposez vos PDF ici                    │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  123 fichiers                                               │
│                                                             │
│  [ Relancer tous les échecs ]                              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ fichier.pdf                                                 │
│ 27/08/2026 14:31                                            │
│ 100 Mo                                                      │
│                                                             │
│ Statut : Traitement                                         │
│ ███████████████░░░░░ 74 %                                  │
│                                                             │
│ [ Télécharger PDF ] [ Télécharger TXT ] [ Copier le texte ]│
│ [ Annuler ]                                                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ autre-document.pdf                                          │
│ 27/08/2026 14:30                                            │
│                                                             │
│ ✓ Terminé                                                   │
│                                                             │
│ [ Télécharger PDF ] [ Télécharger TXT ] [ Copier le texte ]│
│ [ 🗑 Supprimer ]                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

L'interface réelle ne doit cependant pas utiliser d'emoji dans les titres ou éléments importants.

---

# 14. Liste des fichiers

La liste doit être persistante et croître indéfiniment.

Chaque fichier doit apparaître individuellement.

Il n'est pas nécessaire d'avoir une notion de session ou de lot.

Chaque entrée doit au minimum afficher :

- nom du PDF ;
- date et heure d'envoi ;
- taille du PDF ;
- statut ;
- progression lorsque pertinent ;
- actions disponibles.

La liste doit être triée par défaut du plus récent au plus ancien.

---

# 15. Statuts

Les statuts doivent être explicites.

Statuts minimum :

```text
uploading
queued
processing
completed
failed
cancelled
```

Signification :

### `uploading`

Le fichier est en cours d'envoi vers le stockage local.

### `queued`

Le PDF est uploadé et attend son traitement.

### `processing`

Le PDF est actuellement traité par `pdftotext`.

### `completed`

Le TXT a été généré avec succès.

### `failed`

Le traitement a échoué.

### `cancelled`

L'utilisateur a annulé le traitement.

---

# 16. Progression du traitement

Il faut distinguer :

### Progression d'upload

Elle est réelle et doit être affichée en pourcentage lorsque techniquement possible.

Exemple :

```text
Upload : 64 %
```

### Progression de conversion

`pdftotext` ne fournit pas nécessairement une progression exploitable fiable.

Il ne faut donc **pas inventer un faux pourcentage**.

Pendant la conversion, afficher simplement :

```text
Traitement en cours...
```

ou un indicateur d'activité.

---

# 17. Statistiques globales

En haut de l'interface, afficher des informations synthétiques :

```text
150 fichiers

Terminés : 97
En cours : 4
En attente : 45
Échecs : 4
```

Ces compteurs doivent refléter l'état réel de la base.

---

# 18. Téléchargement du PDF

Chaque fichier doit proposer :

```text
Télécharger PDF
```

Le téléchargement doit fonctionner à tout moment tant que le fichier n'a pas été supprimé.

Le fichier original doit être récupéré depuis le stockage local.

---

# 19. Téléchargement du TXT

Une fois le traitement terminé :

```text
Télécharger TXT
```

Le bouton doit être désactivé ou absent tant que le TXT n'existe pas.

Le nom du fichier doit être dérivé du PDF.

Exemple :

```text
rapport.pdf
```

devient :

```text
rapport.txt
```

Le TXT doit rester disponible indéfiniment tant que l'utilisateur n'a pas supprimé le fichier.

---

# 20. Copier le texte

Pour les fichiers terminés, proposer :

```text
Copier le texte
```

Cette action doit :

1. récupérer le contenu du TXT ;
2. utiliser l'API Clipboard du navigateur ;
3. copier le texte dans le presse-papiers ;
4. afficher une confirmation temporaire.

Exemple :

```text
Copié !
```

Aucun éditeur de texte permanent n'est nécessaire dans le MVP.

---

# 21. Suppression

Chaque fichier doit disposer d'une action :

```text
Supprimer
```

La suppression doit demander une confirmation.

Exemple :

```text
Supprimer ce fichier ?

Le PDF et le TXT seront définitivement supprimés.

[ Annuler ] [ Supprimer ]
```

Lors de la suppression :

1. supprimer le PDF du stockage ;
2. supprimer le TXT du stockage s'il existe ;
3. supprimer l'entrée correspondante de la base de données.

Après suppression, le fichier ne doit plus apparaître dans la liste et ne doit plus être récupérable depuis l'application.

Il n'y a pas de corbeille ni de récupération.

---

# 22. Conservation

Les fichiers doivent être conservés **indéfiniment**.

Il ne doit y avoir :

- aucune expiration automatique ;
- aucun nettoyage automatique ;
- aucune suppression automatique des anciens fichiers.

L'utilisateur est responsable de la suppression.

---

# 23. Base de données

Une table principale `files` est suffisante pour le MVP.

Structure indicative :

```text
files
------------------------------------------------
id                  UUID
filename            TEXT
original_size       BIGINT
mime_type           TEXT
status              TEXT
upload_progress     INTEGER
pdf_path            TEXT
txt_path            TEXT
error_message       TEXT NULL
created_at          TIMESTAMP
updated_at          TIMESTAMP
started_at          TIMESTAMP NULL
completed_at        TIMESTAMP NULL
```

Il n'est pas nécessaire de créer une table `batches`.

Chaque fichier est une entité indépendante.

---

# 24. Identifiant

Chaque fichier doit posséder un UUID interne.

Le nom du fichier original ne doit pas être utilisé comme identifiant unique.

Deux fichiers portant le même nom doivent pouvoir être uploadés.

Exemple :

```text
document.pdf
document.pdf
```

Ces deux fichiers doivent pouvoir coexister.

Le système doit utiliser leur UUID pour les différencier.

---

# 25. Stockage

Le stockage doit être local.

Deux objets doivent être conservés :

```text
PDF original
TXT généré
```

Organisation recommandée :

```text
pdf/
  <uuid>.pdf

txt/
  <uuid>.txt
```

Il est préférable de ne pas utiliser directement le nom utilisateur comme nom physique du fichier afin d'éviter les problèmes de caractères spéciaux, de collisions ou de chemins.

Le nom original doit rester enregistré en base de données et être utilisé lors du téléchargement.

---

# 26. Architecture technique

Architecture cible :

```text
                 Navigateur
                     │
                     │ HTTP
                     ▼
              Next.js Application
                     │
          ┌──────────┼──────────┐
          │          │          │
          ▼          ▼          ▼
       API/UI     PostgreSQL   Storage
          │        Supabase    Supabase
          │
          ▼
       Worker local
          │
          ▼
      pdftotext
```

Le traitement `pdftotext` doit être effectué côté serveur et jamais dans le navigateur.

---

# 27. Worker de traitement

Un worker local doit surveiller les fichiers `queued`.

Il doit :

1. récupérer les fichiers en attente ;
2. prendre jusqu'à 4 fichiers simultanément ;
3. passer leur statut à `processing` ;
4. lancer `pdftotext` ;
5. créer le TXT ;
6. mettre à jour le statut ;
7. passer au fichier suivant.

Pseudo-logique :

```text
while application_running:

    récupérer les fichiers queued

    tant que nombre_de_workers < 4:
        prendre un fichier
        lancer son traitement

    attendre qu'un traitement se termine

    mettre à jour son statut

    recommencer
```

Le système doit éviter qu'un même fichier soit traité simultanément deux fois.

---

# 28. Robustesse du worker

Le système doit gérer le redémarrage du serveur.

Si le serveur s'arrête alors qu'un fichier était :

```text
processing
```

il ne doit pas rester bloqué indéfiniment dans cet état.

Au démarrage de l'application, les fichiers `processing` laissés sans activité doivent être identifiés et remis dans un état permettant leur reprise.

Une stratégie simple acceptable pour le MVP :

```text
processing abandonné
        ↓
queued
        ↓
nouveau traitement
```

Le système doit cependant éviter de considérer comme abandonné un traitement réellement en cours.

Un mécanisme de timestamp/heartbeat peut être utilisé si nécessaire.

---

# 29. Gestion des fichiers volumineux

Le système doit être conçu pour des fichiers allant jusqu'à **100 Mo**.

Il ne faut pas charger inutilement l'intégralité du PDF en mémoire JavaScript.

Les transferts doivent privilégier le streaming ou les mécanismes adaptés au stockage local.

L'objectif est d'éviter qu'un upload de 100 Mo provoque une consommation mémoire excessive.

---

# 30. Performances attendues

Volume cible :

- environ 100 PDF par jour ;
- plusieurs dizaines de fichiers dans une utilisation normale ;
- jusqu'à 100 fichiers ajoutés en une seule opération ;
- taille maximale : 100 Mo par fichier ;
- 4 conversions simultanées.

Il n'est pas nécessaire d'optimiser le système pour plusieurs milliers de conversions simultanées.

En revanche, une file de plusieurs centaines de fichiers doit fonctionner sans intervention manuelle.

---

# 31. Pas de traitement par lot

Même si 100 fichiers sont déposés simultanément :

```text
100 PDF
```

le système ne doit pas créer un "job batch" complexe.

Il doit simplement créer :

```text
file 1
file 2
file 3
...
file 100
```

Cela simplifie :

- la reprise ;
- l'annulation ;
- la relance ;
- le suivi ;
- la suppression ;
- l'historique.

La date d'envoi de chaque fichier doit être enregistrée individuellement.

---

# 32. Pas de notifications

Aucune notification email n'est nécessaire.

Aucune notification externe n'est nécessaire.

L'interface doit simplement refléter l'état actuel.

---

# 33. Pas de recherche

Aucune fonctionnalité de recherche n'est nécessaire.

Aucun filtre complexe n'est nécessaire pour le MVP.

La liste complète doit simplement être affichée.

Une pagination ou un chargement progressif peut toutefois être implémenté si nécessaire pour éviter de charger plusieurs dizaines de milliers de lignes simultanément dans le navigateur.

Cette optimisation ne doit pas modifier le principe selon lequel l'historique est conservé indéfiniment.

---

# 34. Sécurité

Même si l'application est mono-utilisateur et locale, les bonnes pratiques suivantes doivent être respectées :

- ne jamais exécuter directement une commande shell construite à partir du nom du fichier utilisateur ;
- ne jamais concaténer naïvement les chemins ;
- utiliser des UUID pour les chemins physiques ;
- valider les extensions et MIME types ;
- limiter la taille des fichiers à 100 Mo ;
- protéger les endpoints de suppression ;
- empêcher les accès à des chemins arbitraires ;
- ne jamais permettre au navigateur de fournir directement une commande à exécuter ;
- utiliser des variables d'environnement pour la configuration.

Le nom original du fichier doit être considéré comme une donnée non fiable.

---

# 35. Configuration

Les paramètres suivants doivent être facilement configurables :

```text
MAX_FILE_SIZE = 100 MB
MAX_FILES_PER_UPLOAD = 100
MAX_CONCURRENT_CONVERSIONS = 4
```

Ils ne doivent pas être dispersés dans le code.

Une configuration centralisée est préférable.

---

# 36. Installation locale

Le projet doit pouvoir être lancé localement avec une procédure simple.

Objectif :

```bash
npm install
```

puis lancement des dépendances locales Supabase et de Next.js.

La documentation du projet doit expliquer :

1. prérequis ;
2. installation de Node.js ;
3. installation de `pdftotext` ;
4. installation de Supabase CLI/Docker si nécessaire ;
5. initialisation de Supabase ;
6. création de la base ;
7. configuration `.env.local` ;
8. lancement de Next.js ;
9. lancement du worker ;
10. accès à l'application.

---

# 37. Fonctionnement hors ligne

Une fois les dépendances installées et les services locaux démarrés, l'application ne doit nécessiter aucune connexion Internet pour fonctionner.

Les PDF doivent rester sur la machine.

Aucun appel réseau vers :

- OpenAI ;
- Anthropic ;
- Google ;
- AWS ;
- Azure ;
- Cloudflare ;
- Supabase Cloud ;
- autre service externe ;

ne doit être effectué.

---

# 38. Dépendances externes

Les bibliothèques open source installées via npm ou les outils installés localement sont autorisés.

En revanche, aucune donnée utilisateur ne doit être envoyée à un service externe.

`pdftotext` est explicitement privilégié comme moteur d'extraction.

---

# 39. Expérience utilisateur cible

Le parcours principal doit être extrêmement simple :

```text
1. Ouvrir l'application
        ↓
2. Glisser-déposer 50 PDF
        ↓
3. Les uploads démarrent
        ↓
4. Les fichiers apparaissent dans la liste
        ↓
5. 4 fichiers sont traités simultanément
        ↓
6. Les suivants attendent
        ↓
7. Les TXT apparaissent progressivement
        ↓
8. Télécharger ou copier le texte
```

L'utilisateur ne doit pas avoir à lancer manuellement le traitement après chaque upload.

Le traitement doit démarrer automatiquement pour les nouveaux fichiers.

---

# 40. États et actions de l'interface

| Statut | Actions |
|---|---|
| Uploading | Annuler l'upload |
| Queued | Annuler |
| Processing | Annuler |
| Completed | Télécharger PDF, Télécharger TXT, Copier le texte, Supprimer |
| Failed | Relancer, Télécharger PDF, Supprimer |
| Cancelled | Relancer, Télécharger PDF, Supprimer |

Pour un fichier en erreur, le message d'erreur doit être accessible.

---

# 41. Critères d'acceptation

## Upload

- [ ] Un PDF peut être ajouté avec le bouton.
- [ ] Plusieurs PDF peuvent être sélectionnés simultanément.
- [ ] Un PDF peut être ajouté par drag & drop.
- [ ] Un maximum de 100 fichiers est accepté par opération.
- [ ] Un fichier supérieur à 100 Mo est refusé.
- [ ] Les fichiers non-PDF sont refusés.
- [ ] La progression d'upload est affichée individuellement.

## Traitement

- [ ] Un fichier uploadé passe automatiquement dans la file d'attente.
- [ ] Le traitement démarre automatiquement.
- [ ] Maximum 4 PDF sont traités simultanément.
- [ ] Les autres restent en attente.
- [ ] La fin d'un traitement déclenche automatiquement le traitement suivant.
- [ ] `pdftotext` est utilisé localement.
- [ ] Aucun OCR n'est utilisé.
- [ ] Aucun service externe n'est utilisé.

## Persistance

- [ ] Fermer l'onglet ne supprime aucun fichier.
- [ ] Rouvrir l'application permet de retrouver l'historique.
- [ ] Les fichiers terminés restent disponibles.
- [ ] Les fichiers en attente restent disponibles.
- [ ] Un traitement interrompu peut être repris.

## Résultats

- [ ] Un TXT est généré après extraction réussie.
- [ ] Le TXT porte le même nom que le PDF avec l'extension `.txt`.
- [ ] Le PDF original reste disponible.
- [ ] Le TXT reste disponible indéfiniment.
- [ ] Le TXT peut être téléchargé.
- [ ] Le contenu du TXT peut être copié dans le presse-papiers.

## Erreurs

- [ ] Un fichier en erreur ne bloque pas la file.
- [ ] L'erreur est visible.
- [ ] Un fichier en erreur peut être relancé individuellement.
- [ ] Tous les fichiers en erreur peuvent être relancés avec une action globale.
- [ ] Aucun retry automatique n'est effectué.

## Annulation

- [ ] Un fichier en attente peut être annulé.
- [ ] Un traitement en cours peut être annulé.
- [ ] Un fichier annulé ne produit pas de TXT valide.
- [ ] Un fichier annulé peut être relancé.

## Suppression

- [ ] Un fichier peut être supprimé individuellement.
- [ ] Une confirmation est demandée.
- [ ] Le PDF est supprimé.
- [ ] Le TXT est supprimé.
- [ ] L'entrée en base est supprimée.
- [ ] Le fichier n'est plus récupérable depuis l'application.

---

# 42. Hors périmètre du MVP

Les fonctionnalités suivantes ne doivent pas être développées :

- authentification ;
- comptes utilisateurs ;
- gestion des droits ;
- multi-utilisateurs ;
- OCR ;
- IA ;
- RAG ;
- API externe de conversion ;
- conversion Word/Excel/etc. ;
- téléchargement ZIP ;
- notifications email ;
- recherche ;
- classement par dossiers ;
- sélection de dossiers lors de l'upload ;
- traitement complexe de la mise en page ;
- reconstruction parfaite des tableaux ;
- système de tags ;
- partage de fichiers ;
- cloud ;
- synchronisation entre machines.

---

# 43. Choix techniques recommandés

Stack :

```text
Frontend
────────
Next.js
React
TypeScript

Backend
───────
Next.js Server / Route Handlers
Worker Node.js local

Base de données
───────────────
PostgreSQL
Supabase local

Stockage
────────
Supabase Storage local

Extraction
──────────
pdftotext

Infrastructure
──────────────
Machine locale
Docker/Supabase local
```

Le worker doit rester découplé de l'interface web afin que le traitement continue même si aucune page n'est actuellement ouverte.

---

# 44. Architecture recommandée du projet

Une organisation indicative :

```text
project/
│
├── app/
│   ├── page.tsx
│   ├── api/
│   │   ├── files/
│   │   ├── upload/
│   │   ├── download/
│   │   ├── retry/
│   │   └── delete/
│   │
│   └── ...
│
├── components/
│   ├── FileUploader.tsx
│   ├── FileList.tsx
│   ├── FileRow.tsx
│   ├── ProgressBar.tsx
│   └── ...
│
├── lib/
│   ├── supabase/
│   ├── storage/
│   ├── pdf/
│   └── queue/
│
├── worker/
│   ├── worker.ts
│   ├── queue.ts
│   └── processor.ts
│
├── supabase/
│   └── migrations/
│
└── ...
```

Cette structure est indicative : le développeur peut l'adapter si une meilleure architecture est justifiée.

---

# 45. Point important concernant Supabase

Supabase doit être utilisé **localement**, et non avec un projet Supabase Cloud.

L'objectif est :

```text
Machine utilisateur
│
├── Next.js
├── Worker
├── pdftotext
├── PostgreSQL
└── Storage
```

Aucune donnée ne quitte la machine.

Si l'utilisation de Supabase Storage local apporte une complexité disproportionnée pour ce projet, une alternative acceptable est d'utiliser directement un stockage filesystem local avec PostgreSQL pour les métadonnées.

La priorité est la simplicité, la robustesse et le fonctionnement 100 % local.

---

# 46. Principe de reprise

La reprise après redémarrage est une exigence importante.

Exemple :

```text
Avant arrêt :

A.pdf    completed
B.pdf    processing
C.pdf    queued
D.pdf    queued
```

Après redémarrage :

```text
A.pdf    completed
B.pdf    queued
C.pdf    queued
D.pdf    queued
```

Le worker reprend alors :

```text
B.pdf
C.pdf
D.pdf
```

sans intervention de l'utilisateur.

Un fichier déjà `completed` ne doit jamais être retraité automatiquement.

---

# 47. Principe de non-duplication

Le système doit éviter de créer plusieurs TXT pour un même fichier.

Si :

```text
rapport.pdf
```

est déjà :

```text
completed
```

le redémarrage du serveur ne doit pas relancer `pdftotext`.

Une relance explicite par l'utilisateur constitue une exception.

---

# 48. Résultat attendu

À terme, l'utilisateur doit avoir une application qui ressemble conceptuellement à ceci :

```text
                     PDF → TXT

        ┌──────────────────────────────────┐
        │                                  │
        │       Glisser vos PDF ici        │
        │                                  │
        │       [ Ajouter des fichiers ]  │
        │                                  │
        └──────────────────────────────────┘

       127 fichiers
       4 en traitement · 118 en attente · 5 erreurs

       [ Relancer tous les échecs ]


  rapport-technique.pdf
  Envoyé le 27/08/2026 à 14:20
  ✓ Terminé

  [ Télécharger PDF ]
  [ Télécharger TXT ]
  [ Copier le texte ]
  [ Supprimer ]


  article-123.pdf
  Envoyé le 27/08/2026 à 14:21
  ⟳ Traitement en cours...

  [ Annuler ]


  document-456.pdf
  Envoyé le 27/08/2026 à 14:22
  En attente

  [ Annuler ]


  scan-789.pdf
  Envoyé le 27/08/2026 à 14:23
  ✕ Échec
  Impossible d'extraire le texte.

  [ Relancer ]
  [ Télécharger PDF ]
  [ Supprimer ]
```

L'ensemble doit rester volontairement simple : **déposer → attendre → récupérer le TXT**.

# 49. Priorité de développement

Le développement doit être réalisé dans cet ordre :

### Phase 1 — Infrastructure

- [ ] Initialisation Next.js + TypeScript
- [ ] Mise en place Supabase local
- [ ] PostgreSQL
- [ ] Storage local
- [ ] Migration de base de données
- [ ] Vérification de `pdftotext`

### Phase 2 — Upload

- [ ] Sélection multiple
- [ ] Drag & drop
- [ ] Validation PDF
- [ ] Limite 100 fichiers
- [ ] Limite 100 Mo
- [ ] Upload
- [ ] Progression
- [ ] Persistance

### Phase 3 — Queue

- [ ] File d'attente persistante
- [ ] Worker
- [ ] Maximum 4 traitements simultanés
- [ ] Traitement automatique
- [ ] Reprise après redémarrage

### Phase 4 — Extraction

- [ ] Exécution de `pdftotext`
- [ ] Création TXT
- [ ] Gestion des erreurs
- [ ] Statuts
- [ ] Messages d'erreur

### Phase 5 — Interface

- [ ] Liste des fichiers
- [ ] Statistiques
- [ ] Progression
- [ ] Téléchargement PDF
- [ ] Téléchargement TXT
- [ ] Copier le texte
- [ ] Suppression

### Phase 6 — Contrôle

- [ ] Annulation
- [ ] Relance individuelle
- [ ] Relance globale des erreurs
- [ ] Tests de redémarrage
- [ ] Tests avec gros fichiers
- [ ] Tests avec 100 fichiers
- [ ] Tests de fichiers portant le même nom

# 50. Définition du MVP terminé

Le MVP est considéré comme terminé lorsque l'utilisateur peut :

1. lancer l'application localement ;
2. déposer jusqu'à 100 PDF ;
3. voir la progression de chaque upload ;
4. fermer le navigateur ;
5. rouvrir l'application ;
6. retrouver tous ses fichiers ;
7. laisser le système traiter automatiquement les PDF ;
8. avoir au maximum 4 conversions simultanées ;
9. voir les fichiers en attente ;
10. voir les fichiers terminés ;
11. télécharger n'importe quel PDF ;
12. télécharger n'importe quel TXT terminé ;
13. copier le contenu d'un TXT ;
14. annuler un traitement ;
15. relancer un fichier en erreur ;
16. relancer tous les fichiers en erreur ;
17. supprimer définitivement un fichier ;
18. conserver l'historique indéfiniment ;
19. fonctionner sans Internet ;
20. ne transmettre aucun PDF ou TXT à un service externe.

Le résultat final doit privilégier **la robustesse et la simplicité plutôt que la complexité fonctionnelle**.