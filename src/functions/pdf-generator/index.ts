import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as base64 from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Validation des paramètres de requête
function validatePdfRequest(body: any): string | null {
  if (!body) return "Corps de requête manquant";
  if (!body.template) return "Template manquant";
  if (!body.data) return "Données manquantes";
  return null;
}

// Limites de taux par utilisateur
const rateLimits = new Map<string, { count: number, resetTime: number }>();
const RATE_LIMIT = 20; // 20 PDFs par heure
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

// Génération de PDF à partir d'un template HTML
async function generatePdf(template: string, data: any): Promise<Uint8Array> {
  try {
    // Remplacer les variables dans le template
    let htmlContent = template;
    // S'assurer que les champs firstName et lastName sont toujours inclus
    const processedData = {
      ...data,
      firstName: data.firstName || data.patientName?.split(' ')[0] || '',
      lastName: data.lastName || data.patientName?.split(' ').slice(1).join(' ') || ''
    };
    
    for (const [key, value] of Object.entries(processedData)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      htmlContent = htmlContent.replace(regex, String(value));
    }
    
    // Utiliser un service externe pour la génération PDF
    // Ici, nous utilisons une API fictive pour l'exemple
    const response = await fetch("https://api.html-to-pdf.service/convert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("PDF_API_KEY")}`
      },
      body: JSON.stringify({ html: htmlContent })
    });
    
    if (!response.ok) {
      throw new Error(`Erreur lors de la génération du PDF: ${response.statusText}`);
    }
    
    // Récupérer le PDF en tant que tableau d'octets
    const pdfBytes = await response.arrayBuffer();
    return new Uint8Array(pdfBytes);
  } catch (error) {
    console.error("Erreur lors de la génération du PDF:", error);
    throw error;
  }
}

// Templates prédéfinis
const TEMPLATES = {
  invoice: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Facture {{invoiceNumber}} - {{firstName}} {{lastName}}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; }
        .invoice-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .invoice-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .invoice-table th, .invoice-table td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        .total { text-align: right; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Facture</h1>
        <p>{{practitionerName}}</p>
      </div>
      
      <div class="invoice-info">
        <div>
          <p><strong>Facturé à:</strong><br>
          {{firstName}} {{lastName}}<br>
          {{patientAddress}}</p>
        </div>
        <div>
          <p><strong>Facture #:</strong> {{invoiceNumber}}<br>
          <strong>Date:</strong> {{issueDate}}<br>
          <strong>Échéance:</strong> {{dueDate}}</p>
        </div>
      </div>
      
      <table class="invoice-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Quantité</th>
            <th>Prix unitaire</th>
            <th>Montant</th>
          </tr>
        </thead>
        <tbody>
          {{#items}}
          <tr>
            <td>{{description}}</td>
            <td>{{quantity}}</td>
            <td>{{unitPrice}} €</td>
            <td>{{amount}} €</td>
          </tr>
          {{/items}}
        </tbody>
      </table>
      
      <div class="total">
        <p><strong>Sous-total:</strong> {{subtotal}} €</p>
        <p><strong>TVA:</strong> {{tax}} €</p>
        <h3>Total: {{total}} €</h3>
      </div>
      
      <div>
        <p><strong>Notes:</strong><br>{{notes}}</p>
      </div>
    </body>
    </html>
  `,
  
  medicalCertificate: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Certificat Médical</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; }
        .content { line-height: 1.6; }
        .signature { margin-top: 50px; text-align: right; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Certificat Médical</h1>
        <p>{{practitionerName}}<br>{{practitionerQualification}}</p>
      </div>
      
      <div class="content">
        <p>Je soussigné, {{practitionerName}}, certifie avoir examiné {{firstName}} {{lastName}}, né(e) le {{patientDateOfBirth}}.</p>
        
        <p>{{certificateContent}}</p>
        
        <p>Ce certificat est délivré à la demande de l'intéressé et remis en main propre pour faire valoir ce que de droit.</p>
      </div>
      
      <div class="signature">
        <p>Fait à {{location}}, le {{issueDate}}</p>
        <p>Signature:</p>
        <p>{{practitionerName}}</p>
      </div>
    </body>
    </html>
  `
};

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
    const validationError = validatePdfRequest(body);
    
    if (validationError) {
      return new Response(
        JSON.stringify({ error: true, message: validationError }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Récupération du template
    let template = body.template;
    if (TEMPLATES[template]) {
      template = TEMPLATES[template];
    }
    
    // Génération du PDF
    const pdfBytes = await generatePdf(template, body.data);
    
    // Encodage en base64 pour la réponse
    const base64Pdf = base64.encode(pdfBytes);
    
    // Réponse de succès
    return new Response(
      JSON.stringify({ 
        success: true, 
        pdf: base64Pdf,
        filename: body.filename || `document-${Date.now()}.pdf`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Erreur dans la Cloud Function pdf-generator:", error);
    
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