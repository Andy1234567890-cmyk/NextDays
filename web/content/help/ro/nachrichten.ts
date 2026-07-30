import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Mesaje și oaspeți",
  description: "Mesagerie, șabloane și comunicarea cu oaspeții.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Comunicare",
      articles: [
        {
          slug: "posteingang",
          title: "Mesageria platformei",
          excerpt: "Toate mesajele oaspeților obiectelor dvs. se adună centralizat în mesageria platformei.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "O mesagerie pentru toate obiectele" },
            {
              type: "p",
              text: "Mesageria platformei reunește într-un singur loc toate mesajele oaspeților dvs. — indiferent prin ce obiect sau perioadă se desfășoară conversația. O deschideți la /nachrichten și vedeți acolo fiecare conversație ca un fir propriu.",
            },
            { type: "h2", text: "Structura mesageriei" },
            {
              type: "ul",
              items: [
                "Coloana din stânga: lista tuturor conversațiilor, cele mai noi primele",
                "Coloana din mijloc: istoricul activ de mesaje cu oaspetele",
                "Coloana din dreapta: contextul rezervării — perioadă, obiect, datele oaspetelui",
              ],
            },
            { type: "h2", text: "Răspunsul la un mesaj" },
            {
              type: "steps",
              items: [
                "Deschideți /nachrichten și alegeți conversația dorită",
                "Scrieți răspunsul dvs. în câmpul de text sau folosiți un răspuns rapid",
                "Trimiteți mesajul — oaspetele îl primește pe aceeași cale prin care a scris",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Mesageria platformei arată exclusiv comunicarea directă dintre dvs. și oaspeții dvs. pe myNextDays — mesajele de pe portaluri le gestionați în continuare acolo.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Răspunsuri rapide",
          excerpt: "Șabloanele pentru întrebări frecvente economisesc timp în contactul cu oaspeții.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "Ce sunt răspunsurile rapide" },
            {
              type: "p",
              text: "Răspunsurile rapide sunt module de text preformulate pentru întrebări recurente — de exemplu despre sosire, parola Wi-Fi sau situația parcării. În loc să scrieți din nou fiecare răspuns, introduceți șablonul potrivit cu un clic în [Mesageria platformei](/hilfe/nachrichten/posteingang).",
            },
            { type: "h2", text: "Adăugarea unui răspuns rapid" },
            {
              type: "steps",
              items: [
                "Deschideți /nachrichten și apăsați pe „Gestionare răspunsuri rapide”",
                "Apăsați pe „Șablon nou” și atribuiți un titlu, de exemplu „Informații check-in”",
                "Scrieți textul răspunsului; substituenți precum numele oaspetelui sau data sosirii sunt completați automat la trimitere",
                "Salvați șablonul — este disponibil din acest moment în fiecare conversație",
              ],
            },
            { type: "h2", text: "Folosirea răspunsurilor rapide în practica zilnică" },
            {
              type: "p",
              text: "În fereastra de mesaje deschideți lista de șabloane prin simbolul fulgerului, alegeți răspunsul potrivit și îl ajustați, dacă este necesar, individual, înainte de a-l trimite.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Adăugați șabloane pentru cele mai frecvente cinci până la zece întrebări — în practică, acest lucru acoperă majoritatea mesajelor primite.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Mesaje automate",
          excerpt: "Confirmări, informații de check-in și reamintiri pot fi trimise automat oaspeților.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "Automatizarea mesajelor recurente" },
            {
              type: "p",
              text: "În loc să trimiteți manual confirmări de rezervare, indicații de check-in sau mesaje de mulțumire, le înregistrați o singură dată ca regulă — myNextDays le trimite apoi automat, la momentul potrivit, înainte, în timpul sau după sejur.",
            },
            { type: "h2", text: "Declanșatori tipici pentru mesaje automate" },
            {
              type: "ul",
              items: [
                "Imediat după rezervare — confirmare cu cele mai importante date",
                "Cu câteva zile înainte de sosire — informații de check-in și cod de acces",
                "În ziua plecării — mulțumire și solicitare de recenzie",
              ],
            },
            { type: "h2", text: "Configurarea unui mesaj automat" },
            {
              type: "steps",
              items: [
                "Deschideți /nachrichten, secțiunea „Mesaje automate”",
                "Alegeți declanșatorul, de exemplu „X zile înainte de sosire”",
                "Introduceți textul — substituenți precum numele oaspetelui, obiectul sau data sosirii sunt completați automat",
                "Activați regula; aceasta se aplică tuturor obiectelor, dacă nu este restricționată altfel",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Mesajele automate apar normal în [Mesageria platformei](/hilfe/nachrichten/posteingang) și pot fi consultate ulterior acolo oricând.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Blocarea mesajelor",
          excerpt: "Puteți bloca o persoană direct din istoricul de mesaje, pentru contactul ulterior.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "Când este utilă o blocare" },
            {
              type: "p",
              text: "În cazul mesajelor jignitoare, hărțuirii sau al unui comportament repetat necorespunzător, puteți bloca o persoană direct din firul de mesaje. O persoană blocată nu vă mai poate scrie mesaje noi și nu mai poate crea o rezervare nouă la dvs.",
            },
            { type: "h2", text: "Blocarea unei persoane din fir" },
            {
              type: "steps",
              items: [
                "Deschideți conversația afectată în [Mesageria platformei](/hilfe/nachrichten/posteingang)",
                "Apăsați sus, în fir, pe meniu și alegeți „Blocare persoană”",
                "Confirmați procesul — blocarea se aplică imediat",
              ],
            },
            { type: "h2", text: "Ce înseamnă blocarea — și ce nu" },
            {
              type: "ul",
              items: [
                "Mesajele noi ale persoanei blocate nu mai sunt livrate",
                "Cererile noi de rezervare ale persoanei sunt respinse",
                "Dacă persoana are în prezent o rezervare în curs, comunicarea rămâne, prin excepție, posibilă pe durata sejurului",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "O blocare poate fi ridicată oricând în privirea de ansamblu „Persoane blocate” din Cont. Verificați înainte de blocare dacă există deja o rezervare în curs.",
            },
          ],
        },
      ],
    },
  ],
};
