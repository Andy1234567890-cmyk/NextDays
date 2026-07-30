import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Sarcini și curățenie",
  description: "Organizați planurile de curățenie și sarcinile echipei.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Operațiuni",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Adăugarea sarcinilor",
          excerpt: "Cum creați o sarcină nouă pentru un obiect sau o perioadă.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Sarcinile reunesc tot ce trebuie făcut în jurul unui obiect — de la curățenia după check-out, până la lucrări de întreținere sau cereri ale oaspeților. Fiecare sarcină este legată de exact un obiect și poate fi atribuită unui membru al echipei.",
            },
            { type: "h2", text: "Crearea unei sarcini noi" },
            {
              type: "steps",
              items: [
                "Deschideți secțiunea „Sarcini” din meniul principal.",
                "Apăsați pe „Sarcină nouă”.",
                "Alegeți obiectul vizat.",
                "Atribuiți un titlu și, opțional, o descriere.",
                "Stabiliți data și ora scadenței.",
                "Salvați sarcina.",
              ],
            },
            { type: "h2", text: "Tipuri de sarcini" },
            {
              type: "p",
              text: "Pe lângă sarcinile libere, există sarcini generate de sistem, de exemplu curățenii planificate automat după un check-out. Acestea sunt deja legate de obiect și de fereastra de timp potrivită și trebuie doar atribuite unui membru al echipei.",
            },
            {
              type: "ul",
              items: [
                "Sarcină manuală: introdusă liber, de ex. întreținere sau dorință specială.",
                "Sarcină automată de curățenie: derivată din data check-out-ului.",
                "Sarcină recurentă: pentru controale sau inspecții regulate.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Detalii despre planificarea automată în timp găsiți la [Planuri de curățenie](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Atribuiți titluri precise — membrii echipei văd adesea în vizualizarea mobilă doar titlul și obiectul, dintr-o privire.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Planuri de curățenie",
          excerpt: "Planificați automat curățenia după check-out.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Un plan de curățenie asigură ca, după fiecare check-out, să apară automat o sarcină de curățenie pentru obiectul afectat — fără să trebuiască să urmăriți fiecare rezervare în parte. Acest lucru reduce predările uitate și asigură un proces fiabil între două sejururi.",
            },
            { type: "h2", text: "Activarea planificării automate" },
            {
              type: "steps",
              items: [
                "Deschideți obiectul și treceți la fila „Curățenie”.",
                "Activați „Planificare automată a curățeniei după check-out”.",
                "Stabiliți cât timp după check-out este planificat pentru curățenie.",
                "Determinați, opțional, o echipă implicită sau o persoană de curățenie implicită.",
                "Salvați setarea.",
              ],
            },
            { type: "h2", text: "Interacțiunea cu calendarul" },
            {
              type: "p",
              text: "De îndată ce o rezervare este anulată sau mutată, sarcina de curățenie aferentă se ajustează automat la noua dată de check-out. Astfel planul de curățenie rămâne întotdeauna sincronizat cu starea reală de ocupare.",
            },
            {
              type: "ul",
              items: [
                "Curățenia apare automat la fiecare check-out, cu plan activ.",
                "Dacă rezervarea se mută, se mută și sarcina de curățenie.",
                "Dacă oaspeții anulează sejurul, sarcina de curățenie este eliminată.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Fără un plan de curățenie activat, nu apar sarcini automate — adăugați atunci curățenii manual la [Adăugarea sarcinilor](/hilfe/aufgaben-reinigung/aufgaben-anlegen).",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Atribuirea sarcinilor",
          excerpt: "Atribuiți în mod țintit sarcini persoanelor de curățenie sau membrilor echipei.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Pentru ca o sarcină să fie îndeplinită, o atribuiți unui membru concret al echipei — de exemplu o persoană de curățenie sau un angajat cu responsabilitate de întreținere. Implicit, doar persoana atribuită vede sarcina în propria sa privire de ansamblu.",
            },
            { type: "h2", text: "Atribuirea manuală a unei sarcini" },
            {
              type: "steps",
              items: [
                "Deschideți sarcina din lista „Sarcini”.",
                "Apăsați pe „Atribuire”.",
                "Alegeți membrul de echipă responsabil din listă.",
                "Confirmați atribuirea.",
              ],
            },
            { type: "h2", text: "Atribuirea pe obiect" },
            {
              type: "p",
              text: "Dacă unei persoane de curățenie îi este deja atribuit fix un obiect, puteți lăsa ca sarcinile pentru acest obiect să fie atribuite automat acelei persoane. Acest lucru economisește clicuri la curățeniile recurente și reduce întrebările suplimentare.",
            },
            {
              type: "ul",
              items: [
                "Atribuire manuală: alegeți dvs. înșivă persoana pentru fiecare sarcină.",
                "Atribuire fixă pe obiect: sarcinile noi pentru acest obiect merg automat la persoana înregistrată.",
                "O sarcină are întotdeauna exact o persoană responsabilă.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Persoanele de curățenie și angajații văd exclusiv sarcinile proprii atribuite, fără date financiare sau de vânzări ale obiectului.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Urmărirea statusului sarcinilor",
          excerpt: "Țineți evidența în timp real a stadiului de procesare al sarcinilor.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Fiecare sarcină parcurge un status clar — de la deschis, la în lucru, până la finalizat. Astfel vedeți oricând dacă o curățenie sau întreținere se finalizează la timp, înainte de următorul check-in.",
            },
            { type: "h2", text: "Prezentare generală a statusurilor" },
            {
              type: "ul",
              items: [
                "Deschis: sarcina este creată, dar nu a fost încă începută.",
                "În lucru: persoana atribuită a început sarcina.",
                "Finalizat: sarcina este îndeplinită și confirmată.",
              ],
            },
            { type: "h2", text: "Actualizarea statusului" },
            {
              type: "steps",
              items: [
                "Deschideți sarcina din lista „Sarcini”.",
                "Alegeți statusul potrivit, de ex. „În lucru” sau „Finalizat”.",
                "Completați, dacă este necesar, o notă scurtă, de exemplu despre particularități la obiect.",
                "Salvați modificarea.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Modificările de status apar imediat în lista partajată de sarcini — nu este necesară o reîncărcare manuală.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Dacă o curățenie este încă deschisă cu puțin timp înainte de următorul check-in, verificați mai întâi atribuirea, înainte de a contacta oaspetele.",
            },
          ],
        },
      ],
    },
  ],
};
