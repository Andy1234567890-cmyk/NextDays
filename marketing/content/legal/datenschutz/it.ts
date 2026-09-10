// Italienische Fassung der Datenschutzerklärung. Quelle der Wahrheit ist
// `de.ts` — inhaltliche Änderungen gehören ZUERST dorthin und werden von dort
// hierher nachgezogen. Struktur (Reihenfolge, Anzahl der Abschnitte und
// Absätze) muss mit `de.ts` deckungsgleich bleiben.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Informativa sulla protezione dei dati",
  metaDescription:
    "Come myNextDays tratta i dati personali: finalità, basi giuridiche, destinatari, periodo di conservazione e i suoi diritti ai sensi del GDPR.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `La presente informativa descrive come la ${ANBIETER.firma} tratta i dati personali — durante la visita di questo sito web, nell’utilizzo della piattaforma myNextDays (dashboard, marketplace e app mobile) e nell’ambito del rapporto commerciale con i nostri clienti.`,
    "Non vendiamo dati e non creiamo profili che La identifichino come persona. Su questo sito web misuriamo — solo con il Suo consenso — la portata delle nostre pagine e il successo della nostra pubblicità; entrambe le categorie possono essere deselezionate individualmente (vedere le sezioni Misurazione della portata e Pubblicità e misurazione del successo). Elaboriamo i dati a fini pubblicitari solo laddove Lei abbia dato il Suo esplicito consenso, ovvero per la nostra newsletter (vedere la sezione Comunicazione), alla quale può disdire l'iscrizione in qualsiasi momento con un clic.",
  ],
  sections: [
    {
      heading: "Titolare del trattamento",
      paragraphs: [
        "Titolare dei trattamenti descritti nella presente informativa è:",
      ],
      zeilen: [
        {
          label: "Impresa",
          werte: [ANBIETER.firma, `CVR-nr. ${ANBIETER.cvr}`],
        },
        {
          label: "Indirizzo",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "E-mail",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefono",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
      ],
    },
    {
      heading: "Ambito di applicazione e ruoli",
      unterpunkte: [
        {
          paragraphs: [
            "Per la visita di questo sito web, per il suo account cliente e per la gestione del nostro rapporto commerciale siamo titolari del trattamento ai sensi dell’art. 4, punto 7), GDPR.",
          ],
        },
        {
          paragraphs: [
            "Per i dati che i nostri clienti (locatori, hotel, agenzie) trattano nella piattaforma in merito ai propri ospiti, proprietari e collaboratori, i clienti sono titolari del trattamento e noi siamo responsabili del trattamento ai sensi dell’art. 28 GDPR. I dettagli sono contenuti nell’[accordo sul trattamento dei dati](/auftragsverarbeitung).",
          ],
        },
        {
          paragraphs: [
            "Se in qualità di ospite prenota un alloggio tramite il nostro marketplace, trattiamo i suoi dati di prenotazione e di contatto sia in nome proprio (gestione del marketplace, elaborazione dei pagamenti) sia per conto della struttura ospitante. Il suo contratto di alloggio si conclude esclusivamente con la struttura; le informative sulla protezione dei dati di quest’ultima si applicano in aggiunta.",
          ],
        },
      ],
    },
    {
      heading: "Visita di questo sito web",
      unterpunkte: [
        {
          titel: "File di log del server",
          paragraphs: [
            "A ogni accesso il suo browser trasmette dati tecnicamente necessari, che il nostro server web registra: indirizzo IP, data e ora, indirizzo richiamato, quantità di dati trasferiti, codice di stato, referrer e identificazione del browser. La finalità è la messa a disposizione della pagina nonché il riconoscimento e la difesa da attacchi e malfunzionamenti. La base giuridica è l’art. 6, par. 1, lett. f) GDPR; il nostro legittimo interesse consiste nel funzionamento sicuro e stabile. I log sono conservati soltanto per il tempo necessario al funzionamento e alla sicurezza e non vengono aggregati ad altri dati.",
          ],
        },
        {
          titel: "Caratteri tipografici",
          paragraphs: [
            "I caratteri utilizzati sono integrati localmente sul nostro server. Non ha luogo alcun collegamento a Google Fonts o ad altro servizio di caratteri.",
          ],
        },
        {
          titel: "Icone",
          paragraphs: [
            "Le icone di questo sito web, come i caratteri tipografici, si trovano presso di noi: vengono inserite nella pagina sul nostro server e non caricate da un servizio di icone. Non ha luogo alcun collegamento con un terzo e il suo indirizzo IP non viene trasmesso a nessuno.",
          ],
        },
        {
          titel: "Protezione antispam del modulo di contatto (reCAPTCHA)",
          paragraphs: [
            "Il nostro modulo di contatto è protetto contro gli invii massivi automatizzati con reCAPTCHA Enterprise di Google Ireland Limited. Soltanto se lei vi acconsente, il suo browser carica al momento della compilazione del modulo uno script da www.google.com; in tale occasione il suo indirizzo IP e le indicazioni relative alla sua interazione con il modulo vengono trasmessi a Google e ivi analizzati, al fine di distinguere un essere umano da uno script. La base giuridica è l’art. 6, par. 1, lett. a) GDPR (consenso); si applica in aggiunta l’[informativa sulla privacy di Google](https://policies.google.com/privacy).",
            "Senza il Suo consenso, nulla verrà caricato da Google e nessun dato verrà trasferito; in tal caso, non accetteremo il modulo, ma potrà sempre inviarci un'e-mail. Se acconsente, reCAPTCHA imposta un proprio cookie (_GRECAPTCHA, la cui durata è stabilita da Google, fino a sei mesi) per la valutazione del rischio. Può modificare o revocare il Suo consenso in qualsiasi momento tramite l'icona dei cookie in basso a sinistra su ogni pagina; il cookie verrà quindi eliminato.",
          ],
        },
        {
          titel: "Misurazione della portata (Google Analytics)",
          paragraphs: [
            "Su questo sito web, con Google Analytics 4 di Google Ireland Limited, misuriamo come vengono utilizzate le nostre pagine — quali pagine vengono visitate, da dove provengono i visitatori e in quale punto abbandonano. Lo scopo è esclusivamente il miglioramento dell'offerta e della reperibilità.",
            'Il caricamento avviene esclusivamente con il Suo consenso. Se lo concede, il Suo browser carica uno script da www.googletagmanager.com e memorizza due cookie ("_ga" e "_ga_<ID>", validi fino a due anni) con un ID generato casualmente; vengono trasmessi questo ID, le pagine visitate, la fonte di riferimento, la posizione approssimativa a livello di paese o regione, il dispositivo e il browser, nonché il Suo indirizzo IP, che Google abbrevia prima di ogni memorizzazione. La base giuridica è l\'Art. 6 par. 1 lett. a GDPR (consenso).',
            "Abbiamo espressamente limitato l'analisi: i segnali di Google e la personalizzazione pubblicitaria sono disattivati. Pertanto, non vengono creati profili cross-device né segmenti di pubblico per la pubblicità, e non trasmettiamo dati di utilizzo a reti pubblicitarie. Non avviene alcuna associazione con il Suo account cliente.",
            "Google elabora i dati come nostro responsabile del trattamento sulla base di un contratto ai sensi dell'Art. 28 GDPR (Google Ads Data Processing Terms). L'abbreviazione del Suo indirizzo IP avviene su server nell'UE, prima che i dati vengano trasferiti negli USA; viene quindi trasmesso un set di dati pseudonimo. La base del trasferimento è la decisione di adeguatezza della Commissione UE per il quadro UE-USA sulla protezione dei dati (Art. 45 GDPR), in base al quale Google LLC è certificata; inoltre, Google ha incluso le clausole contrattuali standard della Commissione UE (Art. 46 GDPR). Sottolineiamo espressamente che le autorità statunitensi, ai sensi della Sezione 702 FISA, possono accedere anche ai dati di aziende certificate e che un rischio residuo non può quindi essere completamente escluso. Si applica inoltre la [Informativa sulla privacy di Google](https://policies.google.com/privacy).",
            "Durata della conservazione: i dati relativi a eventi e utenti vengono automaticamente cancellati dalla nostra proprietà dopo 14 mesi; i dati di report aggregati senza riferimento a singoli visitatori rimangono conservati oltre tale periodo. Il Suo consenso scade dopo sei mesi.",
            "Senza il Suo consenso, nulla viene caricato, nessun cookie viene impostato e nessun dato viene trasmesso a Google. Può revocare il Suo consenso in qualsiasi momento tramite l'icona dei cookie in basso a sinistra su ogni pagina; la misurazione terminerà immediatamente e i cookie menzionati verranno cancellati. Dopo sei mesi, Le chiederemo nuovamente il consenso.",
          ],
        },
        {
          titel: "Pubblicità e misurazione del successo",
          paragraphs: [
            "Con il Suo consenso, utilizziamo cookie di marketing per misurare il successo della nostra pubblicità e per mostrarLe annunci pertinenti su altre piattaforme. Sono coinvolti Meta Platforms Ireland (Meta-Pixel, cookie _fbp), LinkedIn Ireland (Insight-Tag, cookie li_gc e bcookie) e Google Ireland Limited (Google Ads, cookie _gcl_au). La base giuridica è l'Art. 6 par. 1 lett. a GDPR. Senza il Suo consenso, nessuno di questi script verrà caricato e nessun cookie verrà impostato; in caso di revoca, li cancelleremo. I dettagli su ogni cookie sono disponibili nella [Politica sui cookie](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Account cliente e utilizzo della piattaforma",
      paragraphs: [
        "Per la registrazione e la gestione di un account trattiamo i dati che lei o la sua struttura inserisce: nome, ragione sociale e forma giuridica, indirizzo, indirizzo e-mail, numero di telefono, ruolo e autorizzazioni, dati di registro (ad es. numero di iscrizione al registro delle imprese o partita IVA), coordinate bancarie per i versamenti nonché i contenuti creati nell’account.",
        "Per la protezione dell’accesso trattiamo inoltre i log di autenticazione (momento, indirizzo IP, dispositivo e browser dell’accesso) e — se attivata — i dati dell’autenticazione a due fattori.",
        "Accesso con Google: anziché con e-mail e password, può accedere anche con un account Google. Se sceglie questa via, riceviamo da Google Ireland Limited esclusivamente il suo indirizzo e-mail, il suo nome, la sua immagine del profilo e un identificativo del suo account Google (ambiti «openid», «email», «profile») — espressamente nessun accesso alle sue e-mail, ai suoi contatti, ai suoi file o ai suoi calendari. La sua password Google non ci viene comunicata. Google tratta la procedura di accesso in qualità di titolare autonomo; si applica l’[informativa sulla privacy di Google](https://policies.google.com/privacy). La base giuridica è l’art. 6, par. 1, lett. b) GDPR, poiché l’accesso serve all’esecuzione del contratto; la scelta di questa modalità di accesso è facoltativa e in qualsiasi momento sostituibile con l’accesso tramite e-mail e password.",
        "La base giuridica è l’art. 6, par. 1, lett. b) GDPR (esecuzione del contratto di utilizzo, si vedano le [CGC](" +
          AGB_URL +
          ")), per la protezione dell’accesso l’art. 6, par. 1, lett. f) GDPR e per la conservazione a fini fiscali e commerciali l’art. 6, par. 1, lett. c) GDPR.",
      ],
    },
    {
      heading: "Prenotazioni, dati degli ospiti e delle strutture",
      paragraphs: [
        "Tramite la piattaforma vengono trattate prenotazioni, dati degli ospiti, messaggi, attività e rendicontazioni. Ne fanno parte in particolare nome e dati di contatto dell’ospite, arrivo e partenza, numero dei viaggiatori, prezzi e stato dei pagamenti, cronologia dei messaggi nonché — se la struttura li rileva — dati di notifica alle autorità e richieste particolari.",
        "Questo trattamento avviene su incarico e secondo le istruzioni della rispettiva struttura. Non utilizziamo questi dati per finalità proprie, né per pubblicità, né per l’addestramento di modelli di intelligenza artificiale.",
        "All’interno di una struttura i dati sono separati per ruoli: il personale di pulizia e di servizio non vede dati finanziari e commerciali, i proprietari vedono soltanto le proprie strutture. Tra strutture diverse i dati sono separati a livello tecnico (regole di accesso per tenant direttamente nella banca dati).",
      ],
    },
    {
      heading: "Elaborazione dei pagamenti",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "I pagamenti con carta e i versamenti sono gestiti tramite Stripe Payments Europe, Limited, Irlanda. Vengono trasmessi a Stripe i dati necessari al pagamento (importo, valuta, strumento di pagamento, nome, indirizzo e-mail, riferimento della prenotazione) nonché, per gli account dei nostri clienti, i dati di identificazione prescritti dalla legge (titolare, titolari effettivi, dati del documento d’identità, coordinate bancarie). I dati completi delle carte non raggiungono i nostri sistemi. Le basi giuridiche sono l’art. 6, par. 1, lett. b) GDPR e, per gli obblighi di identificazione e antiriciclaggio, l’art. 6, par. 1, lett. c) GDPR. I dettagli sono disciplinati dall’[informativa sulla privacy di Stripe](https://stripe.com/privacy).",
            "Link di pagamento per servizi aggiuntivi: se una struttura fattura al proprio ospite un servizio aggiuntivo (ad es. pulizia o biancheria) tramite un link di pagamento, tale link conduce a una pagina di pagamento gestita da Stripe. A tal fine trasmettiamo a Stripe la denominazione del servizio, l’importo, la valuta nonché un riferimento interno alla prenotazione e alla struttura; il logo aziendale della struttura viene trasferito al suo account Stripe, affinché la pagina mostri il suo marchio. Sulla pagina di pagamento è Stripe stesso a raccogliere i dati di pagamento e di dispositivo dell’ospite, in qualità di titolare autonomo. A noi ritornano soltanto lo stato del pagamento, l’importo, gli importi trattenuti e gli identificativi del pagamento — nessun dato della carta.",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "Se la struttura offre PayPal come modalità di pagamento, i dati di pagamento vengono trasmessi a PayPal (Europe) S.à r.l. et Cie, S.C.A., Lussemburgo. Si applica l’[informativa sulla privacy di PayPal](https://www.paypal.com/de/webapps/mpp/ua/privacy-full).",
          ],
        },
      ],
    },
    {
      heading: "Canali di distribuzione e portali",
      paragraphs: [
        "Se una struttura vende i propri alloggi tramite portali come Booking.com, Airbnb o Expedia, disponibilità, prezzi, restrizioni e dati di prenotazione vengono scambiati con il rispettivo portale attraverso il nostro fornitore di collegamento Channex.io Ltd, Regno Unito. Da questa direzione riceviamo i dati di prenotazione e degli ospiti del portale.",
        "Per il rispettivo portale valgono le sue proprie disposizioni sulla protezione dei dati; in tale misura il portale è titolare autonomo. La base giuridica della trasmissione è l’art. 6, par. 1, lett. b) GDPR in combinazione con l’incarico della struttura.",
      ],
    },
    {
      heading: "Comunicazione",
      unterpunkte: [
        {
          titel: "E-mail",
          paragraphs: [
            "Le e-mail nell’ambito dell’utilizzo (conferme di prenotazione, messaggi di sistema, assistenza, link di conferma e di invito) vengono inviate e ricevute tramite un nostro server di posta, che gestiamo noi stessi. Per questi messaggi non è integrato alcun servizio di invio esterno.",
          ],
        },
        {
          titel: "Newsletter e preiscrizione",
          paragraphs: [
            "Sul nostro sito web può iscriversi per ricevere novità su myNextDays (preiscrizione/newsletter). In tale occasione vengono trattati il suo indirizzo e-mail, la lingua e il punto in cui si è iscritto.",
            "L’iscrizione avviene con procedura di doppio consenso (double opt-in): dopo l’iscrizione riceve una e-mail con un link di conferma; l’iscrizione è efficace soltanto con il clic su tale link. Per dimostrare il consenso conserviamo il momento dell’iscrizione e della conferma, l’indirizzo IP utilizzato, l’identificazione del browser nonché il testo al quale ha prestato il consenso. Queste indicazioni servono esclusivamente alla prova ai sensi dell’art. 7, par. 1, GDPR e non vengono analizzate a fini pubblicitari.",
            "La base giuridica è il suo consenso ai sensi dell’art. 6, par. 1, lett. a) GDPR; la conservazione della prova si fonda sull’art. 6, par. 1, lett. c) in combinazione con l’art. 7, par. 1, GDPR. Può revocare il consenso in qualsiasi momento con effetto per il futuro — tramite il link di disdetta contenuto in ogni e-mail della newsletter oppure inviandoci una semplice e-mail. La revoca non pregiudica la liceità del trattamento effettuato fino a quel momento.",
            "Per la gestione e l’invio delle newsletter ci avvaliamo di Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Parigi, Francia; sede tedesca: Brevo GmbH, Köpenicker Straße 126, 10179 Berlino) in qualità di responsabile del trattamento. Vengono trasmessi il suo indirizzo e-mail e le indicazioni aggiuntive citate (lingua, fonte). I dati sono trattati su server all’interno dell’Unione europea (Francia e Germania); con Brevo è in essere un accordo sul trattamento dei dati ai sensi dell’art. 28 GDPR. Si applica l’[informativa sulla privacy di Brevo](https://www.brevo.com/legal/privacypolicy/).",
            "Quando inviamo una newsletter, Brevo misura per nostro conto se il messaggio è stato aperto e se i link in esso contenuti sono stati cliccati. Questa misurazione ci aiuta ad adeguare contenuto e frequenza; è parte del consenso e termina con la sua disdetta. Non ha luogo alcuna aggregazione con altre fonti di dati né alcuna profilazione.",
            "Fino a quando la conferma non è avvenuta, il suo indirizzo non riceve comunicazioni e non viene trasmesso a Brevo; un’iscrizione non confermata decade dopo sette giorni. Dopo una disdetta blocchiamo l’indirizzo per l’invio e conserviamo la prova del consenso e della disdetta per il tempo in cui possono essere fatti valere diritti al riguardo; su richiesta la cancelliamo integralmente.",
          ],
        },
        {
          titel: "Messaggi nella piattaforma",
          paragraphs: [
            "I messaggi tra ospite e struttura vengono conservati nella piattaforma, affinché entrambe le parti possano consultare la cronologia. Se una struttura blocca un ospite, il canale di messaggistica viene chiuso; i messaggi esistenti rimangono conservati per finalità di tracciabilità.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "Se una struttura utilizza il collegamento con WhatsApp, i contenuti dei messaggi e i numeri di telefono dei partecipanti vengono trasmessi attraverso la WhatsApp Business Platform di Meta Platforms Ireland Limited. L’utilizzo di questa funzione è deciso dalla struttura; senza attivazione non ha luogo alcuna trasmissione.",
          ],
        },
      ],
    },
    {
      heading: "Funzioni automatizzate e intelligenza artificiale",
      paragraphs: [
        "Per le funzioni qui descritte, oltre al GDPR si applica il regolamento (UE) 2024/1689 (regolamento sull’intelligenza artificiale, «AI Act»), i cui obblighi di trasparenza di cui all’art. 50 sono applicabili dal 2 agosto 2026.",
      ],
      unterpunkte: [
        {
          titel: "Proposte di risposta",
          paragraphs: [
            "Per le proposte di risposta nella casella di posta dei messaggi impieghiamo — se la funzione è attivata per la struttura — l’offerta di modelli linguistici di Groq, Inc., USA. In tale occasione il rispettivo contesto del messaggio viene trasmesso al servizio. Le proposte non vengono inviate automaticamente; sull’invio decide sempre una persona. Non ha luogo alcun processo decisionale automatizzato con effetti giuridici ai sensi dell’art. 22 GDPR.",
            "Non si tratta pertanto di un sistema di IA che interagisce direttamente con persone fisiche ai sensi dell’art. 50, par. 1, dell’AI Act: l’obbligo presuppone un’interazione DIRETTA, nella quale l’IA stessa comunica con la persona e non attraverso un intermediario umano. Qui la funzione propone alla struttura un testo che un collaboratore verifica, può modificare e invia egli stesso — il collaboratore è tale intermediario, l’ospite corrisponde con la struttura e non con un chatbot. Non è in uso alcun assistente che risponda automaticamente. Secondo la nostra valutazione la funzione non integra nemmeno alcuna delle fattispecie di IA ad alto rischio di cui all’allegato III dell’AI Act.",
            "I messaggi agli ospiti non costituiscono inoltre un «testo su questioni di interesse pubblico» ai sensi dell’art. 50, par. 4, dell’AI Act: non vengono pubblicati, ma inviati individualmente a una determinata persona, e riguardano la gestione di un soggiorno. Indipendentemente da ciò, opera qui la verifica umana da parte del collaboratore che effettua l’invio.",
            "Qualora in futuro venisse offerta una funzione che risponda autonomamente agli ospiti — senza approvazione umana — l’ospite verrà informato in modo visibile all’inizio del dialogo che sta scrivendo a un sistema di IA. Senza tale informazione una simile funzione non verrà messa a disposizione.",
          ],
        },
        {
          titel: "Consulente di prodotto su questo sito web",
          paragraphs: [
            "Su questo sito web, un consulente di prodotto basato sull'IA risponde a domande sul nostro software. Accede esclusivamente a contenuti pubblicamente disponibili su questo sito web (articoli di aiuto, descrizioni delle funzioni, domande frequenti, testi legali) e ai prezzi attuali della nostra fatturazione. Dati dei clienti, prenotazioni o dati degli ospiti non sono a sua disposizione.",
            "A differenza dei suggerimenti di risposta nella casella di posta, questo consulente risponde IMMEDIATAMENTE e senza approvazione umana. È quindi un sistema di IA ai sensi dell'Art. 50 Par. 1 del Regolamento sull'IA, che interagisce direttamente con persone fisiche. Per questo motivo, all'inizio del dialogo, le verrà chiaramente indicato che le risposte provengono da un assistente IA e possono contenere errori.",
            "Vengono elaborate la sua domanda e la lingua scelta. Entrambe vengono trasmesse a Google Cloud (Vertex AI) nella regione europe-west4 (Paesi Bassi) per la risposta; non avviene alcuna elaborazione al di fuori dell'UE. Non memorizziamo le domande in modo permanente e non le utilizziamo per l'addestramento di modelli di IA. La base giuridica è il nostro legittimo interesse a fornire informazioni rapide agli interessati (Art. 6 Par. 1 lett. f GDPR).",
            "Se il consulente non può rispondere a una domanda basandosi sui contenuti esistenti, offre l'inoltro al nostro supporto. Solo allora — e solo se compila il modulo — raccogliamo nome, indirizzo e-mail e, facoltativamente, il suo numero di telefono; elaboriamo questi dati secondo le regole della sezione \"Comunicazione\".",
          ],
        },
        {
          titel: "Ruoli ai sensi dell’AI Act",
          paragraphs: [
            "Per le funzioni di IA integrate nel prodotto siamo deployer ai sensi dell’art. 3, punto 4), dell’AI Act; fornitori dei modelli linguistici sottostanti sono i rispettivi fornitori dei modelli. Se una struttura utilizza queste funzioni nell’ambito della propria attività professionale, essa è a sua volta deployer e le incombe l’obbligo di alfabetizzazione in materia di IA di cui all’art. 4 dell’AI Act, che si applica dal 2 febbraio 2025 indipendentemente dalle dimensioni dell’impresa. Dal 27 luglio 2026 esso si applica nella versione del regolamento (UE) 2026/1744: fornitori e deployer adottano misure per sostenere lo sviluppo dell’alfabetizzazione in materia di IA del proprio personale; espressamente non deve essere garantito un determinato livello. Noi forniamo sostegno mediante indicazioni nell’applicazione e nel nostro centro assistenza; la formazione dei propri collaboratori resta compito della struttura.",
            "Se una struttura collega il proprio account a un assistente di IA proprio (si veda il punto seguente), essa è deployer ai sensi dell’AI Act anche per quest’ultimo — decide sull’impiego e formula le richieste. L’interfaccia in sé non è un sistema di IA: legge dati dalla banca dati e li restituisce, senza trarre inferenze; il considerando 12 dell’AI Act distingue espressamente tali sistemi dall’IA.",
          ],
        },
        {
          titel: "Collegamento con un assistente di IA proprio",
          paragraphs: [
            "Una struttura può collegare il proprio account, tramite un’interfaccia, a un assistente di IA da essa scelto e con il quale ha un contratto proprio — ad esempio Claude di Anthropic PBC, USA. Se tale collegamento è stato concesso, l’assistente può consultare in sola lettura, su richiesta della struttura: occupazione, disponibilità e prezzi giornalieri; prenotazioni con nome dell’ospite, periodo di soggiorno, alloggio, canale di prenotazione, stato nonché importo e valuta, nella misura in cui il ruolo dell’account richiedente è autorizzato a vedere gli importi; e la panoramica delle conversazioni nella casella di posta. Senza un collegamento concesso non ha luogo alcuna trasmissione.",
            "Non vengono trasmessi indirizzo e-mail e numero di telefono degli ospiti, dati delle carte, coordinate bancarie e giustificativi di pagamento, codici di accesso nonché i dossier degli alloggi. Le note di prenotazione e il contenuto dei messaggi degli ospiti sono esclusi per impostazione predefinita, poiché possono contenere indicazioni sullo stato di salute o altre categorie particolari ai sensi dell’art. 9 GDPR; la struttura deve autorizzarli espressamente e separatamente al momento della concessione.",
            "Il collegamento può essere concesso soltanto da un account con il ruolo «Amministratore», non da qualsiasi account con accesso. Ogni consultazione è registrata ed è consultabile dalla struttura in «Account → Collegamenti»; essa può interrompere il collegamento in qualsiasi momento, e l’accesso cessa immediatamente.",
            "Giuridicamente questa trasmissione è un’istruzione della struttura nei nostri confronti (art. 28, par. 3, lett. a), GDPR). Il fornitore dell’assistente non è un nostro sub-responsabile del trattamento — non lo incarichiamo e non gli impartiamo istruzioni; egli tratta i dati in forza del contratto che la struttura stessa ha concluso con lui. Della base giuridica di tale trattamento, dell’informazione dei propri ospiti e delle garanzie di un trasferimento verso un paese terzo è pertanto responsabile la struttura.",
          ],
        },
        {
          titel: "Traduzioni",
          paragraphs: [
            "I testi degli alloggi e dei contenuti possono essere tradotti tramite la Cloud Translation API di Google Ireland Limited. Vengono trasmessi i testi da tradurre; dati personali soltanto nella misura in cui sono contenuti in tali testi.",
          ],
        },
        {
          titel: "Raccomandazioni di prezzo",
          paragraphs: [
            "Per le raccomandazioni di prezzo accediamo a dati di mercato, meteorologici e di cambio provenienti da fonti esterne. Queste interrogazioni non contengono dati personali, ma soltanto luogo, periodo e caratteristiche dell’alloggio.",
          ],
        },
      ],
    },
    {
      heading: "Siti web e domini dei nostri clienti",
      paragraphs: [
        "Se una struttura crea con il page builder un proprio sito web con dominio proprio, gestiamo le voci DNS a ciò necessarie tramite Cloudflare, Inc. In tale occasione vengono trasmessi dati relativi al dominio e alla configurazione; i dati dei visitatori del sito web del cliente sono trattati come descritto nella presente informativa.",
        "Dei contenuti, delle informazioni societarie obbligatorie e delle informative sulla protezione dei dati del sito web del cliente è responsabile la rispettiva struttura.",
      ],
    },
    {
      heading: "Programma di affiliazione",
      paragraphs: [
        "Gestiamo un programma di affiliazione tramite il quale i partner (influencer, consulenti, agenzie, clienti) raccomandano aziende a myNextDays e ricevono una commissione. In questo contesto, trattiamo i dati dei partner e – in misura limitata – delle aziende raccomandate.",
      ],
      unterpunkte: [
        {
          titel: "Dati dei partner",
          paragraphs: [
            "Al momento della candidatura, trattiamo nome, azienda, forma giuridica, paese, indirizzo e-mail, lingua, account di social media (piattaforma, indirizzo, handle, portata auto-dichiarata), numero di identificazione IVA (verifica tramite il sistema VIES dell'UE), dati di pagamento (IBAN, indirizzo Wise o PayPal) e il consenso ai termini e condizioni di partecipazione con versione e data. La base giuridica è l'esecuzione del contratto di affiliazione (Art. 6 par. 1 lett. b GDPR); per le note di credito e la conservazione si applicano gli obblighi fiscali e commerciali (Art. 6 par. 1 lett. c GDPR).",
            "Se un partner gestisce un team, visualizza il nome o la ragione sociale dei suoi partner di team, il rango, il numero di clienti paganti e la commissione di team risultante. I messaggi tra sponsor e partner di team vengono memorizzati sulla piattaforma in modo che entrambi possano visualizzare la cronologia.",
          ],
        },
        {
          titel: "Clic sui link di affiliazione",
          paragraphs: [
            "Quando un visitatore accede a un link di affiliazione (mynextdays.com/p/CODE), memorizziamo il codice, l'ora, la pagina visitata, la pagina di riferimento e gli eventuali parametri della campagna, nonché l'indirizzo IP e l'identificatore del browser esclusivamente come checksum abbreviati (hash) – per il rilevamento di abusi (frequenze), non per il riconoscimento. Non viene impostato alcun cookie di tracciamento. I dati dei clic vengono eliminati dopo 90 giorni. La base giuridica è il nostro legittimo interesse a una fatturazione del programma a prova di frode (Art. 6 par. 1 lett. f GDPR).",
          ],
        },
        {
          titel: "Account e post di social media collegati",
          paragraphs: [
            "I partner possono collegare volontariamente i loro account YouTube (Google), Instagram e Facebook (Meta) e TikTok alla dashboard del partner. In tal modo, concedono alla rispettiva piattaforma un'autorizzazione di lettura (OAuth); non scriviamo nulla in questi account. Memorizziamo l'identificatore e il nome dell'account, il token di accesso crittografato, l'ora del collegamento e quotidianamente una metrica per account: numero di follower o abbonati, visualizzazioni degli ultimi 28 giorni, tasso di interazione e numero di post, ciascuno con l'ora della risposta della piattaforma. Per i post che il partner crea nella dashboard (titolo, piattaforma, indirizzo, data di pubblicazione), memorizziamo inoltre visualizzazioni, Mi piace, commenti, condivisioni e salvataggi dalla piattaforma.",
            "Lo scopo è la verifica della portata indicata dal partner e l'assegnazione di clic e clienti ai singoli contributi; le informazioni non verificate vengono ponderate meno al momento del rilascio. Le indicazioni di incongruenze (ad esempio un salto di follower senza visualizzazioni corrispondenti) servono esclusivamente alla nostra verifica manuale e non portano ad alcuna decisione automatizzata. La base giuridica è il consenso del partner (Art. 6 par. 1 lett. a GDPR), che egli fornisce collegandosi e può revocare in qualsiasi momento nella dashboard sotto \"Disconnetti\"; al momento della disconnessione, eliminiamo immediatamente il token di accesso, i valori misurati memorizzati rimangono come cronologia e vengono eliminati con l'account del partner. Utilizziamo esclusivamente le interfacce ufficiali delle piattaforme; per il trattamento da parte di Google, Meta e TikTok si applicano le loro proprie informative sulla protezione dei dati.",
          ],
        },
        {
          titel: "Aziende consigliate",
          paragraphs: [
            "Se un'azienda si registra con un codice partner, memorizziamo l'associazione dell'azienda al partner, nonché l'ora, il percorso (link o codice) e lo stato. Il partner vede l'azienda esclusivamente in forma pseudonima (numero progressivo, paese, stato, importi) — mai nome, indirizzo e-mail o dati di prenotazione. Solo se l'azienda acconsente esplicitamente al momento della registrazione, il partner può contattarla tramite la piattaforma. Per la fatturazione delle provvigioni, elaboriamo gli importi netti degli abbonamenti delle fatture pagate dall'azienda; la base giuridica è l'esecuzione del contratto di partnership e del contratto di utilizzo (Art. 6 par. 1 lett. b GDPR).",
          ],
        },
      ],
    },
    {
      heading: "Hosting e conservazione",
      paragraphs: [
        "La piattaforma, la banca dati, i contenuti multimediali e il server di posta funzionano su server di Hetzner Online GmbH, Germania, nel centro dati di Helsinki (Finlandia) — dunque all’interno dell’Unione europea. Con Hetzner è in essere un accordo sul trattamento dei dati.",
        "Le copie di sicurezza vengono create cifrate e conservate cifrate presso un fornitore di archiviazione all’interno dell’UE.",
      ],
    },
    {
      heading: "Panoramica dei destinatari",
      paragraphs: [
        "Oltre ai fornitori indicati, comunichiamo dati personali soltanto se siamo tenuti a farlo per legge (ad es. autorità fiscali, autorità di perseguimento penale) oppure se lei o la struttura titolare lo richiedono.",
      ],
      list: [
        "Hetzner Online GmbH (Germania/Finlandia) — hosting, banca dati, contenuti multimediali, server di posta",
        "Stripe Payments Europe, Limited (Irlanda) — pagamenti, versamenti, verifica dell’identità",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (Lussemburgo) — pagamenti, se attivati",
        "Channex.io Ltd (Regno Unito) — collegamento ai portali di prenotazione",
        "Meta Platforms Ireland Limited (Irlanda) — messaggi WhatsApp, se attivati",
        "Sendinblue SAS / Brevo (Francia, Germania) — gestione e invio della newsletter, soltanto in presenza di consenso",
        "Google Ireland Limited (Irlanda) — traduzioni; protezione antispam del modulo di contatto (reCAPTCHA Enterprise), soltanto in presenza di consenso; accesso con Google, se utilizzato; Misurazione della portata (Google Analytics 4), solo con consenso",
        "Groq, Inc. (USA) — proposte di risposta, se attivate",
        "Cloudflare, Inc. (USA) — gestione DNS per i domini dei clienti",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Non figurano in questo elenco i servizi che una struttura concorda essa stessa con un terzo e collega al proprio account tramite l’interfaccia — ad esempio un assistente di IA come Claude di Anthropic PBC, USA. Essi non sono fornitori da noi incaricati, bensì destinatari su istruzione della rispettiva struttura; senza il collegamento di quest’ultima non vi affluisce alcun dato. Anthropic, secondo l’elenco ufficiale dei partecipanti del Dipartimento del Commercio statunitense, non è certificata nell’ambito dell’EU-US Data Privacy Framework; un trasferimento si fonda pertanto sulle clausole contrattuali tipo, delle quali deve rispondere la rispettiva struttura in qualità di titolare del trattamento.",
          ],
        },
      ],
    },
    {
      heading: "Trasferimento verso paesi terzi",
      paragraphs: [
        "Il trattamento avviene in linea di principio all’interno dell’UE. Presso i servizi sopra indicati con sede fuori dall’UE può verificarsi un trasferimento verso un paese terzo.",
        "Per Groq, Inc. e Cloudflare, Inc. (USA) fondiamo il trasferimento sulle clausole contrattuali tipo della Commissione europea ai sensi dell’art. 46, par. 2, lett. c), GDPR, nella misura in cui il destinatario non possa invocare una decisione di adeguatezza (EU-US Data Privacy Framework).",
        "Controparte contrattuale dell’elaborazione dei pagamenti è Stripe Payments Europe, Limited (Irlanda). Nella misura in cui Stripe si avvale a tal fine di Stripe, LLC (USA), quest’ultima è certificata nell’ambito dell’EU-US Data Privacy Framework; il trasferimento si fonda in tale misura sulla decisione di adeguatezza della Commissione europea ai sensi dell’art. 45 GDPR. In aggiunta si applicano le clausole contrattuali tipo contenute nell’[accordo sul trattamento dei dati di Stripe](https://stripe.com/legal/dpa).",
        "Per Channex.io Ltd (Regno Unito) vale la decisione di adeguatezza della Commissione europea per il Regno Unito; qualora essa venisse a mancare, si applicano le clausole contrattuali tipo.",
      ],
    },
    {
      heading: "Accesso di autorità di paesi terzi (US CLOUD Act)",
      paragraphs: [
        "I fornitori soggetti alla giurisdizione statunitense possono essere obbligati, in base al CLOUD Act (Clarifying Lawful Overseas Use of Data Act, 2018) statunitense, a consegnare dati alle autorità degli Stati Uniti — anche quando tali dati si trovano su server all’interno dell’Unione europea. Un simile accesso può porsi in contrasto con il GDPR, e il fornitore può essere giuridicamente impedito dall’informarne noi o lei. Né la decisione di adeguatezza relativa all’EU-US Data Privacy Framework né le clausole contrattuali tipo escludono questo rischio.",
        "Limitiamo tale rischio facendo funzionare i sistemi portanti — piattaforma, banca dati, contenuti multimediali, server di posta e copie di sicurezza — presso fornitori europei all’interno dell’UE, dove non opera alcuna giurisdizione statunitense.",
      ],
      unterpunkte: [
        {
          titel: "Servizi interessati",
          paragraphs: [
            "Una giurisdizione statunitense può venire in considerazione esclusivamente per i seguenti servizi aggiuntivi, chiaramente delimitati:",
          ],
          list: [
            "Groq, Inc. (USA) — proposte di risposta nella casella di posta dei messaggi, soltanto se la struttura attiva la funzione. Viene trasmesso il rispettivo contesto del messaggio.",
            "Cloudflare, Inc. (USA) — gestione DNS per i domini dei clienti. Vengono trasmessi dati relativi al dominio e alla configurazione, nessun dato degli ospiti.",
            "Google LLC (USA) — per l'accesso con Google, per le traduzioni e per la misurazione della portata (Google Analytics 4, solo con consenso); il partner contrattuale è Google Ireland Limited, ma non si esclude l'accesso da parte della società madre statunitense.",
          ],
        },
        {
          titel: "Evitabilità",
          paragraphs: [
            "L’utilizzo della piattaforma è possibile senza questi servizi: le proposte di risposta sono disattivabili, la gestione DNS riguarda soltanto i clienti con dominio proprio e l’accesso con Google è un’alternativa facoltativa all’accesso con e-mail e password.",
          ],
        },
        {
          titel: "Distinzione dal diritto europeo",
          paragraphs: [
            "Il CLOUD Act è diritto statunitense, non diritto dell’Unione europea. Esso va distinto dall’EU Data Act (regolamento (UE) 2023/2854), che disciplina il passaggio e la portabilità presso i servizi di trattamento dei dati, nonché dal Cloud and AI Development Act, che alla data della presente informativa si trova nel procedimento legislativo europeo.",
          ],
        },
      ],
    },
    {
      heading: "Periodo di conservazione",
      list: [
        "Dati dell’account: per la durata del rapporto commerciale; successivamente cancellazione, nella misura in cui non sussista un obbligo di conservazione.",
        "Dati di prenotazione, di fatturazione e di pagamento: secondo la legge danese sulla contabilità, cinque anni dalla fine dell’esercizio al quale sono da attribuire; per i clienti con sede in Germania possono applicarsi termini commerciali e fiscali più lunghi.",
        "Messaggi e dati degli ospiti nella piattaforma: secondo le istruzioni della struttura titolare, al più tardi fino alla cancellazione da parte di quest’ultima o fino alla fine del contratto.",
        "Newsletter: fino alla revoca del consenso; le iscrizioni non confermate decadono dopo sette giorni. La prova del consenso e della disdetta resta conservata oltre tale termine, per il tempo in cui è necessaria come prova.",
        "Log di autenticazione ed eventi di sicurezza: a breve termine, ai fini del riconoscimento degli attacchi.",
        "File di log del server: soltanto per il tempo necessario al funzionamento e alla sicurezza.",
        "Copie di sicurezza: a rotazione, fino a quando vengono sostituite da copie più recenti.",
      ],
    },
    {
      heading: "I suoi diritti",
      paragraphs: [
        "Lei ha diritto di accesso (art. 15), di rettifica (art. 16), di cancellazione (art. 17), di limitazione del trattamento (art. 18), alla portabilità dei dati (art. 20) e di opposizione ai trattamenti fondati su legittimi interessi (art. 21 GDPR). Un consenso prestato può essere revocato in qualsiasi momento con effetto per il futuro.",
        `A tal fine si rivolga a [${ANBIETER.email}](mailto:${ANBIETER.email}). Se i suoi dati riguardano l’utilizzo della piattaforma da parte di una struttura, inoltriamo la sua richiesta alla struttura titolare oppure sosteniamo quest’ultima nella risposta.`,
        `Può inoltre presentare reclamo a un’autorità di controllo per la protezione dei dati — per noi è competente ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}). Può rivolgersi anche all’autorità di controllo del suo luogo di residenza.`,
      ],
    },
    {
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular. Ein Abschnitt „Ihre Rechte", der die
      // Löschung nur als DSGVO-Artikel erwähnt, genügt der Prüfung nicht.
      heading: "Cancellare l’account e i dati dell’app",
      paragraphs: [
        "La cancellazione del suo account può richiederla lei stesso in qualsiasi momento — nell’app alla voce «Profilo → Account» oppure tramite il nostro modulo sul web:",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "La via sul web funziona volutamente anche quando non ha più l’app installata o non riesce più ad accedere. A tutela contro gli abusi ciò avviene in due passaggi: lei inserisce l’indirizzo e-mail del suo account e riceve esattamente a tale indirizzo un link di conferma. Soltanto il richiamo di quest’ultimo rende valida la richiesta — un indirizzo semplicemente inserito non produce alcun effetto. Trattiamo la richiesta entro 30 giorni e rispondiamo per e-mail.",
        "Con l’account cancelliamo le sue credenziali di accesso, il suo profilo, i suoi dati relativi agli alloggi e al calendario nonché i suoi messaggi. Non vengono cancellati i documenti per i quali sussiste un obbligo legale di conservazione — in particolare fatture e giustificativi di prenotazione dei periodi rendicontati (obbligo di contabilità secondo il diritto danese, di regola cinque anni). Tali documenti vengono bloccati per la durata del termine, dunque conservati esclusivamente per l’adempimento di tale obbligo e successivamente cancellati.",
      ],
    },
    {
      heading: "Sicurezza del trattamento",
      paragraphs: [
        "Proteggiamo il trattamento mediante misure tecniche e organizzative ai sensi dell’art. 32 GDPR, in particolare: cifratura del trasporto su tutto il percorso (TLS), regole di accesso per tenant direttamente nella banca dati, autorizzazioni basate sui ruoli con separazione dei dati finanziari e di servizio, autenticazione a due fattori facoltativa, limitazione dei tentativi di accesso, copie di sicurezza cifrate con test di ripristino periodico nonché registrazione degli eventi rilevanti per la sicurezza.",
      ],
    },
    {
      heading: "Obbligo di fornire i dati",
      paragraphs: [
        "I dati di cui abbiamo bisogno per la conclusione del contratto, la fatturazione e gli obblighi di legge sono necessari — senza di essi non possiamo mettere a disposizione la piattaforma. Tutti gli altri dati sono facoltativi.",
      ],
    },
    {
      heading: "Modifiche della presente informativa",
      paragraphs: [
        "Adeguiamo la presente informativa quando cambiano il trattamento, i fornitori impiegati o il quadro giuridico. Vale di volta in volta la versione qui pubblicata; la data in alto indica l’aggiornamento.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default datenschutz;
