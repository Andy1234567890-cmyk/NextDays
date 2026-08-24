// Italienische Fassung der Vereinbarung zur Auftragsverarbeitung.
// Übersetzung von `de.ts` — inhaltliche Änderungen gehören ZUERST dorthin
// (dort stehen auch die Belege für die technischen und organisatorischen
// Maßnahmen und die Liste der Unterauftragsverarbeiter) und werden von dort
// in alle Sprachfassungen übernommen.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Accordo sul trattamento dei dati personali",
  metaDescription:
    "Trattamento dei dati per conto del titolare ai sensi dell’articolo 28 RGPD tra myNextDays ApS e le imprese che utilizzano la piattaforma: oggetto, istruzioni, sicurezza, sub-responsabili del trattamento.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Il presente accordo (di seguito «DPA») si applica tra l’impresa che utilizza la piattaforma myNextDays (di seguito «titolare del trattamento») e la ${ANBIETER.firma} (di seguito «responsabile del trattamento» o «noi») e dà attuazione agli obblighi previsti dall’articolo 28 del regolamento (UE) 2016/679 (RGPD).`,
    `Esso viene incorporato mediante le [Condizioni generali di contratto](${AGB_URL}) e si applica per l’intera durata dell’utilizzo della piattaforma. Prevale sulle Condizioni generali di contratto per quanto riguarda il trattamento di dati personali per conto del titolare del trattamento.`,
    "In via integrativa si applica l’[Informativa sulla privacy](/datenschutz) ai dati che trattiamo in qualità di titolari autonomi del trattamento — in particolare i dati dell’account e del rapporto commerciale.",
  ],
  sections: [
    {
      heading: "Oggetto e ripartizione dei ruoli",
      unterpunkte: [
        {
          paragraphs: [
            "Oggetto è il trattamento dei dati personali che il titolare del trattamento inserisce nella piattaforma o raccoglie tramite essa, affinché possiamo erogare le prestazioni contrattualmente convenute: gestione di strutture, prenotazioni e occupazione, comunicazione con gli ospiti, elaborazione dei pagamenti, contabilità e rendiconti per i proprietari, collegamento ai portali di prenotazione, generatore di siti web nonché gestione delle attività e del team.",
          ],
        },
        {
          paragraphs: [
            "Il titolare del trattamento decide in merito alle finalità e ai mezzi di tale trattamento. Trattiamo i dati esclusivamente su sua istruzione documentata e non per finalità proprie.",
          ],
        },
        {
          paragraphs: [
            "Per i dati dell’account, per la fatturazione delle nostre prestazioni, per la sicurezza dei sistemi e per la conservazione prevista dalla legge siamo noi stessi titolari del trattamento. Tale trattamento non è oggetto del presente DPA.",
          ],
        },
      ],
    },
    {
      heading: "Natura, ambito e finalità del trattamento",
      paragraphs: [
        "Il trattamento avviene mediante raccolta, conservazione, visualizzazione, modifica, comunicazione a destinatari scelti dal titolare del trattamento (ad es. portali di prenotazione, prestatori di servizi di pagamento), limitazione e cancellazione — in forma automatizzata all’interno della piattaforma.",
        "Il luogo del trattamento è l’Unione europea; le eccezioni sono indicate in modo esaustivo nella sezione 8.",
      ],
    },
    {
      heading: "Categorie di interessati",
      list: [
        "Ospiti e prenotanti, compresi i compagni di viaggio",
        "Potenziali clienti che inviano richieste o messaggi",
        "Proprietari delle strutture gestite",
        "Personale del titolare del trattamento (team, pulizie, servizio, ricevimento)",
        "Referenti di partner e fornitori del titolare del trattamento",
      ],
    },
    {
      heading: "Categorie di dati personali",
      list: [
        "Dati anagrafici: nome, indirizzo, data di nascita se rilevata, nazionalità se rilevata ai fini dell’obbligo di comunicazione",
        "Dati di contatto: indirizzo e-mail, numero di telefono",
        "Dati di prenotazione: periodo, struttura, numero di viaggiatori, prezzi, servizi aggiuntivi, cancellazioni",
        "Dati di pagamento: importo, valuta, modalità di pagamento, stato del pagamento, riferimenti (i dati completi delle carte non raggiungono i nostri sistemi)",
        "Dati di comunicazione: messaggi, note, recensioni",
        "Dati di accesso e di utilizzo del personale: ruolo, autorizzazioni, momento dell’accesso, dispositivo e indirizzo IP dell’accesso",
        "Le categorie particolari di cui all’articolo 9 RGPD non sono oggetto dell’incarico; il titolare del trattamento non inserisce tali dati nei campi di testo libero.",
      ],
    },
    {
      heading: "Istruzioni",
      unterpunkte: [
        {
          paragraphs: [
            "Il titolare del trattamento impartisce le istruzioni mediante l’utilizzo e la configurazione della piattaforma nonché in forma testuale al nostro indirizzo di contatto. Le istruzioni verbali vengono da noi confermate in forma testuale.",
          ],
        },
        {
          paragraphs: [
            "Se riteniamo che un’istruzione sia illecita, lo comunichiamo senza indugio e possiamo sospenderne l’attuazione fino a quando il titolare del trattamento la confermi o la modifichi.",
          ],
        },
        {
          paragraphs: [
            "Se siamo tenuti per legge al trattamento (ad esempio nei confronti delle autorità), informiamo preventivamente il titolare del trattamento, nella misura in cui ciò ci sia giuridicamente consentito.",
          ],
        },
        {
          titel: "Collegamento di servizi propri del titolare del trattamento",
          paragraphs: [
            "Il titolare del trattamento può collegare il proprio account, tramite un’interfaccia, a un servizio che ha scelto autonomamente e con il quale ha concluso un proprio contratto — ad esempio un assistente basato sull’intelligenza artificiale. Se rilascia un tale collegamento, ciò costituisce la sua istruzione esplicita, ai sensi dell’articolo 28, paragrafo 3, lettera a), RGPD, di trasmettere i dati abilitati a tale servizio. Essa comprende espressamente anche il trasferimento verso un paese terzo a essa connesso, qualora il servizio abbia sede al di fuori dell’Unione europea.",
            "In breve: su un tale collegamento decide unicamente il titolare del trattamento, ed è lui stesso competente per il servizio collegato.",
            "Può rilasciarlo soltanto un account dotato dell’autorizzazione a gestire i collegamenti esterni. Tale autorizzazione è riservata al ruolo «Amministratore»; gli account con diritti limitati — anche il ruolo «Co-amministratore» — non possono rilasciare alcun collegamento. Registriamo chi lo ha rilasciato, quando e per quale servizio, quali categorie di dati sono state abilitate e quali richiami sono avvenuti; tale registrazione è a disposizione del titolare del trattamento nell’interfaccia alla voce «Account → Collegamenti», affinché possa adempiere al proprio obbligo di rendicontazione e rispondere alle richieste di accesso.",
            "Il servizio collegato non è un nostro sub-responsabile del trattamento: non lo incarichiamo, non lo selezioniamo e non gli impartiamo istruzioni. Esso tratta i dati in forza del contratto che il titolare del trattamento ha concluso autonomamente con esso. Per tale trattamento, per la sua base giuridica e per le garanzie del trasferimento verso un paese terzo è pertanto competente il titolare del trattamento; esso non è oggetto del presente DPA.",
            "I campi di testo libero — le note di prenotazione e il contenuto dei messaggi degli ospiti — sono per impostazione predefinita esclusi da un tale collegamento. Possono contenere categorie particolari di dati personali ai sensi dell’articolo 9 RGPD, ad esempio indicazioni relative alla salute. Il titolare del trattamento deve abilitarli separatamente al momento del rilascio; senza tale abilitazione non vengono trasmessi.",
            "Il titolare del trattamento può interrompere in qualsiasi momento nell’interfaccia un collegamento rilasciato. I token di rinnovo vengono in tal caso cancellati e, a ogni ulteriore richiamo, viene verificato se il consenso sussista ancora — un servizio scollegato non può quindi leggere più nulla con effetto immediato, e non soltanto alla scadenza del suo token di accesso.",
          ],
        },
      ],
    },
    {
      heading: "Riservatezza",
      paragraphs: [
        "Tutte le persone che, in esecuzione dell’incarico, possono avere accesso ai dati sono vincolate alla riservatezza e vengono periodicamente istruite in materia di protezione dei dati. L’accesso è limitato alla misura necessaria per il rispettivo compito.",
        "Gli accessi del nostro personale ai dati dei clienti avvengono soltanto per la risoluzione di errori, su richiesta di assistenza o per l’adempimento di obblighi di legge.",
      ],
    },
    {
      heading: "Sicurezza del trattamento",
      paragraphs: [
        "Adottiamo le misure tecniche e organizzative necessarie ai sensi dell’articolo 32 RGPD. Sono attuate in particolare:",
      ],
      list: [
        "Cifratura del trasporto (TLS) per tutte le connessioni, header di sicurezza HTTP inclusa una rigorosa Content-Security-Policy",
        "Separazione dei mandanti direttamente nella banca dati: regole di accesso a livello di riga (Row Level Security) e revoca dei diritti sulle tabelle per i dati sensibili, in modo che un accesso al di fuori della propria impresa sia escluso anche per via diretta sulla banca dati",
        "Autorizzazioni basate sui ruoli con separazione dei dati: il personale di servizio e di pulizia non riceve dati finanziari e commerciali, i proprietari soltanto le proprie strutture; i dati degli ospiti vengono mascherati per i ruoli non autorizzati",
        "Autenticazione a due fattori (TOTP) disponibile per gli account; nuova autenticazione in caso di modifiche rilevanti per la sicurezza",
        "Registro degli accessi con dispositivo, momento e indirizzo IP, consultabile dal titolare del trattamento",
        "I collegamenti a servizi esterni possono essere rilasciati soltanto da un account con il ruolo «Amministratore»; ogni richiamo tramite un tale collegamento viene registrato (strumento, momento, ambito — senza i contenuti stessi) ed è consultabile dal titolare del trattamento. Un collegamento interrotto perde immediatamente l’accesso: a ogni richiamo viene verificato se il consenso sussista ancora",
        "Limitazione della frequenza delle richieste contro attacchi automatizzati, verifica delle firme delle chiamate webhook in entrata",
        "Copie di sicurezza cifrate e conservate al di fuori del sistema di produzione, con test di ripristino periodici",
        "Ambienti separati per lo sviluppo e l’esercizio; modifiche alla banca dati esclusivamente tramite migrazioni versionate",
      ],
    },
    {
      heading: "Sub-responsabili del trattamento",
      paragraphs: [
        "Il titolare del trattamento autorizza l’impiego dei seguenti sub-responsabili del trattamento. Con ciascuno di essi sussistono contratti ai sensi dell’articolo 28, paragrafo 4, RGPD con obblighi corrispondenti a quelli del presente DPA.",
      ],
      list: [
        "Hetzner Online GmbH, Germania (server, banca dati, contenuti multimediali, server di posta; centro dati di Helsinki, Finlandia)",
        "Stripe Payments Europe, Limited, Irlanda (pagamenti, versamenti, verifica dell’identità prevista dalla legge)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., Lussemburgo (pagamenti, se il titolare del trattamento li attiva)",
        "Channex.io Ltd, Regno Unito (collegamento ai portali di prenotazione, se attivato)",
        "Meta Platforms Ireland Limited, Irlanda (messaggi WhatsApp, se attivati)",
        "Google Ireland Limited, Irlanda (traduzione di contenuti; accesso con Google, se utilizzato)",
        "Groq, Inc., USA (proposte di risposta nella posta in arrivo, se attivate)",
        "Cloudflare, Inc., USA (gestione dei record DNS per domini propri, se utilizzata)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Comunichiamo una sostituzione o un’integrazione almeno 30 giorni prima. Entro tale termine il titolare del trattamento può opporsi per un motivo grave attinente alla protezione dei dati; se l’opposizione non viene superata, egli può disdire la parte di prestazione interessata oppure il contratto.",
          ],
        },
        {
          paragraphs: [
            "I servizi che il titolare del trattamento concorda autonomamente con un terzo non costituiscono un sub-trattamento, bensì una comunicazione da lui disposta. Ciò vale per un portale di prenotazione con cui egli ha un proprio contratto, così come per un assistente basato sull’intelligenza artificiale o per un altro programma che egli collega al proprio account tramite l’interfaccia (si veda la sezione «Istruzioni»).",
            "A tal fine è determinante non attraverso quali sistemi fluiscano i dati, bensì chi ricorre al servizio: un sub-trattamento sorge quando NOI incarichiamo un ulteriore fornitore per erogare la nostra prestazione. Se il titolare del trattamento seleziona autonomamente il servizio e conclude il contratto con esso, tale servizio tratta i dati per il titolare del trattamento — non per noi. Questa distinzione corrisponde alla prassi contrattuale di fornitori comparabili per i servizi di terzi collegati dal cliente.",
          ],
        },
      ],
    },
    {
      heading: "Trasferimento verso paesi terzi",
      paragraphs: [
        "I trasferimenti a destinatari al di fuori dell’UE si limitano ai servizi sopra indicati con sede negli USA o nel Regno Unito. La base è costituita dalle clausole contrattuali tipo della Commissione europea ai sensi dell’articolo 46, paragrafo 2, lettera c), RGPD oppure da una decisione di adeguatezza vigente; vengono applicate misure di protezione supplementari (cifratura, minimizzazione dei dati).",
      ],
    },
    {
      heading: "Assistenza al titolare del trattamento",
      unterpunkte: [
        {
          paragraphs: [
            "Assistiamo il titolare del trattamento nel dare risposta alle richieste degli interessati (articoli da 15 a 22 RGPD). A tal fine la piattaforma offre accesso, rettifica, esportazione e cancellazione dei dati direttamente nell’interfaccia. Se gli interessati si rivolgono direttamente a noi, li indirizziamo al titolare del trattamento e lo informiamo.",
          ],
        },
        {
          paragraphs: [
            "Assistiamo inoltre nelle valutazioni d’impatto sulla protezione dei dati, nel rispetto degli obblighi di cui agli articoli da 32 a 36 RGPD e in caso di richieste delle autorità di controllo.",
          ],
        },
      ],
    },
    {
      heading: "Violazioni dei dati personali",
      paragraphs: [
        "Se veniamo a conoscenza di una violazione dei dati personali che riguarda dati del titolare del trattamento, lo informiamo senza indugio, al più tardi entro 48 ore dalla conoscenza, in forma testuale.",
        "La comunicazione contiene, nella misura in cui siano noti, la natura e il momento dell’evento, le categorie di dati e i gruppi di persone interessati, le probabili conseguenze nonché le misure adottate e quelle proposte. Assistiamo il titolare del trattamento nei suoi obblighi di notifica e di comunicazione ai sensi degli articoli 33 e 34 RGPD.",
      ],
    },
    {
      heading: "Documentazione e verifiche",
      unterpunkte: [
        {
          paragraphs: [
            "Su richiesta dimostriamo il rispetto del presente DPA, in particolare fornendo informazioni sulle misure adottate e sui sub-responsabili del trattamento impiegati.",
          ],
        },
        {
          paragraphs: [
            "Il titolare del trattamento può effettuare verifiche nella misura necessaria oppure farle effettuare da un revisore indipendente che non sia in concorrenza con noi. Le verifiche avvengono previo preavviso con un termine adeguato, durante il normale orario di lavoro e senza turbare l’esercizio. L’onere di una verifica che vada oltre l’informativa è a carico del titolare del trattamento, salvo che la verifica sia motivata da un evento da noi causato.",
          ],
        },
      ],
    },
    {
      heading: "Cancellazione e restituzione",
      paragraphs: [
        "Al termine del contratto mettiamo a disposizione, su richiesta, i dati del titolare del trattamento per l’esportazione entro 30 giorni in un formato usuale e leggibile da dispositivo automatico. Successivamente cancelliamo i dati, comprese le copie.",
        "Sono esclusi i dati per i quali sussiste un obbligo di conservazione previsto dalla legge (in particolare dati di fatturazione e di contabilità); tali dati vengono bloccati e cancellati alla scadenza del termine. Le copie di sicurezza vengono sovrascritte con il normale ciclo di rotazione.",
      ],
    },
    {
      heading: "Responsabilità e ordine di prevalenza",
      paragraphs: [
        "Si applica l’articolo 82 RGPD. Nel rapporto tra le parti si applicano inoltre le regole di responsabilità delle Condizioni generali di contratto, nella misura in cui non contrastino con il RGPD.",
        "Qualora le Condizioni generali di contratto e il presente DPA siano in contrasto per quanto riguarda il trattamento per conto del titolare, prevale il presente DPA. Se una disposizione diventa inefficace, il restante contenuto resta efficace; le parti la sostituiscono con una disciplina ammissibile avente la medesima finalità.",
      ],
    },
    {
      heading: "Modifiche del presente accordo",
      paragraphs: [
        "Possiamo adeguare il presente DPA nella misura in cui ciò sia necessario a causa di modifiche normative, di requisiti delle autorità di controllo, di prescrizioni dei prestatori di servizi di pagamento o di sviluppi tecnici e purché il titolare del trattamento non ne risulti svantaggiato.",
        "Annunciamo le modifiche in forma testuale almeno 30 giorni prima della loro entrata in vigore. Se il titolare del trattamento non si oppone entro tale termine, esse si considerano accettate; su tale conseguenza si richiama l’attenzione nell’annuncio. In caso di opposizione ciascuna parte può disdire il contratto con effetto dal momento dell’entrata in vigore.",
      ],
    },
    {
      heading: "Contatti",
      paragraphs: [
        `Le richieste relative al presente accordo, le istruzioni e le segnalazioni vanno indirizzate a [${ANBIETER.email}](mailto:${ANBIETER.email}) oppure a ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts);
// der benannte Export bleibt daneben stehen.
export default avv;
