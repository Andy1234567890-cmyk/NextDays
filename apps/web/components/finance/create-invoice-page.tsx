'use client';

// Fassade: Die Rechnungserstellung lebt vollständig unter create-invoice/
// (container.tsx + JSX-Module + Hooks). Export-Vertrag bleibt erhalten:
// default = Client-Komponente ohne Props.
export { default } from './create-invoice/container';
