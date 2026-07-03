import type { LegalDoc } from "../types";

// Italienische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort. § 5 Absatz 1–2 folgt Stripes offiziellem Empfehlungstext
// (Stripe Connected Account Agreement) — Eigennamen und URLs nicht verändern.
export const agb: LegalDoc = {
  title: "Condizioni generali di contratto (CGC) per agenzie e locatori",
  stand: "Ultimo aggiornamento: 3 luglio 2026",
  intro: [
    "Le presenti Condizioni generali di contratto (di seguito «CGC») disciplinano l’utilizzo della piattaforma software myNextDays (di seguito «Piattaforma») da parte di agenzie, locatori, amministratori immobiliari e altri utenti professionali (di seguito «Utente»).",
    "La Piattaforma è gestita da [ragione sociale completa, forma giuridica, indirizzo e dati di registro del gestore — da completare prima della pubblicazione] (di seguito «myNextDays» o «noi»).",
    "La Piattaforma è destinata esclusivamente a imprenditori ai sensi dell’art. 14 del Codice civile tedesco (BGB) o delle corrispondenti disposizioni del rispettivo Stato membro dell’UE. Non è destinata ai consumatori.",
  ],
  sections: [
    {
      heading: "§ 1 Ambito di applicazione",
      paragraphs: [
        "Le presenti CGC si applicano a tutti i contratti relativi all’utilizzo della Piattaforma conclusi tra myNextDays e l’Utente nonché a tutti i servizi e moduli forniti tramite la stessa.",
        "Condizioni generali dell’Utente divergenti, contrastanti o integrative diventano parte del contratto solo se myNextDays ne ha espressamente accettato la validità in forma testuale.",
      ],
    },
    {
      heading: "§ 2 Oggetto del contratto e servizi",
      paragraphs: [
        "myNextDays mette a disposizione dell’Utente un software basato su cloud per la gestione di alloggi per vacanze e strutture ricettive. L’ambito delle funzioni risulta dalla descrizione dei servizi di volta in volta vigente e comprende in particolare:",
      ],
      list: [
        "gestione di strutture, calendari di occupazione e prenotazioni (property management system),",
        "collegamento a canali di prenotazione di terzi (ad es. Booking.com, Airbnb) tramite un channel manager,",
        "pubblicazione di offerte tramite il canale di prenotazione myNextDays, proprio della Piattaforma,",
        "creazione di siti web propri tramite il page builder integrato,",
        "funzioni di contabilità, rendicontazione e reportistica, inclusi i rendiconti per i proprietari,",
        "comunicazione con gli ospiti e accettazione di pagamenti tramite l’elaborazione dei pagamenti integrata (§ 5).",
      ],
    },
    {
      heading: "§ 3 Registrazione, account e dati dell’Utente",
      paragraphs: [
        "L’utilizzo della Piattaforma presuppone la registrazione di un account. L’Utente è tenuto a fornire, al momento della registrazione e per tutta la durata del contratto, informazioni corrette, aggiornate e complete sulla propria persona e sulla propria impresa e ad aggiornarle senza indugio in caso di modifiche.",
        "Le credenziali di accesso devono essere mantenute segrete e protette dall’accesso di terzi. L’Utente deve informare myNextDays senza indugio qualora vi siano indizi di un utilizzo abusivo del proprio account.",
        "L’account non è trasferibile. L’Utente garantisce che tutte le persone che utilizzano l’account per suo conto rispettino le presenti CGC.",
      ],
    },
    {
      heading: "§ 4 Ruolo di myNextDays nelle prenotazioni",
      paragraphs: [
        "I contratti di alloggio relativi alle strutture offerte sulla Piattaforma, sui canali di terzi collegati o sul sito web proprio dell’Utente si concludono esclusivamente tra l’Utente (o il proprietario da questi rappresentato) e il rispettivo ospite. myNextDays non diventa parte del contratto di alloggio.",
        "L’Utente è l’unico responsabile della correttezza e della liceità dei contenuti delle offerte (descrizioni, foto, prezzi, disponibilità, imposte e oneri).",
      ],
    },
    {
      heading: "§ 5 Elaborazione dei pagamenti tramite Stripe",
      paragraphs: [
        "I servizi di elaborazione dei pagamenti per agenzie e locatori su myNextDays sono forniti da Stripe e sono soggetti allo [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full), che include le condizioni d’uso di Stripe (congiuntamente, l’«Accordo sui servizi Stripe»). Accettando le presenti CGC o continuando a operare come agenzia o locatore su myNextDays, l’Utente accetta di essere vincolato dall’Accordo sui servizi Stripe, che può essere modificato da Stripe di volta in volta.",
        "Come condizione affinché myNextDays renda possibili i servizi di elaborazione dei pagamenti tramite Stripe, l’Utente si impegna a fornire a myNextDays informazioni corrette e complete su di sé e sulla propria impresa e autorizza myNextDays a trasmettere a Stripe tali informazioni nonché i dati sulle transazioni connessi all’utilizzo dei servizi di elaborazione dei pagamenti forniti da Stripe.",
        "Per il rapporto giuridico con Stripe fa fede il testo contrattuale in lingua inglese raggiungibile tramite il link, nella versione di volta in volta vigente. La controparte contrattuale per gli utenti nello Spazio economico europeo è la società Stripe indicata nell’Accordo sui servizi Stripe (attualmente Stripe Payments Europe, Limited, Irlanda). Stripe tratta i dati personali in conformità con l’[Informativa sulla privacy di Stripe](https://stripe.com/privacy).",
        "Per adempiere agli obblighi legali di identificazione e verifica (tra l’altro prevenzione del riciclaggio di denaro e requisiti «Know Your Customer»), myNextDays e Stripe possono richiedere in qualsiasi momento ulteriori informazioni e documenti giustificativi, in particolare documenti d’identità, informazioni sui titolari effettivi e sulle coordinate bancarie. Se le informazioni o i documenti richiesti non vengono forniti entro il termine stabilito, l’accettazione dei pagamenti o i versamenti possono essere sospesi in tutto o in parte fino a quando le informazioni non siano complete.",
      ],
    },
    {
      heading: "§ 6 Versamenti, storni di addebito e saldi negativi",
      paragraphs: [
        "I versamenti vengono effettuati sul conto bancario indicato dall’Utente. myNextDays può modificare la cadenza dei versamenti per motivi di rischio, in particolare in caso di account nuovi, modelli di transazione anomali o verifiche in corso.",
        "Gli storni di addebito (chargeback), i rimborsi e le relative commissioni connessi alle prenotazioni dell’Utente sono a carico dell’Utente. myNextDays ha il diritto di compensare tali importi con versamenti futuri.",
        "Se sul conto di pagamento dell’Utente si genera un saldo negativo, l’Utente deve ripianarlo senza indugio. L’Utente autorizza myNextDays e Stripe ad addebitare i saldi negativi sul conto bancario registrato, nella misura consentita dalla legge.",
      ],
    },
    {
      heading: "§ 7 Corrispettivi e fatturazione",
      paragraphs: [
        "I corrispettivi per l’utilizzo della Piattaforma risultano dal listino prezzi concordato al momento della conclusione del contratto o dall’offerta individuale. Tutti i prezzi si intendono al netto delle imposte di volta in volta previste dalla legge e nella valuta indicata nel contratto.",
        "I corrispettivi legati alle transazioni (ad es. commissioni di pagamento o di canale) possono essere trattenuti o compensati direttamente al momento dell’elaborazione della rispettiva transazione.",
        "Se l’Utente è in mora con i pagamenti, myNextDays può, previo avviso, bloccare l’accesso alla Piattaforma fino al saldo dei crediti in sospeso.",
      ],
    },
    {
      heading: "§ 8 Obblighi dell’Utente; testi legali propri",
      paragraphs: [
        "L’Utente garantisce che le proprie offerte, i propri contenuti e le proprie pratiche commerciali siano conformi alle leggi di volta in volta applicabili, in particolare al diritto in materia di ricettività, obblighi di registrazione, fisco e tutela dei consumatori nel luogo in cui si trova l’alloggio. L’Utente mantiene sotto la propria responsabilità le autorizzazioni, le registrazioni e le licenze necessarie.",
        "L’Utente è direttamente responsabile dei siti web che gestisce tramite il page builder nonché delle proprie offerte sulla Piattaforma; ciò comprende in particolare condizioni generali proprie per gli ospiti, note legali proprie e informazioni proprie sulla protezione dei dati.",
        "Sono vietati in particolare: la pubblicazione di offerte inesatte o ingannevoli, l’esecuzione di operazioni fittizie o transazioni fraudolente, l’elusione dell’elaborazione dei pagamenti di cui al § 5 per le prenotazioni concluse tramite la Piattaforma nonché qualsiasi utilizzo che comprometta la sicurezza o la disponibilità della Piattaforma.",
      ],
    },
    {
      heading: "§ 9 Canali di prenotazione di terzi",
      paragraphs: [
        "In caso di collegamento di canali di terzi (ad es. Booking.com, Airbnb) si applicano in aggiunta le condizioni del rispettivo gestore del canale. L’Utente stipula direttamente con il gestore del canale i contratti necessari a tal fine.",
        "myNextDays esegue la sincronizzazione tecnica di disponibilità, prezzi e dati di prenotazione, ma non ha alcuna influenza su contenuti, commissioni o decisioni dei gestori dei canali e non risponde della loro disponibilità.",
      ],
    },
    {
      heading: "§ 10 Disponibilità e sviluppo ulteriore",
      paragraphs: [
        "myNextDays fornisce i servizi con la diligenza di un operatore commerciale accorto e mira a un’elevata disponibilità della Piattaforma. Finestre di manutenzione, sviluppi ulteriori e circostanze al di fuori della sfera di controllo di myNextDays (ad es. malfunzionamenti presso fornitori terzi) possono limitare temporaneamente la disponibilità.",
        "myNextDays può sviluppare ulteriormente la Piattaforma e modificarne le funzioni, purché lo scopo del contratto non ne risulti compromesso e la modifica sia ragionevolmente esigibile per l’Utente.",
      ],
    },
    {
      heading: "§ 11 Dati e protezione dei dati",
      paragraphs: [
        "Nella misura in cui myNextDays, nella fornitura della Piattaforma, tratta dati personali per conto dell’Utente (in particolare dati degli ospiti), le parti stipulano un accordo sul trattamento dei dati per conto del titolare ai sensi dell’art. 28 RGPD.",
        "L’Utente rimane responsabile della liceità, sotto il profilo della protezione dei dati, della raccolta e del trattamento dei dati da lui immessi. I dettagli sul trattamento dei dati da parte di myNextDays risultano dalle informazioni sulla protezione dei dati della Piattaforma; per il trattamento dei dati da parte di Stripe si applica il § 5.",
      ],
    },
    {
      heading: "§ 12 Proprietà intellettuale",
      paragraphs: [
        "Tutti i diritti sulla Piattaforma, sul suo software e sui suoi contenuti (ad eccezione dei contenuti immessi dall’Utente) spettano a myNextDays o ai suoi licenzianti. L’Utente riceve, per la durata del contratto, un diritto non esclusivo e non trasferibile di utilizzare la Piattaforma nella misura concordata contrattualmente.",
        "Sui contenuti da lui immessi, l’Utente concede a myNextDays i diritti d’uso non esclusivi necessari per il funzionamento della Piattaforma (in particolare per la memorizzazione, la riproduzione, la visualizzazione e la trasmissione ai canali collegati).",
      ],
    },
    {
      heading: "§ 13 Responsabilità",
      paragraphs: [
        "myNextDays risponde senza limitazioni per dolo e colpa grave nonché per i danni derivanti da lesioni alla vita, al corpo o alla salute.",
        "In caso di colpa lieve, myNextDays risponde solo per la violazione di obblighi contrattuali essenziali (obblighi cardinali), limitatamente al danno prevedibile e tipico del contratto. Restano impregiudicate la responsabilità ai sensi della legge sulla responsabilità da prodotto nonché quella derivante da garanzie assunte.",
        "Per la perdita di dati, myNextDays risponde solo nella misura in cui il danno si sarebbe verificato anche in caso di salvataggio dei dati corretto e regolare da parte dell’Utente, salvo che il salvataggio dei dati spetti contrattualmente a myNextDays.",
      ],
    },
    {
      heading: "§ 14 Durata, disdetta e blocco",
      paragraphs: [
        "La durata e i termini di disdetta risultano dal rispettivo contratto. Resta impregiudicato il diritto alla risoluzione straordinaria per giusta causa.",
        "myNextDays può bloccare temporaneamente l’accesso alla Piattaforma o singole funzioni (inclusi l’accettazione dei pagamenti e i versamenti) qualora vi siano indizi concreti di una violazione delle presenti CGC, di frode o di un utilizzo abusivo, oppure qualora myNextDays vi sia obbligata per legge o per disposizione di un prestatore di servizi di pagamento. L’Utente viene informato del blocco, nella misura consentita dalla legge.",
        "Al termine del contratto, myNextDays mette a disposizione dell’Utente, su richiesta, i suoi dati per l’esportazione in un formato comune entro 30 giorni; successivamente i dati vengono cancellati, salvo che vi si oppongano obblighi legali di conservazione.",
      ],
    },
    {
      heading: "§ 15 Modifiche delle presenti CGC",
      paragraphs: [
        "myNextDays può modificare le presenti CGC con effetto per il futuro, nella misura in cui ciò sia necessario per motivi validi (in particolare modifiche legislative, mutamenti della giurisprudenza o requisiti dei prestatori di servizi di pagamento) e l’Utente non ne risulti irragionevolmente svantaggiato.",
        "Le modifiche vengono annunciate all’Utente in forma testuale almeno sei settimane prima della loro entrata in vigore. Se l’Utente non si oppone entro il termine di preavviso o continua a utilizzare la Piattaforma dopo l’entrata in vigore, le CGC modificate si considerano accettate; nell’annuncio si richiama espressamente l’attenzione su tale conseguenza.",
      ],
    },
    {
      heading: "§ 16 Disposizioni finali",
      paragraphs: [
        "Si applica il diritto dello Stato in cui il gestore ha la propria sede, con esclusione della Convenzione delle Nazioni Unite sui contratti di compravendita internazionale di merci. Restano impregiudicate le disposizioni imperative dello Stato in cui l’Utente ha la propria sede.",
        "Foro competente esclusivo per tutte le controversie derivanti dal presente contratto o ad esso connesse è — nella misura consentita dalla legge — la sede del gestore.",
        "Qualora singole disposizioni delle presenti CGC siano o divengano inefficaci, la validità delle restanti disposizioni rimane impregiudicata.",
      ],
    },
  ],
};
