/**
 * Générateur de fichiers ICS pour les rendez-vous
 */

export interface ICSEvent {
  uid: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  organizer?: {
    name: string;
    email: string;
  };
  attendee?: {
    name: string;
    email: string;
  };
}

/**
 * Formate une date pour le format ICS (YYYYMMDDTHHMMSSZ)
 */
function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Échappe les caractères spéciaux pour ICS
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Génère un fichier ICS pour un rendez-vous
 */
export function generateICS(event: ICSEvent): string {
  const now = new Date();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OsteoApp//Booking System//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${event.uid}@osteoapp.com`,
    `DTSTAMP:${formatICSDate(now)}`,
    `DTSTART:${formatICSDate(event.start)}`,
    `DTEND:${formatICSDate(event.end)}`,
    `SUMMARY:${escapeICSText(event.title)}`,
    `DESCRIPTION:${escapeICSText(event.description || '')}`,
    `LOCATION:${escapeICSText(event.location || '')}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'TRANSP:OPAQUE'
  ];

  if (event.organizer) {
    lines.push(`ORGANIZER;CN=${escapeICSText(event.organizer.name)}:MAILTO:${event.organizer.email}`);
  }

  if (event.attendee) {
    lines.push(`ATTENDEE;CN=${escapeICSText(event.attendee.name)};RSVP=TRUE:MAILTO:${event.attendee.email}`);
  }

  lines.push(
    'END:VEVENT',
    'END:VCALENDAR'
  );

  return lines.join('\r\n');
}

/**
 * Crée un blob téléchargeable pour un fichier ICS
 */
export function createICSDownload(event: ICSEvent, filename?: string): void {
  const icsContent = generateICS(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `rendez-vous-${event.start.toISOString().split('T')[0]}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}