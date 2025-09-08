import { NextApiRequest, NextApiResponse } from 'next';

const BOOKING_API_BASE = process.env.BOOKING_API_BASE || 'https://europe-west1-ostheo-app.cloudfunctions.net';

// Rate limiting simple
const rateLimits = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string, endpoint: string): boolean {
  const key = `${ip}:${endpoint}`;
  const now = Date.now();
  const limit = rateLimits.get(key);
  
  // Limites par endpoint
  const limits = {
    '/slots': { max: 60, window: 60000 }, // 60 req/min
    '/book': { max: 10, window: 60000 },  // 10 req/min
    '/hold': { max: 30, window: 60000 },  // 30 req/min
    default: { max: 20, window: 60000 }   // 20 req/min
  };
  
  const endpointLimit = limits[endpoint as keyof typeof limits] || limits.default;
  
  if (!limit) {
    rateLimits.set(key, { count: 1, resetTime: now + endpointLimit.window });
    return true;
  }
  
  if (now > limit.resetTime) {
    rateLimits.set(key, { count: 1, resetTime: now + endpointLimit.window });
    return true;
  }
  
  if (limit.count >= endpointLimit.max) {
    return false;
  }
  
  limit.count++;
  return true;
}

/**
 * Proxy vers les Cloud Functions de réservation
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Récupérer l'IP du client
    const clientIP = req.headers['x-forwarded-for'] as string || 
                    req.headers['x-real-ip'] as string || 
                    req.connection.remoteAddress || 
                    'unknown';
    
    // Construire le chemin de l'API
    const { path } = req.query;
    const apiPath = Array.isArray(path) ? path.join('/') : path || '';
    const endpoint = `/${apiPath.split('/')[0]}`;
    
    // Vérifier les limites de taux
    if (!checkRateLimit(clientIP, endpoint)) {
      return res.status(429).json({
        success: false,
        error: 'Trop de requêtes. Veuillez patienter avant de réessayer.'
      });
    }
    
    // Construire l'URL de la Cloud Function
    const functionUrl = `${BOOKING_API_BASE}/${apiPath}`;
    
    // Préparer les headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    // Ajouter l'IP du client pour le rate limiting côté fonction
    headers['X-Client-IP'] = clientIP;
    
    // Copier certains headers de la requête originale
    if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization;
    }
    
    // Préparer les options de la requête
    const fetchOptions: RequestInit = {
      method: req.method,
      headers
    };
    
    // Ajouter le body pour les requêtes POST/PUT
    if (req.method === 'POST' || req.method === 'PUT') {
      fetchOptions.body = JSON.stringify(req.body);
    }
    
    // Construire l'URL avec les query parameters
    const url = new URL(functionUrl);
    Object.entries(req.query).forEach(([key, value]) => {
      if (key !== 'path' && value) {
        url.searchParams.append(key, Array.isArray(value) ? value[0] : value);
      }
    });
    
    // Effectuer la requête vers la Cloud Function
    const response = await fetch(url.toString(), fetchOptions);
    const data = await response.json();
    
    // Retourner la réponse
    res.status(response.status).json(data);
    
  } catch (error) {
    console.error('❌ Erreur dans le proxy de réservation:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
}