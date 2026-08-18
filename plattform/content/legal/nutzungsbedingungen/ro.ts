import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Condiții de utilizare pentru oaspeți",
  stand: "Actualizat: 18 august 2026",
  intro: [
    "Prezentele condiții de utilizare reglementează utilizarea portalului de rezervări myBestDays (denumit în continuare „Platforma”) de către călători și persoanele care efectuează rezervări (denumite în continuare „Oaspete” sau „dumneavoastră”).",
    `Operatorul Platformei este ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danemarca, nr. CVR ${ANBIETER.cvr} (denumit în continuare „myBestDays” sau „noi”). myBestDays este o marcă a acestei societăți și nu o persoană juridică distinctă. Datele complete ale furnizorului se găsesc în [Informații juridice](https://mybestdays.dk/rechtliches/impressum).`,
    "Prin utilizarea Platformei acceptați prezentele condiții. Vă rugăm să le citiți cu atenție.",
  ],
  summary: {
    heading: "Rezumatul prezentelor condiții",
    paragraphs: [
      "myBestDays este o piață. Punem la dispoziție Platforma pe care furnizorii își oferă unitățile de cazare — cazarea propriu-zisă nu o oferim noi. Contractul de cazare se încheie între dumneavoastră și furnizor, nu cu noi.",
      "Ceea ce vedeți în anunț provine de la furnizor: descriere, imagini, dotări, preț, condiții de anulare și regulile casei. Verificăm anunțurile, dar nu putem garanta pentru fiecare afirmație a unui furnizor.",
      "Prețul pe care îl vedeți la finalizarea rezervării este prețul total pentru serviciile rezervate. Sumele suplimentare datorate abia la fața locului (de exemplu taxa de stațiune sau o garanție) le indicăm separat în prealabil.",
      "Dacă ceva nu merge bine, adresați-vă mai întâi nouă. Secțiunea A15 descrie cum depuneți o plângere și ce căi vă stau apoi la dispoziție.",
      "Prezentul rezumat explică condițiile, dar nu le înlocuiește. Determinant este textul integral.",
    ],
  },
  sections: [
    {
      id: "a",
      heading: "A. Toate rezervările prin myBestDays",
      subsections: [
        {
          id: "a1-definitionen",
          heading: "A1. Definiții",
          paragraphs: [
            "Termenii utilizați în prezentele condiții sunt explicați în glosarul de la sfârșitul documentului. Cei mai importanți sunt:",
          ],
          list: [
            "„Platformă” — site-ul web, aplicațiile mobile și toate celelalte puncte de acces prin care myBestDays afișează unități de cazare și intermediază rezervări.",
            "„Furnizor” — persoana fizică sau juridică ce oferă o unitate de cazare prin Platformă (gazdă, locator, agenție, unitate hotelieră sau de cazare).",
            "„Unitate de cazare” — serviciul de cazare oferit de furnizor, adică o proprietate de vacanță sau o unitate dintr-un tip de cameră ori de obiect.",
            "„Rezervare” — rezervarea unei unități de cazare pentru o anumită perioadă, încheiată prin Platformă.",
            "„Preț total” — suma indicată la finalizarea rezervării, inclusiv toate taxele, comisioanele și suplimentele decontate prin Platformă.",
            "„Costuri la fața locului” — sume care nu se decontează prin Platformă, ci devin exigibile față de furnizor (de ex. taxa de stațiune, garanția, curățenia finală la alegerea furnizorului).",
          ],
        },
        {
          id: "a2-ueber-diese-bedingungen",
          heading: "A2. Despre prezentele condiții",
          paragraphs: [
            "Prezentele condiții se aplică oricărei utilizări a Platformei, indiferent dacă vă creați un cont și dacă se ajunge la o rezervare.",
            "Secțiunea A se aplică tuturor rezervărilor. Secțiunea B conține regulile suplimentare pentru unitățile de cazare. În caz de contradicție, prevalează secțiunea B.",
            "Pentru serviciul de cazare propriu-zis se aplică suplimentar condițiile furnizorului respectiv (în special regulile casei și condițiile de anulare), indicate în anunț. Aceste condiții ale furnizorului se adaugă condițiilor noastre; ele nu pot deroga de la condițiile noastre în ceea ce privește raportul dumneavoastră cu noi.",
            "Prezentele condiții sunt disponibile în toate cele 24 de limbi oficiale ale Uniunii Europene. În caz de divergențe între versiunile lingvistice, prevalează versiunea germană, în măsura în care dispozițiile imperative ale statului dumneavoastră de reședință nu prevăd altfel.",
            "Drepturile imperative ale consumatorilor conform dreptului statului dumneavoastră de reședință nu sunt afectate de prezentele condiții.",
          ],
        },
        {
          id: "a3-ueber-mybestdays",
          heading: "A3. Despre myBestDays",
          paragraphs: [
            "myBestDays este o piață online pentru unități de cazare de vacanță și unități de primire turistică. Operăm Platforma pe care furnizorii își prezintă unitățile de cazare, iar oaspeții le pot rezerva.",
            "Suntem intermediar, nu hotelier. Nu deținem, nu exploatăm, nu administrăm și nu controlăm niciuna dintre unitățile de cazare oferite pe Platformă și nu suntem parte la contractul de cazare.",
            "myBestDays este un serviciu intermediar în sensul Regulamentului (UE) 2022/2065 privind serviciile digitale. Datele și procedurile noastre în temeiul acestui regulament se găsesc în [Actul privind serviciile digitale](https://mybestdays.dk/rechtliches/dsa).",
            "myBestDays nu este organizator de călătorii. Nu creăm pachete de servicii de călătorie în sensul Directivei (UE) 2015/2302; privind serviciile de călătorie asociate, a se vedea A20.",
          ],
        },
        {
          id: "a4-unsere-plattform",
          heading: "A4. Platforma noastră",
          paragraphs: [
            "Conținutul unui anunț — descriere, fotografii, dotări, limite de ocupare, prețuri, disponibilități, condiții de anulare și regulile casei — provine de la furnizorul respectiv. Furnizorul răspunde pentru corectitudinea și caracterul complet al acestuia.",
            "Verificăm anunțurile înainte de publicare și în mod curent pentru încălcări evidente ale [Regulilor privind conținutul adecvat](https://mybestdays.dk/rechtliches/inhaltsrichtlinien). Nu există o obligație de monitorizare generală a întregului conținut, iar aceasta ar fi de altfel inadmisibilă conform articolului 8 din Regulamentul (UE) 2022/2065.",
            "Cum ordonăm rezultatele căutării și ce caracteristici determină ordinea explicăm în [Informații privind prețurile, clasarea și recomandările](https://mybestdays.dk/rechtliches/preisangaben).",
            "Ne străduim să menținem Platforma permanent disponibilă, dar nu datorăm o disponibilitate neîntreruptă. Sunt posibile lucrări de întreținere, perturbări și adaptări.",
            "Traducerile conținutului furnizorilor pot fi generate automat. Determinantă este versiunea originală introdusă de furnizor.",
          ],
        },
        {
          id: "a5-unsere-werte",
          heading: "A5. Valorile noastre",
          paragraphs: [
            "Așteptăm din partea oaspeților și a furnizorilor o atitudine respectuoasă. Discriminarea pe motive de origine, culoarea pielii, religie, convingeri, sex, identitate de gen, orientare sexuală, handicap, vârstă sau caracteristici similare nu este tolerată pe Platformă — a se vedea [Politica împotriva discriminării](https://mybestdays.dk/rechtliches/antidiskriminierung).",
            "Pentru comportamentul din timpul șederii se aplică [Regulile de bază pentru oaspeți](https://mybestdays.dk/rechtliches/grundregeln-gaeste), iar pentru furnizori [Codul de conduită al furnizorilor](https://mybestdays.dk/rechtliches/verhaltenskodex-anbieter).",
          ],
        },
        {
          id: "a6-konto-und-nutzung",
          heading: "A6. Contul dumneavoastră și utilizarea Platformei",
          paragraphs: [
            "Pentru o rezervare vă puteți crea un cont. Răspundeți pentru confidențialitatea datelor dumneavoastră de acces și ne informați imediat dacă bănuiți o utilizare neautorizată.",
            "Puteți utiliza Platforma numai dacă aveți capacitate de exercițiu și puteți încheia contracte în mod valabil.",
            "Datele dumneavoastră la înregistrare și la rezervare trebuie să fie corecte și complete — în special numele, datele de contact și numărul de călători. Furnizorul are nevoie de aceste date pentru a pune la dispoziție unitatea de cazare și pentru a-și îndeplini obligațiile de înregistrare.",
            "Nu sunt permise în special:",
          ],
          list: [
            "rezervările fictive, plățile frauduloase sau utilizarea mijloacelor de plată ale altor persoane fără autorizare;",
            "extragerea automatizată a datelor de pe Platformă (scraping, crawler) în afara a ceea ce permite fișierul nostru robots.txt;",
            "măsurile care perturbă sau suprasolicită Platforma ori infrastructura care stă la baza ei sau eludează măsurile lor de securitate;",
            "publicarea de conținut ilegal, ofensator sau înșelător în recenzii, mesaje sau datele de profil;",
            "încercarea de a derula rezervarea în afara Platformei după ce contactul s-a stabilit prin aceasta — a se vedea [Taxe în afara platformei](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "a7-preise",
          heading: "A7. Prețuri",
          paragraphs: [
            "Toate prețurile sunt afișate ca preț total, incluzând taxele și toate comisioanele decontate prin Platformă, de îndată ce datele călătoriei (perioada și numărul de călători) sunt stabilite. Dacă o componentă este datorată abia la fața locului, o indicăm separat înainte de finalizarea rezervării.",
            "Prețurile sunt afișate în moneda anunțului. Dacă vi se afișează o sumă și în altă monedă, aceasta este o conversie neangajantă, cu scop orientativ; decontarea se face în moneda anunțului, cu excepția cazului în care la plată se indică altfel.",
            "Prețurile se pot modifica până la finalizarea rezervării, de exemplu pentru că furnizorul le ajustează sau disponibilitatea se schimbă. Determinant este prețul afișat imediat înainte de rezervarea obligatorie și menționat în confirmarea rezervării.",
            "Erorile evidente de preț (de ex. o sumă greșită cu ordine de mărime) nu ne obligă nici pe noi, nici pe furnizor. Dacă identificăm o astfel de eroare, vă informăm imediat; puteți atunci anula rezervarea gratuit.",
            "Cum se compun comisioanele de serviciu este descris în [Informații privind comisioanele de serviciu](https://mybestdays.dk/rechtliches/servicegebuehren). Privind taxele și impozitele, a se vedea [Politica fiscală](https://mybestdays.dk/rechtliches/steuern).",
          ],
        },
        {
          id: "a8-zahlung",
          heading: "A8. Plata",
          paragraphs: [
            "Plățile prin Platformă sunt procesate de prestatorul de servicii de plată Stripe. Datele de plată (de ex. datele cardului) sunt colectate și prelucrate direct de Stripe; myBestDays nu stochează date complete de card.",
            "Când devine exigibilă fiecare sumă — avans, plata restului sau plata la fața locului — depinde de anunț și este indicat înainte de finalizarea rezervării. Detaliile sunt reglementate în [Condițiile de plată](https://mybestdays.dk/rechtliches/zahlungsbedingungen).",
            "Dacă anunțul prevede o garanție, aceasta poate fi preautorizată sau încasată și, în caz de daună, reținută integral sau parțial; determinante sunt informațiile din anunț.",
            "Dacă o plată eșuează sau este stornată, rezervarea poate fi anulată. Furnizorul poate solicita în continuare sumele rezultate din condițiile sale de anulare.",
          ],
        },
        {
          id: "a9-richtlinien",
          heading: "A9. Politici",
          paragraphs: [
            "Pe lângă prezentele condiții se aplică următoarele politici, care fac parte din contractul dintre dumneavoastră și noi:",
          ],
          list: [
            "[Reguli privind conținutul adecvat](https://mybestdays.dk/rechtliches/inhaltsrichtlinien)",
            "[Politica privind recenziile](https://mybestdays.dk/rechtliches/bewertungsrichtlinien)",
            "[Politica împotriva discriminării](https://mybestdays.dk/rechtliches/antidiskriminierung)",
            "[Reguli de bază pentru oaspeți](https://mybestdays.dk/rechtliches/grundregeln-gaeste)",
            "[Condiții de anulare](https://mybestdays.dk/rechtliches/stornierungsbedingungen)",
            "[Politica de remodificare și rambursare](https://mybestdays.dk/rechtliches/rueckerstattung)",
            "[Politica pentru perturbări grave](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen)",
            "[Politica privind drepturile de autor](https://mybestdays.dk/rechtliches/urheberrecht)",
          ],
        },
        {
          id: "a10-datenschutz-und-cookies",
          heading: "A10. Protecția datelor și cookie-uri",
          paragraphs: [
            "Modul în care prelucrăm datele cu caracter personal este descris în [Politica de confidențialitate](https://mybestdays.dk/rechtliches/datenschutz). Ce cookie-uri și tehnologii similare utilizăm este descris în [Politica privind cookie-urile](https://mybestdays.dk/rechtliches/cookies).",
            "Pentru o rezervare transmitem furnizorului datele de care are nevoie pentru prestarea serviciului de cazare. Furnizorul este operator independent pentru acestea; pentru el se aplică [Standardele de protecție a datelor pentru gazde](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
          ],
        },
        {
          id: "a11-barrierefreiheit",
          heading: "A11. Accesibilitate",
          paragraphs: [
            "Stadiul accesibilității Platformei și modul de semnalare a barierelor sunt descrise în [Declarația de accesibilitate](https://mybestdays.dk/rechtliches/barrierefreiheit).",
            "Informațiile privind accesibilitatea unei unități de cazare provin de la furnizor. Dacă depindeți de anumite caracteristici, clarificați-le înainte de rezervare cu furnizorul prin funcția de mesaje.",
          ],
        },
        {
          id: "a12-bewertungen-und-inhalte",
          heading: "A12. Recenzii și conținut generat de utilizatori",
          paragraphs: [
            "După ședere puteți lăsa o recenzie. Poate lăsa o recenzie doar cine a rezervat prin Platformă și a început sau ar fi putut începe șederea — astfel ne asigurăm că recenziile publicate provin de la oaspeți reali.",
            "Nu plătim pentru recenzii, nu le modificăm conținutul și nu suprimăm o recenzie doar pentru că este negativă. Detaliile și motivele pentru care eliminăm o recenzie sunt descrise în [Politica privind recenziile](https://mybestdays.dk/rechtliches/bewertungsrichtlinien).",
            "Pentru conținutul pe care îl publicați — recenzii, fotografii, mesaje, date de profil — rămâneți responsabil. Ne acordați un drept neexclusiv, nelimitat teritorial și temporal, cu titlu gratuit, de a reproduce, prelucra (de ex. decupare, traducere) și de a pune la dispoziția publicului acest conținut în cadrul exploatării și promovării Platformei. Vă puteți șterge conținutul; utilizările deja efectuate în compilații deja publicate nu sunt afectate.",
          ],
        },
        {
          id: "a13-kommunikation",
          heading: "A13. Mesaje și comunicarea cu furnizorul",
          paragraphs: [
            "Mesajele dintre dumneavoastră și furnizor se derulează prin Platformă. Punem la dispoziție funcția de mesaje, dar nu suntem expeditor sau destinatar al conținutului.",
            "Avem dreptul să verificăm mesajele în mod automatizat pentru încălcări ale prezentelor condiții (de ex. date de contact pentru eludarea Platformei, tipare de fraudă, conținut ilegal) și să reținem sau să eliminăm mesajele vizate. Despre o eliminare vă informăm cu motivare conform A17.",
            "Vă trimitem mesaje referitoare la rezervarea dumneavoastră (confirmare, modificări, informații de sosire) la adresa de e-mail indicată. Aceste mesaje reprezintă comunicare contractuală și nu pot fi dezabonate atât timp cât rezervarea există. Mesaje publicitare primiți numai în măsura în care v-ați dat consimțământul sau legea o permite fără consimțământ; vă puteți opune oricând.",
          ],
        },
        {
          id: "a14-geistiges-eigentum",
          heading: "A14. Drepturi de proprietate intelectuală",
          paragraphs: [
            "Platforma, designul, software-ul, bazele de date, textele și mărcile sale sunt protejate. Primiți un drept neexclusiv, netransmisibil de a utiliza Platforma pentru căutarea și rezervarea de unități de cazare — nimic mai mult.",
            "Utilizarea mărcilor și siglelor noastre este reglementată de [Regulile privind mărcile](https://mybestdays.dk/rechtliches/markenzeichen).",
            "Dacă apreciați că un conținut de pe Platformă vă încalcă dreptul de autor, urmați [Politica privind drepturile de autor](https://mybestdays.dk/rechtliches/urheberrecht).",
          ],
        },
        {
          id: "a15-wenn-etwas-schiefgeht",
          heading: "A15. Ce faceți dacă ceva nu merge bine",
          paragraphs: [
            "Dacă problema privește unitatea de cazare în sine, adresați-vă mai întâi furnizorului — prin funcția de mesaje sau la fața locului. Multe probleme se rezolvă astfel cel mai repede.",
            "Dacă nu avansați cu furnizorul sau problema privește Platforma, plata ori derularea rezervării, adresați-vă nouă. Cum ne găsiți și cum prelucrăm plângerile este descris în [Plângeri și soluționarea litigiilor](https://mybestdays.dk/rechtliches/beschwerden).",
            "Pregătiți: numărul rezervării, adresa de e-mail a rezervării, o scurtă descriere a problemei cu dorința dumneavoastră privind modul în care să ajutăm și dovezile aferente (fotografii, mesaje, chitanțe).",
            "Dacă unitatea de cazare nu este disponibilă la sosire sau se abate substanțial de la anunț, se aplică [Politica de remodificare și rambursare](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Platforma Comisiei Europene de soluționare online a litigiilor a fost abrogată prin Regulamentul (UE) 2024/3228 și și-a încetat activitatea; ea nu mai este disponibilă ca și cale. Ce organisme îi iau locul este descris în [Plângeri și soluționarea litigiilor](https://mybestdays.dk/rechtliches/beschwerden).",
            "Dacă am luat o măsură împotriva conținutului sau contului dumneavoastră, pe lângă procedura noastră internă de plângeri vă puteți adresa și unui organism de soluționare extrajudiciară a litigiilor certificat conform articolului 21 din Regulamentul (UE) 2022/2065. Deciziile acestuia nu sunt obligatorii pentru noi.",
          ],
        },
        {
          id: "a16-unangemessenes-verhalten",
          heading: "A16. Măsuri împotriva comportamentului neadecvat",
          paragraphs: [
            "Dacă încălcați prezentele condiții sau una dintre politicile menționate la A9, putem — gradual, în funcție de gravitatea, frecvența și efectul încălcării — să eliminăm conținut sau să îi restrângem vizibilitatea, să blocăm funcții, să anulăm rezervări sau să vă blocăm contul temporar ori definitiv.",
            "Înainte de o măsură analizăm cazul concret. În cazul conținutului vădit ilegal, al pericolului pentru persoane sau al fraudei putem acționa imediat.",
            "Fiecare măsură v-o motivăm și vă indicăm calea de plângere — a se vedea A17.",
          ],
        },
        {
          id: "a17-meldung-rechtswidriger-inhalte",
          heading: "A17. Semnalarea conținutului ilegal și motivarea măsurilor",
          paragraphs: [
            "Orice persoană ne poate semnala conținut pe care îl consideră ilegal. Procedura de semnalare conform articolului 16 din Regulamentul (UE) 2022/2065, punctele noastre de contact și modul de tratare a semnalărilor sunt descrise în [Actul privind serviciile digitale](https://mybestdays.dk/rechtliches/dsa).",
            "Dacă luăm o măsură împotriva conținutului publicat de dumneavoastră sau împotriva contului dumneavoastră, primiți o motivare cu indicarea motivului, a bazei factuale, a temeiului juridic sau a clauzei contractuale încălcate, precum și a posibilităților de plângere.",
            "Împotriva fiecărei măsuri puteți depune gratuit plângere în termen de șase luni. Plângerile sunt prelucrate de oameni, nu exclusiv automatizat.",
          ],
        },
        {
          id: "a18-haftung",
          heading: "A18. Limitarea răspunderii",
          paragraphs: [
            "Răspundem nelimitat pentru intenție și culpă gravă, pentru prejudicii rezultate din vătămarea vieții, corpului sau sănătății, precum și în limitele unei garanții asumate de noi. Pretențiile în temeiul răspunderii pentru produse nu sunt afectate.",
            "În rest, răspunderea noastră este limitată la prejudiciul previzibil care rezultă în mod tipic din încălcarea obligațiilor pe a căror îndeplinire aveți dreptul să vă bazați — și numai în măsura în care legea aplicabilă permite o astfel de limitare.",
            "Nu răspundem pentru prestarea serviciului de cazare în sine și nici pentru comportamentul furnizorilor sau al altor oaspeți. Partenerul contractual pentru serviciul de cazare este furnizorul.",
            "Nu răspundem pentru corectitudinea informațiilor introduse de furnizori, în măsura în care nu le-am cunoscut și nici nu trebuia să le cunoaștem. Îndată ce luăm cunoștință de o informație ilegală, acționăm fără întârziere.",
            "Orice răspundere suplimentară este exclusă. Pretențiile legale imperative, în special drepturile consumatorilor, nu sunt afectate.",
          ],
        },
        {
          id: "a19-recht-und-gerichtsstand",
          heading: "A19. Legea aplicabilă și instanța competentă",
          paragraphs: [
            "Se aplică dreptul danez — sediul operatorului se află în Danemarca — cu excluderea Convenției Națiunilor Unite asupra contractelor de vânzare internațională de mărfuri. Dispozițiile imperative de protecție a consumatorilor din statul în care aveți reședința obișnuită nu sunt afectate, conform articolului 6 din Regulamentul (CE) nr. 593/2008 (Roma I).",
            "În calitate de consumator ne puteți acționa în justiție la instanța de la domiciliul dumneavoastră sau la sediul nostru din Danemarca; noi vă putem acționa doar la instanța de la domiciliul dumneavoastră (articolele 17—19 din Regulamentul (UE) nr. 1215/2012).",
            "Pentru contractul de cazare se aplică de regulă dreptul statului în care se află unitatea de cazare; pentru acțiunile privind închirierea unui bun imobil, instanțele acestuia sunt exclusiv competente.",
          ],
        },
        {
          id: "a20-verbundene-reiseleistungen",
          heading: "A20. Servicii de călătorie asociate",
          paragraphs: [
            "myBestDays intermediază exclusiv servicii de cazare. Nu oferim zboruri, autoturisme de închiriat, servicii de transport, excursii sau atracții și nu creăm pachete de servicii de călătorie în sensul Directivei (UE) 2015/2302.",
            "Dacă în viitor vom intermedia și alte servicii de călătorie, vă vom informa înainte de rezervare, prin formularul standard prevăzut de lege, dacă ia naștere un pachet de servicii de călătorie sau un serviciu de călătorie asociat și ce drepturi vă revin din acesta.",
          ],
        },
        {
          id: "a21-laufzeit-und-kuendigung",
          heading: "A21. Durată, blocare și încetare",
          paragraphs: [
            "Contractul privind utilizarea Platformei este încheiat pe durată nedeterminată. Vă puteți șterge contul oricând fără a indica motive; rezervările existente nu sunt afectate și se derulează conform condițiilor furnizorului respectiv.",
            "Putem denunța contractul de utilizare cu un preaviz de 14 zile. În cazul unei încălcări grave a prezentelor condiții putem denunța fără preaviz și bloca contul.",
            "După încetare vă ștergem datele, în măsura în care nu se opune o obligație legală de păstrare sau un interes legitim de păstrare; detaliile sunt reglementate în [Politica de confidențialitate](https://mybestdays.dk/rechtliches/datenschutz).",
          ],
        },
        {
          id: "a22-aenderungen",
          heading: "A22. Clauza de modificare",
          paragraphs: [
            "Putem modifica prezentele condiții atunci când există un motiv obiectiv — de exemplu o modificare a cadrului juridic, jurisprudența instanțelor supreme, funcții noi sau eliminate ale Platformei ori acoperirea unor lacune de reglementare.",
            "Modificările le anunțăm în formă textuală cu cel puțin 30 de zile înainte de intrarea în vigoare. Dacă nu vă opuneți până la intrarea în vigoare, condițiile modificate se consideră acceptate; asupra acestui efect vă atragem atenția în mod expres în anunț. Dacă vă opuneți, putem denunța contractul de utilizare la data intrării în vigoare.",
            "Pentru rezervările deja încheiate se aplică condițiile în versiunea în vigoare la momentul rezervării.",
          ],
        },
      ],
    },
    {
      id: "b",
      heading: "B. Unități de cazare",
      subsections: [
        {
          id: "b1-umfang",
          heading: "B1. Domeniul de aplicare al prezentei secțiuni",
          paragraphs: [
            "Prezenta secțiune se aplică rezervării de unități de cazare prin Platformă — atât proprietăți de vacanță, cât și camere și unități ale unităților de primire turistică.",
            "Ea completează secțiunea A. În caz de contradicții, prevalează prezenta secțiune B.",
          ],
        },
        {
          id: "b2-vertragsverhaeltnis",
          heading: "B2. Raportul contractual",
          paragraphs: [
            "Contractul de cazare se încheie exclusiv între dumneavoastră și furnizor. myBestDays nu este parte contractantă.",
            "Prezentarea unei unități de cazare pe Platformă este o invitație adresată dumneavoastră de a face o ofertă de rezervare. Prin apăsarea butonului de rezervare cu obligație de plată faceți o ofertă obligatorie.",
            "Contractul se încheie atunci când rezervarea este confirmată. Confirmarea rezervării o trimitem la adresa de e-mail indicată de dumneavoastră; ea menționează furnizorul, serviciul rezervat, perioada, prețul total și condițiile de anulare.",
            "La unitățile de cazare cu rezervare pe bază de cerere, contractul se încheie abia prin acceptarea de către furnizor. Până atunci mijlocul dumneavoastră de plată poate fi preautorizat, dar nu debitat.",
          ],
        },
        {
          id: "b3-was-wir-tun",
          heading: "B3. Ce facem noi",
          paragraphs: [
            "Punem la dispoziție Platforma, afișăm anunțurile furnizorilor, preluăm rezervarea dumneavoastră, o transmitem furnizorului și vă trimitem confirmarea rezervării.",
            "Procesăm plata, în măsura în care anunțul prevede plata prin Platformă, și punem la dispoziție funcția de mesaje între dumneavoastră și furnizor.",
            "Nu punem la dispoziție unitatea de cazare, nu o exploatăm și nu garantăm pentru starea ei. Nu suntem organizatorul dumneavoastră de călătorie.",
          ],
        },
        {
          id: "b4-was-sie-tun-muessen",
          heading: "B4. Ce trebuie să faceți dumneavoastră",
          paragraphs: [
            "Verificați integral anunțul înainte de rezervare: dotările, limita de ocupare, orele de sosire și de plecare, regulile casei, condițiile de anulare și costurile datorate abia la fața locului.",
            "Respectați numărul maxim de persoane indicat în anunț. Dacă sosesc mai multe persoane decât cele rezervate, furnizorul poate refuza primirea sau poate solicita un supliment.",
            "Respectați regulile casei ale furnizorului și [Regulile de bază pentru oaspeți](https://mybestdays.dk/rechtliches/grundregeln-gaeste). Tratați cu grijă unitatea de cazare și răspundeți pentru daunele cauzate de dumneavoastră sau de însoțitorii dumneavoastră.",
            "Dacă furnizorul sau o autoritate are nevoie de date pentru înregistrare (de ex. fișă de cazare, date de identitate, declarație privind taxa de stațiune), le puneți la dispoziție în timp util.",
          ],
        },
        {
          id: "b5-preise-und-zahlung",
          heading: "B5. Prețuri și plată",
          paragraphs: [
            "Prețul total cuprinde prețul cazării pentru perioada rezervată și suplimentele și comisioanele indicate în anunț, care se decontează prin Platformă.",
            "La fața locului pot apărea sume suplimentare — în special taxa de stațiune sau taxele locale, o garanție, precum și servicii suplimentare pe care le rezervați abia la fața locului. Pe acestea le indicăm înainte de finalizarea rezervării ca fiind costuri la fața locului, în măsura în care furnizorul le-a declarat.",
            "Dacă anunțul prevede un avans, restul devine exigibil la momentul indicat în anunț. Dacă plata restului nu intervine, furnizorul poate rezilia contractul conform condițiilor sale de anulare.",
            "Plățile către furnizor în afara Platformei nu le primim și nu le putem urmări; ele nu intră în procesarea noastră de plăți — a se vedea [Taxe în afara platformei](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "b6-aenderungen-stornierungen",
          heading: "B6. Modificări, anulări și rambursări",
          paragraphs: [
            "Dacă și în ce condiții o rezervare poate fi anulată sau modificată gratuit depinde de condițiile de anulare ale furnizorului indicate în anunț. Condițiile pe care le punem la dispoziția furnizorilor spre alegere sunt descrise în [Condiții de anulare](https://mybestdays.dk/rechtliches/stornierungsbedingungen).",
            "În cazul serviciilor de cazare rezervate pentru o anumită perioadă nu există de regulă un drept legal de retragere, conform articolului 16 litera (l) din Directiva 2011/83/UE, respectiv dispozițiilor naționale corespunzătoare. Drepturile legale imperative nu sunt afectate.",
            "Dacă furnizorul anulează, rambursăm integral suma plătită prin Platformă. Suplimentar se aplică [Politica de remodificare și rambursare](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Dacă un eveniment aflat în afara controlului ambelor părți împiedică călătoria sau șederea, se aplică [Politica pentru perturbări grave](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen).",
            "Rambursările se efectuează la mijlocul de plată utilizat pentru plată, cu excepția cazului în care s-a convenit altfel.",
          ],
        },
        {
          id: "b7-was-sie-ausserdem-wissen-muessen",
          heading: "B7. Ce mai trebuie să știți",
          paragraphs: [
            "Furnizorii pot fi gazde private sau profesioniști. Dacă un furnizor acționează în calitate de profesionist, indicăm acest lucru în anunț. Dacă nu este vorba despre un profesionist, dispozițiile Uniunii privind protecția consumatorilor nu se aplică contractului de cazare — asupra acestei împrejurări vă atragem atenția în anunț.",
            "Informațiile privind amplasarea, împrejurimile, distanțele și evaluările terților servesc drept orientare. Obligatorii sunt informațiile privind serviciul rezervat în sine.",
            "În zonele cu obligație de înregistrare pentru închirierea pe termen scurt indicăm în anunț numărul de înregistrare comunicat de furnizor; a se vedea [Închirierea pe termen scurt](https://mybestdays.dk/rechtliches/kurzzeitvermietung).",
            "În cazul mai multor unități identice dintr-un tip de obiect sau de cameră, rezervați o unitate din acest tip. Ce unitate concretă primiți stabilește furnizorul.",
          ],
        },
      ],
    },
    {
      id: "lexikon",
      heading: "Glosar",
      paragraphs: [
        "Următorii termeni au în prezentele condiții semnificația indicată aici.",
      ],
      definitions: [
        {
          term: "Furnizor",
          description:
            "Persoana fizică sau juridică ce oferă o unitate de cazare prin Platformă și devine parte la contractul de cazare.",
        },
        {
          term: "Rezervare pe bază de cerere",
          description:
            "O rezervare care se încheie abia după acceptarea expresă de către furnizor, spre deosebire de rezervarea imediată.",
        },
        {
          term: "Confirmarea rezervării",
          description:
            "Mesajul prin care vă confirmăm încheierea contractului de cazare; conține furnizorul, serviciul, perioada, prețul total și condițiile de anulare.",
        },
        {
          term: "Unitate",
          description:
            "Obiectul concret rezervabil din cadrul unui tip de obiect sau de cameră. Se vinde unitatea, iar tipul este descris și tarifat.",
        },
        {
          term: "Preț total",
          description:
            "Suma indicată la finalizarea rezervării, inclusiv toate taxele și toate comisioanele decontate prin Platformă.",
        },
        {
          term: "Ocupare maximă",
          description:
            "Numărul maxim admis de persoane care pot înnopta în unitatea de cazare, indicat în anunț.",
        },
        {
          term: "Garanție",
          description:
            "O sumă solicitată de furnizor drept garanție pentru daune, care se preautorizează sau se încasează și, după ședere, se eliberează sau se compensează.",
        },
        {
          term: "Taxă de stațiune",
          description:
            "O taxă locală pentru înnoptări, percepută în funcție de comună la fața locului sau prin intermediul furnizorului; ea nu este un serviciu al myBestDays.",
        },
        {
          term: "Platformă",
          description:
            "Site-ul web, aplicațiile mobile și toate celelalte puncte de acces prin care myBestDays afișează unități de cazare și intermediază rezervări.",
        },
        {
          term: "Comision de serviciu",
          description:
            "Remunerația pentru serviciul de intermediere al myBestDays. Cine îl suportă și cum este indicat se arată în informațiile privind comisioanele de serviciu.",
        },
        {
          term: "Condiții de anulare",
          description:
            "Regulile alese de furnizor privind până când și cu ce costuri poate fi anulată sau modificată o rezervare.",
        },
        {
          term: "Unitate de cazare",
          description:
            "Serviciul de cazare oferit de furnizor — o proprietate de vacanță sau o unitate dintr-un tip de cameră ori de obiect.",
        },
        {
          term: "Costuri la fața locului",
          description:
            "Sume care nu se decontează prin Platformă, ci devin exigibile față de furnizor, precum taxa de stațiune, garanția sau serviciile suplimentare rezervate la fața locului.",
        },
      ],
    },
  ],
};
