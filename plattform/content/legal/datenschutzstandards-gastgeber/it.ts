import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Standard di protezione dei dati per gli host",
  stand: "Aggiornato: 18 agosto 2026",
  intro: [
    "Quando offre alloggio tramite myBestDays riceve dati personali dei Suoi ospiti. Per il loro trattamento Lei è titolare autonomo ai sensi del regolamento (UE) 2016/679 (RGPD). I presenti standard descrivono cosa ci attendiamo da Lei.",
  ],
  sections: [
    {
      id: "zweckbindung",
      heading: "1. Limitazione della finalità",
      paragraphs: [
        "Utilizza i dati degli ospiti esclusivamente per eseguire la prenotazione, comunicare con l'ospite e adempiere ai propri obblighi di legge (per esempio scheda di notifica, tassa di soggiorno, obblighi fiscali e di conservazione).",
        "Ogni ulteriore utilizzo — in particolare pubblicità, newsletter, comunicazione a terzi, inserimento in un proprio archivio clienti per future prenotazioni dirette — richiede una base giuridica autonoma, di regola il consenso dell'ospite.",
        "Non utilizza i dati degli ospiti per indurli a prenotare al di fuori della piattaforma.",
      ],
    },
    {
      id: "datensparsamkeit",
      heading: "2. Minimizzazione dei dati",
      paragraphs: [
        "Raccoglie soltanto i dati di cui ha effettivamente bisogno. Richiede copie di documenti d'identità solo quando una norma di legge lo imponga e le conserva soltanto per il tempo previsto da tale norma.",
        "Non richiede dati di pagamento. I pagamenti transitano dalla piattaforma.",
      ],
    },
    {
      id: "sicherheit",
      heading: "3. Sicurezza",
      paragraphs: [
        "Protegge i dati degli ospiti con misure tecniche e organizzative adeguate — accesso solo per chi ne ha bisogno, dispositivi protetti, trasmissione cifrata.",
        "Se impiega collaboratori, personale di pulizia o co-host, li vincola alla riservatezza e fornisce loro solo i dati necessari al loro compito.",
      ],
    },
    {
      id: "loeschung",
      heading: "4. Conservazione e cancellazione",
      paragraphs: [
        "Cancella i dati degli ospiti non appena la finalità è venuta meno e non sussiste più alcun obbligo di conservazione.",
        "Conserva le schede di notifica e la documentazione fiscalmente rilevante per il tempo prescritto dal diritto del Suo Paese — non oltre.",
      ],
    },
    {
      id: "rechte",
      heading: "5. Diritti degli ospiti",
      paragraphs: [
        "Se un ospite Le rivolge una richiesta di accesso, rettifica, cancellazione od opposizione, vi dà seguito nei termini. Se riguarda dati in nostro possesso, lo rinvia a noi.",
        "Informa i Suoi ospiti su come tratta i loro dati, nella misura in cui vada oltre l'esecuzione della prenotazione.",
      ],
    },
    {
      id: "vorfall",
      heading: "6. Violazioni dei dati personali",
      paragraphs: [
        "In caso di violazione della protezione dei dati degli ospiti informa senza indugio l'autorità di controllo competente e, ove richiesto, gli ospiti interessati.",
        "Se la violazione riguarda dati ricevuti tramite la piattaforma, informa anche noi affinché possiamo valutare i nostri obblighi.",
      ],
    },
    {
      id: "kameras",
      heading: "7. Telecamere e dispositivi di registrazione",
      paragraphs: [
        "Nei locali interni con legittima aspettativa di riservatezza — camere da letto, bagni — telecamere e microfoni non sono ammessi, neppure spenti.",
        "Dichiara nell'annuncio tutte le altre telecamere, i sensori di movimento con registrazione, i campanelli con telecamera e i sensori acustici, indicandone la posizione e ciò che viene registrato.",
      ],
    },
    {
      id: "folgen",
      heading: "8. Conseguenze delle violazioni",
      paragraphs: [
        "Trattiamo le violazioni dei presenti standard come violazioni delle [Condizioni aggiuntive per gli host](https://mybestdays.dk/rechtliches/gastgeber-bedingungen) e possiamo adottare misure fino al blocco dell'account.",
      ],
    },
  ],
};
