import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Configuration SMTP
const SMTP_CONFIG = {
  hostname: Deno.env.get("SMTP_HOST") || "",
  port: parseInt(Deno.env.get("SMTP_PORT") || "587"),
  username: Deno.env.get("SMTP_USERNAME") || "",
  password: Deno.env.get("SMTP_PASSWORD") || "",
};

// Validation des paramètres de requête
function validateEmailRequest(body: any): string | null {
  if (!body) return "Corps de requête manquant";
  if (!body.to) return "Destinataire (to) manquant";
  if (!body.subject) return "Sujet (subject) manquant";
  if (!body.text && !body.html) return "Contenu (text ou html) manquant";
  return null;
}

// Limites de taux par utilisateur
const rateLimits = new Map<string, { count: number, resetTime: number }>();
const RATE_LIMIT = 10; // 10 emails par heure
const RATE_WINDOW = 60 * 60 * 1000; // 1 heure

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimits.get(userId);
  
  if (!userLimit) {
    rateLimits.set(userId, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  
  if (now > userLimit.resetTime) {
    rateLimits.set(userId, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }
  
  userLimit.count += 1;
  return true;
}

serve(async (req) => {
  // Gestion des requêtes OPTIONS (CORS)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  
  // Vérifier que la méthode est POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: true, message: "Méthode non autorisée" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  try {
    // Vérification de l'authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: true, message: "Authentification requise" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Extraction du token (à valider selon votre logique d'authentification)
    const token = authHeader.split(' ')[1];
    const userId = "user-123"; // À remplacer par l'extraction de l'ID utilisateur du token
    
    // Vérification de la limite de taux
    if (!checkRateLimit(userId)) {
      return new Response(
        JSON.stringify({ 
          error: true, 
          message: "Limite de taux dépassée. Veuillez réessayer plus tard." 
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Récupération et validation du corps de la requête
    const body = await req.json();
    const validationError = validateEmailRequest(body);
    
    if (validationError) {
      return new Response(
        JSON.stringify({ error: true, message: validationError }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Configuration du client SMTP
    const client = new SmtpClient();
    await client.connectTLS({
      hostname: SMTP_CONFIG.hostname,
      port: SMTP_CONFIG.port,
      username: SMTP_CONFIG.username,
      password: SMTP_CONFIG.password,
    });
    
    // Préparation de l'email
    const email = {
      from: body.from || `"OstheoApp" <${SMTP_CONFIG.username}>`,
      to: body.to,
      subject: body.subject,
      content: body.html || body.text,
      html: !!body.html,
    };
    
    // Envoi de l'email
    await client.send(email);
    await client.close();
    
    // Réponse de succès
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email envoyé avec succès",
        to: body.to,
        subject: body.subject
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Erreur dans la Cloud Function email-sender:", error);
    
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
});