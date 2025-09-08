import { Deno } from "npm:@deno/shim-deno";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Stockage sécurisé des clés API
const API_KEYS = {
  WEATHER_API: Deno.env.get("WEATHER_API_KEY") || "",
  NEWS_API: Deno.env.get("NEWS_API_KEY") || "",
  GEOCODING_API: Deno.env.get("GEOCODING_API_KEY") || "",
};

// Validation des paramètres de requête
function validateParams(params: URLSearchParams, requiredParams: string[]): string | null {
  for (const param of requiredParams) {
    if (!params.has(param) || !params.get(param)) {
      return `Le paramètre '${param}' est requis`;
    }
  }
  return null;
}

// Gestion des erreurs
function handleError(error: any): Response {
  console.error("Erreur dans la Cloud Function:", error);
  
  const errorMessage = error.message || "Une erreur inconnue s'est produite";
  const statusCode = error.statusCode || 500;
  
  return new Response(
    JSON.stringify({
      error: true,
      message: errorMessage,
      status: statusCode
    }),
    {
      status: statusCode,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}

// Mise en cache simple
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCachedData(key: string): any | null {
  const cachedItem = cache.get(key);
  if (cachedItem && (Date.now() - cachedItem.timestamp) < CACHE_DURATION) {
    return cachedItem.data;
  }
  return null;
}

function setCachedData(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// Fonction pour récupérer les données météo
async function getWeatherData(city: string): Promise<any> {
  const cacheKey = `weather_${city}`;
  const cachedData = getCachedData(cacheKey);
  
  if (cachedData) {
    return cachedData;
  }
  
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&lang=fr&appid=${API_KEYS.WEATHER_API}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const error = await response.json();
    throw { 
      message: `Erreur API météo: ${error.message || response.statusText}`,
      statusCode: response.status
    };
  }
  
  const data = await response.json();
  setCachedData(cacheKey, data);
  
  return data;
}

// Fonction pour récupérer les actualités
async function getNewsData(category: string, country: string = 'fr'): Promise<any> {
  const cacheKey = `news_${category}_${country}`;
  const cachedData = getCachedData(cacheKey);
  
  if (cachedData) {
    return cachedData;
  }
  
  const url = `https://newsapi.org/v2/top-headlines?country=${country}&category=${category}&apiKey=${API_KEYS.NEWS_API}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const error = await response.json();
    throw { 
      message: `Erreur API actualités: ${error.message || response.statusText}`,
      statusCode: response.status
    };
  }
  
  const data = await response.json();
  setCachedData(cacheKey, data);
  
  return data;
}

// Fonction pour le géocodage
async function getGeocodingData(address: string): Promise<any> {
  const cacheKey = `geocoding_${address}`;
  const cachedData = getCachedData(cacheKey);
  
  if (cachedData) {
    return cachedData;
  }
  
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEYS.GEOCODING_API}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const error = await response.json();
    throw { 
      message: `Erreur API géocodage: ${error.message || response.statusText}`,
      statusCode: response.status
    };
  }
  
  const data = await response.json();
  setCachedData(cacheKey, data);
  
  return data;
}

// Gestionnaire principal des requêtes
serve(async (req) => {
  // Gestion des requêtes OPTIONS (CORS)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  
  try {
    const url = new URL(req.url);
    const endpoint = url.pathname.split('/').pop();
    const params = url.searchParams;
    
    // Vérification de l'authentification (à adapter selon vos besoins)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: true, message: "Authentification requise" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Extraction du token (à valider selon votre logique d'authentification)
    const token = authHeader.split(' ')[1];
    
    // Ici, vous pourriez vérifier le token avec Firebase Auth
    // const user = await verifyToken(token);
    
    // Routage vers les différentes fonctionnalités
    switch (endpoint) {
      case "weather":
        const cityError = validateParams(params, ["city"]);
        if (cityError) {
          return new Response(
            JSON.stringify({ error: true, message: cityError }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const city = params.get("city")!;
        const weatherData = await getWeatherData(city);
        
        return new Response(
          JSON.stringify(weatherData),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
        
      case "news":
        const newsError = validateParams(params, ["category"]);
        if (newsError) {
          return new Response(
            JSON.stringify({ error: true, message: newsError }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const category = params.get("category")!;
        const country = params.get("country") || "fr";
        const newsData = await getNewsData(category, country);
        
        return new Response(
          JSON.stringify(newsData),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
        
      case "geocoding":
        const addressError = validateParams(params, ["address"]);
        if (addressError) {
          return new Response(
            JSON.stringify({ error: true, message: addressError }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const address = params.get("address")!;
        const geocodingData = await getGeocodingData(address);
        
        return new Response(
          JSON.stringify(geocodingData),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
        
      default:
        return new Response(
          JSON.stringify({ error: true, message: "Endpoint non trouvé" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    return handleError(error);
  }
});