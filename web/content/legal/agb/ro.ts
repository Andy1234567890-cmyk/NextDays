import type { LegalDoc } from "../types";

// Rumänische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort, dann hier nachziehen. § 5 enthält die von Stripe für
// Custom-Plattformen vorgeschriebene Klausel (Stripe Connected Account
// Agreement) — Wortlaut an Stripes Empfehlungstext angelehnt, URLs nicht ändern.
export const agb: LegalDoc = {
  title: "Condiții generale de afaceri (CGA) pentru agenții și locatori",
  stand: "Ultima actualizare: 11 septembrie 2026",
  intro: [
    "Prezentele condiții generale de afaceri (denumite în continuare „CGA”) reglementează utilizarea platformei software myNextDays (denumită în continuare „Platforma”) de către agenții, locatori, administratori de imobile și alți utilizatori comerciali (denumiți în continuare „Utilizatorul”).",
    "Furnizorul Platformei este myNextDays ApS, societate cu răspundere limitată (anpartsselskab) de drept danez, Hirtshalsvej 21, 9881 Bindslev, Danemarca, înregistrată în Registrul Central al Întreprinderilor din Danemarca (CVR) cu nr. CVR 46615182 (denumit în continuare „myNextDays” sau „noi”).",
    "Platforma se adresează exclusiv întreprinzătorilor în sensul § 14 din Codul civil german (BGB), respectiv al dispozițiilor corespunzătoare din statul membru UE relevant. Ea nu se adresează consumatorilor.",
  ],
  sections: [
    {
      heading: "§ 1 Domeniul de aplicare",
      paragraphs: [
        "Prezentele CGA se aplică tuturor contractelor privind utilizarea Platformei încheiate între myNextDays și Utilizator, precum și tuturor serviciilor și modulelor puse la dispoziție prin intermediul acesteia.",
        "Condițiile comerciale ale Utilizatorului care derogă de la prezentele CGA, le contravin sau le completează devin parte a contractului numai dacă myNextDays a acceptat în mod expres, în formă text, aplicarea acestora.",
      ],
    },
    {
      heading: "§ 2 Obiectul contractului și serviciile",
      paragraphs: [
        "myNextDays pune la dispoziția Utilizatorului un software în cloud pentru administrarea locuințelor de vacanță și a unităților de cazare. Gama de funcții rezultă din descrierea actuală a serviciilor și cuprinde în special:",
      "Fiecare proprietate creată de utilizator pe platformă este listată simultan pe piața proprie a platformei, myBestDays (canal obligatoriu). Utilizatorul nu poate deselecta individual acest canal; cu toate acestea, poate oricând să retragă o proprietate de la vânzare pe toate canalele simultan sau să o șteargă, utilizând funcția „Pauză vânzare”. O proprietate devine vizibilă pe myBestDays numai după ce utilizatorul a publicat-o și myNextDays a aprobat listarea; myNextDays poate refuza sau revoca aprobarea pentru un motiv obiectiv. Pentru rezervările efectuate prin myBestDays, se aplică taxa conform § 7.",
      ],
      list: [
        "administrarea proprietăților, a calendarelor de ocupare și a rezervărilor (sistem de management al proprietăților),",
        "conectarea la canale de rezervare ale terților (de ex. Booking.com, Airbnb) prin intermediul unui channel manager,",
        "Publicarea ofertelor prin intermediul pieței proprii a platformei myBestDays (canal obligatoriu, a se vedea alineatul 2),",
        "crearea de site-uri web proprii prin intermediul page builder-ului integrat,",
        "funcții de contabilitate, decontare și raportare, inclusiv decontări pentru proprietari,",
        "comunicarea cu oaspeții și acceptarea plăților prin procesarea integrată a plăților (§ 5).",
      ],
    },
    {
      heading: "§ 3 Înregistrarea, contul și datele Utilizatorului",
      paragraphs: [
        "Utilizarea Platformei presupune înregistrarea unui cont. Utilizatorul este obligat să furnizeze, la înregistrare și pe întreaga durată a contractului, date corecte, actuale și complete despre persoana sa și despre întreprinderea sa și să le actualizeze fără întârziere în cazul unor modificări.",
        "Datele de acces trebuie păstrate secrete și protejate împotriva accesului terților. Utilizatorul trebuie să informeze myNextDays fără întârziere dacă există indicii privind o utilizare abuzivă a contului său.",
        "Contul nu este transferabil. Utilizatorul se asigură că toate persoanele care utilizează contul în numele său respectă prezentele CGA.",
      ],
    },
    {
      heading: "§ 4 Rolul myNextDays în cadrul rezervărilor",
      paragraphs: [
        "Contractele de cazare privind unitățile de cazare oferite pe Platformă, prin canale terțe conectate sau prin site-ul web propriu al Utilizatorului se încheie exclusiv între Utilizator (respectiv proprietarul reprezentat de acesta) și oaspetele respectiv. myNextDays nu devine parte a contractului de cazare.",
        "Pentru corectitudinea și legalitatea conținutului ofertelor (descrieri, fotografii, prețuri, disponibilități, taxe și impozite) răspunde exclusiv Utilizatorul.",
      ],
    },
    {
      heading: "§ 5 Procesarea plăților prin Stripe",
      paragraphs: [
        "Serviciile de procesare a plăților pentru agenții și locatori pe myNextDays sunt furnizate de Stripe și sunt supuse acordului [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full), care include condițiile de utilizare Stripe (denumite împreună „Acordul de servicii Stripe”). Prin acceptarea prezentelor CGA sau prin continuarea activității ca agenție sau locator pe myNextDays, Utilizatorul se declară de acord să fie obligat de Acordul de servicii Stripe, care poate fi modificat de Stripe din când în când.",
        "Condiția pentru ca myNextDays să permită servicii de procesare a plăților prin Stripe este ca Utilizatorul să pună la dispoziția myNextDays informații corecte și complete despre sine și despre întreprinderea sa. Utilizatorul autorizează myNextDays să transmită către Stripe aceste informații, precum și datele de tranzacție legate de utilizarea serviciilor de procesare a plăților furnizate de Stripe.",
        "Pentru raportul juridic cu Stripe este determinant textul contractual în limba engleză, accesibil prin linkul de mai sus, în versiunea sa în vigoare la momentul respectiv. Partenerul contractual pentru utilizatorii din Spațiul Economic European este societatea Stripe desemnată în Acordul de servicii Stripe (în prezent Stripe Payments Europe, Limited, Irlanda). Stripe prelucrează date cu caracter personal în conformitate cu [Politica de confidențialitate Stripe](https://stripe.com/privacy).",
        "Pentru îndeplinirea obligațiilor legale de identificare și verificare (printre altele prevenirea spălării banilor, „Know Your Customer”), myNextDays și Stripe pot solicita în orice moment informații și documente justificative suplimentare, în special documente de identitate, informații privind beneficiarii reali și datele contului bancar. Dacă informațiile sau documentele solicitate nu sunt furnizate în termenul stabilit, acceptarea plăților sau viramentele pot fi suspendate integral sau parțial până când informațiile sunt complete.",
      ],
    },
    {
      heading: "§ 6 Viramente, refuzuri la plată și solduri negative",
      paragraphs: [
        "Circuitul plății depinde de canalul de rezervare. În cazul rezervărilor efectuate prin propriul motor de rezervări al Utilizatorului și al rezervărilor prin portaluri de distribuție conectate, plățile oaspeților sunt încasate direct în contul de plată al Utilizatorului; în aceste cazuri, Utilizatorul este, față de oaspete, beneficiarul plății și partea contractantă a serviciului de cazare (§ 4), iar myNextDays nu devine în niciun moment deținător al acestor fonduri. Pentru astfel de rezervări, myNextDays nu percepe niciun comision procentual de rezervare; comisionul pentru rezervările prin portaluri de distribuție conectate este indicat separat și facturat ulterior.",
        "În cazul rezervărilor efectuate prin portalul de rezervări myNextDays, plata este procesată prin myNextDays. myNextDays reține în acest caz comisionul de intermediere prevăzut în lista de prețuri în vigoare, inclusiv costurile procesării plății, și transferă suma rămasă Utilizatorului potrivit alineatelor de mai jos. Remunerația pentru utilizarea software-ului (§ 7) rămâne neafectată.",
        "Viramentele se efectuează în contul bancar indicat de Utilizator. myNextDays poate ajusta ritmul viramentelor din motive de risc, în special în cazul conturilor noi, al tiparelor de tranzacții neobișnuite sau al verificărilor în curs.",
        "Rambursările către oaspeți sunt suportate economic de Utilizator. Refuzurile la plată și taxele rezultate sunt suportate de Utilizator în cazul rezervărilor efectuate prin propriul motor de rezervări și prin portaluri de distribuție conectate, întrucât în aceste cazuri Utilizatorul este beneficiarul plății; în cazul rezervărilor efectuate prin portalul de rezervări myNextDays, myNextDays suportă riscul de refuz la plată, cu excepția cazului în care acesta rezultă dintr-o încălcare a obligațiilor Utilizatorului (în special neprestarea sau abaterea substanțială a serviciului de cazare). myNextDays are dreptul de a compensa sumele suportate de Utilizator cu viramentele viitoare.",
        "Dacă în contul de plăți al Utilizatorului apare un sold negativ, Utilizatorul trebuie să îl acopere fără întârziere. Utilizatorul autorizează myNextDays și Stripe să debiteze soldurile negative din contul bancar indicat, în măsura în care acest lucru este permis de lege.",
      ],
    },
    {
      heading: "§ 7 Tarife și facturare",
      paragraphs: [
        "Tarifele pentru utilizarea Platformei rezultă din lista de prețuri convenită la încheierea contractului, respectiv din oferta individuală. Toate prețurile nu includ taxele legale aplicabile și sunt exprimate în moneda indicată în contract.",
        "Tarifele dependente de tranzacții (de ex. comisioane de plată sau de canal) pot fi reținute sau compensate direct la procesarea tranzacției respective.",
        "Dacă Utilizatorul este în întârziere cu plățile, myNextDays poate bloca accesul la Platformă, după o notificare prealabilă, până la achitarea sumelor restante.",
      ],
    },
    {
      heading: "§ 8 Obligațiile Utilizatorului; texte juridice proprii",
      paragraphs: [
        "Utilizatorul se asigură că ofertele, conținuturile și practicile sale comerciale respectă legislația aplicabilă, în special reglementările privind cazarea, obligațiile de declarare, dreptul fiscal și dreptul protecției consumatorilor de la locul unității de cazare. Utilizatorul deține pe propria răspundere autorizațiile, înregistrările și licențele necesare.",
        "Pentru site-urile web pe care Utilizatorul le operează prin page builder, precum și pentru ofertele sale de pe Platformă, răspunde Utilizatorul însuși; aceasta include în special propriile condiții generale pentru oaspeți, propriile date de identificare ale operatorului (impressum) și propriile informații privind protecția datelor.",
        "Sunt interzise în special: publicarea de oferte incorecte sau înșelătoare, derularea de tranzacții fictive sau frauduloase, eludarea procesării plăților conform § 5 pentru rezervările încheiate prin Platformă, precum și orice utilizare care afectează securitatea sau disponibilitatea Platformei.",
      ],
    },
    {
      heading: "§ 9 Canale de rezervare ale terților",
      paragraphs: [
        "La conectarea canalelor terțe (de ex. Booking.com, Airbnb) se aplică suplimentar condițiile operatorului de canal respectiv. Utilizatorul încheie el însuși contractele necesare în acest scop cu operatorul de canal.",
        "myNextDays asigură sincronizarea tehnică a disponibilităților, prețurilor și datelor de rezervare, însă nu are nicio influență asupra conținuturilor, comisioanelor sau deciziilor operatorilor de canal și nu răspunde pentru disponibilitatea acestora.",
      ],
    },
    {
      heading: "§ 10 Disponibilitate și dezvoltare ulterioară",
      paragraphs: [
        "myNextDays furnizează serviciile cu diligența unui comerciant prudent și urmărește o disponibilitate ridicată a Platformei. Ferestrele de mentenanță, dezvoltările ulterioare și împrejurările din afara sferei de influență a myNextDays (de ex. defecțiuni la furnizori terți) pot limita temporar disponibilitatea.",
        "myNextDays poate dezvolta în continuare Platforma și poate modifica funcții, în măsura în care scopul contractului nu este periclitat prin aceasta, iar modificarea este rezonabilă pentru Utilizator.",
      ],
    },
    {
      heading: "§ 11 Date și protecția datelor",
      paragraphs: [
        "În măsura în care myNextDays prelucrează date cu caracter personal în numele Utilizatorului în cadrul furnizării Platformei (în special date ale oaspeților), părțile încheie un acord de prelucrare a datelor în conformitate cu art. 28 din RGPD.",
        "Utilizatorul rămâne responsabil, din perspectiva protecției datelor, pentru legalitatea colectării și prelucrării datelor pe care le introduce. Detaliile privind prelucrarea datelor de către myNextDays rezultă din informațiile privind protecția datelor ale Platformei; pentru prelucrarea datelor de către Stripe se aplică § 5.",
      ],
    },
    {
      heading: "§ 12 Utilizarea inteligenței artificiale",
      paragraphs: [
        "myNextDays utilizează în anumite funcții sisteme de inteligență artificială, în special pentru recomandări de prețuri (Dynamic Pricing), pentru sugestii de răspuns în cutia de mesaje primite și pentru sprijinul acordat în cadrul asistenței. Aceste funcții generează sugestii; decizia privind utilizarea lor și răspunderea pentru aceasta revin Utilizatorului. Recomandările de prețuri nu înlocuiesc propria verificare comercială.",
                "În cadrul platformei, niciun sistem AI nu răspunde automat oaspeților sau utilizatorului: fiecare mesaj generat de un AI este prezentat unei persoane pentru verificare, care îl poate modifica și trimite sau nu. Suportul pentru utilizator este asigurat de oameni. De acesta se distinge consultantul de produs de pe site-ul nostru: acesta răspunde întrebărilor potențialilor clienți despre gama de servicii imediat și fără aprobare umană, nu face parte din platformă și nu este obiectul acestui contract. Informațiile furnizate de acest consultant nu constituie o garanție a unei proprietăți și nu prevalează asupra reglementărilor acestor Termeni și Condiții generale și a descrierii serviciilor actuale; relevant este § 2. Detalii despre prelucrarea datelor se găsesc în informațiile noastre privind protecția datelor.",
        "Dacă o persoană fizică interacționează direct cu un sistem AI, acest lucru îi va fi dezvăluit (Articolul 50 alineatul (1) din Regulamentul (UE) 2024/1689 — „Regulamentul AI”); în cazul consultantului de produs de pe site-ul nostru, acest lucru se întâmplă la începutul dialogului. Textele generate sau modificate substanțial de un sistem AI și pe care utilizatorul le transmite oaspeților trebuie să fie marcate de utilizator, în măsura în care există o obligație legală în acest sens.",
        "myNextDays nu operează sisteme de inteligență artificială care, potrivit anexei III la Regulamentul privind inteligența artificială, sunt considerate sisteme cu grad ridicat de risc, și nici practici interzise potrivit articolului 5 din Regulamentul privind inteligența artificială. Datele introduse de Utilizator și datele oaspeților săi nu sunt utilizate pentru antrenarea modelelor în lipsa unei însărcinări separate.",
        "Utilizatorul nu are dreptul să folosească funcțiile de inteligență artificială pentru a crea față de oaspeți aparența unei comunicări umane acolo unde există o obligație de informare, sau pentru a emite declarații cu efect juridic obligatoriu fără o verificare proprie.",
        "Dacă Utilizatorul își conectează contul, prin interfața prevăzută în acest scop, la un asistent de inteligență artificială propriu (de exemplu Claude de la Anthropic), se aplică următoarele: Utilizatorul încheie el însuși contractul privind acest serviciu și răspunde pentru utilizarea acestuia. Conectarea reprezintă instrucțiunea sa adresată myNextDays de a transmite acolo datele autorizate — inclusiv un transfer către o țară terță, dacă furnizorul are sediul în afara Uniunii Europene. Utilizatorul se asigură că dispune de o bază legală în acest scop, că propriile sale informații privind protecția datelor indică destinatarul și că garanțiile necesare pentru transfer există.",
        "Pentru o astfel de conectare, Utilizatorul folosește un acces pentru care furnizorul oferă o prelucrare a datelor pe bază de împuternicire și exclude utilizarea datelor pentru antrenarea modelelor — în cazul Claude, acestea sunt accesele pentru clienți de afaceri (Team, Enterprise sau API). Accesele destinate utilizării private nu îndeplinesc de regulă această condiție; de aceea, ele sunt nepotrivite pentru datele oaspeților. myNextDays nu poate identifica ce acces folosește Utilizatorul și atrage atenția asupra acestui aspect în dialogul de consimțământ.",
        "Utilizatorul ține cont în acest context de faptul că conținuturile pe care le copiază manual din interfața de utilizare într-un câmp de introducere al asistentului nu sunt, de regulă, acoperite de restricțiile contractuale ale furnizorului — diferit de datele preluate prin interfață.",
        "Datele care provin de la un portal de rezervări sunt utilizate de Utilizator, și prin interfață, numai pentru derularea și gestionarea rezervării respective — nu pentru evaluarea persoanelor, pentru crearea de profiluri sau în scopuri publicitare. Portalurile prevăd această limitare a scopului în propriile lor condiții.",
      ],
    },
    {
      heading: "§ 13 Reclamații și mediere",
      paragraphs: [
        "myNextDays menține pentru utilizatorii comerciali un sistem intern gratuit de gestionare a reclamațiilor (articolul 11 din Regulamentul (UE) 2019/1150 — „Regulamentul P2B”). Reclamațiile — în special cele privind pretinse încălcări ale prezentelor CGA, probleme tehnice cu impact considerabil sau măsuri luate de myNextDays față de Utilizator — pot fi depuse fără formalități la info@mynextdays.dk sau prin asistența din aplicație. Primirea este confirmată; soluționarea are loc cu promptitudine și într-un termen rezonabil, în cazurile simple de regulă în termen de 14 zile. Rezultatul este comunicat Utilizatorului într-un limbaj clar.",
        "Dacă în cadrul procedurii de reclamație nu se ajunge la un acord, myNextDays este dispusă să se adreseze împreună cu Utilizatorul, pe cale extrajudiciară, următorilor mediatori (articolul 12 din Regulamentul P2B): (1) WIPO Arbitration and Mediation Center, 34 chemin des Colombettes, 1211 Geneva 20, Elveția — proceduri posibile și la distanță și în mai multe limbi; (2) Voldgiftsinstituttet — Danish Institute of Arbitration, Kronprinsessegade 28, 1306 Copenhaga K, Danemarca — statul în care furnizorul își are sediul.",
        "Desemnarea nu obligă Utilizatorul să desfășoare o procedură de mediere; dreptul de a se adresa unei instanțe rămâne neatins. myNextDays participă la costurile rezonabile ale unei medieri; repartizarea acestora se stabilește potrivit regulamentului mediatorului respectiv și circumstanțelor cazului concret.",
        "myNextDays publică anual informații privind numărul reclamațiilor, durata soluționării și măsurile luate.",
      ],
    },
    {
      heading: "§ 14 Proprietate intelectuală",
      paragraphs: [
        "Toate drepturile asupra Platformei, asupra software-ului și conținuturilor acesteia (cu excepția conținuturilor introduse de Utilizator) aparțin myNextDays, respectiv licențiatorilor săi. Utilizatorul primește, pe durata contractului, un drept simplu, netransferabil, de a utiliza Platforma în limitele convenite prin contract.",
        "Asupra conținuturilor introduse de Utilizator, acesta acordă myNextDays drepturile simple de utilizare necesare pentru operarea Platformei (în special pentru stocare, reproducere, afișare și transmitere către canalele conectate).",
      ],
    },
    {
      heading: "§ 15 Răspundere",
      paragraphs: [
        "myNextDays răspunde nelimitat pentru intenție și neglijență gravă, precum și pentru prejudiciile rezultate din vătămarea vieții, a integrității corporale sau a sănătății.",
        "În caz de neglijență simplă, myNextDays răspunde numai pentru încălcarea obligațiilor contractuale esențiale (obligații cardinale), limitat la prejudiciul previzibil, tipic pentru contract. Răspunderea potrivit legislației privind răspunderea pentru produse, precum și cea rezultată din garanțiile asumate rămâne neatinsă.",
        "Pentru pierderea de date, myNextDays răspunde numai în măsura în care prejudiciul s-ar fi produs și în cazul unei salvări corespunzătoare și regulate a datelor de către Utilizator, cu excepția cazului în care salvarea datelor revine contractual myNextDays.",
      ],
    },
    {
      heading: "§ 16 Durată, reziliere și blocare",
      paragraphs: [
        "Durata și termenele de reziliere rezultă din contractul respectiv. Dreptul la rezilierea extraordinară pentru motive întemeiate rămâne neatins.",
        "myNextDays poate bloca temporar accesul la Platformă sau la anumite funcții (inclusiv acceptarea plăților și viramentele) dacă există indicii concrete privind o încălcare a prezentelor CGA, o fraudă sau o utilizare abuzivă ori dacă myNextDays este obligată la aceasta prin lege sau prin dispoziția unui prestator de servicii de plată. Utilizatorul va fi informat despre blocare, în măsura în care acest lucru este permis de lege.",
        "După încetarea contractului, myNextDays pune la dispoziția Utilizatorului, la cerere, datele sale pentru export într-un format uzual, în termen de 30 de zile; ulterior, datele vor fi șterse, în măsura în care nu se opun obligații legale de păstrare.",
      ],
    },
    {
      heading: "§ 17 Modificarea prezentelor CGA",
      paragraphs: [
        "myNextDays poate modifica prezentele CGA cu efect pentru viitor, în măsura în care acest lucru este necesar din motive întemeiate (în special modificări legislative, modificări ale jurisprudenței sau cerințe ale prestatorilor de servicii de plată), iar Utilizatorul nu este dezavantajat în mod nerezonabil prin aceasta.",
        "Modificările vor fi anunțate Utilizatorului în formă text cu cel puțin șase săptămâni înainte de intrarea lor în vigoare. Dacă Utilizatorul nu se opune în termenul de anunțare sau continuă să utilizeze Platforma după intrarea în vigoare, CGA modificate se consideră acceptate; asupra acestei consecințe se va atrage atenția în mod expres în anunț.",
      ],
    },
    {
      heading: "§ 18 Dispoziții finale",
      paragraphs: [
        "Se aplică dreptul statului în care furnizorul își are sediul, cu excluderea Convenției ONU asupra contractelor de vânzare internațională de mărfuri. Dispozițiile imperative ale statului în care Utilizatorul își are sediul rămân neatinse.",
        "Instanța competentă exclusiv pentru toate litigiile care decurg din sau în legătură cu prezentul contract este — în măsura permisă de lege — cea de la sediul furnizorului.",
        "În cazul în care anumite dispoziții ale prezentelor CGA sunt sau devin nule, validitatea celorlalte dispoziții rămâne neatinsă.",
      ],
    },
  ],
};
