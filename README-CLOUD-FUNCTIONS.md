# Documentation des Cloud Functions

Ce document décrit les Cloud Functions Firebase implémentées pour sécuriser les appels API externes dans l'application OsteoApp.

## Table des matières

1. [Introduction](#introduction)
2. [Configuration](#configuration)
3. [Fonctions disponibles](#fonctions-disponibles)
   - [API Proxy](#api-proxy)
   - [Email Sender](#email-sender)
   - [PDF Generator](#pdf-generator)
4. [Utilisation côté client](#utilisation-côté-client)
5. [Sécurité](#sécurité)
6. [Dépannage](#dépannage)

## Introduction

Les Cloud Functions servent d'intermédiaire sécurisé entre le frontend et les APIs externes. Elles permettent de :
- Masquer les clés d'API sensibles
- Valider les requêtes entrantes
- Gérer les erreurs de manière cohérente
- Mettre en cache les réponses pour améliorer les performances
- Limiter le taux de requêtes par utilisateur

## Configuration

### Prérequis

- Projet Firebase avec le plan Blaze (pay-as-you-go)
- Node.js 14 ou supérieur
- Firebase CLI installé (`npm install -g firebase-tools`)

### Variables d'environnement

Les fonctions utilisent les variables d'environnement suivantes :

```bash
# API Proxy
firebase functions:config:set weather.api_key="VOTRE_CLE_API_OPENWEATHERMAP"
firebase functions:config:set news.api_key="VOTRE_CLE_API_NEWS"
firebase functions:config:set geocoding.api_key="VOTRE_CLE_API_GOOGLE_MAPS"

# Email Sender
firebase functions:config:set smtp.host="smtp.example.com"
firebase functions:config:set smtp.port="587"
firebase functions:config:set smtp.username="votre_email@example.com"
firebase functions:config:set smtp.password="votre_mot_de_passe"

# PDF Generator
firebase functions:config:set pdf.api_key="VOTRE_CLE_API_PDF"
```

## Fonctions disponibles

### API Proxy

Endpoint: `/api-proxy`

Cette fonction sert d'intermédiaire pour les appels API externes, masquant les clés d'API sensibles.

#### Endpoints disponibles

1. **Météo**
   - URL: `/api-proxy/weather`
   - Méthode: GET
   - Paramètres:
     - `city` (obligatoire): Nom de la ville
   - Exemple: `/api-proxy/weather?city=Paris`

2. **Actualités**
   - URL: `/api-proxy/news`
   - Méthode: GET
   - Paramètres:
     - `category` (obligatoire): Catégorie d'actualités (business, entertainment, health, science, sports, technology)
     - `country` (optionnel): Code pays à 2 lettres (défaut: fr)
   - Exemple: `/api-proxy/news?category=health&country=fr`

3. **Géocodage**
   - URL: `/api-proxy/geocoding`
   - Méthode: GET
   - Paramètres:
     - `address` (obligatoire): Adresse à géocoder
   - Exemple: `/api-proxy/geocoding?address=1%20rue%20de%20la%20Paix%2C%20Paris`

### Email Sender

Endpoint: `/email-sender`

Cette fonction permet d'envoyer des emails via SMTP.

#### Utilisation

- Méthode: POST
- Corps de la requête:
  ```json
  {
    "to": "destinataire@example.com",
    "subject": "Sujet de l'email",
    "text": "Contenu en texte brut (optionnel si html est fourni)",
    "html": "Contenu HTML (optionnel si text est fourni)",
    "from": "expediteur@example.com (optionnel)"
  }
  ```

### PDF Generator

Endpoint: `/pdf-generator`

Cette fonction génère des documents PDF à partir de templates HTML.

#### Utilisation

- Méthode: POST
- Corps de la requête:
  ```json
  {
    "template": "invoice", // ou un template HTML personnalisé
    "data": {
      // Données à injecter dans le template
      "invoiceNumber": "F-20230001",
      "patientName": "John Doe",
      // ...autres données
    },
    "filename": "facture-20230001.pdf" // optionnel
  }
  ```

#### Templates prédéfinis

1. **invoice**: Template pour les factures
2. **medicalCertificate**: Template pour les certificats médicaux

## Utilisation côté client

Un client API est fourni pour faciliter l'utilisation des Cloud Functions:

```typescript
import { apiClient } from '../utils/apiClient';

// Exemple d'utilisation
async function getWeatherData() {
  const response = await apiClient.getWeather('Paris');
  
  if (response.error) {
    console.error('Erreur:', response.error.message);
    return;
  }
  
  console.log('Données météo:', response.data);
}
```

## Sécurité

Les fonctions implémentent plusieurs mesures de sécurité:

1. **Authentification**: Vérification du token JWT Firebase
2. **Validation des entrées**: Validation des paramètres et du corps des requêtes
3. **Limitation de taux**: Limitation du nombre de requêtes par utilisateur
4. **CORS**: Configuration des en-têtes CORS pour contrôler l'accès
5. **Journalisation**: Enregistrement des erreurs pour le débogage

## Dépannage

### Erreurs courantes

1. **401 Unauthorized**: Vérifiez que l'utilisateur est authentifié et que le token est valide
2. **400 Bad Request**: Vérifiez les paramètres de la requête
3. **429 Too Many Requests**: L'utilisateur a dépassé la limite de taux
4. **500 Internal Server Error**: Erreur côté serveur, vérifiez les logs Firebase

### Logs

Pour consulter les logs des fonctions:

```bash
firebase functions:log
```

### Tests locaux

Pour tester les fonctions localement:

```bash
firebase emulators:start --only functions
```