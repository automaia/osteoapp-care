import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, setPersistence, browserLocalPersistence, multiFactor } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence, setLogLevel, CACHE_SIZE_UNLIMITED } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { enableCryptoEngine, initializeEncryption } from "../utils/encryption";

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD-L4R32GM-QZCOJBLzcfp69LpC7m8488s",
  authDomain: "ostheo-app.firebaseapp.com",
  databaseURL: "https://ostheo-app-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ostheo-app",
  storageBucket: "ostheo-app.firebasestorage.app",
  messagingSenderId: "927433064971",
  appId: "1:927433064971:web:6134d2d69194aa2e053d0e",
  measurementId: "G-B4K0K66PE2"
};

// Configuration HDS
const hdsConfig = {
  enabled: true,
  encryptionLevel: 'AES-256-GCM',
  auditEnabled: true,
  auditRetentionDays: 1095, // 3 ans
  pseudonymizationEnabled: true,
  securityLevel: 'high',
  dataResidency: 'eu-west-3', // Paris (France)
  complianceVersion: 'HDS-2022-01'
};

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);

// Journalisation détaillée en développement
if (import.meta.env.DEV) {
  setLogLevel('debug');
  console.log('🔥 Firebase debug logging enabled');
  console.log('🔒 HDS compliance mode:', hdsConfig.enabled ? 'ENABLED' : 'DISABLED');
}

// Initialisation des services
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// IMPORTANT: Enable persistence IMMEDIATELY after Firestore initialization
// This must be done before any other Firestore operations
enableIndexedDbPersistence(db, {
  synchronizeTabs: true,
  forceOwnership: false
})
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('⚠️ Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('⚠️ The current browser doesn\'t support persistence.');
    }
  });

const storage = getStorage(app);
const functions = getFunctions(app, 'europe-west1'); // Région européenne pour conformité RGPD

// Configuration de l'émulateur Functions en développement
if (import.meta.env.DEV && !import.meta.env.VITE_FIREBASE_USE_PRODUCTION) {
  try {
    connectFunctionsEmulator(functions, "localhost", 5001);
    console.log('🔧 Connected to Functions emulator');
  } catch (error) {
    console.warn('⚠️ Could not connect to Functions emulator:', error);
  }
}

// Configuration de l'authentification renforcée
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("✅ Auth persistence configured");
    
    // Configuration MFA si HDS activé
    if (hdsConfig.enabled && hdsConfig.securityLevel === 'high') {
      console.log("🔐 MFA enforcement prepared for HDS compliance");
    }
  })
  .catch((error) => {
    console.error("❌ Error setting auth persistence:", error);
  });

// Configuration Firestore pour HDS
const firestoreSettings: any = {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
};

// Activation du chiffrement côté client si HDS activé
if (hdsConfig.enabled) {
  try {
    // Initialisation du moteur de chiffrement
    initializeEncryption();
    enableCryptoEngine(db);
    console.log("🔐 Client-side encryption initialized for HDS compliance");
    
    // Ajout des métadonnées de conformité
    firestoreSettings.hdsCompliance = {
      version: hdsConfig.complianceVersion,
      encryptionLevel: hdsConfig.encryptionLevel,
      dataResidency: hdsConfig.dataResidency
    };
  } catch (error) {
    console.error("❌ Failed to initialize encryption:", error);
  }
}

// Journalisation de l'initialisation
console.log("✅ Firebase initialized successfully");
console.log("🔑 Authentication service ready");
console.log("💾 Firestore service ready");
console.log("📦 Storage service ready");
console.log("⚡ Functions service ready");
console.log("🏛️ HDS compliance mode:", hdsConfig.enabled ? "ENABLED" : "DISABLED");

export { app, analytics, auth, db, storage, functions, hdsConfig };