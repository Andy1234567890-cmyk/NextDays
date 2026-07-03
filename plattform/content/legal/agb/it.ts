import type { LegalDoc } from "../types";

// Italienische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort. Zielgruppe sind Verbraucher (Gäste) — anders als die
// Agentur-AGB in apps/web.
export const agb: LegalDoc = {
  title: "Condizioni di utilizzo per gli ospiti (CGC)",
  stand: "Ultimo aggiornamento: 3 luglio 2026",
  intro: [
    "Le presenti condizioni di utilizzo disciplinano l’utilizzo del portale di prenotazione myNextDays (di seguito «Piattaforma») da parte di viaggiatori e prenotanti (di seguito «Ospite»).",
    "La Piattaforma è gestita da [ragione sociale completa, forma giuridica, indirizzo e dati di registro del gestore — da completare prima della pubblicazione] (di seguito «myNextDays» o «noi»).",
  ],
  sections: [
    {
      heading: "§ 1 Ambito di applicazione",
      paragraphs: [
        "Le presenti condizioni si applicano all’utilizzo della Piattaforma, in particolare alla ricerca di alloggi e alla prenotazione di servizi di alloggio tramite la Piattaforma.",
        "Al servizio di alloggio stesso si applicano in aggiunta le condizioni del rispettivo fornitore (ad es. regolamento interno, condizioni di cancellazione) indicate nell’offerta.",
      ],
    },
    {
      heading: "§ 2 Ruolo di myNextDays; conclusione del contratto",
      paragraphs: [
        "myNextDays agisce da intermediario per servizi di alloggio offerti dai rispettivi fornitori (agenzie, locatori o proprietari, di seguito «Fornitore»). Il contratto relativo all’alloggio si conclude esclusivamente tra l’Ospite e il rispettivo Fornitore. myNextDays non diventa parte del contratto di alloggio.",
        "Il rispettivo Fornitore è indicato nell’offerta e nella conferma di prenotazione.",
      ],
    },
    {
      heading: "§ 3 Prenotazione e conferma di prenotazione",
      paragraphs: [
        "La presentazione degli alloggi sulla Piattaforma costituisce un invito a presentare un’offerta di prenotazione. Completando il processo di prenotazione (clic sul pulsante di prenotazione con obbligo di pagamento), l’Ospite presenta un’offerta vincolante per la conclusione di un contratto di alloggio con il Fornitore.",
        "Il contratto si conclude quando la prenotazione viene confermata. La conferma di prenotazione viene inviata all’Ospite all’indirizzo e-mail indicato.",
        "L’Ospite è tenuto a fornire informazioni corrette e complete al momento della prenotazione (in particolare nome, dati di contatto e numero di viaggiatori).",
      ],
    },
    {
      heading: "§ 4 Prezzi e pagamento",
      paragraphs: [
        "Si applicano i prezzi indicati nell’offerta al momento della prenotazione, incluse le imposte, le commissioni e i costi aggiuntivi ivi indicati. I prezzi vengono visualizzati nella valuta indicata nell’offerta. In loco possono essere dovuti oneri locali aggiuntivi (ad es. tassa di soggiorno), nella misura in cui ciò sia indicato nell’offerta.",
        "Il pagamento viene elaborato tramite il prestatore di servizi di pagamento Stripe. I dati di pagamento (ad es. i dati della carta) vengono raccolti e trattati direttamente da Stripe; myNextDays non memorizza dati completi della carta. Stripe tratta i dati personali in conformità con l’[Informativa sulla privacy di Stripe](https://stripe.com/privacy).",
        "Se nell’offerta è indicata una cauzione, questa può essere preautorizzata al momento della prenotazione o dell’arrivo e trattenuta in tutto o in parte in caso di danni; fanno fede le indicazioni contenute nell’offerta.",
      ],
    },
    {
      heading: "§ 5 Cancellazione, modifica della prenotazione e recesso",
      paragraphs: [
        "Se e a quali condizioni una prenotazione possa essere cancellata o modificata gratuitamente dipende dalle condizioni di cancellazione del Fornitore indicate nell’offerta.",
        "Per i servizi di alloggio prenotati per un periodo determinato non sussiste, di regola, alcun diritto legale di recesso ai sensi dell’art. 16, lettera l), della direttiva UE sui diritti dei consumatori o delle corrispondenti disposizioni nazionali. Restano impregiudicati i diritti legali inderogabili dell’Ospite.",
      ],
    },
    {
      heading: "§ 6 Obblighi dell’Ospite",
      paragraphs: [
        "L’Ospite utilizza l’alloggio conformemente al contratto, rispetta l’occupazione massima indicata nell’offerta e osserva il regolamento interno del Fornitore.",
        "La Piattaforma non può essere utilizzata in modo abusivo, in particolare non per prenotazioni fittizie, pagamenti fraudolenti o la pubblicazione di contenuti illeciti (ad es. in recensioni o messaggi).",
      ],
    },
    {
      heading: "§ 7 Responsabilità di myNextDays",
      paragraphs: [
        "Il solo responsabile della fornitura del servizio di alloggio è il Fornitore. myNextDays non risponde della correttezza dei contenuti delle offerte pubblicate dai Fornitori, ma svolge l’intermediazione e l’elaborazione dei pagamenti con la diligenza di un operatore commerciale accorto.",
        "myNextDays risponde senza limitazioni per dolo e colpa grave nonché per i danni derivanti da lesioni alla vita, al corpo o alla salute. In caso di colpa lieve, myNextDays risponde solo per la violazione di obblighi contrattuali essenziali (obblighi cardinali), limitatamente al danno prevedibile e tipico del contratto. Restano impregiudicate le norme di legge inderogabili in materia di responsabilità.",
      ],
    },
    {
      heading: "§ 8 Protezione dei dati",
      paragraphs: [
        "myNextDays tratta i dati personali dell’Ospite per l’esecuzione dell’intermediazione e della prenotazione. I dati di prenotazione vengono trasmessi al rispettivo Fornitore nella misura necessaria all’esecuzione del contratto di alloggio. Per l’elaborazione dei pagamenti si applica il § 4.",
        "I dettagli risultano dalle informazioni sulla protezione dei dati della Piattaforma.",
      ],
    },
    {
      heading: "§ 9 Reclami e risoluzione delle controversie",
      paragraphs: [
        "Per contestazioni relative all’alloggio, l’Ospite si rivolge innanzitutto al Fornitore; per domande sulla prenotazione o sul pagamento, il supporto di myNextDays è disponibile tramite i canali di contatto indicati sulla Piattaforma.",
        "myNextDays non è obbligata né disposta a partecipare a procedure di risoluzione delle controversie dinanzi a un organismo di conciliazione dei consumatori, salvo obbligo di legge.",
      ],
    },
    {
      heading: "§ 10 Modifiche delle presenti condizioni",
      paragraphs: [
        "myNextDays può modificare le presenti condizioni con effetto per il futuro, nella misura in cui ciò sia necessario per motivi validi (in particolare modifiche legislative o mutamenti della giurisprudenza) e l’Ospite non ne risulti irragionevolmente svantaggiato. Alle prenotazioni già concluse si applica la versione in vigore al momento della prenotazione.",
      ],
    },
    {
      heading: "§ 11 Disposizioni finali",
      paragraphs: [
        "Si applica il diritto dello Stato in cui il gestore ha la propria sede, con esclusione della Convenzione delle Nazioni Unite sui contratti di compravendita internazionale di merci. Se l’Ospite è un consumatore, restano impregiudicate le disposizioni imperative a tutela dei consumatori dello Stato in cui l’Ospite ha la propria residenza abituale.",
        "Qualora singole disposizioni delle presenti condizioni siano o divengano inefficaci, la validità delle restanti disposizioni rimane impregiudicata.",
      ],
    },
  ],
};
