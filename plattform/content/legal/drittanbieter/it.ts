import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Terzi e servizi di pagamento",
  stand: "Aggiornato: 18 agosto 2026",
  intro: [
    "myBestDays si avvale di servizi di terzi per la gestione della piattaforma. La presente pagina li elenca e spiega il loro ruolo e quali condizioni si applichino.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principio",
      paragraphs: [
        "Ove un terzo eroghi una prestazione direttamente a Suo favore, si applicano le sue condizioni e la sua informativa sulla privacy in aggiunta alle nostre. Lo segnaliamo nel punto pertinente.",
        "Ove un terzo tratti esclusivamente per nostro conto, restiamo il Suo interlocutore. I responsabili del trattamento di cui ci avvaliamo figurano nell'[Informativa sulla privacy](https://mybestdays.dk/rechtliches/datenschutz).",
      ],
    },
    {
      id: "zahlungsdienst",
      heading: "2. Prestatore di servizi di pagamento",
      paragraphs: [
        "I pagamenti tramite la piattaforma sono gestiti da Stripe. Stripe raccoglie e tratta i dati di pagamento direttamente ed è titolare autonomo del trattamento. Si applica inoltre l'[informativa sulla privacy di Stripe](https://stripe.com/privacy).",
        "Per il pagamento agli host, Stripe effettua la verifica dell'identità prevista dalla legge.",
      ],
    },
    {
      id: "psd2",
      heading: "3. Direttiva sui servizi di pagamento e accesso di terzi",
      paragraphs: [
        "La direttiva (UE) 2015/2366 («PSD2») richiede l'autenticazione forte del cliente per numerosi pagamenti. La effettua la Sua banca o l'emittente della carta; senza autenticazione riuscita un pagamento può essere rifiutato.",
        "myBestDays non è un servizio di disposizione di ordini di pagamento né un servizio di informazione sui conti e non accede ai Suoi conti bancari.",
      ],
    },
    {
      id: "karten-und-inhalte",
      heading: "4. Mappe, immagini e contenuti incorporati",
      paragraphs: [
        "Per le rappresentazioni cartografiche e le indicazioni di posizione incorporiamo servizi di mappe di terzi. Il caricamento di tali contenuti può comportare la trasmissione di dati al rispettivo fornitore; i dettagli e la gestione del consenso figurano nella [Politica sui cookie](https://mybestdays.dk/rechtliches/cookies).",
        "Immagini e descrizioni negli annunci provengono dal rispettivo fornitore, non da noi.",
      ],
    },
    {
      id: "verlinkung",
      heading: "5. Siti collegati",
      paragraphs: [
        "La piattaforma può rinviare a siti di terzi. Non abbiamo influenza sui loro contenuti e non ce ne assumiamo responsabilità. Non appena veniamo a conoscenza di una violazione rimuoviamo il collegamento senza indugio.",
      ],
    },
    {
      id: "app-stores",
      heading: "6. Store di applicazioni",
      paragraphs: [
        "Se scarica l'app myBestDays da uno store, si applicano inoltre le condizioni del gestore di tale store. Il gestore dello store non è parte del contratto tra Lei e noi e non deve né assistenza né garanzia per l'app.",
      ],
    },
  ],
};
