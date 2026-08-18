import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Actul privind serviciile digitale",
  stand: "Actualizat: 18 august 2026",
  intro: [
    "myBestDays este un serviciu intermediar și o platformă online în sensul Regulamentului (UE) 2022/2065 privind o piață unică pentru serviciile digitale (Actul privind serviciile digitale, DSA). Această pagină reunește informațiile și procedurile pe care acest regulament le impune.",
    "myBestDays nu este o platformă online foarte mare în sensul articolului 33 din regulament. Obligațiile suplimentare aplicabile acestora — identificarea riscurilor sistemice, auditul independent, arhiva de publicitate și publicarea numărului lunar de utilizatori prin procedura prevăzută acolo — nu ne revin, prin urmare.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Puncte de contact (articolele 11 și 12)",
      paragraphs: [
        `Punct unic de contact pentru autoritățile statelor membre, Comisie și Comitetul european pentru servicii digitale: ${ANBIETER.email}, prin poștă ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danemarca.`,
        `Punct unic de contact pentru utilizatori: ${ANBIETER.email}. Ne contactați direct și fără o etapă intermediară automatizată.`,
        "Cu ambele puncte de contact se poate comunica în germană, daneză și engleză.",
        "Nu este necesară desemnarea unui reprezentant legal în Uniune conform articolului 13: operatorul este stabilit în Danemarca și, prin urmare, în Uniune.",
        `Coordonatorul competent al serviciilor digitale conform articolului 49: ${DSA_KOORDINATOR.name}, Danemarca ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Semnalarea conținutului ilegal (articolul 16)",
      paragraphs: [
        "Orice persoană ne poate semnala conținut pe care îl consideră ilegal. Utilizați în acest scop funcția de semnalare disponibilă la fiecare anunț, fiecare recenzie și fiecare mesaj, sau punctul de contact pentru utilizatori.",
        "Pentru ca o semnalare să poată fi evaluată fără o analiză juridică aprofundată, ea ar trebui să conțină:",
      ],
      list: [
        "o explicație suficient de motivată privind motivul pentru care conținutul este ilegal;",
        "locația electronică exactă, în special adresa URL;",
        "numele și adresa de e-mail ale persoanei care semnalează — cu excepția semnalărilor privind infracțiuni împotriva libertății sexuale a copiilor, unde această indicație este facultativă;",
        "declarația că informațiile sunt, după cea mai bună știință, corecte și complete.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Cum prelucrăm semnalările",
      paragraphs: [
        "Confirmăm primirea fără întârziere și decidem prompt, cu diligență, fără arbitrar și obiectiv.",
        "Dacă o semnalare conține informațiile de la secțiunea 2, ea întemeiază cunoașterea noastră în sensul articolului 6 din regulament.",
        "Despre decizia noastră informăm persoana care a semnalat și indicăm căile de atac.",
        "În cazul unei prelucrări automatizate comunicăm acest lucru.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Motivarea măsurilor (articolul 17)",
      paragraphs: [
        "Dacă restrângem vizibilitatea unui conținut, îl eliminăm, blocăm accesul la el, suspendăm plăți, prestarea serviciului sau contul, persoana vizată primește o motivare clară și specifică.",
        "Motivarea indică natura și amploarea măsurii, domeniul său de aplicare teritorial și temporal, faptele și împrejurările deciziei, dacă a fost implicată o prelucrare automatizată, temeiul juridic sau clauza contractuală încălcată și căile de atac disponibile.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Suspiciunea de infracțiune (articolul 18)",
      paragraphs: [
        "Dacă există indicii privind o infracțiune care generează un pericol pentru viața sau siguranța unei persoane, informăm fără întârziere autoritățile competente de urmărire penală sau judiciare.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. Procedura internă de plângeri (articolul 20)",
      paragraphs: [
        "Împotriva fiecărei măsuri prevăzute la secțiunea 4 și împotriva respingerii unei semnalări se poate depune gratuit plângere în termen de șase luni.",
        "Plângerile sunt prelucrate prompt, nediscriminatoriu și cu diligență — sub supravegherea unor persoane calificate și nu exclusiv prin mijloace automatizate.",
        "Dacă o plângere se dovedește întemeiată, retragem măsura. Calea este descrisă în [Plângeri și soluționarea litigiilor](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Soluționarea extrajudiciară a litigiilor (articolul 21)",
      paragraphs: [
        "Pentru litigiile privind măsurile prevăzute la secțiunea 4, utilizatorii se pot adresa unui organism de soluționare extrajudiciară a litigiilor certificat de coordonatorul competent al serviciilor digitale. Lista organismelor certificate este ținută de Comisia Europeană.",
        "Deciziile acestor organisme nu sunt obligatorii pentru noi; nu suntem obligați să participăm la proceduri ale unor furnizori independenți. Calea către instanțe rămâne neafectată.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Semnalatori de încredere (articolul 22)",
      paragraphs: [
        "Semnalările depuse de o entitate recunoscută ca semnalator de încredere în domeniul său de competență le prelucrăm cu prioritate.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Măsuri împotriva abuzurilor (articolul 23)",
      paragraphs: [
        "Conturile prin care se furnizează frecvent conținut vădit ilegal le blocăm, după o avertizare prealabilă, pentru o perioadă rezonabilă.",
        "Prelucrarea semnalărilor și a plângerilor o suspendăm pentru persoanele care depun frecvent semnalări sau plângeri vădit neîntemeiate — de asemenea după o avertizare prealabilă.",
        "Analizăm întotdeauna cazul concret: numărul, proporția și gravitatea faptelor vizate, precum și intenția.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Rapoarte de transparență (articolele 15 și 24)",
      paragraphs: [
        "Publicăm anual un raport privind moderarea conținutului: numărul ordinelor autorităților, numărul și tipul semnalărilor, măsurile luate, numărul plângerilor și rezultatul acestora, informații privind utilizarea procedeelor automatizate, precum și numărul litigiilor în fața organismelor extrajudiciare.",
        `Microîntreprinderile și întreprinderile mici sunt exceptate conform articolului 19 din regulament de la o parte dintre aceste obligații. Atât timp cât exceptarea se aplică, punem la dispoziție informațiile la cerere la ${ANBIETER.email}; îndată ce primul raport este publicat, el va fi legat aici.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. Trasabilitatea comercianților (articolele 30—32)",
      paragraphs: [
        "Furnizorii care acționează pe Platformă în cadrul activității lor comerciale pot oferi abia după ce ne-au transmis numele, adresa, numărul de telefon, adresa de e-mail, datele de registru, codul de înregistrare în scopuri de TVA și contul de plată, iar informațiile lor sunt plauzibile.",
        "Aceste informații le afișăm în anunț, în măsura în care regulamentul o prevede.",
        "Dacă aflăm că un anunț a privit un produs ilegal sau un serviciu ilegal, informăm oaspeții vizați, în măsura în care dispunem de datele lor de contact.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Sisteme de recomandare (articolul 27)",
      paragraphs: [
        "Principalii parametri ai ordinii rezultatelor căutării și ai recomandărilor, precum și posibilitatea de a-i influența, sunt descriși în [Prețuri, clasare și recomandări](https://mybestdays.dk/rechtliches/preisangaben).",
      ],
    },
    {
      id: "werbung",
      heading: "13. Publicitate (articolul 26)",
      paragraphs: [
        "În prezent nu afișăm publicitate plătită a terților și nici poziționări plătite în rezultatele căutării.",
        "Dacă vom introduce publicitate, o vom marca în mod clar, vom indica agentul de publicitate și principalii parametri ai difuzării. Publicitatea bazată pe categorii speciale de date cu caracter personal conform articolului 9 din Regulamentul (UE) 2016/679 și publicitatea către minori pe baza creării de profiluri sunt excluse.",
      ],
    },
  ],
};
