# Configuration des Index Firestore

## Index 1 : Consultations

1. **ID de collection** : `consultations`
2. **Champs d'application des requêtes** : Sélectionner "Collection"
3. **Champs à indexer** :
   - Champ 1 : `osteopathId` → Croissant
   - Champ 2 : `patientId` → Croissant  
   - Champ 3 : `date` → Décroissant

## Index 2 : Invoices (Factures)

1. **ID de collection** : `invoices`
2. **Champs d'application des requêtes** : Sélectionner "Collection"
3. **Champs à indexer** :
   - Champ 1 : `osteopathId` → Croissant
   - Champ 2 : `patientId` → Croissant
   - Champ 3 : `issueDate` → Décroissant

## Index 3 : Appointments (Rendez-vous)

1. **ID de collection** : `appointments`
2. **Champs d'application des requêtes** : Sélectionner "Collection"
3. **Champs à indexer** :
   - Champ 1 : `osteopathId` → Croissant
   - Champ 2 : `patientId` → Croissant
   - Champ 3 : `date` → Décroissant

## Index 4 : Patients (REQUIS POUR CORRIGER L'ERREUR ACTUELLE)

1. **ID de collection** : `patients`
2. **Champs d'application des requêtes** : Sélectionner "Collection"
3. **Champs à indexer** :
   - Champ 1 : `osteopathId` → Croissant
   - Champ 2 : `createdAt` → Croissant
   - Champ 3 : `__name__` → Croissant

**Lien direct pour créer cet index :**
https://console.firebase.google.com/v1/r/project/ostheo-app/firestore/indexes?create_composite=Cktwcm9qZWN0cy9vc3RoZW8tYXBwL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wYXRpZW50cy9pbmRleGVzL18QARoPCgtvc3Rlb3BhdGhJZBABGg0KCWNyZWF0ZWRBdBABGgwKCF9fbmFtZV9fEAE

## Index 5 : Appointments avec Status (NOUVEAU - REQUIS POUR CORRIGER L'ERREUR ACTUELLE)

1. **ID de collection** : `appointments`
2. **Champs d'application des requêtes** : Sélectionner "Collection"
3. **Champs à indexer** :
   - Champ 1 : `osteopathId` → Croissant
   - Champ 2 : `patientId` → Croissant
   - Champ 3 : `status` → Croissant
   - Champ 4 : `__name__` → Croissant

**Lien direct pour créer cet index :**
https://console.firebase.google.com/v1/r/project/ostheo-app/firestore/indexes?create_composite=Ck9wcm9qZWN0cy9vc3RoZW8tYXBwL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9hcHBvaW50bWVudHMvaW5kZXhlcy9fEAEaDwoLb3N0ZW9wYXRoSWQQARoNCglwYXRpZW50SWQQARoKCgZzdGF0dXMQARoMCghfX25hbWVfXxAB

## Index 6 : Beta Waitlist (Status) - REQUIS POUR CORRIGER L'ERREUR ACTUELLE

1. **ID de collection** : `beta_waitlist`
2. **Champs d'application des requêtes** : Sélectionner "Collection"
3. **Champs à indexer** :
   - Champ 1 : `status` → Croissant

**Lien direct pour créer cet index :**
https://console.firebase.google.com/v1/r/project/ostheo-app/firestore/indexes?create_composite=CkVwcm9qZWN0cy9vc3RoZW8tYXBwL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9iZXRhX3dhaXRsaXN0L2luZGV4ZXMvXxABGgoKBnN0YXR1cxAB

## Instructions étape par étape :

### Pour chaque index :

1. Dans "ID de collection", saisissez le nom de la collection (consultations, invoices, appointments, patients, ou beta_waitlist)

2. Laissez "Collection" sélectionné dans "Champs d'application des requêtes"

3. Pour "Champs à indexer" :
   - Cliquez sur "Ajouter un champ" pour chaque champ nécessaire
   - Saisissez le nom exact du champ dans "Chemin d'accès du champ"
   - Sélectionnez "Croissant" ou "Décroissant" selon les spécifications ci-dessus

4. Cliquez sur "Créer" pour chaque index

5. Attendez que l'index soit construit (cela peut prendre quelques minutes)

## Note importante :
Vous devez créer ces 6 index séparément. Une fois tous les index créés et construits, les erreurs dans votre application disparaîtront.

## URGENT - Index manquant pour la liste d'attente Beta :
L'**Index 6** est critique pour résoudre l'erreur actuelle dans le dashboard de la liste d'attente Beta. Cet index permet aux requêtes avec `where('status', '==', 'waiting')` et autres filtres de statut de fonctionner correctement.

## URGENT - Index manquant pour les consultations du Dashboard :
L'**Index 7** est critique pour résoudre l'erreur actuelle dans le dashboard. Cet index permet aux requêtes de récupération des consultations du jour avec `where('osteopathId', '==', osteopathId)` et `where('date', '>=', startOfDay)` de fonctionner correctement.

## Index 7 : Consultations pour Dashboard (NOUVEAU - REQUIS POUR CORRIGER L'ERREUR ACTUELLE)

1. **ID de collection** : `consultations`
2. **Champs d'application des requêtes** : Sélectionner "Collection"
3. **Champs à indexer** :
   - Champ 1 : `osteopathId` → Croissant
   - Champ 2 : `date` → Croissant
   - Champ 3 : `__name__` → Croissant

**Lien direct pour créer cet index :**
https://console.firebase.google.com/v1/r/project/ostheo-app/firestore/indexes?create_composite=ClBwcm9qZWN0cy9vc3RoZW8tYXBwL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9jb25zdWx0YXRpb25zL2luZGV4ZXMvXxABGg8KC29zdGVvcGF0aElkEAEaCAoEZGF0ZRABGgwKCF9fbmFtZV9fEAE

## Index 8 : Consultations par Patient (NOUVEAU - REQUIS POUR CORRIGER L'ERREUR ACTUELLE)

1. **ID de collection** : `consultations`
2. **Champs d'application des requêtes** : Sélectionner "Collection"
3. **Champs à indexer** :
   - Champ 1 : `osteopathId` → Croissant
   - Champ 2 : `patientId` → Croissant
   - Champ 3 : `__name__` → Croissant

**Lien direct pour créer cet index :**
https://console.firebase.google.com/v1/r/project/ostheo-app/firestore/indexes?create_composite=Ck9wcm9qZWN0cy9vc3RoZW8tYXBwL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9jb25zdWx0YXRpb25zL2luZGV4ZXMvXxABGg8KC29zdGVvcGF0aElkEAEaDQoJcGF0aWVudElkEAEaDAoICF9fbmFtZV9fEAE

## URGENT - Index manquant pour la synchronisation des rendez-vous :
L'**Index 5** est critique pour résoudre l'erreur actuelle. Cet index permet à la méthode `syncPatientNextAppointment` de fonctionner correctement en filtrant les rendez-vous par `osteopathId`, `patientId` et `status != 'cancelled'`.

## Réponse à votre question sur "Collection" vs "Groupe de collections"
Pour tous les index, vous devez sélectionner "Collection" et non "Groupe de collections".

- **Collection** : Utilisez cette option lorsque vous interrogez une collection spécifique (comme `patients`, `appointments`, ou `beta_waitlist`).
- **Groupe de collections** : Utilisez cette option uniquement lorsque vous interrogez plusieurs collections ayant le même ID à travers différents chemins de documents.

Dans votre cas, vous interrogez uniquement des collections spécifiques directement, donc "Collection" est le bon choix pour tous les index.

## URGENT - Nouvel index requis pour les consultations par patient :
L'**Index 8** est critique pour résoudre l'erreur actuelle dans les détails des patients. Cet index permet aux requêtes de récupération des consultations d'un patient spécifique avec `where('osteopathId', '==', osteopathId)` et `where('patientId', '==', patientId)` de fonctionner correctement.

## Index 9 : Consultations avec tri par date (NOUVEAU - REQUIS POUR CORRIGER L'ERREUR ACTUELLE)

1. **ID de collection** : `consultations`
2. **Champs d'application des requêtes** : Sélectionner "Collection"
3. **Champs à indexer** :
   - Champ 1 : `osteopathId` → Croissant
   - Champ 2 : `patientId` → Croissant
   - Champ 3 : `date` → Décroissant
   - Champ 4 : `__name__` → Décroissant

**Lien direct pour créer cet index :**
https://console.firebase.google.com/v1/r/project/ostheo-app/firestore/indexes?create_composite=ClBwcm9qZWN0cy9vc3RoZW8tYXBwL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9jb25zdWx0YXRpb25zL2luZGV4ZXMvXxABGg8KC29zdGVvcGF0aElkEAEaDQoJcGF0aWVudElkEAEaCAoEZGF0ZRACGgwKCF9fbmFtZV9fEAI

## URGENT - Index manquant pour les consultations avec tri par date :
L'**Index 9** est critique pour résoudre l'erreur actuelle dans les consultations. Cet index permet aux requêtes de récupération des consultations avec `where('osteopathId', '==', osteopathId)`, `where('patientId', '==', patientId)` et `orderBy('date', 'desc')` de fonctionner correctement.