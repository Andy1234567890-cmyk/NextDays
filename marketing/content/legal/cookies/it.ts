// Italienische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Informativa sui cookie",
  metaDescription:
    "Quali cookie utilizza myNextDays: esclusivamente cookie tecnicamente necessari e funzionali, nessun cookie di tracciamento o pubblicitario.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Questa informativa spiega quali cookie e tecniche di archiviazione analoghe utilizza ${ANBIETER.firma} su questo sito web e sulla piattaforma myNextDays.`,
    "In breve: utilizziamo esclusivamente cookie tecnicamente necessari e funzionali. Non sono presenti cookie di analisi, pubblicitari o di tracciamento, né trasmissione di dati di utilizzo a reti pubblicitarie.",
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
        "Dovete dare il consenso per una sola cosa: la protezione anti-spam del nostro modulo di contatto. Proviene da Google (reCAPTCHA Enterprise), è quindi un servizio esterno, e viene caricato esclusivamente se lo avete autorizzato. A tal fine, al primo accesso compare una barra nella parte inferiore dello schermo, con pulsanti di pari rilievo per Rifiuta e Accetta e senza selezione preimpostata. Finché non avete deciso, vale «non consentito».",
        "La vostra decisione è memorizzata nell'archivio del vostro browser (Local Storage, valore «nd_consent»); contiene solo la categoria, il momento e un numero di versione, nessun dato identificativo della vostra persona. Tramite l'icona dei cookie in basso a sinistra di ogni pagina potete modificarla o revocarla in qualsiasi momento. Dopo sei mesi ve lo richiederemo di nuovo — un consenso non deve valere indefinitamente.",
      ],
    },
    {
      heading: "Questo sito web",
      paragraphs: [
        "Il sito web di marketing non imposta cookie. I caratteri e le icone si trovano sul nostro server: per questo non viene richiamato alcun servizio di terzi per icone o caratteri. L'unico servizio esterno di questo sito è la protezione anti-spam del modulo di contatto, che si carica solo con il vostro consenso. I dettagli sono riportati nell'[Informativa sulla privacy](/datenschutz).",
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
          titel: "nd_refresh — Rinnovo della sessione (tecnicamente necessario)",
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
          titel: "sb-… — Accesso con Google (tecnicamente necessario, solo in caso di utilizzo)",
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
            "Registra la vostra decisione sulla protezione anti-spam del modulo di contatto, in modo che la barra di consenso non chieda di nuovo a ogni accesso. Vengono memorizzati solo la categoria, il momento e un numero di versione. Il valore non lascia il vostro dispositivo e non viene trasmesso al nostro server; vale per questo browser. Validità: sei mesi — trascorsi i quali la barra chiederà di nuovo. Se eliminate il valore, la barra chiederà di nuovo alla visita successiva.",
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
