// Hauptexport für das zentrale Platzhalter-System

export * from './aliases';
export { default as companyPlaceholders } from './categories/company';
export { default as customerPlaceholders } from './categories/customer';

// Kategorie-spezifische Exports
export { default as dateTimePlaceholders } from './categories/dateTime';
export { default as invoicePlaceholders } from './categories/invoice';
export { default as quotePlaceholders } from './categories/quote';
export * from './placeholderEngine';
// Haupt-Engine als Default Export
export { default } from './placeholderEngine';
export * from './types';
