// Datum und Zeit Platzhalter - Zentrale Implementierung
import type { PlaceholderRegistry } from '../types';

// Hilfsfunktionen für erweiterte Datumsberechnungen
function formatDateDE(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getISOWeek(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

function getMonthName(date: Date): string {
  return date.toLocaleDateString('de-DE', { month: 'long' });
}

function getMonthNameShort(date: Date): string {
  return date.toLocaleDateString('de-DE', { month: 'short' });
}

function getMonthNumber(date: Date): string {
  return (date.getMonth() + 1).toString().padStart(2, '0');
}

function getWeekdayName(date: Date): string {
  return date.toLocaleDateString('de-DE', { weekday: 'long' });
}

function getQuarter(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

function getNextQuarter(date: Date): number {
  const currentQuarter = getQuarter(date);
  return currentQuarter === 4 ? 1 : currentQuarter + 1;
}

function getPreviousQuarter(date: Date): number {
  const currentQuarter = getQuarter(date);
  return currentQuarter === 1 ? 4 : currentQuarter - 1;
}

function getYesterday(): Date {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday;
}

function getDaysInCurrentMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

// Hauptregistry für Datum/Zeit-Platzhalter
export const dateTimePlaceholders: PlaceholderRegistry = {
  // Basis-Datum Platzhalter
  HEUTE: () => formatDateDE(new Date()),
  DATUM: () => formatDateDE(new Date()),
  JAHR: () => new Date().getFullYear().toString(),
  'JAHR.KURZ': () => new Date().getFullYear().toString().slice(-2),

  // Monat Platzhalter
  MONAT: () => getMonthName(new Date()),
  'MONAT.KURZ': () => getMonthNameShort(new Date()),
  'MONAT.ZAHL': () => getMonthNumber(new Date()),

  // Tag und Wochentag
  TAG: () => new Date().getDate().toString().padStart(2, '0'),
  WOCHENTAG: () => getWeekdayName(new Date()),
  HEUTETAG: () => new Date().getDate().toString().padStart(2, '0'),
  HEUTETAG_NAME: () => getWeekdayName(new Date()),

  // Kalenderwoche und Quartal
  KALENDERWOCHE: () => getISOWeek(new Date()).toString(),
  KW_NUMMER: () => getISOWeek(new Date()).toString(),
  QUARTAL: () => getQuarter(new Date()).toString(),

  // Vorjahr Platzhalter
  VORJAHR: () => (new Date().getFullYear() - 1).toString(),
  'VORJAHR.KURZ': () => (new Date().getFullYear() - 1).toString().slice(-2),
  LETZTES_JAHR: () => (new Date().getFullYear() - 1).toString(),
  LETZTES_JAHR_KURZ: () => (new Date().getFullYear() - 1).toString().slice(-2),

  // Vormonat Platzhalter
  VORMONAT: () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    return getMonthName(lastMonth);
  },
  'VORMONAT.KURZ': () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    return getMonthNameShort(lastMonth);
  },
  'VORMONAT.ZAHL': () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    return getMonthNumber(lastMonth);
  },
  LETZTER_MONAT: () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    return getMonthName(lastMonth);
  },
  LETZTER_MONAT_KURZ: () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    return getMonthNameShort(lastMonth);
  },
  LETZTER_MONAT_ZAHL: () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    return getMonthNumber(lastMonth);
  },

  // Folgejahr Platzhalter
  FOLGEJAHR: () => (new Date().getFullYear() + 1).toString(),
  'FOLGEJAHR.KURZ': () => (new Date().getFullYear() + 1).toString().slice(-2),
  NAECHSTES_JAHR: () => (new Date().getFullYear() + 1).toString(),
  NAECHSTES_JAHR_KURZ: () => (new Date().getFullYear() + 1).toString().slice(-2),

  // Folgemonat Platzhalter
  FOLGEMONAT: () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return getMonthName(nextMonth);
  },
  'FOLGEMONAT.KURZ': () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return getMonthNameShort(nextMonth);
  },
  'FOLGEMONAT.ZAHL': () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return getMonthNumber(nextMonth);
  },
  NAECHSTER_MONAT: () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return getMonthName(nextMonth);
  },
  NAECHSTER_MONAT_KURZ: () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return getMonthNameShort(nextMonth);
  },
  NAECHSTER_MONAT_ZAHL: () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return getMonthNumber(nextMonth);
  },

  // Folge-Quartal
  FOLGEQUARTAL: () => getNextQuarter(new Date()).toString(),
  NAECHSTES_QUARTAL: () => getNextQuarter(new Date()).toString(),
  VORHERIGES_QUARTAL: () => getPreviousQuarter(new Date()).toString(),

  // Weitere erweiterte Datum-Funktionen
  GESTERN: () => formatDateDE(getYesterday()),
  GESTERN_TAG: () => getYesterday().getDate().toString().padStart(2, '0'),
  GESTERN_MONAT: () => getMonthName(getYesterday()),
  GESTERN_JAHR: () => getYesterday().getFullYear().toString(),

  // Monat-spezifische Funktionen
  TAGE_IM_MONAT: () => getDaysInCurrentMonth().toString(),
  MONAT_ERSTER_TAG: () => '01',
  MONAT_LETZTER_TAG: () => getDaysInCurrentMonth().toString(),

  // ISO-Datum Formate
  DATUM_ISO: () => new Date().toISOString().split('T')[0],
  ZEIT_ISO: () => new Date().toTimeString().split(' ')[0],
  DATETIME_ISO: () => new Date().toISOString(),

  // Timestamp
  TIMESTAMP: () => Math.floor(Date.now() / 1000).toString(),
  TIMESTAMP_MS: () => Date.now().toString(),
};

export default dateTimePlaceholders;
