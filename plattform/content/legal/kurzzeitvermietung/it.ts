import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Locazione breve e obblighi di registrazione",
  stand: "Aggiornato: 18 agosto 2026",
  intro: [
    "In molte città e regioni la locazione breve di immobili abitativi è soggetta ad autorizzazione, registrazione o notifica. La presente pagina illustra cosa ciò comporti per fornitori e ospiti.",
  ],
  sections: [
    {
      id: "rechtsrahmen",
      heading: "1. Quadro giuridico",
      paragraphs: [
        "Il regolamento (UE) 2024/1028 relativo alla raccolta e alla condivisione dei dati riguardanti i servizi di locazione di alloggi di breve durata istituisce un quadro uniforme: laddove uno Stato membro o un ente locale abbia introdotto una procedura di registrazione, ogni unità riceve un numero di registrazione.",
        "Le piattaforme devono mostrare tale numero, verificarne la validità a campione e trasmettere periodicamente alle autorità competenti dati sull'attività.",
        "Restano inoltre applicabili le norme nazionali e locali — per esempio sul mutamento di destinazione d'uso degli alloggi, sul numero massimo di giorni di locazione, sulla sicurezza antincendio e sulla registrazione degli ospiti.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Cosa devono fare i fornitori",
      paragraphs: [
        "Verifichi prima della pubblicazione se al Suo alloggio si applichi un obbligo di registrazione, autorizzazione o notifica e vi adempia.",
        "Inserisca il numero di registrazione nell'immobile, se esistente. Lo mostriamo nell'annuncio.",
        "Rispetti il numero massimo di giorni di locazione e gli altri limiti locali. Vigilare su di essi è compito Suo, non nostro.",
        "Non possiamo mostrare in modo permanente un annuncio privo del numero di registrazione richiesto. Se manca o risulta non valido lo sollecitiamo; in assenza di indicazione disattiviamo l'annuncio.",
      ],
    },
    {
      id: "gaeste",
      heading: "3. Cosa significa per gli ospiti",
      paragraphs: [
        "Se per un alloggio sussiste un obbligo di registrazione, vedrà il numero di registrazione nell'annuncio. Esso indica che la locazione è stata notificata all'autorità competente.",
        "A destinazione può essere richiesta una registrazione (scheda di notifica, dati identificativi, dichiarazione della tassa di soggiorno). Il fornitore richiede i dati necessari; li fornisca per tempo.",
      ],
    },
    {
      id: "datenuebermittlung",
      heading: "4. Trasmissione di dati alle autorità",
      paragraphs: [
        "Nella misura prevista dal regolamento (UE) 2024/1028 o dal diritto nazionale, trasmettiamo alle autorità competenti dati sull'attività di locazione — in particolare numero di registrazione, indirizzo dell'unità, numero di notti occupate e numero di ospiti.",
        "Tale trasmissione avviene per adempiere a un obbligo di legge ai sensi dell'articolo 6, paragrafo 1, lettera c), del regolamento (UE) 2016/679. I dettagli figurano nell'[Informativa sulla privacy](https://mybestdays.dk/rechtliches/datenschutz).",
        "Distintamente da ciò sussiste l'obbligo di comunicazione fiscale ai sensi di DAC7; si veda la [Politica fiscale](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "melden",
      heading: "5. Segnalare violazioni",
      paragraphs: [
        "Se ha elementi per ritenere che un alloggio sia offerto senza l'autorizzazione o la registrazione richieste, ce lo segnali tramite la funzione di segnalazione dell'annuncio. Diamo seguito a ogni segnalazione.",
      ],
    },
  ],
};
