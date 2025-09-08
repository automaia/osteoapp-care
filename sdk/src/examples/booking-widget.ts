/**
 * Exemple d'implémentation d'un widget de prise de rendez-vous
 * utilisant le SDK OsteoApp
 */

import { OsteoAppSDK, DateHelpers, OsteoAppSDKError } from '../index';

export class BookingWidget {
  private sdk: OsteoAppSDK;
  private container: HTMLElement;
  private selectedOsteopathId: string | null = null;
  private selectedDate: Date | null = null;
  private selectedTime: string | null = null;

  constructor(containerId: string, config: { apiUrl: string; apiKey?: string }) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container avec l'ID "${containerId}" non trouvé`);
    }

    this.container = container;
    this.sdk = new OsteoAppSDK(config);
    this.init();
  }

  private async init() {
    try {
      // Vérifier la connexion
      const isConnected = await this.sdk.testConnection();
      if (!isConnected) {
        this.showError('Service temporairement indisponible');
        return;
      }

      // Charger l'interface
      await this.loadOsteopaths();
    } catch (error) {
      this.showError('Erreur lors de l\'initialisation du widget');
    }
  }

  private async loadOsteopaths() {
    try {
      const osteopaths = await this.sdk.getOsteopaths();
      this.renderOsteopathSelection(osteopaths);
    } catch (error) {
      this.showError('Impossible de charger les praticiens');
    }
  }

  private renderOsteopathSelection(osteopaths: any[]) {
    this.container.innerHTML = `
      <div class="osteoapp-widget">
        <h3 class="widget-title">Prendre rendez-vous</h3>
        <div class="step-1">
          <label class="widget-label">Choisissez votre ostéopathe :</label>
          <select id="osteopath-select" class="widget-select">
            <option value="">Sélectionner un praticien</option>
            ${osteopaths.map(o => `
              <option value="${o.id}">${o.firstName} ${o.lastName}</option>
            `).join('')}
          </select>
        </div>
        <div id="date-selection" style="display: none;"></div>
        <div id="time-selection" style="display: none;"></div>
        <div id="patient-form" style="display: none;"></div>
        <div id="confirmation" style="display: none;"></div>
      </div>
    `;

    // Ajouter les styles CSS
    this.addStyles();

    // Gérer la sélection d'ostéopathe
    const select = document.getElementById('osteopath-select') as HTMLSelectElement;
    select.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      if (target.value) {
        this.selectedOsteopathId = target.value;
        this.showDateSelection();
      }
    });
  }

  private showDateSelection() {
    const dateContainer = document.getElementById('date-selection')!;
    dateContainer.style.display = 'block';
    
    // Générer les 14 prochains jours
    const dates = [];
    for (let i = 1; i <= 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      dates.push(date);
    }

    dateContainer.innerHTML = `
      <div class="step-2">
        <label class="widget-label">Choisissez une date :</label>
        <div class="date-grid">
          ${dates.map(date => `
            <button 
              class="date-button" 
              data-date="${DateHelpers.formatDate(date, 'yyyy-MM-dd')}"
            >
              <div class="date-day">${DateHelpers.formatDate(date, 'EEE')}</div>
              <div class="date-number">${DateHelpers.formatDate(date, 'd')}</div>
              <div class="date-month">${DateHelpers.formatDate(date, 'MMM')}</div>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    // Gérer la sélection de date
    const dateButtons = dateContainer.querySelectorAll('.date-button');
    dateButtons.forEach(button => {
      button.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLElement;
        const dateStr = target.dataset.date!;
        this.selectedDate = new Date(dateStr);
        
        // Marquer comme sélectionné
        dateButtons.forEach(b => b.classList.remove('selected'));
        target.classList.add('selected');
        
        await this.showTimeSelection();
      });
    });
  }

  private async showTimeSelection() {
    if (!this.selectedOsteopathId || !this.selectedDate) return;

    const timeContainer = document.getElementById('time-selection')!;
    timeContainer.style.display = 'block';
    timeContainer.innerHTML = '<div class="loading">Chargement des créneaux...</div>';

    try {
      const availability = await this.sdk.appointments.getAvailableSlots(
        this.selectedOsteopathId,
        this.selectedDate,
        60
      );

      if (!availability.isOpen) {
        timeContainer.innerHTML = `
          <div class="step-3">
            <p class="no-slots">Cabinet fermé ce jour-là</p>
          </div>
        `;
        return;
      }

      const availableSlots = availability.slots.filter(slot => slot.available);
      
      if (availableSlots.length === 0) {
        timeContainer.innerHTML = `
          <div class="step-3">
            <p class="no-slots">Aucun créneau disponible ce jour-là</p>
          </div>
        `;
        return;
      }

      timeContainer.innerHTML = `
        <div class="step-3">
          <label class="widget-label">Choisissez un horaire :</label>
          <div class="time-grid">
            ${availableSlots.map(slot => `
              <button class="time-button" data-time="${slot.start}">
                ${slot.start}
              </button>
            `).join('')}
          </div>
        </div>
      `;

      // Gérer la sélection d'horaire
      const timeButtons = timeContainer.querySelectorAll('.time-button');
      timeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          const target = e.currentTarget as HTMLElement;
          this.selectedTime = target.dataset.time!;
          
          // Marquer comme sélectionné
          timeButtons.forEach(b => b.classList.remove('selected'));
          target.classList.add('selected');
          
          this.showPatientForm();
        });
      });

    } catch (error) {
      timeContainer.innerHTML = `
        <div class="error">
          Erreur lors du chargement des créneaux
        </div>
      `;
    }
  }

  private showPatientForm() {
    const formContainer = document.getElementById('patient-form')!;
    formContainer.style.display = 'block';
    
    formContainer.innerHTML = `
      <div class="step-4">
        <label class="widget-label">Vos informations :</label>
        <form id="patient-info-form" class="patient-form">
          <div class="form-row">
            <input type="text" id="firstName" placeholder="Prénom *" required class="widget-input">
            <input type="text" id="lastName" placeholder="Nom *" required class="widget-input">
          </div>
          <div class="form-row">
            <input type="email" id="email" placeholder="Email *" required class="widget-input">
            <input type="tel" id="phone" placeholder="Téléphone" class="widget-input">
          </div>
          <textarea id="notes" placeholder="Motif de consultation (optionnel)" class="widget-textarea"></textarea>
          <button type="submit" class="widget-button-primary">Confirmer le rendez-vous</button>
        </form>
      </div>
    `;

    // Gérer la soumission du formulaire
    const form = document.getElementById('patient-info-form') as HTMLFormElement;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleBooking();
    });
  }

  private async handleBooking() {
    if (!this.selectedOsteopathId || !this.selectedDate || !this.selectedTime) {
      this.showError('Informations de rendez-vous incomplètes');
      return;
    }

    const form = document.getElementById('patient-info-form') as HTMLFormElement;
    const formData = new FormData(form);
    
    const patient = {
      firstName: (document.getElementById('firstName') as HTMLInputElement).value,
      lastName: (document.getElementById('lastName') as HTMLInputElement).value,
      email: (document.getElementById('email') as HTMLInputElement).value,
      phone: (document.getElementById('phone') as HTMLInputElement).value
    };

    const notes = (document.getElementById('notes') as HTMLTextAreaElement).value;

    try {
      // Désactiver le formulaire
      const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      submitButton.disabled = true;
      submitButton.textContent = 'Création en cours...';

      const appointment = await this.sdk.bookAppointment({
        osteopathId: this.selectedOsteopathId,
        patient,
        date: this.selectedDate,
        time: this.selectedTime,
        notes: notes || undefined
      });

      this.showConfirmation(appointment);

    } catch (error) {
      if (error instanceof OsteoAppSDKError) {
        this.showError(error.message);
      } else {
        this.showError('Erreur lors de la création du rendez-vous');
      }
      
      // Réactiver le formulaire
      const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      submitButton.disabled = false;
      submitButton.textContent = 'Confirmer le rendez-vous';
    }
  }

  private showConfirmation(appointment: any) {
    const confirmationContainer = document.getElementById('confirmation')!;
    confirmationContainer.style.display = 'block';
    
    confirmationContainer.innerHTML = `
      <div class="step-5 confirmation">
        <div class="success-icon">✅</div>
        <h3>Rendez-vous confirmé !</h3>
        <div class="appointment-details">
          <p><strong>Numéro de confirmation :</strong> ${appointment.confirmationNumber}</p>
          <p><strong>Date :</strong> ${DateHelpers.formatDate(this.selectedDate!, 'dd/MM/yyyy')}</p>
          <p><strong>Heure :</strong> ${this.selectedTime}</p>
          <p><strong>Praticien :</strong> ${appointment.osteopathName}</p>
        </div>
        <p class="confirmation-note">
          Un email de confirmation vous a été envoyé.
        </p>
        <button class="widget-button-secondary" onclick="location.reload()">
          Prendre un autre rendez-vous
        </button>
      </div>
    `;

    // Masquer les étapes précédentes
    document.querySelectorAll('.step-1, .step-2, .step-3, .step-4').forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
  }

  private showError(message: string) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'widget-error';
    errorDiv.textContent = message;
    
    // Supprimer les erreurs précédentes
    this.container.querySelectorAll('.widget-error').forEach(el => el.remove());
    
    // Ajouter la nouvelle erreur
    this.container.insertBefore(errorDiv, this.container.firstChild);
    
    // Supprimer après 5 secondes
    setTimeout(() => errorDiv.remove(), 5000);
  }

  private addStyles() {
    if (document.getElementById('osteoapp-widget-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'osteoapp-widget-styles';
    styles.textContent = `
      .osteoapp-widget {
        max-width: 500px;
        margin: 0 auto;
        padding: 20px;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        background: white;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .widget-title {
        font-size: 24px;
        font-weight: bold;
        color: #0A84FF;
        margin-bottom: 20px;
        text-align: center;
      }

      .widget-label {
        display: block;
        font-weight: 600;
        color: #374151;
        margin-bottom: 8px;
      }

      .widget-select, .widget-input, .widget-textarea {
        width: 100%;
        padding: 12px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 16px;
        margin-bottom: 16px;
        transition: border-color 0.2s;
      }

      .widget-select:focus, .widget-input:focus, .widget-textarea:focus {
        outline: none;
        border-color: #0A84FF;
        box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.1);
      }

      .date-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
        gap: 8px;
        margin-bottom: 20px;
      }

      .date-button {
        padding: 12px 8px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        background: white;
        cursor: pointer;
        text-align: center;
        transition: all 0.2s;
      }

      .date-button:hover {
        border-color: #0A84FF;
        background: #f0f9ff;
      }

      .date-button.selected {
        border-color: #0A84FF;
        background: #0A84FF;
        color: white;
      }

      .date-day {
        font-size: 12px;
        text-transform: uppercase;
        opacity: 0.7;
      }

      .date-number {
        font-size: 18px;
        font-weight: bold;
      }

      .date-month {
        font-size: 12px;
        opacity: 0.7;
      }

      .time-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
        gap: 8px;
        margin-bottom: 20px;
      }

      .time-button {
        padding: 12px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        background: white;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s;
      }

      .time-button:hover {
        border-color: #0A84FF;
        background: #f0f9ff;
      }

      .time-button.selected {
        border-color: #0A84FF;
        background: #0A84FF;
        color: white;
      }

      .patient-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .widget-button-primary {
        background: #0A84FF;
        color: white;
        border: none;
        padding: 14px 24px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .widget-button-primary:hover {
        background: #0969C6;
      }

      .widget-button-primary:disabled {
        background: #9ca3af;
        cursor: not-allowed;
      }

      .widget-button-secondary {
        background: #f3f4f6;
        color: #374151;
        border: 1px solid #d1d5db;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .widget-button-secondary:hover {
        background: #e5e7eb;
      }

      .confirmation {
        text-align: center;
        padding: 20px;
      }

      .success-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }

      .appointment-details {
        background: #f0f9ff;
        padding: 16px;
        border-radius: 8px;
        margin: 16px 0;
        text-align: left;
      }

      .confirmation-note {
        color: #6b7280;
        font-size: 14px;
        margin: 16px 0;
      }

      .widget-error {
        background: #fef2f2;
        color: #dc2626;
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 16px;
        border: 1px solid #fecaca;
      }

      .loading {
        text-align: center;
        padding: 20px;
        color: #6b7280;
      }

      .no-slots {
        text-align: center;
        padding: 20px;
        color: #6b7280;
        font-style: italic;
      }

      @media (max-width: 640px) {
        .form-row {
          grid-template-columns: 1fr;
        }
        
        .date-grid {
          grid-template-columns: repeat(4, 1fr);
        }
        
        .time-grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }
    `;

    document.head.appendChild(styles);
  }
}

// Export pour utilisation directe dans le navigateur
(window as any).BookingWidget = BookingWidget;