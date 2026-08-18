import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Dichiarazione di accessibilità",
  stand: "Aggiornato: 18 agosto 2026",
  intro: [
    "myBestDays deve essere utilizzabile da tutti. La presente dichiarazione descrive lo stato dell'accessibilità della piattaforma, le limitazioni note e la via per segnalarci barriere.",
    "Si riferisce ai requisiti della direttiva (UE) 2019/882 sui requisiti di accessibilità dei prodotti e dei servizi, applicabile dal 28 giugno 2025 ai servizi di commercio elettronico.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. Stato dell'accessibilità",
      paragraphs: [
        "Ci orientiamo alla norma armonizzata EN 301 549 e alle sottostanti Web Content Accessibility Guidelines (WCAG) 2.1, livello di conformità AA.",
        "Sono attuati, tra l'altro: piena operabilità da tastiera, focus visibile, struttura semantica dei titoli, etichette su tutti i campi dei moduli, alternative testuali per gli elementi di comando, contrasti cromatici sufficienti, scalabilità del testo senza perdita di contenuto nonché una resa che si adatta alle dimensioni dello schermo.",
        "I testi giuridici sono disponibili in tutte le 24 lingue ufficiali dell'Unione e recano una corretta marcatura linguistica, affinché le utilità per la lettura dello schermo li restituiscano correttamente.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Limitazioni note",
      paragraphs: ["Attualmente non sono accessibili, in particolare:"],
      list: [
        "Foto e descrizioni negli annunci provengono dai fornitori; le alternative testuali alle foto possono mancare o essere insufficienti. Invitiamo i fornitori a integrarle.",
        "Le rappresentazioni cartografiche di terzi incorporate sono operabili da tastiera solo in misura limitata. Tutte le indicazioni di posizione sono disponibili anche come testo.",
        "I documenti caricati dai fornitori (per esempio il regolamento della casa in PDF) non sono sistematicamente marcati per l'accessibilità.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. Accessibilità degli alloggi",
      paragraphs: [
        "La presente dichiarazione riguarda la piattaforma, non gli alloggi. Le indicazioni sull'accessibilità edilizia di un alloggio provengono dal fornitore.",
        "Se dipende da determinate caratteristiche — accesso senza gradini, larghezza delle porte, doccia a filo pavimento, ascensore — le chiarisca con il fornitore tramite la messaggistica prima di prenotare. Indicazioni inesatte sull'accessibilità costituiscono una violazione delle nostre regole e possono essere segnalate.",
      ],
    },
    {
      id: "melden",
      heading: "4. Segnalare barriere",
      paragraphs: [
        `Se incontra una barriera, ce la segnali all'indirizzo ${ANBIETER.email} oppure tramite i canali di contatto indicati in [Reclami e risoluzione delle controversie](https://mybestdays.dk/rechtliches/beschwerden).`,
        "La preghiamo di descrivere quale pagina è interessata, cosa intendeva fare e quali ausili utilizza. Confermiamo la ricezione e Le comunichiamo come e quando elimineremo la barriera.",
        "Se necessita di un'informazione in forma accessibile, la mettiamo a disposizione su richiesta.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Procedura di applicazione",
      paragraphs: [
        "Se non è soddisfatto della nostra risposta, può rivolgersi all'autorità competente per la vigilanza del mercato ai sensi della direttiva (UE) 2019/882.",
        "Erhvervsstyrelsen | Markedsovervågning (già Sikkerhedsstyrelsen), Esbjerg Brygge 30, 6700 Esbjerg, Danimarca",
        "Telefono: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
