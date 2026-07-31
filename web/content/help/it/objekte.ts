import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Strutture e dotazioni",
  description: "Creare e gestire camere e case vacanza.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Gestire le strutture",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Struttura = un'unità prenotabile",
          excerpt: "Perché ogni struttura in myNextDays è esattamente un'unità prenotabile.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "In myNextDays una struttura è sempre esattamente un'unità prenotabile: una singola camera in un hotel oppure una casa vacanza completa. Questo principio vale indipendentemente dal fatto che gestiate una casa vacanza, un appartamento per vacanze o un hotel, ed è alla base della disponibilità, dei prezzi e delle prenotazioni.",
            },
            { type: "h2", text: "Non un edificio con camere sottostanti" },
            {
              type: "p",
              text: "Un equivoco frequente è rappresentare un edificio alberghiero come un'unica struttura con più camere al suo interno. In myNextDays questo non è previsto. Se ad esempio gestite un hotel con otto camere doppie e quattro camere singole, create dodici strutture distinte — non una struttura con un numero di camere indicato.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Un campo come «numero di camere» a livello di struttura non esiste, di proposito. Ogni camera necessita di una propria struttura con calendario e prezzi propri.",
            },
            { type: "h2", text: "Case vacanza" },
            {
              type: "p",
              text: "Nel caso di una casa vacanza o di un appartamento per vacanze, l'intera struttura corrisponde all'unità prenotabile. Qui non esiste un'ulteriore suddivisione: una casa vacanza è sempre una struttura autonoma con un proprio calendario.",
            },
            { type: "h2", text: "Perché questo è importante" },
            {
              type: "ul",
              items: [
                "Ogni struttura ha un proprio calendario di disponibilità: le doppie prenotazioni vengono impedite a livello di singola struttura.",
                "Prezzi, dotazioni e foto valgono per struttura, non per edificio.",
                "Una struttura appartiene sempre a un solo proprietario — nessuna assegnazione multipla.",
                "La visibilità sui canali (sito web, marketplace della piattaforma, portali) viene gestita per singola struttura.",
              ],
            },
            {
              type: "p",
              text: "Per sapere come scegliere la tipologia di struttura corretta per la vostra camera o casa vacanza, consultate [Definire la tipologia di struttura](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Definire la tipologia di struttura",
          excerpt: "Assegnare correttamente categoria, tipo di immobile e tipo di offerta.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "La tipologia di struttura determina come la vostra struttura viene classificata e filtrata sui portali e sul marketplace della piattaforma. È composta da tre campi di selezione consecutivi che percorrete durante la creazione o la modifica di una struttura.",
            },
            { type: "h2", text: "I tre livelli di selezione" },
            {
              type: "steps",
              items: [
                "Selezionate innanzitutto la categoria, ad esempio alloggio per vacanze o hotel.",
                "In base a questa, selezionate il tipo di immobile, ad esempio appartamento per vacanze, casa vacanza, camera doppia o camera singola.",
                "Selezionate il tipo di offerta, ad esempio l'intera struttura o una camera privata.",
                "Completate i campi aggiuntivi visualizzati in base alla selezione, ad esempio il tipo di letto o il piano.",
              ],
            },
            { type: "h2", text: "Perché l'ordine è importante" },
            {
              type: "p",
              text: "I tre menu a tendina dipendono l'uno dall'altro: la scelta della categoria limita i tipi di immobile disponibili, e la scelta del tipo di immobile limita a sua volta i tipi di offerta. In questo modo si ottengono solo combinazioni sensate, come quelle utilizzate anche dai grandi portali.",
            },
            {
              type: "note",
              variant: "info",
              text: "Se modificate la categoria in un secondo momento, myNextDays verifica se il tipo di immobile e il tipo di offerta sono ancora coerenti e, se necessario, vi chiede di effettuare una nuova selezione.",
            },
            { type: "h2", text: "Modificare la tipologia di struttura" },
            {
              type: "p",
              text: "Nel menu Strutture aprite la struttura desiderata e passate alla scheda Dati di base. Lì trovate i tre menu a tendina sotto Tipologia di struttura. Salvando la modifica, la nuova classificazione viene trasmessa a tutti i canali attivi.",
            },
            {
              type: "ul",
              items: [
                "Categoria: classificazione di livello superiore (ad es. alloggio per vacanze, hotel)",
                "Tipo di immobile: tipologia concreta della struttura (ad es. appartamento per vacanze, camera doppia)",
                "Tipo di offerta: cosa viene esattamente prenotato (ad es. intera struttura, camera privata)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Gestire le dotazioni",
          excerpt: "Selezionare le caratteristiche delle dotazioni e mantenerle aggiornate.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Le dotazioni di una struttura influiscono in modo determinante sulla facilità con cui viene trovata e filtrata sui portali. Gli ospiti filtrano in modo mirato in base a caratteristiche come Wi-Fi, cucina o parcheggio — dati mancanti possono escludere una struttura dai risultati di ricerca.",
            },
            { type: "h2", text: "Selezionare le dotazioni" },
            {
              type: "steps",
              items: [
                "Aprite la struttura e passate alla scheda Dotazioni.",
                "Selezionate tutte le caratteristiche pertinenti dall'elenco predefinito.",
                "Se necessario, aggiungete dettagli come il numero di posti auto o il tipo di cucina.",
                "Salvate le modifiche: vengono trasmesse automaticamente a tutti i portali attivi.",
              ],
            },
            { type: "h2", text: "Da dove provengono le caratteristiche" },
            {
              type: "p",
              text: "L'elenco delle dotazioni segue il catalogo delle caratteristiche dei grandi portali, affinché i vostri dati possano essere classificati correttamente. Non è previsto l'inserimento di caratteristiche personalizzate e inventate liberamente, poiché non potrebbero essere trasmesse correttamente ai portali.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Controllate le dotazioni dopo ogni modifica strutturale — ad esempio l'installazione di un nuovo condizionatore o di un bagno aggiuntivo — affinché i dati restino aggiornati su tutti i canali.",
            },
            { type: "h2", text: "Gruppi di caratteristiche comuni" },
            {
              type: "ul",
              items: [
                "Dotazioni di base: Wi-Fi, riscaldamento, condizionatore",
                "Cucina e ristorazione: cucina completamente attrezzata, lavastoviglie, macchina del caffè",
                "Bagno e biancheria: bagno privato, lavatrice, asciugamani",
                "Area esterna: balcone, terrazza, giardino, parcheggio",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Foto e descrizione",
          excerpt: "Immagini e testi efficaci per più prenotazioni.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "Foto e descrizione rappresentano per gli ospiti la base decisionale più importante. Una struttura può essere pubblicata solo quando sono presenti almeno una foto di copertina e una descrizione.",
            },
            { type: "h2", text: "Caricare le foto" },
            {
              type: "steps",
              items: [
                "Aprite la struttura e passate alla scheda Foto.",
                "Trascinate i file immagine nell'area di caricamento oppure selezionateli tramite la finestra di dialogo dei file.",
                "Impostate una foto di copertina: apparirà nei risultati di ricerca e nelle schede.",
                "Ordinate le restanti foto trascinandole in una sequenza sensata.",
              ],
            },
            { type: "h2", text: "Redigere la descrizione" },
            {
              type: "p",
              text: "Passate alla scheda Descrizione e inserite un titolo e un testo descrittivo. Descrivete in modo concreto la posizione, le particolarità e il target della struttura — le frasi generiche risultano sui portali meno convincenti di dettagli tangibili.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Non è consentito utilizzare foto di altre strutture o prese da internet: i portali effettuano controlli e possono sospendere le strutture in caso di violazioni.",
            },
            { type: "h2", text: "Consigli per foto di qualità" },
            {
              type: "ul",
              items: [
                "Almeno cinque foto, idealmente una per ogni ambiente",
                "Formato orizzontale, buona esposizione, nessuna filigrana",
                "La foto di copertina mostra la struttura nel modo più invitante e chiaro possibile",
                "Aggiornare regolarmente, soprattutto dopo le ristrutturazioni",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Occupazione e capacità",
          excerpt: "Registrare correttamente il numero massimo di ospiti e la disposizione dei letti.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "L'occupazione stabilisce quanti ospiti una struttura può accogliere e viene verificata a ogni ricerca e prenotazione. Dati errati portano a richieste rifiutate oppure a sovraffollamento — entrambe le situazioni sono da evitare.",
            },
            { type: "h2", text: "Inserire l'occupazione" },
            {
              type: "steps",
              items: [
                "Aprite la struttura e passate alla scheda Occupazione.",
                "Inserite il numero massimo di adulti.",
                "Inserite il numero massimo di bambini, se ammessi.",
                "Registrate la disposizione dei letti per ogni ambiente, ad esempio un letto matrimoniale e due letti singoli.",
              ],
            },
            { type: "h2", text: "Limiti dell'occupazione" },
            {
              type: "p",
              text: "In caso di richiesta di prenotazione, myNextDays verifica automaticamente se il numero di ospiti richiesto rientra nell'occupazione registrata. Le richieste che superano la capacità massima vengono rifiutate, oppure non vengono nemmeno mostrate come prenotabili.",
            },
            {
              type: "note",
              variant: "info",
              text: "Un letto aggiuntivo o un lettino per bambini aumenta la capacità reale solo se lo registrate esplicitamente nella disposizione dei letti — altrimenti il numero massimo di ospiti rimane invariato.",
            },
            { type: "h2", text: "Errori tipici" },
            {
              type: "ul",
              items: [
                "Numero massimo di ospiti impostato troppo alto, pur essendo presenti pochi letti",
                "Numero di bambini dimenticato, pur rivolgendosi la struttura alle famiglie",
                "Disposizione dei letti non aggiornata dopo una ristrutturazione",
              ],
            },
            {
              type: "p",
              text: "Se occupazione e dotazioni non corrispondono, controllate anche la scheda [Dotazioni](/hilfe/objekte/ausstattung).",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Stato della struttura e visibilità",
          excerpt: "Differenza tra attivo/inattivo e i tre assi dei canali.",
          updated: "Ultimo aggiornamento: luglio 2026",
          body: [
            {
              type: "p",
              text: "myNextDays distingue due elementi diversi che vengono spesso confusi: lo stato della struttura (attivo o inattivo) e la visibilità sui singoli canali di vendita. Entrambi si gestiscono separatamente.",
            },
            { type: "h2", text: "Stato della struttura" },
            {
              type: "p",
              text: "Lo stato active significa che una struttura è fondamentalmente vendibile. Lo stato inactive mette completamente fuori servizio una struttura — ad esempio in caso di ristrutturazione a lungo termine. Una struttura inattiva non è prenotabile su nessun canale, indipendentemente dagli interruttori dei canali.",
            },
            { type: "h2", text: "I tre assi dei canali" },
            {
              type: "p",
              text: "Se una struttura è attiva, tre interruttori indipendenti determinano esattamente dove è visibile:",
            },
            {
              type: "ul",
              items: [
                "Sito web — visibilità sul vostro sito web myNextDays",
                "Marketplace della piattaforma — visibilità sul marketplace globale di myBestDays",
                "Portali — visibilità su Booking, Airbnb e altri",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Questi tre assi sono completamente indipendenti dallo stato della struttura e tra loro. Una struttura attiva può, ad esempio, essere visibile solo sul sito web ma non sui portali.",
            },
            { type: "h2", text: "Modificare lo stato" },
            {
              type: "steps",
              items: [
                "Aprite la struttura e passate alla scheda Panoramica.",
                "Impostate lo stato su attivo o inattivo.",
                "Se necessario, regolate anche i tre interruttori dei canali nella scheda Visibilità.",
                "Salvate la modifica: ha effetto immediato su tutti i canali interessati.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Per bloccare singoli giorni a breve termine, utilizzate invece la funzione Stop-Sell nel calendario: blocca in modo mirato determinati giorni su tutti i canali, senza disattivare l'intera struttura.",
            },
          ],
        },
      ],
    },
  ],
};
