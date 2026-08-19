import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Pagamenti e fatture",
  description: "Fornitori di pagamento, regole di pagamento e fatture.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Pagamenti",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Collegare un fornitore di pagamento",
          excerpt:
            "Come collegare Stripe o PayPal a myNextDays per gestire i pagamenti automaticamente.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Fornitori disponibili" },
            {
              type: "p",
              text: "myNextDays gestisce i pagamenti tramite fornitori di pagamento collegati. Attualmente sono supportati Stripe e PayPal — potete collegare uno o entrambi i fornitori contemporaneamente e utilizzarli a seconda dell'immobile o delle preferenze dell'ospite.",
            },
            {
              type: "steps",
              items: [
                "Aprite Account e passate alla sezione «Pagamenti».",
                "Selezionate il fornitore desiderato — Stripe o PayPal.",
                "Seguite la procedura guidata di collegamento e accedete al fornitore oppure create un nuovo account.",
                "Confermate il collegamento — lo stato passa a «collegato».",
              ],
            },
            { type: "h2", text: "Cosa succede dopo" },
            {
              type: "p",
              text: "Non appena un fornitore è collegato, potete inviare link di pagamento, incassare acconti e avviare rimborsi direttamente dalla prenotazione. Tutti gli importi vengono elaborati nella valuta impostata per il rispettivo immobile.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Senza un fornitore collegato potete contrassegnare i pagamenti come ricevuti solo manualmente — l'addebito automatico non è quindi possibile.",
            },
            { type: "h2", text: "Più immobili, un solo fornitore" },
            {
              type: "p",
              text: "Un collegamento stabilito una volta vale per l'intero account, per tutti i vostri immobili. Le modalità esatte dell'addebito si impostano tramite [Regole di pagamento](/hilfe/zahlungen/zahlungsregeln). I pagamenti a voi avvengono successivamente tramite il rispettivo fornitore, vedi [Versamenti](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "Stripe è adatto per pagamenti con carta e molti metodi di pagamento locali",
                "PayPal offre agli ospiti un'alternativa familiare",
                "Entrambi i fornitori possono essere scollegati e ricollegati in modo indipendente l'uno dall'altro",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Regole di pagamento",
          excerpt: "Stabilite quando scadono l'acconto e il saldo di una prenotazione.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Acconto e saldo" },
            {
              type: "p",
              text: "Le regole di pagamento stabiliscono come viene gestita finanziariamente una prenotazione — ad esempio un acconto al momento della prenotazione e un saldo prima dell'arrivo, oppure il pagamento completo immediato. Le regole valgono per ogni immobile e possono essere modificate in qualsiasi momento.",
            },
            {
              type: "steps",
              items: [
                "Aprite l'immobile e passate alla sezione «Regole di pagamento».",
                "Scegliete se richiedere un acconto e stabilite la percentuale.",
                "Stabilite quando scade il saldo, ad esempio un determinato numero di giorni prima dell'arrivo.",
                "Salvate le impostazioni.",
              ],
            },
            { type: "h2", text: "Addebito automatico" },
            {
              type: "p",
              text: "Se è collegato un fornitore di pagamento, myNextDays addebita automaticamente acconto e saldo alla data impostata e informa preventivamente l'ospite tramite un messaggio.",
            },
            {
              type: "note",
              variant: "info",
              text: "Le regole di pagamento hanno effetto solo per le prenotazioni con un fornitore di pagamento collegato. Senza fornitore, contrassegnate i pagamenti manualmente nella prenotazione.",
            },
            { type: "h2", text: "Differenze per canale" },
            {
              type: "p",
              text: "Sui portali può valere in modo diverso la loro propria gestione dei pagamenti — in questo caso verificate le rispettive condizioni del portale. Per le prenotazioni tramite la propria piattaforma o il proprio sito web si applicano sempre le regole impostate qui. I dettagli sul collegamento del fornitore si trovano in [Collegare un fornitore di pagamento](/hilfe/zahlungen/zahlungsanbieter-verbinden), quelli sulla fatturazione in [Creare fatture](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "L'acconto può essere un importo fisso o una percentuale",
                "La scadenza del saldo è liberamente configurabile",
                "Le modifiche hanno effetto solo sulle nuove prenotazioni, non retroattivamente",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Creare fatture",
          excerpt: "Come creare una fattura per una prenotazione con l'indirizzo di fatturazione corretto.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Creare una fattura" },
            {
              type: "p",
              text: "Per ogni prenotazione è possibile creare una fattura — intestata all'ospite stesso oppure a un'azienda diversa, nel caso in cui la prenotazione sia di natura commerciale.",
            },
            {
              type: "steps",
              items: [
                "Aprite la prenotazione in Prenotazioni.",
                "Selezionate «Crea fattura».",
                "Verificate o completate l'indirizzo di fatturazione.",
                "Verificate le voci elencate — pernottamento, add-on, commissioni.",
                "Create la fattura e inviatela all'ospite.",
              ],
            },
            { type: "h2", text: "Gestire l'indirizzo di fatturazione" },
            {
              type: "p",
              text: "Potete inserire l'indirizzo di fatturazione direttamente nella prenotazione oppure farlo integrare successivamente dall'ospite tramite la conferma di prenotazione. Senza un indirizzo completo, in alcuni paesi non è possibile emettere una fattura legalmente valida.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Per i clienti aziendali verificate in particolare la ragione sociale e l'indirizzo — le correzioni successive richiedono l'emissione di una fattura di rettifica.",
            },
            { type: "h2", text: "Importi e valuta" },
            {
              type: "p",
              text: "Tutte le voci vengono indicate nella valuta impostata per l'immobile. I pagamenti già effettuati vengono annotati in fattura come pagamento ricevuto. Per sapere come vengono determinati acconto e saldo, consultate [Regole di pagamento](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "Le fatture possono essere scaricate in PDF",
                "In caso di modifiche è sempre possibile emettere fatture di rettifica",
                "Gli add-on compaiono come voce separata",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Rimborsi",
          excerpt:
            "Come rimborsare un pagamento totalmente o parzialmente quando una prenotazione viene cancellata o modificata.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Quando è necessario un rimborso" },
            {
              type: "p",
              text: "Un rimborso si verifica tipicamente in caso di cancellazione, ma può essere necessario anche in caso di un successivo adeguamento del prezzo o di un add-on cancellato.",
            },
            {
              type: "steps",
              items: [
                "Aprite la prenotazione interessata in Prenotazioni.",
                "Selezionate «Rimborso» nella sezione pagamenti della prenotazione.",
                "Inserite l'importo da rimborsare — totale o parziale.",
                "Confermate il rimborso.",
              ],
            },
            { type: "h2", text: "Procedura tramite il fornitore di pagamento" },
            {
              type: "p",
              text: "Il rimborso viene eseguito tramite il fornitore utilizzato per il pagamento — Stripe o PayPal — e viene riaccreditato direttamente sul metodo di pagamento originale dell'ospite. L'operazione viene annotata automaticamente nella cronologia della prenotazione.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Senza un fornitore di pagamento collegato non è possibile avviare automaticamente un rimborso — in questo caso concordate la restituzione direttamente con l'ospite.",
            },
            { type: "h2", text: "Effetto sulle commissioni" },
            {
              type: "p",
              text: "Le commissioni di marketplace o di portale già fatturate vengono adeguate proporzionalmente in caso di rimborso. Maggiori informazioni in [Capire le commissioni](/hilfe/zahlungen/provisionen-verstehen). I dettagli sulla cancellazione stessa si trovano in [Cancellazione e rimborso](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "Sono possibili rimborsi parziali per singole voci",
                "Lo stato di elaborazione è sempre visibile nella prenotazione",
                "I rimborsi avvengono esclusivamente tramite il fornitore originariamente utilizzato",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Versamenti",
          excerpt:
            "Come ricevere dai fornitori di pagamento collegati i ricavi delle vostre prenotazioni.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Come funzionano i versamenti" },
            {
              type: "p",
              text: "I pagamenti in entrata si accumulano dapprima presso il fornitore di pagamento collegato. Da lì avviene il versamento sul vostro conto bancario registrato, secondo la cadenza abituale del rispettivo fornitore.",
            },
            {
              type: "steps",
              items: [
                "Aprite Account e passate alla sezione «Pagamenti».",
                "Verificate in «Versamenti» lo stato del rispettivo fornitore.",
                "Se necessario, aprite la vista dettagliata del fornitore per la cronologia completa dei versamenti.",
              ],
            },
            { type: "h2", text: "Cosa viene detratto prima del versamento" },
            {
              type: "p",
              text: "Prima del versamento vengono considerate le commissioni di marketplace e di portale, oltre alle commissioni del fornitore. L'importo versato non corrisponde quindi necessariamente alla somma originale della prenotazione.",
            },
            {
              type: "note",
              variant: "info",
              text: "La struttura esatta delle trattenute è spiegata in [Capire le commissioni](/hilfe/zahlungen/provisionen-verstehen).",
            },
            { type: "h2", text: "Più immobili e proprietari" },
            {
              type: "p",
              text: "Se gestite immobili per proprietari diversi, i versamenti vengono assegnati in base ai rendiconti dei proprietari registrati. In caso di discrepanze, verificate prima di tutto lo stato delle prenotazioni sottostanti in Prenotazioni.",
            },
            {
              type: "ul",
              items: [
                "La cadenza e il metodo di versamento sono determinati dal rispettivo fornitore",
                "Gli importi trattenuti, ad esempio per rimborsi in corso, sono contrassegnati",
                "La cronologia completa è consultabile direttamente presso il fornitore",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Capire le commissioni",
          excerpt:
            "Una panoramica su come si compongono le commissioni di marketplace e di portale e dove vengono conteggiate.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            { type: "h2", text: "Due tipi di commissioni" },
            {
              type: "p",
              text: "Per le prenotazioni tramite myNextDays possono essere applicate due commissioni diverse: la commissione di marketplace per le prenotazioni tramite la propria piattaforma e le commissioni di portale per le prenotazioni ricevute tramite portali collegati come Booking o Airbnb. Le due sono indipendenti l'una dall'altra e possono variare a seconda del canale di vendita di una prenotazione.",
            },
            {
              type: "ul",
              items: [
                "Commissione di marketplace: si applica alle prenotazioni tramite la piattaforma myBestDays",
                "Commissione di portale: viene calcolata dal rispettivo portale secondo le proprie condizioni",
                "Le prenotazioni dirette tramite il vostro sito web vanno considerate indipendentemente da queste",
              ],
            },
            { type: "h2", text: "Dove sono visibili le commissioni" },
            {
              type: "steps",
              items: [
                "Aprite Account e passate alla sezione «Rendiconto».",
                "Selezionate il mese desiderato.",
                "Verificate il prospetto per ogni prenotazione con la relativa commissione.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Il canale tramite cui è arrivata una prenotazione si vede direttamente nella prenotazione stessa — questo spiega quale commissione è stata applicata di volta in volta.",
            },
            { type: "h2", text: "Collegamento con i versamenti" },
            {
              type: "p",
              text: "Le commissioni vengono detratte dalla somma della prenotazione prima del versamento. I dettagli sulla procedura di versamento si trovano in [Versamenti](/hilfe/zahlungen/auszahlungen). In caso di rimborso, la relativa commissione viene corretta proporzionalmente — l'intero svolgimento di una prenotazione è mostrato nella [La cronologia della prenotazione](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
      ],
    },
  ],
};
