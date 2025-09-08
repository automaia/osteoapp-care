import { format, parse, isValid, addMinutes, isBefore, isAfter, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Utilitaires pour la gestion des dates et heures
 */
export class DateHelpers {
  /**
   * Formate une date pour l'affichage
   */
  static formatDate(date: Date, formatString: string = 'dd/MM/yyyy'): string {
    return format(date, formatString, { locale: fr });
  }

  /**
   * Formate une heure pour l'affichage
   */
  static formatTime(date: Date): string {
    return format(date, 'HH:mm');
  }

  /**
   * Parse une chaîne de temps au format "HH:MM"
   */
  static parseTime(timeString: string): Date {
    const today = new Date();
    const parsed = parse(timeString, 'HH:mm', today);
    
    if (!isValid(parsed)) {
      throw new Error(`Format de temps invalide: ${timeString}`);
    }
    
    return parsed;
  }

  /**
   * Combine une date et une heure
   */
  static combineDateTime(date: Date, timeString: string): Date {
    const time = this.parseTime(timeString);
    const combined = new Date(date);
    combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return combined;
  }

  /**
   * Vérifie si un créneau est dans le futur
   */
  static isFutureSlot(date: Date, timeString: string): boolean {
    const slotDateTime = this.combineDateTime(date, timeString);
    return isAfter(slotDateTime, new Date());
  }

  /**
   * Génère des créneaux horaires entre deux heures
   */
  static generateTimeSlots(
    startTime: string, 
    endTime: string, 
    duration: number = 60
  ): string[] {
    const slots: string[] = [];
    const start = this.parseTime(startTime);
    const end = this.parseTime(endTime);
    
    let current = start;
    
    while (isBefore(current, end)) {
      slots.push(this.formatTime(current));
      current = addMinutes(current, duration);
    }
    
    return slots;
  }

  /**
   * Vérifie si deux créneaux se chevauchent
   */
  static slotsOverlap(
    slot1Start: string,
    slot1End: string,
    slot2Start: string,
    slot2End: string
  ): boolean {
    const start1 = this.parseTime(slot1Start);
    const end1 = this.parseTime(slot1End);
    const start2 = this.parseTime(slot2Start);
    const end2 = this.parseTime(slot2End);

    return isBefore(start1, end2) && isAfter(end1, start2);
  }

  /**
   * Calcule l'heure de fin à partir de l'heure de début et de la durée
   */
  static calculateEndTime(startTime: string, duration: number): string {
    const start = this.parseTime(startTime);
    const end = addMinutes(start, duration);
    return this.formatTime(end);
  }

  /**
   * Valide qu'une date est dans une plage acceptable (pas trop dans le passé ou le futur)
   */
  static isValidAppointmentDate(date: Date): boolean {
    const now = new Date();
    const maxFutureDate = new Date();
    maxFutureDate.setMonth(maxFutureDate.getMonth() + 6); // 6 mois dans le futur

    return isAfter(date, startOfDay(now)) && isBefore(date, endOfDay(maxFutureDate));
  }

  /**
   * Obtient le nom du jour de la semaine en français
   */
  static getDayName(date: Date): string {
    return format(date, 'EEEE', { locale: fr });
  }

  /**
   * Obtient la clé du jour pour la structure de planning (monday, tuesday, etc.)
   */
  static getDayKey(date: Date): string {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return dayNames[date.getDay()];
  }
}