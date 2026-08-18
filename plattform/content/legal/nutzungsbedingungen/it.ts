import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Condizioni d'uso per gli ospiti",
  stand: "Aggiornato: 18 agosto 2026",
  intro: [
    "Le presenti condizioni d'uso disciplinano l'utilizzo del portale di prenotazione myBestDays (di seguito «la piattaforma») da parte di viaggiatori e di chi effettua la prenotazione (di seguito «l'ospite» o «Lei»).",
    `La piattaforma è gestita da ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danimarca, CVR n. ${ANBIETER.cvr} (di seguito «myBestDays» o «noi»). myBestDays è un marchio di questa società e non una persona giuridica autonoma. I dati completi del prestatore figurano nelle [Informazioni legali](https://mybestdays.dk/rechtliches/impressum).`,
    "Utilizzando la piattaforma Lei accetta le presenti condizioni. La preghiamo di leggerle attentamente.",
  ],
  summary: {
    heading: "Sintesi delle presenti condizioni",
    paragraphs: [
      "myBestDays è un marketplace. Mettiamo a disposizione la piattaforma sulla quale i fornitori offrono il proprio alloggio — l'alloggio in sé non lo forniamo noi. Il contratto di alloggio si conclude tra Lei e il fornitore, non con noi.",
      "Ciò che vede in un annuncio proviene dal fornitore: descrizione, foto, dotazioni, prezzo, condizioni di cancellazione e regolamento della casa. Verifichiamo gli annunci, ma non possiamo rispondere di ogni indicazione di un fornitore.",
      "Il prezzo che vede al momento di concludere la prenotazione è il prezzo totale dei servizi prenotati. Gli importi dovuti solo in loco (per esempio tassa di soggiorno o cauzione) sono indicati separatamente in anticipo.",
      "Se qualcosa non va, si rivolga anzitutto a noi. La sezione A15 descrive come presentare un reclamo e quali vie Le restano aperte in seguito.",
      "Questa sintesi illustra le condizioni ma non le sostituisce. Fa fede il testo integrale.",
    ],
  },
  sections: [
    {
      id: "a",
      heading: "A. Tutte le prenotazioni tramite myBestDays",
      subsections: [
        {
          id: "a1-definitionen",
          heading: "A1. Definizioni",
          paragraphs: [
            "I termini utilizzati nelle presenti condizioni sono illustrati nel glossario in calce al presente documento. I principali sono:",
          ],
          list: [
            "«Piattaforma»: il sito web, le applicazioni mobili e ogni altro accesso mediante il quale myBestDays mostra alloggi e intermedia prenotazioni.",
            "«Fornitore»: la persona fisica o giuridica che offre un alloggio tramite la piattaforma (host, locatore, agenzia, struttura alberghiera o ricettiva).",
            "«Alloggio»: la prestazione ricettiva offerta dal fornitore, ossia un immobile per vacanze o un'unità di una tipologia di camera o di immobile.",
            "«Prenotazione»: la prenotazione di un alloggio per un periodo determinato, conclusa tramite la piattaforma.",
            "«Prezzo totale»: l'importo indicato al momento di concludere la prenotazione, comprensivo di tutte le imposte, commissioni e supplementi regolati tramite la piattaforma.",
            "«Costi in loco»: importi non regolati tramite la piattaforma ma dovuti al fornitore (per esempio tassa di soggiorno, cauzione, pulizia finale a scelta del fornitore).",
          ],
        },
        {
          id: "a2-ueber-diese-bedingungen",
          heading: "A2. Sulle presenti condizioni",
          paragraphs: [
            "Le presenti condizioni si applicano a ogni utilizzo della piattaforma, indipendentemente dal fatto che Lei crei un account e che si concluda una prenotazione.",
            "La sezione A si applica a tutte le prenotazioni. La sezione B contiene le regole integrative per gli alloggi. In caso di contrasto prevale la sezione B.",
            "Alla prestazione ricettiva si applicano inoltre le condizioni del rispettivo fornitore (in particolare regolamento della casa e condizioni di cancellazione) indicate nell'annuncio. Tali condizioni del fornitore si aggiungono alle nostre; non possono derogare alle nostre condizioni per quanto riguarda il Suo rapporto con noi.",
            "Le presenti condizioni sono disponibili in tutte le 24 lingue ufficiali dell'Unione europea. In caso di divergenza tra le versioni linguistiche prevale la versione tedesca, salvo che il diritto imperativo del Suo Stato di residenza disponga diversamente.",
            "I diritti imperativi dei consumatori previsti dal diritto del Suo Stato di residenza non sono pregiudicati dalle presenti condizioni.",
          ],
        },
        {
          id: "a3-ueber-mybestdays",
          heading: "A3. Su myBestDays",
          paragraphs: [
            "myBestDays è un marketplace online per alloggi per vacanze e strutture ricettive. Gestiamo la piattaforma sulla quale i fornitori presentano il proprio alloggio e gli ospiti possono prenotarlo.",
            "Siamo intermediari, non albergatori. Non possediamo, gestiamo, amministriamo né controlliamo alcuno degli alloggi offerti sulla piattaforma e non siamo parte del contratto di alloggio.",
            "myBestDays è un servizio intermediario ai sensi del regolamento (UE) 2022/2065 relativo ai servizi digitali. Le nostre indicazioni e procedure ai sensi di tale regolamento figurano in [Regolamento sui servizi digitali](https://mybestdays.dk/rechtliches/dsa).",
            "myBestDays non è un organizzatore di viaggi. Non organizziamo pacchetti turistici ai sensi della direttiva (UE) 2015/2302; sui servizi turistici collegati si veda A20.",
          ],
        },
        {
          id: "a4-unsere-plattform",
          heading: "A4. La nostra piattaforma",
          paragraphs: [
            "Il contenuto di un annuncio — descrizione, foto, dotazioni, limiti di occupazione, prezzi, disponibilità, condizioni di cancellazione e regolamento della casa — proviene dal rispettivo fornitore, il quale è responsabile della sua esattezza e completezza.",
            "Verifichiamo gli annunci prima della pubblicazione e in via continuativa rispetto a violazioni manifeste delle nostre [Regole sui contenuti appropriati](https://mybestdays.dk/rechtliches/inhaltsrichtlinien). Non sussiste alcun obbligo di sorveglianza generale di tutti i contenuti e, ai sensi dell'articolo 8 del regolamento (UE) 2022/2065, esso non sarebbe neppure ammissibile.",
            "Come ordiniamo i risultati di ricerca e quali fattori determinano tale ordine è illustrato in [Prezzi, posizionamento e raccomandazioni](https://mybestdays.dk/rechtliches/preisangaben).",
            "Ci adoperiamo per una piattaforma costantemente disponibile, ma non siamo tenuti a una disponibilità ininterrotta. Sono possibili manutenzioni, disservizi e adeguamenti.",
            "Le traduzioni dei contenuti dei fornitori possono essere automatiche. Fa fede la versione originale inserita dal fornitore.",
          ],
        },
        {
          id: "a5-unsere-werte",
          heading: "A5. I nostri valori",
          paragraphs: [
            "Ci attendiamo da ospiti e fornitori un rapporto rispettoso. Le discriminazioni fondate su origine, colore della pelle, religione, convinzioni personali, sesso, identità di genere, orientamento sessuale, disabilità, età o caratteristiche analoghe non sono tollerate sulla piattaforma — si veda [Politica di non discriminazione](https://mybestdays.dk/rechtliches/antidiskriminierung).",
            "Al comportamento durante il soggiorno si applicano le [Regole di base per gli ospiti](https://mybestdays.dk/rechtliches/grundregeln-gaeste) e, ai fornitori, il [Codice di condotta per i fornitori](https://mybestdays.dk/rechtliches/verhaltenskodex-anbieter).",
          ],
        },
        {
          id: "a6-konto-und-nutzung",
          heading: "A6. Il Suo account e il Suo utilizzo della piattaforma",
          paragraphs: [
            "Per prenotare può creare un account. Lei è responsabile della riservatezza delle Sue credenziali e ci informa senza indugio se sospetta un utilizzo non autorizzato.",
            "Può utilizzare la piattaforma solo se ha la capacità di agire e può concludere validamente contratti.",
            "I Suoi dati in fase di registrazione e prenotazione devono essere esatti e completi — in particolare nome, recapiti e numero di viaggiatori. Il fornitore necessita di tali informazioni per mettere a disposizione l'alloggio e adempiere ai propri obblighi di registrazione.",
            "Non è consentito, in particolare:",
          ],
          list: [
            "prenotazioni fittizie, pagamenti fraudolenti o l'uso non autorizzato di mezzi di pagamento altrui;",
            "l'estrazione automatizzata della piattaforma (scraping, crawler) oltre quanto consentito dal nostro robots.txt;",
            "misure che perturbino o sovraccarichino la piattaforma o la sua infrastruttura o ne eludano le misure di sicurezza;",
            "l'inserimento di contenuti illeciti, ingiuriosi o ingannevoli in recensioni, messaggi o dati del profilo;",
            "il tentativo di gestire la prenotazione al di fuori della piattaforma dopo che il contatto è avvenuto tramite essa — si veda [Costi al di fuori della piattaforma](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "a7-preise",
          heading: "A7. Prezzi",
          paragraphs: [
            "Tutti i prezzi sono indicati come prezzo totale comprensivo di imposte e di tutte le commissioni regolate tramite la piattaforma, non appena sono noti i dati di viaggio (periodo e numero di viaggiatori). Se una componente è dovuta solo in loco, la indichiamo separatamente prima della conclusione della prenotazione.",
            "I prezzi sono indicati nella valuta dell'annuncio. Se un importo è indicato anche in un'altra valuta, si tratta di una conversione orientativa non vincolante; il regolamento avviene nella valuta dell'annuncio, salvo diversa indicazione in fase di pagamento.",
            "I prezzi possono variare fino alla conclusione della prenotazione, per esempio perché il fornitore li adegua o cambia la disponibilità. Fa fede il prezzo mostrato immediatamente prima della prenotazione vincolante e indicato nella conferma di prenotazione.",
            "Gli errori di prezzo manifesti (per esempio un importo errato di un ordine di grandezza) non vincolano né noi né il fornitore. Se rileviamo un tale errore, La informiamo senza indugio; potrà quindi annullare gratuitamente la prenotazione.",
            "La composizione delle commissioni di servizio figura in [Commissioni di servizio](https://mybestdays.dk/rechtliches/servicegebuehren). Su imposte e tributi si veda la [Politica fiscale](https://mybestdays.dk/rechtliches/steuern).",
          ],
        },
        {
          id: "a8-zahlung",
          heading: "A8. Pagamento",
          paragraphs: [
            "I pagamenti tramite la piattaforma sono gestiti dal prestatore di servizi di pagamento Stripe. I dati di pagamento (per esempio i dati della carta) sono raccolti e trattati direttamente da Stripe; myBestDays non conserva dati completi delle carte.",
            "Quando ciascun importo diviene esigibile — acconto, saldo o pagamento in loco — dipende dall'annuncio ed è indicato prima della conclusione della prenotazione. I dettagli sono disciplinati nelle [Condizioni di pagamento](https://mybestdays.dk/rechtliches/zahlungsbedingungen).",
            "Se l'annuncio prevede una cauzione, essa può essere preautorizzata o addebitata e trattenuta in tutto o in parte in caso di danni; fanno fede le indicazioni dell'annuncio.",
            "Se un pagamento non va a buon fine o viene stornato, la prenotazione può essere annullata. Il fornitore può comunque pretendere gli importi derivanti dalle proprie condizioni di cancellazione.",
          ],
        },
        {
          id: "a9-richtlinien",
          heading: "A9. Politiche",
          paragraphs: [
            "Oltre alle presenti condizioni si applicano le seguenti politiche, che sono parte del contratto tra Lei e noi:",
          ],
          list: [
            "[Regole sui contenuti appropriati](https://mybestdays.dk/rechtliches/inhaltsrichtlinien)",
            "[Politica sulle recensioni](https://mybestdays.dk/rechtliches/bewertungsrichtlinien)",
            "[Politica di non discriminazione](https://mybestdays.dk/rechtliches/antidiskriminierung)",
            "[Regole di base per gli ospiti](https://mybestdays.dk/rechtliches/grundregeln-gaeste)",
            "[Condizioni di cancellazione](https://mybestdays.dk/rechtliches/stornierungsbedingungen)",
            "[Politica di risistemazione e rimborso](https://mybestdays.dk/rechtliches/rueckerstattung)",
            "[Politica per eventi gravemente perturbativi](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen)",
            "[Politica sul diritto d'autore](https://mybestdays.dk/rechtliches/urheberrecht)",
          ],
        },
        {
          id: "a10-datenschutz-und-cookies",
          heading: "A10. Protezione dei dati e cookie",
          paragraphs: [
            "Le modalità con cui trattiamo i dati personali figurano nell'[Informativa sulla privacy](https://mybestdays.dk/rechtliches/datenschutz). I cookie e le tecnologie analoghe che utilizziamo figurano nella [Politica sui cookie](https://mybestdays.dk/rechtliches/cookies).",
            "Per una prenotazione trasmettiamo al fornitore i dati necessari a erogare la prestazione ricettiva. Il fornitore ne è titolare autonomo del trattamento; a esso si applicano gli [Standard di protezione dei dati per gli host](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
          ],
        },
        {
          id: "a11-barrierefreiheit",
          heading: "A11. Accessibilità",
          paragraphs: [
            "Lo stato dell'accessibilità della piattaforma e la via per segnalare barriere sono descritti nella [Dichiarazione di accessibilità](https://mybestdays.dk/rechtliches/barrierefreiheit).",
            "Le indicazioni sull'accessibilità di un alloggio provengono dal fornitore. Se dipende da determinate caratteristiche, le chiarisca con il fornitore tramite la messaggistica prima di prenotare.",
          ],
        },
        {
          id: "a12-bewertungen-und-inhalte",
          heading: "A12. Recensioni e contenuti generati dagli utenti",
          paragraphs: [
            "Dopo il soggiorno può lasciare una recensione. Può recensire soltanto chi ha prenotato tramite la piattaforma e ha iniziato il soggiorno o avrebbe potuto iniziarlo — così garantiamo che le recensioni pubblicate provengano da ospiti reali.",
            "Non paghiamo per le recensioni, non ne modifichiamo il contenuto e non sopprimiamo una recensione solo perché negativa. I dettagli e i motivi per cui rimuoviamo una recensione figurano nella [Politica sulle recensioni](https://mybestdays.dk/rechtliches/bewertungsrichtlinien).",
            "Lei resta responsabile dei contenuti che inserisce — recensioni, foto, messaggi, dati del profilo. Ci concede un diritto non esclusivo, illimitato nel tempo e nello spazio e gratuito di riprodurre, elaborare (per esempio ritagliare, tradurre) e comunicare al pubblico tali contenuti nell'ambito della gestione e della promozione della piattaforma. Può eliminare i Suoi contenuti; gli utilizzi già effettuati in raccolte già pubblicate non ne sono pregiudicati.",
          ],
        },
        {
          id: "a13-kommunikation",
          heading: "A13. Messaggi e comunicazione con il fornitore",
          paragraphs: [
            "I messaggi tra Lei e il fornitore transitano dalla piattaforma. Mettiamo a disposizione la funzione di messaggistica, ma non siamo né mittente né destinatario dei contenuti.",
            "Possiamo verificare i messaggi in modo automatizzato quanto a violazioni delle presenti condizioni (per esempio recapiti volti a eludere la piattaforma, schemi di frode, contenuti illeciti) e trattenere o rimuovere i messaggi interessati. La informiamo di ogni rimozione con una motivazione ai sensi di A17.",
            "Le inviamo messaggi relativi alla Sua prenotazione (conferma, modifiche, informazioni sull'arrivo) all'indirizzo di posta elettronica indicato. Tali messaggi costituiscono comunicazione contrattuale e non possono essere disdetti finché la prenotazione esiste. Riceve messaggi pubblicitari solo se ha prestato il consenso o se la legge lo consente senza consenso; può opporsi in qualsiasi momento.",
          ],
        },
        {
          id: "a14-geistiges-eigentum",
          heading: "A14. Diritti di proprietà intellettuale",
          paragraphs: [
            "La piattaforma, il suo design, il software, le banche dati, i testi e i marchi sono protetti. Lei ottiene un diritto non esclusivo e non trasferibile di utilizzare la piattaforma per cercare e prenotare alloggi — nulla di più.",
            "L'uso dei nostri marchi e loghi è disciplinato dalle [Regole sui marchi](https://mybestdays.dk/rechtliches/markenzeichen).",
            "Se ritiene che un contenuto della piattaforma violi il Suo diritto d'autore, segua la [Politica sul diritto d'autore](https://mybestdays.dk/rechtliches/urheberrecht).",
          ],
        },
        {
          id: "a15-wenn-etwas-schiefgeht",
          heading: "A15. Cosa fare se qualcosa non va",
          paragraphs: [
            "Se il problema riguarda l'alloggio in sé, si rivolga anzitutto al fornitore — tramite la messaggistica o in loco. Molti problemi si risolvono così più rapidamente.",
            "Se non progredisce con il fornitore, o se il problema riguarda la piattaforma, il pagamento o la gestione della prenotazione, si rivolga a noi. Come contattarci e come trattiamo i reclami è indicato in [Reclami e risoluzione delle controversie](https://mybestdays.dk/rechtliches/beschwerden).",
            "Tenga a portata di mano: il numero di prenotazione, l'indirizzo e-mail della prenotazione, una breve descrizione del problema con la Sua richiesta su come dobbiamo intervenire e la documentazione relativa (foto, messaggi, ricevute).",
            "Se all'arrivo l'alloggio non è disponibile o si discosta sostanzialmente dall'annuncio, si applica la [Politica di risistemazione e rimborso](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "La piattaforma di risoluzione delle controversie online della Commissione europea (piattaforma ODR) è stata abrogata dal regolamento (UE) 2024/3228 e ha cessato l'attività; non è più disponibile come via. Gli organismi che la sostituiscono figurano in [Reclami e risoluzione delle controversie](https://mybestdays.dk/rechtliches/beschwerden).",
            "Se abbiamo adottato una misura nei confronti dei Suoi contenuti o del Suo account, oltre alla nostra procedura interna di reclamo può adire un organismo di risoluzione extragiudiziale delle controversie certificato ai sensi dell'articolo 21 del regolamento (UE) 2022/2065. Le sue decisioni non ci vincolano.",
          ],
        },
        {
          id: "a16-unangemessenes-verhalten",
          heading: "A16. Misure contro comportamenti inappropriati",
          paragraphs: [
            "Se viola le presenti condizioni o una delle politiche indicate in A9, possiamo — in modo graduato secondo gravità, frequenza ed effetti della violazione — rimuovere contenuti o limitarne la visibilità, bloccare funzioni, annullare prenotazioni o sospendere il Suo account temporaneamente o definitivamente.",
            "Prima di ogni misura esaminiamo il caso concreto. In presenza di contenuti manifestamente illeciti, di pericolo per persone o di frode possiamo intervenire immediatamente.",
            "Motiviamo ogni misura nei Suoi confronti e Le indichiamo la via di reclamo — si veda A17.",
          ],
        },
        {
          id: "a17-meldung-rechtswidriger-inhalte",
          heading: "A17. Segnalazione di contenuti illeciti e motivazione delle misure",
          paragraphs: [
            "Chiunque può segnalarci contenuti che ritiene illeciti. La procedura di segnalazione ai sensi dell'articolo 16 del regolamento (UE) 2022/2065, i nostri punti di contatto e il trattamento delle segnalazioni sono descritti in [Regolamento sui servizi digitali](https://mybestdays.dk/rechtliches/dsa).",
            "Se adottiamo una misura nei confronti di contenuti da Lei inseriti o del Suo account, riceve una motivazione con indicazione del motivo, della base fattuale, del fondamento giuridico o della clausola contrattuale violata e delle possibilità di reclamo.",
            "Contro ogni misura può reclamare gratuitamente entro sei mesi. I reclami sono trattati da persone, non esclusivamente in modo automatizzato.",
          ],
        },
        {
          id: "a18-haftung",
          heading: "A18. Limitazione di responsabilità",
          paragraphs: [
            "Rispondiamo senza limiti per dolo e colpa grave, per danni derivanti da lesione della vita, dell'integrità fisica o della salute, nonché nei limiti di una garanzia da noi assunta. Le pretese fondate sulla responsabilità da prodotto non sono pregiudicate.",
            "Per il resto la nostra responsabilità è limitata al danno prevedibile che deriva tipicamente dalla violazione degli obblighi sul cui adempimento Lei può fare affidamento — e soltanto nella misura in cui il diritto applicabile ammetta tale limitazione.",
            "Non rispondiamo dell'erogazione della prestazione ricettiva in sé né del comportamento di fornitori o di altri ospiti. Controparte della prestazione ricettiva è il fornitore.",
            "Non rispondiamo dell'esattezza delle indicazioni inserite dai fornitori, nella misura in cui non ne fossimo a conoscenza né avessimo dovuto esserlo. Non appena veniamo a conoscenza di un'indicazione illecita interveniamo senza indugio.",
            "È esclusa ogni ulteriore responsabilità. I diritti imperativi di legge, in particolare i diritti dei consumatori, non sono pregiudicati.",
          ],
        },
        {
          id: "a19-recht-und-gerichtsstand",
          heading: "A19. Diritto applicabile e foro competente",
          paragraphs: [
            "Si applica il diritto danese — il gestore è stabilito in Danimarca — con esclusione della Convenzione delle Nazioni Unite sui contratti di vendita internazionale di merci. Le disposizioni imperative a tutela dei consumatori dello Stato in cui ha la residenza abituale restano impregiudicate ai sensi dell'articolo 6 del regolamento (CE) n. 593/2008 (Roma I).",
            "In qualità di consumatore può convenirci davanti al giudice del Suo domicilio o davanti a quello della nostra sede in Danimarca; noi possiamo convenirla soltanto davanti al giudice del Suo domicilio (articoli da 17 a 19 del regolamento (UE) n. 1215/2012).",
            "Al contratto di alloggio si applica di regola il diritto dello Stato in cui si trova l'alloggio; per le azioni in materia di locazione di beni immobili sono esclusivamente competenti i giudici di tale Stato.",
          ],
        },
        {
          id: "a20-verbundene-reiseleistungen",
          heading: "A20. Servizi turistici collegati",
          paragraphs: [
            "myBestDays intermedia esclusivamente prestazioni ricettive. Non offriamo voli, autonoleggio, servizi di trasporto, escursioni o attrazioni e non organizziamo pacchetti turistici ai sensi della direttiva (UE) 2015/2302.",
            "Qualora in futuro intermediassimo ulteriori servizi turistici, La informeremmo prima della prenotazione mediante il modulo standard previsto dalla legge sull'eventuale sorgere di un pacchetto o di un servizio turistico collegato e sui diritti che ne derivano.",
          ],
        },
        {
          id: "a21-laufzeit-und-kuendigung",
          heading: "A21. Durata, sospensione e recesso",
          paragraphs: [
            "Il contratto d'uso della piattaforma è a tempo indeterminato. Può eliminare il Suo account in qualsiasi momento senza indicarne il motivo; le prenotazioni esistenti non ne sono pregiudicate e sono gestite secondo le condizioni del rispettivo fornitore.",
            "Possiamo recedere dal contratto d'uso con un preavviso di 14 giorni. In caso di grave violazione delle presenti condizioni possiamo recedere senza preavviso e bloccare l'account.",
            "Dopo la cessazione eliminiamo i Suoi dati, salvo che vi osti un obbligo legale di conservazione o un interesse legittimo alla conservazione; i dettagli sono disciplinati nell'[Informativa sulla privacy](https://mybestdays.dk/rechtliches/datenschutz).",
          ],
        },
        {
          id: "a22-aenderungen",
          heading: "A22. Clausola di modifica",
          paragraphs: [
            "Possiamo modificare le presenti condizioni quando sussista un motivo oggettivo — per esempio una modifica normativa, la giurisprudenza delle corti supreme, funzionalità nuove o soppresse della piattaforma o la colmatura di lacune.",
            "Annunciamo le modifiche almeno 30 giorni prima della loro entrata in vigore in forma testuale. Se non si oppone prima dell'entrata in vigore, le condizioni modificate si intendono accettate; su tale effetto richiamiamo espressamente l'attenzione nell'annuncio. In caso di opposizione possiamo recedere dal contratto d'uso alla data di entrata in vigore.",
            "Alle prenotazioni già concluse si applicano le condizioni nella versione vigente al momento della prenotazione.",
          ],
        },
      ],
    },
    {
      id: "b",
      heading: "B. Alloggi",
      subsections: [
        {
          id: "b1-umfang",
          heading: "B1. Ambito della presente sezione",
          paragraphs: [
            "La presente sezione si applica alla prenotazione di alloggi tramite la piattaforma — sia immobili per vacanze sia camere e unità di strutture ricettive.",
            "Integra la sezione A. In caso di contrasto prevale la presente sezione B.",
          ],
        },
        {
          id: "b2-vertragsverhaeltnis",
          heading: "B2. Rapporto contrattuale",
          paragraphs: [
            "Il contratto di alloggio si conclude esclusivamente tra Lei e il fornitore. myBestDays non è parte del contratto.",
            "La presentazione di un alloggio sulla piattaforma costituisce un invito a formulare una proposta di prenotazione. Cliccando sul pulsante di prenotazione con obbligo di pagamento Lei formula una proposta vincolante.",
            "Il contratto si conclude quando la prenotazione è confermata. Inviamo la conferma di prenotazione all'indirizzo e-mail da Lei indicato; essa riporta il fornitore, la prestazione prenotata, il periodo, il prezzo totale e le condizioni di cancellazione.",
            "Per gli alloggi con prenotazione su richiesta il contratto si conclude solo con l'accettazione del fornitore. Fino ad allora il Suo mezzo di pagamento può essere preautorizzato ma non addebitato.",
          ],
        },
        {
          id: "b3-was-wir-tun",
          heading: "B3. Cosa facciamo noi",
          paragraphs: [
            "Mettiamo a disposizione la piattaforma, mostriamo gli annunci dei fornitori, riceviamo la Sua prenotazione, la trasmettiamo al fornitore e Le inviamo la conferma di prenotazione.",
            "Gestiamo il pagamento nella misura in cui l'annuncio preveda il pagamento tramite la piattaforma e mettiamo a disposizione la messaggistica tra Lei e il fornitore.",
            "Non mettiamo a disposizione l'alloggio, non lo gestiamo e non garantiamo il suo stato. Non siamo il Suo organizzatore di viaggi.",
          ],
        },
        {
          id: "b4-was-sie-tun-muessen",
          heading: "B4. Cosa deve fare Lei",
          paragraphs: [
            "Prima di prenotare esamini integralmente l'annuncio: dotazioni, limite di occupazione, orari di arrivo e partenza, regolamento della casa, condizioni di cancellazione e i costi dovuti solo in loco.",
            "Rispetti l'occupazione massima indicata nell'annuncio. Se arrivano più persone di quelle prenotate, il fornitore può negare l'accesso o richiedere un supplemento.",
            "Osservi il regolamento della casa del fornitore e le [Regole di base per gli ospiti](https://mybestdays.dk/rechtliches/grundregeln-gaeste). Tratterà l'alloggio con cura e risponderà dei danni causati da Lei o dai Suoi compagni di viaggio.",
            "Se il fornitore o un'autorità necessita di dati per la registrazione (per esempio scheda di notifica, dati identificativi, dichiarazione della tassa di soggiorno), li fornisca per tempo.",
          ],
        },
        {
          id: "b5-preise-und-zahlung",
          heading: "B5. Prezzi e pagamento",
          paragraphs: [
            "Il prezzo totale comprende il prezzo del pernottamento per il periodo prenotato e i supplementi e le commissioni indicati nell'annuncio che sono regolati tramite la piattaforma.",
            "In loco possono maturare importi ulteriori — in particolare la tassa di soggiorno o tributi locali, una cauzione nonché servizi aggiuntivi che prenoti solo in loco. Li indichiamo come costi in loco prima della conclusione della prenotazione, nella misura in cui il fornitore li abbia dichiarati.",
            "Se l'annuncio prevede un acconto, il saldo è esigibile alla data indicata nell'annuncio. In mancanza di saldo il fornitore può recedere dal contratto secondo le proprie condizioni di cancellazione.",
            "Non accettiamo né possiamo tracciare i pagamenti al fornitore effettuati al di fuori della piattaforma; essi non rientrano nella nostra gestione dei pagamenti — si veda [Costi al di fuori della piattaforma](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "b6-aenderungen-stornierungen",
          heading: "B6. Modifiche, cancellazioni e rimborsi",
          paragraphs: [
            "Se e a quali condizioni una prenotazione possa essere annullata o modificata gratuitamente dipende dalle condizioni di cancellazione del fornitore indicate nell'annuncio. Le condizioni che mettiamo a disposizione dei fornitori sono descritte in [Condizioni di cancellazione](https://mybestdays.dk/rechtliches/stornierungsbedingungen).",
            "Per le prestazioni ricettive prenotate per un periodo determinato non sussiste di regola un diritto legale di recesso ai sensi dell'articolo 16, lettera l), della direttiva 2011/83/UE o delle corrispondenti disposizioni nazionali. I diritti imperativi di legge non sono pregiudicati.",
            "Se annulla il fornitore, rimborsiamo integralmente l'importo versato tramite la piattaforma. Si applica inoltre la [Politica di risistemazione e rimborso](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Se un evento estraneo al controllo di entrambe le parti impedisce il viaggio o il soggiorno, si applica la [Politica per eventi gravemente perturbativi](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen).",
            "I rimborsi avvengono sul mezzo di pagamento utilizzato, salvo diverso accordo.",
          ],
        },
        {
          id: "b7-was-sie-ausserdem-wissen-muessen",
          heading: "B7. Cos'altro deve sapere",
          paragraphs: [
            "I fornitori possono essere host privati o professionisti. Indichiamo nell'annuncio se un fornitore agisce come professionista. Se non si tratta di un professionista, le disposizioni dell'Unione a tutela dei consumatori non si applicano al contratto di alloggio — Le segnaliamo tale circostanza nell'annuncio.",
            "Le indicazioni su posizione, dintorni, distanze e valutazioni di terzi hanno valore orientativo. Sono vincolanti le indicazioni relative alla prestazione prenotata.",
            "Nelle zone con obbligo di registrazione per la locazione breve indichiamo nell'annuncio il numero di registrazione comunicato dal fornitore; si veda [Locazione breve](https://mybestdays.dk/rechtliches/kurzzeitvermietung).",
            "In presenza di più unità identiche di una tipologia di immobile o camera Lei prenota un'unità di tale tipologia. Quale unità concreta Le venga assegnata è stabilito dal fornitore.",
          ],
        },
      ],
    },
    {
      id: "lexikon",
      heading: "Glossario",
      paragraphs: [
        "I termini seguenti hanno nelle presenti condizioni il significato qui indicato.",
      ],
      definitions: [
        {
          term: "Fornitore",
          description:
            "La persona fisica o giuridica che offre un alloggio tramite la piattaforma e diviene controparte del contratto di alloggio.",
        },
        {
          term: "Prenotazione su richiesta",
          description:
            "Una prenotazione che si conclude solo dopo l'accettazione espressa del fornitore, a differenza della prenotazione immediata.",
        },
        {
          term: "Conferma di prenotazione",
          description:
            "Il messaggio con cui Le confermiamo la conclusione del contratto di alloggio; contiene fornitore, prestazione, periodo, prezzo totale e condizioni di cancellazione.",
        },
        {
          term: "Unità",
          description:
            "L'oggetto concreto prenotabile all'interno di una tipologia di immobile o camera. Si vende l'unità, si descrive e si tariffa la tipologia.",
        },
        {
          term: "Prezzo totale",
          description:
            "L'importo indicato al momento di concludere la prenotazione, comprensivo di tutte le imposte e di tutte le commissioni regolate tramite la piattaforma.",
        },
        {
          term: "Occupazione massima",
          description:
            "Il numero massimo di persone autorizzate a pernottare nell'alloggio, come indicato nell'annuncio.",
        },
        {
          term: "Cauzione",
          description:
            "Un importo richiesto dal fornitore a garanzia di eventuali danni, preautorizzato o addebitato e poi svincolato o compensato dopo il soggiorno.",
        },
        {
          term: "Tassa di soggiorno",
          description:
            "Un tributo locale sui pernottamenti che, a seconda del comune, è riscosso in loco o tramite il fornitore; non è una prestazione di myBestDays.",
        },
        {
          term: "Piattaforma",
          description:
            "Il sito web, le applicazioni mobili e ogni altro accesso mediante il quale myBestDays mostra alloggi e intermedia prenotazioni.",
        },
        {
          term: "Commissione di servizio",
          description:
            "Il corrispettivo della prestazione di intermediazione di myBestDays. Chi la sostiene e come è indicata figura in Commissioni di servizio.",
        },
        {
          term: "Condizioni di cancellazione",
          description:
            "Le regole scelte dal fornitore su entro quando e a quale costo una prenotazione può essere annullata o modificata.",
        },
        {
          term: "Alloggio",
          description:
            "La prestazione ricettiva offerta dal fornitore — un immobile per vacanze o un'unità di una tipologia di camera o di immobile.",
        },
        {
          term: "Costi in loco",
          description:
            "Importi non regolati tramite la piattaforma ma dovuti al fornitore, quali tassa di soggiorno, cauzione o servizi aggiuntivi prenotati in loco.",
        },
      ],
    },
  ],
};
