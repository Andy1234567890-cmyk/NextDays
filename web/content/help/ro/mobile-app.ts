import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "Aplicația mobilă",
  description: "Aplicația myNextDays pentru mobilitate.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "Aplicație",
      articles: [
        {
          slug: "die-app",
          title: "Aplicația myNextDays",
          excerpt: "Un cont, patru experiențe: Oaspete, Agenție, Owner și Angajat.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Aplicația myNextDays este platforma mobilă pentru întreaga dvs. companie. Nu este un produs separat, ci o interfață de rang egal cu dashboard-ul dvs. web — ambele accesează același cont și aceleași date, doar interfața este optimizată pentru mobilitate.",
            },
            { type: "h2", text: "Patru experiențe într-o singură aplicație" },
            {
              type: "ul",
              items: [
                "Oaspete: vizualizarea rezervărilor, comunicarea cu compania, accesarea informațiilor de check-in.",
                "Agenție: gestionarea mai multor companii și obiecte dintr-o privire de ansamblu.",
                "Owner: vizualizare protejată la scriere asupra propriilor obiecte, ocupare și rapoarte.",
                "Angajat: calendar, sarcini și planuri de curățenie pentru activitatea operațională de zi cu zi.",
              ],
            },
            { type: "h2", text: "Ce experiență vedeți" },
            {
              type: "p",
              text: "După autentificare, aplicația arată automat experiența potrivită rolului dvs. — același rol care se aplică și în dashboard-ul web. Un angajat cu drepturi limitate vede în aplicație exact aceleași restricții ca în browser, întrucât permisiunea este verificată la nivel de server.",
            },
            {
              type: "note",
              variant: "info",
              text: "Mai multe despre roluri și ce pot vedea acestea găsiți la [Roluri și permisiuni](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Nu aveți nevoie de o înregistrare separată pentru aplicație — autentificați-vă pur și simplu cu datele dvs. de acces myNextDays existente.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "Instalarea aplicației și autentificarea",
          excerpt: "Cum descărcați aplicația myNextDays și vă autentificați.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Aplicația myNextDays este disponibilă pentru iOS și Android. Autentificarea se face cu aceleași date de acces ca în dashboard-ul web — nu este necesar un cont separat, nici o nouă înregistrare.",
            },
            { type: "h2", text: "Instalare" },
            {
              type: "steps",
              items: [
                "Deschideți App Store (iOS) sau Google Play (Android).",
                "Căutați „myNextDays”.",
                "Instalați aplicația pe smartphone-ul sau tableta dvs.",
                "Deschideți aplicația după instalare.",
              ],
            },
            { type: "h2", text: "Autentificare" },
            {
              type: "steps",
              items: [
                "Apăsați pe „Autentificare”.",
                "Introduceți adresa dvs. de e-mail și parola.",
                "Confirmați, dacă este cazul, solicitarea de autentificare în doi factori.",
                "Ajungeți automat în experiența potrivită rolului dvs.",
              ],
            },
            {
              type: "ul",
              items: [
                "Datele de acces sunt identice cu cele din dashboard-ul web.",
                "Dacă accesul dvs. a fost revocat, și autentificarea în aplicație este blocată imediat.",
                "În caz de probleme cu parola, folosiți „Am uitat parola” direct în aplicație.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Autentificați-vă exclusiv prin intrarea oficială din App Store, „myNextDays”; aplicația nu solicită niciodată date de acces în afara ecranului de autentificare.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Administrarea din mers",
          excerpt: "Gestionați rezervări, mesaje și sarcini direct de pe smartphone.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Aplicația myNextDays este potrivită în special pentru activitatea curentă din mers: vedeți rezervările actuale, răspundeți mesajelor oaspeților și procesați sarcinile, fără să trebuiască să stați la calculator — modificările apar în timp real și în dashboard-ul web.",
            },
            { type: "h2", text: "Rezervările sub control" },
            {
              type: "p",
              text: "În secțiunea „Rezervări” vedeți sosiri și plecări, ocupare și status, per obiect. Angajații și persoanele de curățenie văd doar informațiile relevante pentru ei, fără prețuri sau detalii de vânzări.",
            },
            { type: "h2", text: "Mesaje și sarcini" },
            {
              type: "steps",
              items: [
                "Deschideți secțiunea „Mesaje”, pentru a răspunde direct cererilor oaspeților.",
                "Treceți la „Sarcini”, pentru a vedea sarcinile atribuite dvs.",
                "Apăsați pe o sarcină, pentru a deschide detaliile și a o finaliza.",
                "Marcați termenele de curățenie finalizate direct la fața locului, ca fiind încheiate.",
              ],
            },
            {
              type: "ul",
              items: [
                "Mesajele și sarcinile noi apar live, fără actualizare manuală.",
                "Sarcinile finalizate sunt vizibile imediat și în dashboard-ul web.",
                "Owner-ii văd rezervările și rapoartele obiectelor lor, dar strict de citire.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Notificările push vă informează despre mesaje noi și sarcini atribuite, de îndată ce le permiteți în setările dispozitivului.",
            },
          ],
        },
      ],
    },
  ],
};
