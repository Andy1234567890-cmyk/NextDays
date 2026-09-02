// Partner-AGB — Italienisch. Maschinell aus de.ts übersetzt (Gemini, juristischer Prompt,
// 02.09.2026), NICHT anwaltlich geprüft — ENTWURF wie die deutsche Fassung. Struktur und
// Platzhalter sind die der Quelldatei; inhaltliche Änderungen zuerst in de.ts, dann hier.
import type { LegalDoc } from "../types";

import { ANBIETER } from "../anbieter";

export const partnerAgb: LegalDoc = {
  slug: "partner/agb",
  metaDescription:
    "Condizioni di partecipazione al programma partner myNextDays: attribuzione, base provvigionale, scaglioni, provvigione di squadra, divieti, identificazione, pagamento.",
  numbered: false,
  toc: true,
  title: "Condizioni di partecipazione al programma partner (CGP Partner) — Bozza",
  standIso: "2026-09-02",
  intro: [
    "BOZZA — Queste condizioni rappresentano uno stato di lavorazione di myNextDays e non sono ancora state esaminate legalmente. Fino al rilascio della versione verificata, esse valgono come descrizione del programma, non come testo contrattuale definitivo. La versione verificata sarà pubblicata a questo indirizzo con un nuovo numero di versione; ai partner verrà richiesta una nuova accettazione al prossimo accesso.",
    `Le presenti condizioni di partecipazione regolano la partecipazione al programma partner (programma di affiliazione) di ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-nr. ${ANBIETER.cvr} (di seguito “myNextDays” o “noi”) da parte dei partner (di seguito “Partner”).`,
    "Il programma partner si rivolge a persone fisiche e giuridiche con sede nell'UE, in Svizzera o nel Regno Unito, che raccomandano strutture (locatori, agenzie, hotel) su myNextDays.",
  ],
  sections: [
    {
      heading: "§ 1 Partecipazione e approvazione",
      paragraphs: [
        "La partecipazione richiede una candidatura tramite la dashboard del Partner. I dati obbligatori includono nome o ragione sociale, forma giuridica, paese, almeno un account di social media con indirizzo, handle e portata, e per le aziende il numero di identificazione IVA.",
        "myNextDays esamina personalmente ogni candidatura e decide liberamente sull'approvazione. Non sussiste alcun diritto all'ammissione. La partecipazione è gratuita; un abbonamento a myNextDays non è un prerequisito.",
        "Il Partner mantiene aggiornati i propri dati, in particolare canali, forma giuridica, dati fiscali e di pagamento.",
        "La portata indicata è inizialmente un'autocertificazione. Il Partner può collegare volontariamente i propri account YouTube, Instagram, Facebook e TikTok; in tal caso, follower e visualizzazioni verranno letti dalla piattaforma e indicati come verificati. La portata non verificata avrà un peso inferiore durante l'approvazione e le successive verifiche. Il collegamento può essere disconnesso in qualsiasi momento nella dashboard; i dettagli sul trattamento sono disponibili nell'informativa sulla privacy.",
      ],
    },
    {
      heading: "§ 2 Assegnazione delle strutture (Attribuzione)",
      paragraphs: [
        "Una struttura viene assegnata al Partner se si registra con il codice di raccomandazione del Partner. Il codice viene visualizzato in modo visibile alla struttura al momento della registrazione e confermato con l'invio. Non vengono impostati cookie di tracciamento.",
        "Una struttura viene assegnata esattamente a un Partner; determinante è il codice confermato al momento della registrazione. Una successiva riassegnazione avviene solo da myNextDays in caso di errore comprovato.",
        "Non vengono assegnate le strutture del Partner stesso, dei suoi soci, dipendenti o familiari, nonché le strutture che sono o sono state già clienti di myNextDays.",
      ],
    },
    {
      heading: "§ 3 Provvigione sui propri clienti",
      paragraphs: [
        "La base provvigionale è il fatturato netto dell'abbonamento della struttura assegnata (tariffa base e moduli) derivante da fatture pagate — senza IVA, senza provvigioni del portale, servizi aggiuntivi, ricalcoli e altre voci di transito.",
        "Il tasso di commissione dipende dal rango del partner al momento del pagamento. I ranghi e i tassi sono pubblicati sulla pagina del programma. Il rango è determinato dal numero di clienti paganti nella struttura del partner: i suoi propri clienti paganti e i clienti paganti dei suoi partner di squadra (§ 4), ogni cliente una volta. Il rango viene stabilito mensilmente alla data di riferimento; un avanzamento di rango è immediato, una retrocessione avviene solo se il numero è stato inferiore alla soglia per due date di riferimento consecutive.",
        "Se il partner raggiunge per la prima volta un rango a partire da “Aufsteiger”, riceve una tantum il bonus di avanzamento di rango indicato per questo rango sulla pagina del programma (attualmente 50,00 EUR per rango, per tutti i partner in Euro). Ogni rango viene remunerato una sola volta, anche dopo una retrocessione e un nuovo avanzamento. Il bonus è soggetto alla finestra di rimborso di cui al § 7.",
        "La commissione matura per ogni attività per dodici mesi a partire dalla sua prima fattura di abbonamento a pagamento; un periodo di prova gratuito e un mese gratuito intermediati tramite il partner non vengono conteggiati. Se l'abbonamento termina prima, la commissione termina con l'ultima fattura pagata.",
        "A partire dal rango “Elite-Partner”, il partner riceve inoltre una super-commissione dell'importo indicato sulla pagina del programma (attualmente 2,5 %) sul fatturato netto degli abbonamenti di tutti i clienti della sua struttura — clienti propri e clienti dei suoi partner di squadra — senza il limite di dodici mesi, purché il rispettivo cliente mantenga un abbonamento a pagamento e il partner detenga il rango al momento del pagamento. Essa matura oltre alla commissione di cui al comma 2 e al § 4.",
        "Per ogni prenotazione di un'attività associata al partner o a uno dei suoi partner di squadra, ricevuta e pagata tramite myBestDays, il partner riceve una quota di prenotazione dell'importo indicato sulla pagina del programma (attualmente 0,5 %) dell'importo della prenotazione pagato dall'ospite nella valuta della prenotazione, senza limiti di tempo, purché l'associazione sussista. Le cauzioni non sono un importo di prenotazione. I rimborsi all'ospite riducono proporzionalmente la quota (§ 7).",
      ],
    },
    {
      heading: "§ 4 Commissione di squadra",
      paragraphs: [
        "A partire dal rango “Aufsteiger”, un partner può guidare partner di squadra. Se un altro partner si candida tramite il link di squadra del partner e conferma visibilmente il suo codice nella sua candidatura, dopo la sua approvazione verrà assegnato alla squadra del partner (di seguito “Sponsor”). Se lo Sponsor non detiene il rango al momento della candidatura, la candidatura rimane valida, ma non si crea un'assegnazione di squadra.",
        "Lo Sponsor riceve sul fatturato netto degli abbonamenti dei clienti dei suoi partner di squadra una commissione di squadra pari alla differenza tra il proprio tasso di commissione e il tasso di commissione del partner di squadra, ciascuno in base al rango al momento del pagamento. Se entrambi sono dello stesso rango o il partner di squadra è di rango superiore, non matura alcuna commissione di squadra. La commissione del partner di squadra e la commissione di squadra dello Sponsor insieme non superano mai il tasso più alto della scala (attualmente 30 %).",
        "La commissione di squadra è esattamente a un livello di profondità: i partner di squadra non ricevono commissioni di squadra sui partner che reclutano direttamente. Non viene pagato alcun compenso per il reclutamento di un partner; non viene addebitata alcuna quota di partecipazione. La commissione di squadra deriva esclusivamente dal fatturato degli abbonamenti a pagamento.",
        "La commissione di squadra è valida per ogni cliente di squadra per dodici mesi a partire dalla sua prima fattura pagata, è soggetta alla stessa finestra di rimborso e viene proporzionalmente annullata in caso di rimborso o storno di addebito (§ 7). Essa matura solo finché lo sponsor e il partner di squadra sono approvati; in caso contrario, viene sospesa fino a chiarimento.",
        "L'assegnazione al team è unica. Una modifica avviene solo tramite myNextDays con un motivo documentato.",
      ],
    },
    {
      heading: "§ 5 Obblighi del partner e identificazione",
      paragraphs: [
        "Il partner identifica ogni raccomandazione con il suo link o codice come pubblicità — all'inizio del post, nella lingua del post, in conformità con le normative del suo paese (in Germania, tra l'altro, § 5a comma 4 UWG, in Danimarca markedsføringsloven § 6 comma 4). myNextDays fornisce le formulazioni per ogni paese nella dashboard del partner.",
        "Il partner fornisce a myNextDays solo informazioni che corrispondono alle descrizioni dei servizi pubblicate e non rilascia alcuna promessa a nome di myNextDays. Sono in particolare vietate promesse di successo e garanzie (ad esempio “occupazione garantita al 100% in tre giorni”) nonché dichiarazioni sui guadagni che non derivano dalle descrizioni dei servizi pubblicate.",
        "Ogni video e ogni post che menziona myNextDays o che contiene il link del partner deve essere sottoposto a revisione come file nella dashboard del partner prima della pubblicazione. Il link del partner viene creato solo dopo l'approvazione scritta da parte di myNextDays; la pubblicazione senza approvazione è vietata. myNextDays può revocare un'approvazione; le commissioni già maturate rimangono inalterate.",
        "Per loghi, schermate, B-Roll, overlay e screenshot, il partner utilizza esclusivamente il materiale pubblicitario fornito da myNextDays. Non sono consentite registrazioni software proprie non verificate.",
      ],
    },
    {
      heading: "§ 6 Pratiche vietate",
      paragraphs: ["Sono in particolare vietate:"],
      list: [
        "Brand-Bidding: annunci a pagamento sul marchio “myNextDays”, varianti di scrittura e combinazioni (ad es. “myNextDays prezzi”) nei motori di ricerca e nelle reti;",
        "Cookie-dropping, reindirizzamenti nascosti, iFrames, richiamo automatico del link del partner o altre manipolazioni tecniche dell'assegnazione;",
        "Auto-promozione: registrazione di proprie attività, di soci, dipendenti o parenti tramite il proprio codice o il codice di un partner di squadra;",
        "Portata acquistata (follower acquistati, click farm, traffico bot) nonché incentivi alle attività per la registrazione (rimborsi, regali, concorsi);",
        "Promesse di reclutamento: il reclutamento di partner con promesse di guadagno che non derivano da fatturato di abbonamenti a pagamento, o la presentazione del programma come fonte di reddito attraverso il reclutamento di ulteriori partner;",
        "Spam, pubblicità diretta non autorizzata e l'uso di marchi o contenuti di terzi senza diritto.",
      ],
    },
    {
      heading: "§ 7 Finestra di rimborso, storno, trattenuta",
      paragraphs: [
        "Ogni riga di commissione è aperta per 30 giorni (finestra di rimborso) dopo la sua creazione e successivamente pagabile. Se una fattura sottostante viene rimborsata o stornata (chargeback) in tutto o in parte, la commissione — inclusa una commissione di squadra basata su di essa — viene stornata proporzionalmente, anche dopo il pagamento, mediante compensazione con future commissioni.",
        "In caso di sospetto di violazione del § 2, § 5 o § 6, myNextDays può sospendere le assegnazioni e le commissioni fino a chiarimento. Se la violazione viene confermata, le commissioni interessate decadono.",
      ],
    },
    {
      heading: "§ 8 Pagamento e nota di credito",
      paragraphs: [
        "Le commissioni pagabili vengono raggruppate e pagate mensilmente per valuta, non appena raggiungono l'importo minimo della rispettiva valuta indicato sulla pagina del programma o nel dashboard. Non avviene alcuna conversione tra valute.",
        "La fatturazione avviene tramite procedura di nota di credito (autofatturazione, momsloven § 52a): myNextDays emette una nota di credito per ogni pagamento; il partner non emette fattura. Il partner acconsente alla procedura di nota di credito.",
        "Gli imprenditori ricevono la nota di credito con riferimento all'inversione contabile (Reverse Charge); il prerequisito è un numero di identificazione IVA valido e confermato. I privati ricevono la nota di credito senza IVA e tassano la commissione autonomamente.",
        "Il pagamento avviene tramite bonifico SEPA, Wise o PayPal ai dati inseriti dal partner nel dashboard.",
      ],
    },
    {
      heading: "§ 9 Dati e accesso",
      paragraphs: [
        "Il partner visualizza le attività assegnate in forma pseudonima (numero, paese, stato, importi). Nomi, indirizzi e-mail o dati di prenotazione delle attività non vengono divulgati. Uno sponsor visualizza dei suoi partner di squadra nome o ragione sociale, rango, numero di clienti paganti e la commissione di squadra risultante, nessun dettaglio del cliente.",
        "Per gli account collegati e i post creati, myNextDays visualizza follower, visualizzazioni, interazioni, nonché clic e clienti per post. Anomalie (ad esempio un salto di follower senza visualizzazioni corrispondenti o una deviazione significativa tra l'autodichiarazione e il valore verificato) sono indicazioni per una verifica personale ai sensi del § 6 e § 10, non un blocco automatico.",
        "Il trattamento dei dati personali nel programma partner è descritto nell'informativa sulla privacy.",
      ],
    },
    {
      heading: "§ 10 Durata, blocco e risoluzione",
      paragraphs: [
        "La partecipazione è a tempo indeterminato e può essere terminata da entrambe le parti in qualsiasi momento in forma testuale. Le commissioni già maturate e pagabili vengono pagate ai sensi del § 8; dopo la risoluzione non maturano nuove commissioni.",
        "myNextDays può bloccare il partner in caso di violazioni delle presenti condizioni. Durante il blocco, le commissioni vengono sospese; in caso di violazione confermata, decadono.",
      ],
    },
    {
      heading: "§ 11 Modifiche",
      paragraphs: [
        "myNextDays può modificare le presenti condizioni e la scala con effetto per il futuro. Le modifiche saranno pubblicate nella dashboard del partner e su questa pagina con numero di versione; in caso di modifiche sostanziali, al partner sarà richiesta una nuova accettazione. Le commissioni già maturate rimangono inalterate.",
      ],
    },
    {
      heading: "§ 12 Diritto applicabile",
      paragraphs: [
        "Si applica il diritto danese, con esclusione delle norme di conflitto. Le disposizioni imperative a tutela dei consumatori dello Stato in cui un partner privato ha la sua residenza abituale rimangono inalterate.",
      ],
    },
  ],
};
