// Italienische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Informativa sui cookie",
  metaDescription:
    "Quali cookie imposta myNextDays: cookie tecnicamente necessari e — solo con il Suo consenso — cookie funzionali, analitici e di marketing. Ogni categoria può essere attivata e disattivata individualmente.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Questa informativa spiega quali cookie e tecniche di archiviazione analoghe utilizza ${ANBIETER.firma} su questo sito web e sulla piattaforma myNextDays.`,
    "In breve: Necessari sono solo i cookie senza i quali il sito web non funziona come richiesto. Tutto il resto richiede il Suo consenso e non viene caricato senza di esso — la protezione antispam del nostro modulo di contatto, la misurazione della portata e i cookie di marketing con cui misuriamo il successo della nostra pubblicità. Può consentire o negare individualmente ciascuna di queste categorie e revocare la Sua decisione in qualsiasi momento.",
  ],
  sections: [
    {
      heading: "Cosa sono i cookie",
      paragraphs: [
        "I cookie sono piccoli file di testo che un sito web salva nel browser. Consentono di riconoscere una sessione — ad esempio per rimanere connessi dopo l'accesso. Oltre ai cookie, i browser utilizzano altri sistemi di archiviazione come il Local Storage, che funzionano in modo tecnicamente simile.",
      ],
    },
    {
      heading: "Per cosa serve il vostro consenso",
      paragraphs: [
        "Il consenso è necessario ai sensi del § 9 del regolamento danese sui cookie (Cookie-bekendtgørelsen), che attua l'articolo 5, paragrafo 3, della direttiva 2002/58/CE, solo se l'accesso al vostro dispositivo non serve esclusivamente a trasmettere una comunicazione o non è strettamente necessario per un servizio da voi espressamente richiesto.",
        "Tutti i cookie che utilizziamo sono necessari per l'accesso, la sicurezza della sessione o un'impostazione scelta da voi stessi — per questo non chiediamo nulla e, viceversa, non impostiamo nulla che richieda un consenso.",
        "Deve dare il Suo consenso per tre categorie, che non vengono caricate senza la Sua autorizzazione: la protezione antispam del nostro modulo di contatto (reCAPTCHA di Google), la misurazione della portata di questo sito web (Google Analytics 4) e i cookie di marketing (Meta, LinkedIn, Google Ads). A tal fine, una finestra con un elenco di categorie — alla prima visita, senza preselezione, ogni categoria con il proprio interruttore — Le chiederà il consenso. Finché non ha deciso, vale „non consentito“, e non verrà né valutato né pubblicizzato.",
        "La vostra decisione è memorizzata nell'archivio del vostro browser (Local Storage, valore «nd_consent»); contiene solo la categoria, il momento e un numero di versione, nessun dato identificativo della vostra persona. Tramite l'icona dei cookie in basso a sinistra di ogni pagina potete modificarla o revocarla in qualsiasi momento. Dopo sei mesi ve lo richiederemo di nuovo — un consenso non deve valere indefinitamente.",
      ],
    },
    {
      heading: "Questo sito web",
      paragraphs: [
        "Questo sito web non imposta cookie di per sé. Font e simboli sono ospitati sul nostro server — non viene richiamato alcun servizio di simboli o font di terze parti. Due servizi esterni vengono aggiunti, se li consente: la protezione antispam del modulo di contatto e la misurazione della portata. Solo quest'ultima imposta cookie (\"Questo sito web non imposta cookie di sua iniziativa. Font e simboli sono ospitati sul nostro server — non viene richiamato alcun servizio di simboli o font di terzi. Si aggiungono solo i servizi che Lei consente: la protezione antispam del modulo di contatto, la misurazione della portata e i servizi di marketing. Quali cookie vengono impostati, con quale durata e su quale host, è indicato di seguito nella sezione „Cookie di terze parti“. La revoca avviene tramite l'icona dei cookie in basso a sinistra — il rispettivo servizio termina immediatamente e i suoi cookie vengono cancellati. I dettagli sono disponibili nella [Informativa sulla privacy](/datenschutz).\", \"_ga_<ID>\", fino a due anni, con un ID casuale senza riferimento alla Sua persona); Google abbrevia il Suo indirizzo IP, i segnali di Google e la personalizzazione degli annunci sono disattivati. Revoca tramite l'icona dei cookie in basso a sinistra — la misurazione termina immediatamente e i cookie vengono eliminati. I dettagli sono disponibili nella [Informativa sulla privacy](/datenschutz).",
      ],
    },
    {
      heading: "Cookie della piattaforma",
      paragraphs: [
        "Non appena effettuate l'accesso al pannello di controllo, al marketplace o nella visualizzazione mobile, vengono impostati i seguenti cookie:",
      ],
      unterpunkte: [
        {
          titel: "nd_access — Accesso (tecnicamente necessario)",
          list: [
            "Scopo: identifica la vostra sessione autenticata nei confronti del server.",
            "Contenuto: token di accesso di breve durata; leggibile solo dal server (HttpOnly), trasmesso solo via HTTPS.",
            "Durata: sessione o scadenza del token.",
          ],
        },
        {
          titel:
            "nd_refresh — Rinnovo della sessione (tecnicamente necessario)",
          list: [
            "Scopo: rinnova il token di accesso in modo che non dobbiate effettuare continuamente un nuovo accesso.",
            "Contenuto: token di rinnovo; HttpOnly, solo via HTTPS.",
            "Durata: fino alla disconnessione o alla scadenza.",
          ],
        },
        {
          titel: "nd_locale — Scelta della lingua (funzionale)",
          list: [
            "Scopo: memorizza la lingua da voi scelta.",
            "Contenuto: codice lingua, ad es. «de» o «en».",
            "Durata: fino alla modifica o all'eliminazione.",
          ],
        },
        {
          titel: "sidebar_state — Barra laterale (funzionale)",
          list: [
            "Scopo: memorizza se la barra di navigazione è espansa o compressa.",
            "Contenuto: «true» o «false».",
            "Durata: fino alla modifica o all'eliminazione.",
          ],
        },
        {
          titel:
            "sb-… — Accesso con Google (tecnicamente necessario, solo in caso di utilizzo)",
          list: [
            "Scopo: mantiene la sessione quando accedete tramite Google.",
            "Contenuto: token di sessione del servizio di accesso.",
            "Durata: sessione o scadenza del token. Viene impostato solo se scegliete l'accesso con Google.",
          ],
        },
      ],
    },
    {
      heading: "Local Storage",
      unterpunkte: [
        {
          titel: "nd_consent",
          paragraphs: [
            "Registra la Sua decisione sui servizi che richiedono il consenso (protezione antispam del modulo di contatto e misurazione della portata).",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "Viene impostato solo se aprite voi stessi la chat su questo sito e inviate un messaggio. È la chiave della vostra conversazione — senza di esso non ritrovereste la nostra risposta dopo un cambio di pagina. Non contiene alcun dato su di voi ed è utilizzato solo per questo scopo.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "Memorizza nel browser se avete acconsentito all'uso dell'inserimento vocale, in modo che il consenso non venga richiesto di nuovo a ogni accesso. Il valore non lascia il vostro dispositivo.",
          ],
        },
      ],
    },
    {
      heading: "Cookie dell'app mobile",
      paragraphs: [
        "L'app mobile non utilizza cookie. I token di accesso e di rinnovo vengono memorizzati nell'archivio chiavi sicuro del dispositivo (iOS Keychain, Android Keystore) ed eliminati alla disconnessione.",
      ],
    },
    {
      heading: "Cookie di terze parti",
      paragraphs: [
        "Se effettuate un pagamento, il fornitore del servizio di pagamento (Stripe o PayPal) può impostare cookie sul proprio sito, necessari per l'elaborazione e la prevenzione delle frodi. Si applicano le disposizioni del rispettivo fornitore.",
        "Sui siti web che le attività creano con il nostro builder, è la rispettiva attività a decidere sui cookie aggiuntivi ed è responsabile delle relative informazioni.",
        "Solo con il Suo consenso i servizi Google su questo sito web impostano i seguenti cookie: due per la misurazione dell'audience, uno per la protezione antispam. Senza il Suo consenso, il rispettivo script non verrà caricato e nessuno di questi cookie verrà impostato; in caso di revoca, li cancelleremo.",
      ],
      unterpunkte: [
        {
          titel: "_fbp — Misurazione del successo della pubblicità (consenso richiesto)",
          list: [
            "Scopo: associa la Sua visita a un annuncio pubblicitario per consentirci di misurare il successo delle nostre campagne.",
            "Contenuto: un identificatore generato casualmente; nessun nome, e-mail o informazione sull'account da parte nostra.",
            "Fornitore: Meta Platforms Ireland Limited, Merrion Road, Dublino 4, Irlanda.",
            "Host: mynextdays.com (cookie di prima parte, impostato dallo script di Meta). Durata: circa tre mesi.",
          ],
        },
        {
          titel: "_gcl_au — Misurazione del successo di Google Ads (consenso richiesto)",
          list: [
            "Scopo: associa la Sua visita a un annuncio Google per consentirci di misurare il successo delle nostre campagne.",
            "Contenuto: un identificatore generato casualmente senza alcun riferimento alla Sua persona.",
            "Fornitore: Google Ireland Limited, Gordon House, Barrow Street, Dublino 4, Irlanda.",
            "Host: mynextdays.com (cookie di prima parte). Durata: circa tre mesi.",
          ],
        },
        {
          titel: "li_gc e bcookie — Pubblicità LinkedIn (consenso richiesto)",
          list: [
            "Scopo: identifica il Suo browser rispetto a LinkedIn, in modo che gli annunci e il loro successo possano essere attribuiti; li_gc memorizza anche il Suo consenso.",
            "Contenuto: un identificatore del browser e lo stato del consenso; nessun dato dal Suo account presso di noi.",
            "Fornitore: LinkedIn Ireland Unlimited Company, Wilton Plaza, Dublino 2, Irlanda.",
            "Host: linkedin.com (cookie di terze parti). Durata: circa sei mesi o un anno.",
          ],
        },
        {
          titel:
            "_GRECAPTCHA — Protezione antispam del modulo di contatto (consenso richiesto)",
          list: [
            "Host: www.google.com (cookie di terze parti).",
            "Scopo: consente a Google di valutare il rischio, distinguendo le richieste di massa automatizzate da quelle reali.",
            "Contenuto: un identificatore generato da Google per questa valutazione; nessun nome, e-mail o dati dell'account da parte nostra.",
            "Fornitore: Google Ireland Limited, Gordon House, Barrow Street, Dublino 4, Irlanda.",
            "Durata: stabilita da Google, fino a sei mesi. Viene impostato solo dopo aver autorizzato la protezione antispam e aperto il modulo di contatto.",
          ],
        },
        {
          titel: "_ga — Misurazione della portata (consenso richiesto)",
          list: [
            "Host: mynextdays.com (cookie di prima parte, impostato dallo script di Google).",
            "Scopo: distingue i visitatori in modo che le visite ricorrenti non vengano contate due volte.",
            "Contenuto: ID generato casualmente senza riferimento alla Sua persona; nessun nome, e-mail o dati dell'account.",
            "Fornitore: Google Ireland Limited, Gordon House, Barrow Street, Dublino 4, Irlanda.",
            "Durata: fino a due anni.",
          ],
        },
        {
          titel:
            "_ga_<ID> — Stato della sessione di misurazione (consenso richiesto)",
          list: [
            "Host: mynextdays.com (cookie di prima parte, impostato dallo script di Google).",
            "Scopo: registra quando è iniziata la Sua visita attuale, in modo che le visualizzazioni di pagina di una sessione appartengano insieme.",
            "Contenuto: timestamp e contatore della sessione; l'ID nel nome si riferisce alla nostra proprietà, non a Lei.",
            "Fornitore: Google Ireland Limited.",
            "Durata: fino a due anni.",
          ],
        },
      ],
    },
    {
      heading: "Eliminare e gestire i cookie",
      paragraphs: [
        "Potete eliminare o bloccare i cookie in qualsiasi momento nelle impostazioni del vostro browser. Se bloccate i cookie necessari, l'accesso alla piattaforma non è tecnicamente possibile — il sito pubblico e il marketplace restano utilizzabili senza accesso.",
        "Alla disconnessione, rimuoviamo noi stessi i cookie di accesso.",
      ],
    },
    {
      heading: "Modifiche alla presente informativa",
      paragraphs: [
        "Se vengono aggiunte funzionalità che richiedono ulteriori cookie, aggiorniamo questo elenco. Fa fede sempre la versione qui pubblicata; la data in alto indica lo stato di aggiornamento.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;
