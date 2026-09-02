// Rumänische Fassung der Datenschutzerklärung.
//
// Referenz ist content/legal/datenschutz/de.ts — INHALTLICHE Änderungen gehören
// ZUERST dorthin und werden von dort in alle Sprachfassungen nachgezogen. Diese
// Datei hat dieselbe Struktur wie de.ts (20 Abschnitte, gleiche Absatzzahlen);
// Firmen-, Register-, Dienstleister- und Rechtsakt-Bezeichnungen bleiben
// unübersetzt.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Politica de confidențialitate",
  metaDescription:
    "Cum prelucrează myNextDays datele cu caracter personal: scopuri, temeiuri juridice, destinatari, durate de stocare și drepturile dumneavoastră conform RGPD.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Prezenta politică descrie modul în care ${ANBIETER.firma} prelucrează date cu caracter personal — la vizitarea acestui site, la utilizarea platformei myNextDays (tablou de bord, piață online și aplicație mobilă) și în cadrul relației comerciale cu clienții noștri.`,
    "Nu vindem date și nu creăm profiluri care să vă identifice ca persoană. Pe acest site web măsurăm — doar cu acordul dumneavoastră — audiența paginilor noastre și succesul publicității noastre; ambele categorii pot fi deselectate individual (vezi secțiunile Măsurarea audienței și Publicitate și măsurarea succesului). Procesăm date în scopuri promoționale numai acolo unde v-ați dat acordul explicit — și anume pentru newsletter-ul nostru (consultați secțiunea Comunicare), la care vă puteți dezabona oricând cu un singur clic.",
  ],
  sections: [
    {
      heading: "Operatorul de date",
      paragraphs: [
        "Responsabil pentru prelucrările descrise în prezenta politică este:",
      ],
      zeilen: [
        {
          label: "Societatea",
          werte: [ANBIETER.firma, `CVR-nr. ${ANBIETER.cvr}`],
        },
        {
          label: "Adresa",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "E-mail",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefon",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
      ],
    },
    {
      heading: "Domeniu de aplicare și roluri",
      unterpunkte: [
        {
          paragraphs: [
            "Pentru vizitarea acestui site, pentru contul dumneavoastră de client și pentru derularea relației noastre comerciale suntem operator în sensul art. 4 pct. 7 din RGPD.",
          ],
        },
        {
          paragraphs: [
            "Pentru datele pe care clienții noștri (proprietari, hoteluri, agenții) prelucrează pe platformă despre oaspeții, proprietarii și angajații lor, clienții sunt operatori, iar noi suntem persoană împuternicită de operator conform art. 28 din RGPD. Detaliile se găsesc în [acordul de prelucrare a datelor](/auftragsverarbeitung).",
          ],
        },
        {
          paragraphs: [
            "Dacă rezervați ca oaspete o unitate de cazare prin piața noastră online, prelucrăm datele dumneavoastră de rezervare și de contact atât în nume propriu (operarea pieței online, procesarea plăților), cât și pentru unitatea de cazare gazdă. Contractul dumneavoastră de cazare se încheie exclusiv cu unitatea de cazare; în paralel se aplică informările privind protecția datelor ale acesteia.",
          ],
        },
      ],
    },
    {
      heading: "Vizitarea acestui site",
      unterpunkte: [
        {
          titel: "Fișiere jurnal ale serverului",
          paragraphs: [
            "La fiecare accesare, browserul dumneavoastră transmite date necesare din punct de vedere tehnic, pe care serverul nostru web le înregistrează: adresa IP, data și ora, adresa accesată, volumul de date transferat, codul de stare, pagina de referință și identificatorul browserului. Scopul este furnizarea paginii, precum și detectarea și respingerea atacurilor și a perturbărilor. Temeiul juridic este art. 6 alin. (1) lit. f) din RGPD; interesul nostru legitim constă în funcționarea sigură și stabilă. Jurnalele sunt păstrate numai atât timp cât este necesar pentru funcționare și securitate și nu sunt combinate cu alte date.",
          ],
        },
        {
          titel: "Fonturi",
          paragraphs: [
            "Fonturile utilizate sunt integrate local pe serverul nostru. Nu are loc nicio conexiune către Google Fonts sau către un alt serviciu de fonturi.",
          ],
        },
        {
          titel: "Pictograme",
          paragraphs: [
            "Pictogramele acestui site se află, la fel ca fonturile, la noi: sunt inserate în pagină pe serverul nostru și nu sunt încărcate ulterior de la un serviciu de pictograme. Nu are loc nicio conexiune către un terț, iar adresa dumneavoastră IP nu este transmisă nimănui.",
          ],
        },
        {
          titel:
            "Protecția formularului de contact împotriva spamului (reCAPTCHA)",
          paragraphs: [
            "Formularul nostru de contact este protejat împotriva mesajelor automate în masă cu reCAPTCHA Enterprise de la Google Ireland Limited. Numai dacă vă dați consimțământul, browserul dumneavoastră încarcă la completarea formularului un script de la www.google.com; în acest context, adresa dumneavoastră IP și informații despre interacțiunea dumneavoastră cu formularul sunt transmise către Google și analizate acolo pentru a distinge omul de un script. Temeiul juridic este art. 6 alin. (1) lit. a) din RGPD (consimțământ); suplimentar se aplică [politica de confidențialitate a Google](https://policies.google.com/privacy).",
            "Fără acordul dumneavoastră, nimic nu va fi încărcat de pe Google și nu vor fi transmise date către acesta; nu vom accepta formularul, dar ne puteți scrie oricând un e-mail. Dacă vă dați acordul, reCAPTCHA va seta propriul cookie (_GRECAPTCHA, durata de viață stabilită de Google, până la șase luni), care este utilizat pentru evaluarea riscurilor. Vă puteți modifica sau revoca acordul în orice moment prin intermediul pictogramei cookie din partea stângă jos a fiecărei pagini; cookie-ul va fi apoi șters.",
          ],
        },
        {
          titel: "Măsurarea acoperirii (Google Analytics)",
          paragraphs: [
            "Pe acest site web, folosim Google Analytics 4 de la Google Ireland Limited pentru a măsura modul în care sunt utilizate paginile noastre — ce pagini sunt accesate, de unde provin vizitatorii și în ce punct renunță. Scopul este exclusiv îmbunătățirea ofertei și a vizibilității.",
            "Încărcarea se face exclusiv cu acordul dumneavoastră. Dacă îl acordați, browserul dumneavoastră va încărca un script de pe www.googletagmanager.com și va stoca două cookie-uri („_ga” și „_ga_<ID>”, valabile până la doi ani) cu un identificator generat aleatoriu; acest identificator, paginile accesate, sursa de referință, locația aproximativă la nivel de țară sau regiune, dispozitivul și browserul, precum și adresa dumneavoastră IP, pe care Google o scurtează înainte de fiecare stocare, vor fi transmise. Baza legală este Art. 6 Par. 1 lit. a GDPR (consimțământ).",
            "Am restricționat în mod explicit evaluarea: semnalele Google și personalizarea publicitară sunt dezactivate. Prin urmare, nu se creează profiluri inter-dispozitive și nici audiențe pentru publicitate, și nu transmitem date de utilizare către rețelele publicitare. Nu are loc o combinare cu contul dumneavoastră de client.",
            "Google prelucrează datele în calitate de procesator al nostru, în baza unui contract conform Art. 28 GDPR (Termenii de prelucrare a datelor Google Ads). Scurtarea adresei dumneavoastră IP are loc pe servere din UE, înainte ca datele să fie transferate în SUA; prin urmare, este transmis un set de date pseudonim. Baza transferului este decizia de adecvare a Comisiei UE privind Cadrul de confidențialitate a datelor UE-SUA (Art. 45 GDPR), în baza căreia Google LLC este certificată; în plus, Google a inclus clauzele contractuale standard ale Comisiei UE (Art. 46 GDPR). Atragem atenția în mod explicit că autoritățile americane, conform Secțiunii 702 FISA, pot accesa datele companiilor certificate și, prin urmare, un risc rezidual nu poate fi exclus în totalitate. Se aplică, de asemenea, [Politica de confidențialitate Google](https://policies.google.com/privacy).",
            "Durata de stocare: Datele legate de evenimente și utilizatori sunt șterse automat din proprietatea noastră după 14 luni; datele agregate de raportare fără legătură cu vizitatori individuali rămân păstrate. Consimțământul dumneavoastră expiră după șase luni.",
            "Fără acordul dumneavoastră, nimic nu este încărcat, niciun cookie nu este setat și nu sunt transmise date către Google. Puteți revoca oricând acordul dumneavoastră prin intermediul pictogramei cookie din stânga jos a fiecărei pagini; măsurarea se va opri imediat și cookie-urile menționate vor fi șterse. După șase luni, vă vom întreba din nou.",
          ],
        },
        {
          titel: "Publicitate și măsurarea succesului",
          paragraphs: [
            "Cu acordul dumneavoastră, utilizăm cookie-uri de marketing pentru a măsura succesul publicității noastre și pentru a vă afișa anunțuri relevante pe alte platforme. Sunt implicate Meta Platforms Ireland (Meta-Pixel, cookie _fbp), LinkedIn Ireland (Insight-Tag, cookie-uri li_gc și bcookie) și Google Ireland Limited (Google Ads, cookie _gcl_au). Temeiul juridic este Art. 6 alin. 1 lit. a GDPR. Fără acordul dumneavoastră, niciunul dintre aceste scripturi nu va fi încărcat și niciun cookie nu va fi setat; în cazul revocării, le vom șterge. Detalii despre fiecare cookie sunt disponibile în [Politica privind cookie-urile](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Contul de client și utilizarea platformei",
      paragraphs: [
        "Pentru înregistrarea și administrarea unui cont prelucrăm datele pe care le introduceți dumneavoastră sau unitatea dumneavoastră de cazare: numele, denumirea comercială și forma juridică, adresa, adresa de e-mail, numărul de telefon, rolul și permisiunile, datele de registru (de exemplu numărul de înregistrare la registrul comerțului sau codul de TVA), contul bancar pentru plăți, precum și conținuturile create în cont.",
        "Pentru securizarea accesului prelucrăm în plus jurnalele de autentificare (momentul, adresa IP, dispozitivul și browserul folosite la autentificare) și — dacă este activată — datele autentificării cu doi factori.",
        "Autentificarea cu Google: în loc de e-mail și parolă vă puteți autentifica și cu un cont Google. Dacă alegeți această cale, primim de la Google Ireland Limited exclusiv adresa dumneavoastră de e-mail, numele, imaginea de profil și un identificator al contului dumneavoastră Google (domeniile „openid”, „email”, „profile”) — în mod expres niciun acces la e-mailurile, contactele, fișierele sau calendarul dumneavoastră. Parola dumneavoastră Google nu ne este cunoscută. Google prelucrează procesul de autentificare ca operator independent; se aplică [politica de confidențialitate a Google](https://policies.google.com/privacy). Temeiul juridic este art. 6 alin. (1) lit. b) din RGPD, întrucât autentificarea servește executării contractului; alegerea acestei căi de autentificare este voluntară și poate fi înlocuită oricând cu autentificarea prin e-mail și parolă.",
        "Temeiul juridic este art. 6 alin. (1) lit. b) din RGPD (executarea contractului de utilizare, a se vedea [condițiile generale de afaceri](" +
          AGB_URL +
          ")), pentru securizarea accesului art. 6 alin. (1) lit. f) din RGPD, iar pentru păstrarea în scopuri fiscale și de drept comercial art. 6 alin. (1) lit. c) din RGPD.",
      ],
    },
    {
      heading: "Rezervări, date ale oaspeților și date ale imobilelor",
      paragraphs: [
        "Prin platformă sunt prelucrate rezervări, date ale oaspeților, mesaje, sarcini și decontări. Printre acestea se numără în special numele și datele de contact ale oaspetelui, sosirea și plecarea, numărul de călători, prețurile și starea plății, istoricul mesajelor, precum și — în măsura în care unitatea de cazare le înregistrează — datele de înregistrare a oaspeților și cererile speciale.",
        "Această prelucrare are loc pe baza însărcinării și potrivit instrucțiunilor unității de cazare respective. Nu folosim aceste date în scopuri proprii, nici pentru publicitate, nici pentru antrenarea modelelor de IA.",
        "În interiorul unei unități de cazare, datele sunt separate pe roluri: personalul de curățenie și de servicii nu vede date financiare și comerciale, proprietarii doar propriile imobile. Între unități de cazare diferite, datele sunt separate tehnic (reguli de acces pe chiriaș, direct în baza de date).",
      ],
    },
    {
      heading: "Procesarea plăților",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "Plățile cu cardul și plățile către beneficiari se derulează prin Stripe Payments Europe, Limited, Irlanda. Către Stripe sunt transmise datele necesare plății (suma, moneda, mijlocul de plată, numele, adresa de e-mail, referința rezervării), iar pentru conturile clienților noștri datele de identificare prevăzute de lege (titularul, beneficiarii reali, datele actului de identitate, contul bancar). Datele complete ale cardului nu ajung în sistemele noastre. Temeiurile juridice sunt art. 6 alin. (1) lit. b) din RGPD și, pentru obligațiile de identificare și de combatere a spălării banilor, art. 6 alin. (1) lit. c) din RGPD. Detaliile sunt reglementate de [politica de confidențialitate a Stripe](https://stripe.com/privacy).",
            "Linkuri de plată pentru servicii suplimentare: dacă o unitate de cazare facturează oaspetelui său un serviciu suplimentar (de exemplu curățenie sau spălătorie) printr-un link de plată, acest link conduce la o pagină de plată operată de Stripe. Transmitem în acest scop către Stripe denumirea serviciului, suma, moneda, precum și o referință internă la rezervare și la unitatea de cazare; sigla unității de cazare este transferată în contul său Stripe, pentru ca pagina să afișeze marca acesteia. Pe pagina de plată însăși, Stripe colectează datele de plată și datele de dispozitiv ale oaspetelui pe propria răspundere. Către noi revin doar starea plății, suma, sumele reținute și identificatorii plății — niciun fel de date de card.",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "În măsura în care unitatea de cazare oferă PayPal ca modalitate de plată, datele de plată sunt transmise către PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxemburg. Se aplică [politica de confidențialitate a PayPal](https://www.paypal.com/de/webapps/mpp/ua/privacy-full).",
          ],
        },
      ],
    },
    {
      heading: "Canale de distribuție și portaluri",
      paragraphs: [
        "Dacă o unitate de cazare își vinde imobilele prin portaluri precum Booking.com, Airbnb sau Expedia, disponibilitățile, prețurile, restricțiile și datele de rezervare sunt schimbate cu portalul respectiv prin furnizorul nostru de servicii de conectare Channex.io Ltd, Regatul Unit. Din această direcție primim datele de rezervare și datele oaspeților de la portal.",
        "Pentru portalul respectiv se aplică propriile sale dispoziții privind protecția datelor; în această măsură portalul este operator independent. Temeiul juridic al transmiterii este art. 6 alin. (1) lit. b) din RGPD, coroborat cu însărcinarea unității de cazare.",
      ],
    },
    {
      heading: "Comunicare",
      unterpunkte: [
        {
          titel: "E-mail",
          paragraphs: [
            "E-mailurile aferente utilizării (confirmări de rezervare, mesaje de sistem, asistență, linkuri de confirmare și de invitație) le trimitem și le primim prin propriul server de e-mail, pe care îl operăm noi înșine. Pentru aceste mesaje nu este implicat niciun serviciu extern de expediere.",
          ],
        },
        {
          titel: "Buletin informativ și preînscriere",
          paragraphs: [
            "Pe site-ul nostru vă puteți înscrie pentru noutăți despre myNextDays (preînscriere/buletin informativ). Sunt prelucrate adresa dumneavoastră de e-mail, limba și locul în care v-ați înscris.",
            "Înscrierea se desfășoară prin procedura double opt-in: după înscriere primiți un e-mail cu un link de confirmare; abia prin clic pe acesta înscrierea devine efectivă. Pentru dovedirea consimțământului stocăm momentul înscrierii și al confirmării, adresa IP folosită, identificatorul browserului, precum și textul cu care ați fost de acord. Aceste informații servesc exclusiv drept dovadă conform art. 7 alin. (1) din RGPD și nu sunt analizate în scopuri publicitare.",
            "Temeiul juridic este consimțământul dumneavoastră conform art. 6 alin. (1) lit. a) din RGPD; stocarea dovezii se întemeiază pe art. 6 alin. (1) lit. c) coroborat cu art. 7 alin. (1) din RGPD. Puteți retrage consimțământul oricând, cu efect pentru viitor — prin linkul de dezabonare din fiecare e-mail al buletinului informativ sau, fără formalități, prin e-mail către noi. Retragerea nu afectează legalitatea prelucrării efectuate până în acel moment.",
            "Pentru administrarea și expedierea buletinelor informative folosim Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, Franța; sucursala germană: Brevo GmbH, Köpenicker Straße 126, 10179 Berlin) ca persoană împuternicită de operator. Sunt transmise adresa dumneavoastră de e-mail și informațiile suplimentare menționate (limba, sursa). Datele sunt prelucrate pe servere din Uniunea Europeană (Franța și Germania); cu Brevo există un acord de prelucrare a datelor conform art. 28 din RGPD. Se aplică [politica de confidențialitate a Brevo](https://www.brevo.com/legal/privacypolicy/).",
            "Când trimitem un buletin informativ, Brevo măsoară pentru noi dacă mesajul a fost deschis și dacă s-a dat clic pe linkurile incluse. Această măsurare ne ajută să adaptăm conținutul și frecvența; face parte din consimțământ și încetează odată cu dezabonarea dumneavoastră. Nu are loc nicio combinare cu alte surse de date și nicio creare de profiluri.",
            "Atât timp cât confirmarea lipsește, adresa dumneavoastră nu este contactată și nu este transmisă către Brevo; o înscriere neconfirmată expiră după șapte zile. După o dezabonare blocăm adresa pentru expediere și păstrăm dovada consimțământului și a dezabonării atât timp cât din aceasta pot fi invocate pretenții; la cerere o ștergem complet.",
          ],
        },
        {
          titel: "Mesaje pe platformă",
          paragraphs: [
            "Mesajele dintre oaspete și unitatea de cazare sunt stocate pe platformă, astfel încât ambele părți să poată consulta istoricul. Dacă o unitate de cazare blochează un oaspete, canalul de mesaje este închis; mesajele existente se păstrează pentru a asigura trasabilitatea.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "Dacă o unitate de cazare folosește conectarea la WhatsApp, conținuturile mesajelor și numerele de telefon ale persoanelor implicate sunt transmise prin WhatsApp Business Platform de la Meta Platforms Ireland Limited. Utilizarea acestei funcții este decisă de unitatea de cazare; fără activare nu are loc nicio transmitere.",
          ],
        },
      ],
    },
    {
      heading: "Funcții automatizate și inteligență artificială",
      paragraphs: [
        "Pentru funcțiile descrise aici se aplică, pe lângă RGPD, Regulamentul (UE) 2024/1689 (Regulamentul privind inteligența artificială, „AI Act”), ale cărui obligații de transparență prevăzute la art. 50 sunt aplicabile de la 2 august 2026.",
      ],
      unterpunkte: [
        {
          titel: "Sugestii de răspuns",
          paragraphs: [
            "Pentru sugestiile de răspuns din căsuța de mesaje folosim — în măsura în care funcția este activată pentru unitatea de cazare — oferta de modele lingvistice a Groq, Inc., SUA. În acest context, contextul mesajului respectiv este transmis către serviciu. Sugestiile nu sunt trimise automat; asupra expedierii decide întotdeauna un om. Nu are loc niciun proces decizional automatizat cu efect juridic în sensul art. 22 din RGPD.",
            "Nu este vorba, prin urmare, despre un sistem de IA care interacționează direct cu persoane fizice în sensul art. 50 alin. (1) din Regulamentul privind inteligența artificială: obligația presupune o interacțiune DIRECTĂ, în care IA însăși comunică cu persoana și nu prin intermediul unei persoane. Aici funcția propune unității de cazare un text pe care un angajat îl verifică, îl poate modifica și îl trimite el însuși — angajatul este acest intermediar, oaspetele corespondează cu unitatea de cazare și nu cu un chatbot. Nu este utilizat niciun asistent care răspunde automat. Potrivit aprecierii noastre, funcția nu îndeplinește nici vreuna dintre situațiile privind IA cu grad ridicat de risc prevăzute în anexa III la Regulamentul privind inteligența artificială.",
            "Mesajele către oaspeți nu sunt, în plus, „text privind chestiuni de interes public” în sensul art. 50 alin. (4) din Regulamentul privind inteligența artificială: ele nu sunt publicate, ci trimise individual unei anumite persoane și privesc derularea unui sejur. Independent de aceasta, se aplică aici verificarea umană efectuată de angajatul care expediază.",
            "În cazul în care în viitor va fi oferită o funcție care răspunde oaspeților în mod autonom — fără aprobare umană —, oaspetele va fi informat vizibil la începutul dialogului că scrie cu un sistem de IA. Fără această informare, o astfel de funcție nu va fi pusă la dispoziție.",
          ],
        },
        {
          titel:
            "Roluri conform Regulamentului privind inteligența artificială",
          paragraphs: [
            "Pentru funcțiile de IA integrate în produs suntem utilizator în sensul art. 3 pct. 4 din Regulamentul privind inteligența artificială; furnizori ai modelelor lingvistice care stau la bază sunt furnizorii de modele respectivi. Dacă o unitate de cazare folosește aceste funcții în cadrul activității sale profesionale, ea este la rândul său utilizator și îi revine obligația de alfabetizare în domeniul IA prevăzută la art. 4 din Regulamentul privind inteligența artificială, care se aplică de la 2 februarie 2025 independent de dimensiunea întreprinderii. De la 27 iulie 2026 se aplică în versiunea Regulamentului (UE) 2026/1744: furnizorii și utilizatorii iau măsuri pentru a sprijini dezvoltarea competențelor personalului lor în domeniul IA; în mod expres nu trebuie garantat un anumit nivel. Sprijinim prin indicații în aplicație și în centrul nostru de ajutor; instruirea propriilor angajați rămâne sarcina unității de cazare.",
            "Dacă o unitate de cazare își conectează contul cu un asistent de IA propriu (a se vedea punctul următor), este utilizator și în această privință în sensul Regulamentului privind inteligența artificială — ea decide asupra utilizării și formulează solicitările. Interfața în sine nu este un sistem de IA: citește date din baza de date și le redă, fără a face deducții; considerentul 12 al Regulamentului privind inteligența artificială delimitează în mod expres astfel de sisteme de IA.",
          ],
        },
        {
          titel: "Conectarea cu un asistent de IA propriu",
          paragraphs: [
            "O unitate de cazare își poate conecta contul, printr-o interfață, cu un asistent de IA pe care l-a ales ea însăși și cu care are un contract propriu — de exemplu Claude de la Anthropic PBC, SUA. Dacă o astfel de conexiune este acordată, asistentul poate consulta, la solicitarea unității de cazare, în mod exclusiv pentru citire: ocuparea, disponibilitatea și prețurile pe zi; rezervările cu numele oaspetelui, perioada sejurului, imobilul, canalul de rezervare, starea, precum și suma și moneda, în măsura în care rolul contului care interoghează poate vedea sume; și lista conversațiilor din căsuța de mesaje. Fără o conexiune acordată nu are loc nicio transmitere.",
            "Nu sunt transmise adresa de e-mail și numărul de telefon ale oaspeților, datele de card, conturile bancare și documentele de plată, codurile de acces, precum și dosarele imobilelor. Notele de rezervare și conținutul mesajelor oaspeților sunt excluse în mod implicit, deoarece pot conține informații privind sănătatea sau alte categorii speciale de date conform art. 9 din RGPD; unitatea de cazare trebuie să le elibereze expres și separat la acordarea conexiunii.",
            "Conexiunea poate fi acordată numai de un cont cu rolul „administrator”, nu de orice cont cu acces. Fiecare interogare este înregistrată și poate fi consultată de unitatea de cazare la „Cont → Conexiuni”; ea poate întrerupe conexiunea acolo oricând, iar accesul încetează imediat.",
            "Din punct de vedere juridic, această transmitere este o instrucțiune a unității de cazare adresată nouă (art. 28 alin. (3) lit. a) din RGPD). Furnizorul asistentului nu este subîmputernicit al nostru — nu îl însărcinăm și nu îi dăm instrucțiuni; el prelucrează datele în temeiul contractului pe care unitatea de cazare l-a încheiat ea însăși cu el. Pentru temeiul juridic al acestei prelucrări, pentru informarea oaspeților săi și pentru garanțiile unei transmiteri către o țară terță răspunde, prin urmare, unitatea de cazare.",
          ],
        },
        {
          titel: "Traduceri",
          paragraphs: [
            "Textele imobilelor și textele de conținut pot fi traduse prin Cloud Translation API de la Google Ireland Limited. Sunt transmise textele care urmează să fie traduse; date cu caracter personal numai în măsura în care sunt cuprinse în aceste texte.",
          ],
        },
        {
          titel: "Recomandări de preț",
          paragraphs: [
            "Pentru recomandările de preț accesăm date de piață, meteorologice și de curs valutar din surse externe. Aceste interogări nu conțin date cu caracter personal, ci numai localitatea, perioada și caracteristicile imobilului.",
          ],
        },
      ],
    },
    {
      heading: "Site-urile și domeniile clienților noștri",
      paragraphs: [
        "Dacă o unitate de cazare creează prin generatorul de site-uri un site propriu cu domeniu propriu, administrăm înregistrările DNS necesare prin Cloudflare, Inc. Sunt transmise date privind domeniul și configurația; datele vizitatorilor site-ului clientului le prelucrăm astfel cum este descris în prezenta politică.",
        "Pentru conținuturile, datele de identificare ale editorului și informările privind protecția datelor de pe site-ul clientului răspunde unitatea de cazare respectivă.",
      ],
    },
    {
      heading: "Program de parteneriat",
      paragraphs: [
        "Operăm un program de parteneriat prin care partenerii (influenceri, consultanți, agenții, clienți) recomandă afaceri către myNextDays și primesc un comision. În acest proces, prelucrăm date de la parteneri și – într-o măsură limitată – de la afacerile recomandate.",
      ],
      unterpunkte: [
        {
          titel: "Datele partenerilor",
          paragraphs: [
            "La înregistrare, prelucrăm numele, denumirea companiei, forma juridică, țara, adresa de e-mail, limba, conturile de social media (platforma, adresa, handle-ul, acoperirea declarată), numărul de identificare fiscală (verificare prin sistemul UE VIES), datele de plată (IBAN, adresa Wise sau PayPal), precum și acordul cu termenii și condițiile de participare, cu versiunea și data. Temeiul juridic este executarea contractului de parteneriat (Art. 6 alin. 1 lit. b GDPR); pentru credite și păstrare se aplică obligațiile fiscale și comerciale (Art. 6 alin. 1 lit. c GDPR).",
            "Dacă un partener conduce o echipă, el vede numele sau denumirea companiei, rangul, numărul de clienți plătitori și comisionul de echipă rezultat de la partenerii săi de echipă. Mesajele dintre sponsor și partenerul de echipă sunt stocate în platformă, astfel încât ambii să poată vedea istoricul.",
          ],
        },
        {
          titel: "Clicuri pe link-uri de parteneriat",
          paragraphs: [
            "Dacă un vizitator accesează un link de parteneriat (mynextdays.com/p/CODE), stocăm codul, ora, pagina accesată, pagina de referință și eventualii parametri de campanie, precum și adresa IP și identificatorul browserului exclusiv ca sume de control scurtate (hash) – pentru detectarea abuzurilor (frecvențe), nu pentru recunoaștere. Nu este setat un cookie de urmărire. Ștergem datele de clic după 90 de zile. Temeiul juridic este interesul nostru legitim de a asigura o decontare a programului fără fraude (Art. 6 alin. 1 lit. f GDPR).",
          ],
        },
        {
          titel: "Conturi și postări conectate de social media",
          paragraphs: [
            "Partenerii își pot conecta voluntar conturile de YouTube (Google), Instagram și Facebook (Meta), precum și TikTok la tabloul de bord al partenerului. În acest proces, ei acordă platformei respective o permisiune de citire (OAuth); nu scriem nimic în aceste conturi. Stocăm identificatorul și numele contului, token-ul de acces criptat, momentul conectării, precum și zilnic o valoare de măsurare pentru fiecare cont: numărul de urmăritori sau abonați, vizualizările din ultimele 28 de zile, rata de interacțiune și numărul de postări, fiecare cu momentul răspunsului platformei. Pentru postările pe care partenerul le creează în tabloul de bord (titlu, platformă, adresă, data publicării), stocăm suplimentar vizualizările, aprecierile, comentariile, distribuirile și salvările din platformă.",
            "Scopul este verificarea acoperirii indicate de partener și atribuirea clicurilor și clienților către postări individuale; informațiile neverificate sunt ponderate mai puțin la aprobare. Indicațiile de neconcordanțe (cum ar fi o creștere bruscă a numărului de urmăritori fără vizualizări corespunzătoare) servesc exclusiv verificării manuale de către noi și nu duc la nicio decizie automatizată. Temeiul juridic este consimțământul partenerului (art. 6 alin. (1) lit. a GDPR), pe care îl acordă prin conectare și pe care îl poate revoca oricând în tabloul de bord sub „Deconectare”; la deconectare, ștergem imediat tokenul de acces, valorile măsurate stocate rămân ca istoric și sunt șterse odată cu contul partenerului. Utilizăm exclusiv interfețele oficiale ale platformelor; pentru prelucrarea de către Google, Meta și TikTok se aplică propriile lor politici de confidențialitate.",
          ],
        },
        {
          titel: "Afaceri recomandate",
          paragraphs: [
            "Dacă o afacere se înregistrează cu un cod de partener, stocăm asocierea afacerii cu partenerul, precum și data, modalitatea (link sau cod) și statutul. Partenerul vede afacerea exclusiv pseudonimizat (număr curent, țară, statut, sume) — niciodată numele, adresa de e-mail sau datele de rezervare. Doar dacă afacerea își dă acordul explicit la înregistrare, partenerul o poate contacta prin intermediul platformei. Pentru decontarea comisioanelor, prelucrăm sumele nete ale abonamentelor din facturile plătite ale afacerii; temeiul juridic este executarea contractului de parteneriat și a contractului de utilizare (art. 6 alin. (1) lit. b GDPR).",
          ],
        },
      ],
    },
    {
      heading: "Găzduire și stocare",
      paragraphs: [
        "Platforma, baza de date, fișierele media și serverul de e-mail rulează pe servere ale Hetzner Online GmbH, Germania, în centrul de date din Helsinki (Finlanda) — deci în interiorul Uniunii Europene. Cu Hetzner există un acord de prelucrare a datelor.",
        "Copiile de siguranță sunt create criptat și păstrate criptat la un furnizor de spațiu de stocare din UE.",
      ],
    },
    {
      heading: "Destinatarii în ansamblu",
      paragraphs: [
        "În afara furnizorilor de servicii menționați, transmitem date cu caracter personal numai atunci când suntem obligați legal (de exemplu autorități fiscale, urmărire penală) sau când dumneavoastră, respectiv unitatea de cazare responsabilă, o solicitați.",
      ],
      list: [
        "Hetzner Online GmbH (Germania/Finlanda) — găzduire, bază de date, fișiere media, server de e-mail",
        "Stripe Payments Europe, Limited (Irlanda) — plăți, plăți către beneficiari, verificarea identității",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luxemburg) — plăți, în măsura în care este activat",
        "Channex.io Ltd (Regatul Unit) — conectarea la portalurile de rezervări",
        "Meta Platforms Ireland Limited (Irlanda) — mesaje WhatsApp, în măsura în care este activat",
        "Sendinblue SAS / Brevo (Franța, Germania) — administrarea și expedierea buletinului informativ, numai cu consimțământ",
        "Google Ireland Limited (Irlanda) — traduceri; protecția formularului de contact împotriva spamului (reCAPTCHA Enterprise), numai cu consimțământ; autentificarea cu Google, în măsura în care este folosită; Măsurarea audienței (Google Analytics 4), numai cu acordul dumneavoastră",
        "Groq, Inc. (SUA) — sugestii de răspuns, în măsura în care este activat",
        "Cloudflare, Inc. (SUA) — administrarea DNS pentru domeniile clienților",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "În această listă nu se află serviciile pe care o unitate de cazare le convine ea însăși cu un terț și le conectează prin interfață cu contul său — de exemplu un asistent de IA precum Claude de la Anthropic PBC, SUA. Acestea nu sunt furnizori de servicii însărcinați de noi, ci destinatari care acționează la instrucțiunea unității de cazare respective; fără conexiunea acesteia nu ajung acolo niciun fel de date. Potrivit listei oficiale a participanților întocmită de Departamentul Comerțului al SUA, Anthropic nu este certificată în cadrul EU-US Data Privacy Framework; o transmitere se întemeiază, prin urmare, pe clauzele contractuale standard, pentru care răspunde unitatea de cazare respectivă în calitate de operator.",
          ],
        },
      ],
    },
    {
      heading: "Transmiterea către țări terțe",
      paragraphs: [
        "Prelucrarea are loc, în principiu, în interiorul UE. În cazul serviciilor menționate mai sus cu sediul în afara UE poate avea loc o transmitere către o țară terță.",
        "Pentru Groq, Inc. și Cloudflare, Inc. (SUA) întemeiem transmiterea pe clauzele contractuale standard ale Comisiei Europene conform art. 46 alin. (2) lit. c) din RGPD, în măsura în care destinatarul nu se poate prevala de o decizie privind caracterul adecvat (EU-US Data Privacy Framework).",
        "Partenerul contractual pentru procesarea plăților este Stripe Payments Europe, Limited (Irlanda). În măsura în care Stripe recurge la Stripe, LLC (SUA), aceasta este certificată în cadrul EU-US Data Privacy Framework; transmiterea se întemeiază în această măsură pe decizia privind caracterul adecvat a Comisiei Europene conform art. 45 din RGPD. Suplimentar se aplică clauzele contractuale standard din [acordul de prelucrare a datelor al Stripe](https://stripe.com/legal/dpa).",
        "Pentru Channex.io Ltd (Regatul Unit) se aplică decizia privind caracterul adecvat a Comisiei Europene pentru Regatul Unit; dacă aceasta încetează, se aplică clauzele contractuale standard.",
      ],
    },
    {
      heading: "Accesul autorităților din state terțe (US CLOUD Act)",
      paragraphs: [
        "Furnizorii supuși jurisdicției Statelor Unite pot fi obligați, în temeiul CLOUD Act american (Clarifying Lawful Overseas Use of Data Act, 2018), să pună date la dispoziția autorităților din SUA — chiar și atunci când aceste date se află pe servere din interiorul Uniunii Europene. Un astfel de acces poate contraveni RGPD, iar furnizorului îi poate fi interzis din punct de vedere juridic să ne informeze pe noi sau pe dumneavoastră despre aceasta. Nici decizia privind caracterul adecvat referitoare la EU-US Data Privacy Framework, nici clauzele contractuale standard nu exclud acest risc.",
        "Limităm acest risc prin faptul că sistemele purtătoare — platforma, baza de date, fișierele media, serverul de e-mail și copiile de siguranță — sunt operate la furnizori europeni în interiorul UE, unde jurisdicția SUA nu se aplică.",
      ],
      unterpunkte: [
        {
          titel: "Serviciile vizate",
          paragraphs: [
            "O jurisdicție a SUA poate intra în discuție exclusiv în cazul următoarelor servicii suplimentare, clar delimitate:",
          ],
          list: [
            "Groq, Inc. (SUA) — sugestii de răspuns în căsuța de mesaje, numai dacă unitatea de cazare activează funcția. Este transmis contextul mesajului respectiv.",
            "Cloudflare, Inc. (SUA) — administrarea DNS pentru domeniile clienților. Sunt transmise date privind domeniul și configurația, niciun fel de date ale oaspeților.",
            "Google LLC (SUA) — la înregistrarea cu Google, la traduceri și la măsurarea audienței (Google Analytics 4, numai cu acordul dumneavoastră); partenerul contractual este Google Ireland Limited, dar accesul companiei-mamă din SUA nu este exclus.",
          ],
        },
        {
          titel: "Posibilitatea de evitare",
          paragraphs: [
            "Utilizarea platformei este posibilă fără aceste servicii: sugestiile de răspuns pot fi dezactivate, administrarea DNS îi privește numai pe clienții cu domeniu propriu, iar autentificarea cu Google este o alternativă voluntară la autentificarea prin e-mail și parolă.",
          ],
        },
        {
          titel: "Delimitarea față de dreptul european",
          paragraphs: [
            "CLOUD Act este drept american, nu drept al Uniunii Europene. Trebuie deosebit de EU Data Act (Regulamentul (UE) 2023/2854), care reglementează schimbarea furnizorului și portabilitatea în cazul serviciilor de prelucrare a datelor, precum și de Cloud and AI Development Act, care, la data prezentei politici, se află în procedura legislativă europeană.",
          ],
        },
      ],
    },
    {
      heading: "Durata de stocare",
      list: [
        "Datele contului: pe durata relației comerciale; ulterior ștergere, în măsura în care nu există o obligație de păstrare.",
        "Datele de rezervare, de facturare și de plată: potrivit legii daneze a contabilității, cinci ani de la încheierea exercițiului financiar căruia le sunt atribuite; în cazul clienților cu sediul în Germania pot fi aplicabile termene mai lungi de drept comercial și fiscal.",
        "Mesajele și datele oaspeților pe platformă: potrivit instrucțiunilor unității de cazare responsabile, cel mai târziu până la ștergerea de către aceasta, respectiv până la încetarea contractului.",
        "Buletinul informativ: până la retragerea consimțământului; înscrierile neconfirmate expiră după șapte zile. Dovada consimțământului și a dezabonării se păstrează dincolo de acest moment atât timp cât este necesară ca dovadă.",
        "Jurnalele de autentificare și evenimentele de securitate: pe termen scurt, pentru detectarea atacurilor.",
        "Fișierele jurnal ale serverului: numai atât timp cât este necesar pentru funcționare și securitate.",
        "Copiile de siguranță: prin rotație, până când sunt înlocuite de copii mai noi.",
      ],
    },
    {
      heading: "Drepturile dumneavoastră",
      paragraphs: [
        "Aveți dreptul de acces (art. 15), la rectificare (art. 16), la ștergere (art. 17), la restricționarea prelucrării (art. 18), la portabilitatea datelor (art. 20) și de opoziție față de prelucrările întemeiate pe interese legitime (art. 21 din RGPD). Un consimțământ acordat poate fi retras oricând, cu efect pentru viitor.",
        `Pentru aceasta, adresați-vă la [${ANBIETER.email}](mailto:${ANBIETER.email}). Dacă datele dumneavoastră privesc utilizarea platformei de către o unitate de cazare, transmitem cererea dumneavoastră unității de cazare responsabile sau o sprijinim la formularea răspunsului.`,
        `Puteți depune, în plus, o plângere la o autoritate de supraveghere în domeniul protecției datelor — competentă pentru noi este ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}). Vă puteți adresa și autorității de supraveghere din localitatea dumneavoastră de domiciliu.`,
      ],
    },
    {
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular. Nicht mit „Ihre Rechte" zusammenlegen.
      heading: "Ștergerea contului și a datelor din aplicație",
      paragraphs: [
        "Ștergerea contului dumneavoastră o puteți solicita oricând chiar dumneavoastră — în aplicație, la „Profil → Cont”, sau prin formularul nostru pe web:",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "Calea pe web funcționează în mod deliberat și atunci când nu mai aveți aplicația instalată sau nu vă mai puteți autentifica. Pentru protecția împotriva abuzurilor, aceasta se desfășoară în doi pași: introduceți adresa de e-mail a contului dumneavoastră și primiți exact la această adresă un link de confirmare. Abia accesarea acestuia face cererea valabilă — o adresă doar introdusă nu produce niciun efect. Prelucrăm cererea în termen de 30 de zile și răspundem prin e-mail.",
        "Împreună cu contul ștergem datele dumneavoastră de acces, profilul, datele privind imobilele și calendarul, precum și mesajele dumneavoastră. Nu sunt șterse documentele pentru care există o obligație legală de păstrare — în special facturile și documentele de rezervare aferente perioadelor decontate (obligația de contabilitate potrivit dreptului danez, de regulă cinci ani). Aceste documente sunt blocate pe durata termenului, adică păstrate exclusiv pentru îndeplinirea acestei obligații, și șterse ulterior.",
      ],
    },
    {
      heading: "Securitatea prelucrării",
      paragraphs: [
        "Asigurăm prelucrarea prin măsuri tehnice și organizatorice conform art. 32 din RGPD, în special: criptarea continuă a transportului (TLS), reguli de acces pe chiriaș direct în baza de date, permisiuni bazate pe roluri cu separarea datelor financiare și de serviciu, autentificare cu doi factori opțională, limitarea încercărilor de autentificare, copii de siguranță criptate cu test de restaurare periodic, precum și înregistrarea evenimentelor relevante pentru securitate.",
      ],
    },
    {
      heading: "Obligația de a furniza datele",
      paragraphs: [
        "Datele de care avem nevoie pentru încheierea contractului, decontare și obligațiile legale sunt necesare — fără ele nu putem pune platforma la dispoziție. Toate celelalte date sunt furnizate în mod voluntar.",
      ],
    },
    {
      heading: "Modificări ale prezentei politici",
      paragraphs: [
        "Adaptăm prezenta politică atunci când se schimbă prelucrarea, furnizorii de servicii folosiți sau situația juridică. Se aplică de fiecare dată versiunea publicată aici; data de mai sus indică actualizarea.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte Export
// bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default datenschutz;
