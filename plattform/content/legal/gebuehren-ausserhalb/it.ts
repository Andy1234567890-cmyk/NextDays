import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Costi al di fuori della piattaforma",
  stand: "Aggiornato: 18 agosto 2026",
  intro: [
    "La presente politica disciplina quali importi un fornitore possa pretendere al di fuori della piattaforma e quali no. Tutela gli ospiti dal trovarsi in loco di fronte a richieste non indicate nell'annuncio.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principio",
      paragraphs: [
        "Tutto ciò che è dovuto per la prestazione prenotata deve essere indicato nell'annuncio prima della conclusione della prenotazione — come componente del prezzo totale oppure come voce di costi in loco.",
        "Un importo non indicato né nel prezzo totale né come costo in loco non è dovuto dall'ospite.",
      ],
    },
    {
      id: "erlaubt",
      heading: "2. Cosa può essere richiesto in loco",
      paragraphs: ["In loco possono essere richiesti esclusivamente:"],
      list: [
        "gli importi espressamente indicati nell'annuncio come costi in loco (per esempio pulizia finale, set biancheria, posto auto);",
        "i tributi locali come la tassa di soggiorno, nella misura in cui le norme locali ne impongano il pagamento in loco;",
        "una cauzione indicata nell'annuncio;",
        "i servizi che l'ospite prenota volontariamente solo in loco, a un prezzo comunicato in anticipo;",
        "il risarcimento di danni documentati causati dall'ospite.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "3. Cosa non può essere richiesto",
      paragraphs: ["Non è ammesso, in particolare:"],
      list: [
        "un conguaglio sul prezzo del pernottamento dopo la conclusione della prenotazione;",
        "un onere per il fatto che la prenotazione sia avvenuta tramite myBestDays;",
        "spese di gestione, di prenotazione o per l'uso della carta non indicate nell'annuncio;",
        "l'invito ad annullare la prenotazione e a riprenotare lo stesso alloggio al di fuori della piattaforma;",
        "l'invito a pagare il prezzo o parte di esso mediante bonifico, contanti o un servizio di pagamento esterno alla piattaforma, quando l'annuncio prevede il pagamento tramite la piattaforma.",
      ],
    },
    {
      id: "umgehung",
      heading: "4. Elusione della piattaforma",
      paragraphs: [
        "Se il contatto tra ospite e fornitore è avvenuto tramite la piattaforma, la prenotazione non può essere gestita al di fuori di essa. Ciò vale per entrambe le parti.",
        "Chi elude la piattaforma ne perde la tutela: i pagamenti non sono garantiti, le nostre politiche di cancellazione e rimborso non si applicano e non possiamo intervenire in caso di controversia.",
        "Le violazioni possono comportare il blocco dell'account. Nei confronti dei fornitori possiamo inoltre far valere la commissione di servizio perduta.",
      ],
    },
    {
      id: "melden",
      heading: "5. Segnalare",
      paragraphs: [
        "Se in loco Le viene richiesto un importo non indicato nell'annuncio, non lo paghi e ce lo segnali tramite i canali di contatto indicati in [Reclami e risoluzione delle controversie](https://mybestdays.dk/rechtliches/beschwerden). Se ha già pagato, L'aiutiamo a ottenerne la restituzione.",
      ],
    },
  ],
};
