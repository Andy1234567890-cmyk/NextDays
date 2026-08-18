import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Regolamento sui servizi digitali",
  stand: "Aggiornato: 18 agosto 2026",
  intro: [
    "myBestDays è un servizio intermediario e una piattaforma online ai sensi del regolamento (UE) 2022/2065 relativo a un mercato unico dei servizi digitali (regolamento sui servizi digitali, DSA). La presente pagina raccoglie le informazioni e le procedure richieste da tale regolamento.",
    "myBestDays non è una piattaforma online di dimensioni molto grandi ai sensi dell'articolo 33 del regolamento. Gli obblighi aggiuntivi previsti per queste ultime — valutazione dei rischi sistemici, revisione indipendente, archivio degli annunci pubblicitari e pubblicazione del numero mensile di utenti secondo la procedura ivi prevista — non ci incombono.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Punti di contatto (articoli 11 e 12)",
      paragraphs: [
        `Punto di contatto unico per le autorità degli Stati membri, la Commissione e il comitato europeo per i servizi digitali: ${ANBIETER.email}, per posta ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danimarca.`,
        `Punto di contatto unico per gli utenti: ${ANBIETER.email}. Ci raggiunge direttamente, senza filtri automatizzati.`,
        "Con entrambi i punti di contatto è possibile comunicare in tedesco, danese e inglese.",
        "Non occorre designare un rappresentante legale nell'Unione ai sensi dell'articolo 13: il gestore è stabilito in Danimarca e quindi nell'Unione.",
        `Coordinatore dei servizi digitali competente ai sensi dell'articolo 49: ${DSA_KOORDINATOR.name}, Danimarca ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Segnalare contenuti illeciti (articolo 16)",
      paragraphs: [
        "Chiunque può segnalarci contenuti che ritiene illeciti. Utilizzi la funzione di segnalazione disponibile su ogni annuncio, recensione e messaggio, oppure il punto di contatto per gli utenti.",
        "Affinché possiamo valutare una segnalazione senza un esame giuridico approfondito, essa dovrebbe contenere:",
      ],
      list: [
        "una spiegazione sufficientemente motivata del perché il contenuto sia illecito;",
        "l'esatta ubicazione elettronica, in particolare l'URL;",
        "nome e indirizzo e-mail del segnalante — salvo per le segnalazioni relative a reati contro l'autodeterminazione sessuale dei minori, per le quali l'indicazione è facoltativa;",
        "la dichiarazione che le informazioni sono esatte e complete secondo scienza e coscienza.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Come trattiamo le segnalazioni",
      paragraphs: [
        "Confermiamo la ricezione senza indugio e decidiamo in modo tempestivo, diligente, non arbitrario e obiettivo.",
        "Se una segnalazione contiene le informazioni di cui alla sezione 2, essa fonda la nostra conoscenza ai sensi dell'articolo 6 del regolamento.",
        "Comunichiamo la nostra decisione al segnalante e indichiamo i mezzi di ricorso.",
        "Se il trattamento è automatizzato, lo comunichiamo.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Motivazione delle misure (articolo 17)",
      paragraphs: [
        "Se limitiamo la visibilità di un contenuto, lo rimuoviamo, ne blocchiamo l'accesso, sospendiamo pagamenti, sospendiamo la prestazione del servizio o l'account, la persona interessata riceve una motivazione chiara e specifica.",
        "La motivazione indica natura e portata della misura, il suo ambito territoriale e temporale, i fatti e le circostanze della decisione, l'eventuale coinvolgimento di un trattamento automatizzato, il fondamento giuridico o la clausola contrattuale violata e i mezzi di ricorso disponibili.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Sospetto di reato (articolo 18)",
      paragraphs: [
        "In presenza di indizi di un reato che comporti un pericolo per la vita o la sicurezza di una persona, informiamo senza indugio le autorità di contrasto o giudiziarie competenti.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. Sistema interno di gestione dei reclami (articolo 20)",
      paragraphs: [
        "Contro ogni misura di cui alla sezione 4 e contro il rigetto di una segnalazione è possibile reclamare gratuitamente entro sei mesi.",
        "I reclami sono trattati in modo tempestivo, non discriminatorio e diligente — sotto la supervisione di personale qualificato e non esclusivamente con strumenti automatizzati.",
        "Se un reclamo risulta fondato, revochiamo la misura. La via è descritta in [Reclami e risoluzione delle controversie](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Risoluzione extragiudiziale delle controversie (articolo 21)",
      paragraphs: [
        "Per le controversie relative alle misure di cui alla sezione 4 gli utenti possono rivolgersi a un organismo di risoluzione extragiudiziale delle controversie certificato dal coordinatore dei servizi digitali competente. La Commissione europea tiene l'elenco degli organismi certificati.",
        "Le decisioni di tali organismi non ci vincolano; non siamo tenuti a partecipare a procedure di fornitori indipendenti. La via giudiziaria resta impregiudicata.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Segnalatori attendibili (articolo 22)",
      paragraphs: [
        "Le segnalazioni presentate da un segnalatore riconosciuto come attendibile nel proprio settore di competenza sono trattate in via prioritaria.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Misure contro gli abusi (articolo 23)",
      paragraphs: [
        "Blocchiamo per un periodo ragionevole, previo avvertimento, gli account attraverso i quali vengono frequentemente forniti contenuti manifestamente illeciti.",
        "Sospendiamo il trattamento di segnalazioni e reclami per le persone che presentano frequentemente segnalazioni o reclami manifestamente infondati — anch'esso previo avvertimento.",
        "Valutiamo sempre il caso concreto: numero, proporzione e gravità dei casi interessati nonché l'intento.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Relazioni sulla trasparenza (articoli 15 e 24)",
      paragraphs: [
        "Pubblichiamo annualmente una relazione sulla moderazione dei contenuti: numero di ordini delle autorità, numero e tipo di segnalazioni, misure adottate, numero di reclami ed esito, informazioni sull'impiego di strumenti automatizzati nonché numero di controversie dinanzi a organismi extragiudiziali.",
        `Le microimprese e le piccole imprese sono esentate da parte di tali obblighi ai sensi dell'articolo 19 del regolamento. Finché l'esenzione si applica, mettiamo le informazioni a disposizione su richiesta all'indirizzo ${ANBIETER.email}; non appena la prima relazione sarà pubblicata, sarà collegata qui.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. Tracciabilità degli operatori commerciali (articoli da 30 a 32)",
      paragraphs: [
        "I fornitori che operano professionalmente sulla piattaforma possono offrire solo dopo averci comunicato nome, indirizzo, numero di telefono, indirizzo e-mail, dati di registrazione, partita IVA e conto di pagamento, e a condizione che le loro indicazioni risultino plausibili.",
        "Mostriamo tali informazioni nell'annuncio nella misura prevista dal regolamento.",
        "Se veniamo a sapere che un annuncio riguardava un prodotto o un servizio illecito, informiamo gli ospiti interessati nella misura in cui disponiamo dei loro recapiti.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Sistemi di raccomandazione (articolo 27)",
      paragraphs: [
        "I principali parametri dell'ordine dei risultati di ricerca e delle raccomandazioni, nonché la possibilità di influenzarli, sono descritti in [Prezzi, posizionamento e raccomandazioni](https://mybestdays.dk/rechtliches/preisangaben).",
      ],
    },
    {
      id: "werbung",
      heading: "13. Pubblicità (articolo 26)",
      paragraphs: [
        "Attualmente non mostriamo pubblicità a pagamento di terzi né posizionamenti a pagamento nei risultati di ricerca.",
        "Qualora introducessimo pubblicità, la contrassegneremmo chiaramente, indicheremmo l'inserzionista e i principali parametri della sua diffusione. Escludiamo la pubblicità basata su categorie particolari di dati personali ai sensi dell'articolo 9 del regolamento (UE) 2016/679 e la pubblicità rivolta a minori basata sulla profilazione.",
      ],
    },
  ],
};
