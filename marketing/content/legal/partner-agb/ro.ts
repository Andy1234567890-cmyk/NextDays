// Partner-AGB — Rumänisch. Maschinell aus de.ts übersetzt (Gemini, juristischer Prompt,
// 02.09.2026), NICHT anwaltlich geprüft — ENTWURF wie die deutsche Fassung. Struktur und
// Platzhalter sind die der Quelldatei; inhaltliche Änderungen zuerst in de.ts, dann hier.
import type { LegalDoc } from "../types";

import { ANBIETER } from "../anbieter";

export const partnerAgb: LegalDoc = {
  slug: "partner/agb",
  metaDescription:
    "Termenii și condițiile de participare la programul de parteneriat myNextDays: atribuire, bază de comision, nivel, comision de echipă, interdicții, identificare, plată.",
  numbered: false,
  toc: true,
  title: "Termenii și condițiile programului de parteneriat (T&C Partener) — Proiect",
  standIso: "2026-09-02",
  intro: [
    "PROIECT — Acești termeni reprezintă o versiune de lucru a myNextDays și nu au fost încă verificați de un avocat. Până la lansarea versiunii verificate, aceștia sunt considerați o descriere a programului, nu un text contractual final. Versiunea verificată va fi publicată la această adresă cu un nou număr de versiune; partenerii vor fi rugați să își reconfirme acordul la următoarea autentificare.",
    `Acești termeni și condiții de participare reglementează participarea la programul de parteneriat (programul de afiliere) al ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-nr. ${ANBIETER.cvr} (denumit în continuare „myNextDays” sau „noi”) de către parteneri (denumit în continuare „Partener”).`,
    "Programul de parteneriat se adresează persoanelor fizice și juridice cu sediul în UE, Elveția sau Regatul Unit, care recomandă afaceri (proprietari, agenții, hoteluri) pe myNextDays.",
  ],
  sections: [
    {
      heading: "§ 1 Participare și aprobare",
      paragraphs: [
        "Participarea necesită o cerere prin intermediul tabloului de bord al partenerului. Informațiile obligatorii sunt numele sau denumirea companiei, forma juridică, țara, cel puțin un cont de social media cu adresă, nume de utilizator și acoperire, precum și, în cazul companiilor, numărul de identificare fiscală.",
        "myNextDays examinează personal fiecare cerere și decide liber asupra aprobării. Nu există un drept la admitere. Participarea este gratuită; un abonament myNextDays nu este o condiție prealabilă.",
        "Partenerul își menține informațiile actualizate, în special canalele, forma juridică, datele fiscale și de plată.",
        "Acoperirea indicată este inițial o autodeclarație. Partenerul își poate conecta voluntar conturile YouTube, Instagram, Facebook și TikTok; atunci urmăritorii și vizualizările vor fi citite de pe platformă și afișate ca verificate. Acoperirea neverificată va fi ponderată mai puțin la aprobare și la verificările ulterioare. Conexiunea poate fi deconectată oricând în tabloul de bord; detalii despre prelucrare sunt disponibile în politica de confidențialitate.",
      ],
    },
    {
      heading: "§ 2 Atribuirea afacerilor (Atribuire)",
      paragraphs: [
        "O afacere este atribuită Partenerului dacă se înregistrează cu codul de recomandare al Partenerului. Codul este afișat vizibil afacerii la înregistrare și confirmat prin trimitere. Nu sunt setate cookie-uri de urmărire.",
        "O afacere este atribuită unui singur Partener; relevant este codul confirmat la înregistrare. O reatribuire ulterioară se face numai de către myNextDays în cazul unei erori dovedite.",
        "Nu sunt atribuite afacerile Partenerului însuși, ale asociaților săi, angajaților sau rudelor, precum și afacerile care sunt sau au fost deja clienți myNextDays.",
      ],
    },
    {
      heading: "§ 3 Comision pentru clienții proprii",
      paragraphs: [
        "Baza de comision este venitul net din abonamente al afacerii atribuite (tarif de bază și module) din facturile plătite — fără TVA, fără comisioane de portal, servicii suplimentare, recalculări și alte elemente tranzitorii.",
        "Rata comisionului depinde de rangul partenerului la momentul plății. Rangurile și ratele sunt publicate pe pagina programului. Rangul se determină în funcție de numărul de clienți plătitori din structura partenerului: proprii săi clienți plătitori și clienții plătitori ai partenerilor săi de echipă (§ 4), fiecare client o singură dată. Rangul se stabilește lunar la data de referință; o promovare este valabilă imediat, o retrogradare doar dacă numărul a fost sub prag la două date de referință consecutive.",
        "Dacă partenerul atinge pentru prima dată un rang începând cu „Aufsteiger”, primește o singură dată bonusul de promovare indicat pentru acest rang pe pagina programului (în prezent 50,00 EUR per rang, pentru toți partenerii în Euro). Fiecare rang este remunerat o singură dată, chiar și după retrogradare și o nouă promovare. Bonusul este supus ferestrei de rambursare conform § 7.",
        "Comisionul se generează pentru fiecare operațiune timp de douăsprezece luni de la prima factură de abonament plătibilă; o perioadă de testare gratuită intermediată de partener și o lună gratuită nu se iau în considerare. Dacă abonamentul se încheie mai devreme, comisionul se încheie cu ultima factură plătită.",
        "Începând cu rangul „Elite-Partner”, partenerul primește suplimentar un supercomision în valoarea indicată pe pagina programului (în prezent 2,5 %) din cifra de afaceri netă a abonamentelor tuturor clienților din structura sa — proprii clienți și clienții partenerilor săi de echipă — fără limita de douăsprezece luni, atâta timp cât clientul respectiv deține un abonament plătitor și partenerul deține rangul la momentul plății. Acesta se generează pe lângă comisionul conform alineatului 2 și § 4.",
        "Pentru fiecare rezervare primită și plătită prin myBestDays de la o operațiune atribuită partenerului sau unuia dintre partenerii săi de echipă, partenerul primește o cotă din rezervare în valoarea indicată pe pagina programului (în prezent 0,5 %) din suma rezervării plătită de oaspete în moneda rezervării, fără limită de timp, atâta timp cât atribuirea există. Garanțiile nu sunt o sumă de rezervare. Rambursările către oaspete reduc proporțional cota (§ 7).",
      ],
    },
    {
      heading: "§ 4 Comision de echipă",
      paragraphs: [
        "Începând cu rangul „Aufsteiger”, un partener poate conduce parteneri de echipă. Dacă un alt partener se înscrie prin linkul de echipă al partenerului și confirmă vizibil codul acestuia în cererea sa, acesta va fi atribuit echipei partenerului (denumit în continuare „Sponsor”) după aprobarea sa. Dacă Sponsorul nu deține rangul la momentul cererii, cererea rămâne valabilă, dar nu se creează o atribuire de echipă.",
        "Sponsorul primește din cifra de afaceri netă a abonamentelor clienților partenerilor săi de echipă un comision de echipă în valoarea diferenței dintre propria sa rată de comision și rata de comision a partenerului de echipă, fiecare conform rangului la momentul plății. Dacă ambii sunt în același rang sau partenerul de echipă este mai sus, nu se generează comision de echipă. Comisionul partenerului de echipă și comisionul de echipă al Sponsorului nu depășesc niciodată împreună cea mai mare rată a grilei (în prezent 30 %).",
        "Comisionul de echipă există exact la un nivel adâncime: partenerii de echipă nu primesc comision de echipă pentru partenerii pe care îi recrutează ei înșiși. Nu se plătește nicio remunerație pentru recrutarea unui partener; nu se percepe o taxă de participare. Comisionul de echipă provine exclusiv din veniturile din abonamente plătite.",
        "Comisionul de echipă se aplică pentru fiecare client de echipă timp de douăsprezece luni de la prima factură plătită a acestuia, este supus aceleiași perioade de rambursare și este anulat proporțional în caz de rambursare sau stornare (§ 7). Acesta se generează numai atâta timp cât sponsorul și partenerul de echipă sunt aprobați; în caz contrar, este suspendat până la clarificare.",
        "Alocarea echipei este unică. O modificare se face numai de către myNextDays cu un motiv documentat.",
      ],
    },
    {
      heading: "§ 5 Obligațiile partenerului și etichetarea",
      paragraphs: [
        "Partenerul etichetează fiecare recomandare cu linkul sau codul său ca publicitate — la începutul postării, în limba postării, în conformitate cu cerințele țării sale (în Germania, printre altele, § 5a alin. 4 UWG, în Danemarca markedsføringsloven § 6 alin. 4). myNextDays pune la dispoziție formulările pentru fiecare țară în tabloul de bord al partenerului.",
        "Partenerul face referire la myNextDays numai cu informații care corespund descrierilor de servicii publicate și nu face promisiuni în numele myNextDays. Sunt interzise în special promisiunile de succes și garanțiile (de exemplu, „ocupare garantată în trei zile”) precum și declarațiile privind veniturile care nu rezultă din descrierile de servicii publicate.",
        "Fiecare videoclip și fiecare postare care menționează myNextDays sau care conține linkul partenerului va fi prezentată spre verificare în tabloul de bord al partenerului sub formă de fișier înainte de publicare. Linkul partenerului se generează numai după aprobarea scrisă de către myNextDays; publicarea fără aprobare este interzisă. myNextDays poate revoca o aprobare; comisioanele deja generate rămân neafectate.",
        "Pentru logo-uri, capturi de ecran, B-Roll, suprapuneri și capturi de ecran, partenerul utilizează exclusiv materialul publicitar furnizat de myNextDays. Înregistrările software proprii, neverificate, nu sunt permise.",
      ],
    },
    {
      heading: "§ 6 Practici interzise",
      paragraphs: ["Sunt interzise în special:"],
      list: [
        "Brand-Bidding: anunțuri plătite pentru marca „myNextDays”, variante de scriere și combinații (de exemplu, „myNextDays Preise”) în motoarele de căutare și rețele;",
        "Cookie-Dropping, redirecționări ascunse, iFrames, apelarea automată a linkului partenerului sau alte manipulări tehnice ale alocării;",
        "Auto-promovare: înregistrarea propriilor afaceri, a asociaților, angajaților sau rudelor prin propriul cod sau codul unui partener de echipă;",
        "Audiență cumpărată (urmăritori cumpărați, ferme de clicuri, trafic de bot) precum și stimulente pentru afaceri pentru înregistrare (rambursări, cadouri, concursuri);",
        "Promisiuni de recrutare: recrutarea de parteneri cu promisiuni de câștig care nu provin din veniturile din abonamente plătite, sau prezentarea programului ca sursă de venit prin recrutarea de noi parteneri;",
        "Spam, publicitate directă neautorizată și utilizarea mărcilor sau conținutului terților fără drept.",
      ],
    },
    {
      heading: "§ 7 Fereastra de rambursare, retragere, reținere",
      paragraphs: [
        "Fiecare linie de comision este deschisă timp de 30 de zile (fereastra de rambursare) după generare și este plătibilă ulterior. În cazul în care o factură subiacentă este rambursată integral sau parțial sau este supusă unei stornări (chargeback), comisionul — inclusiv un comision de echipă bazat pe acesta — va fi retras proporțional, chiar și după plată, prin compensare cu comisioanele viitoare.",
        "În cazul suspiciunii unei încălcări a § 2, § 5 sau § 6, myNextDays poate suspenda alocările și comisioanele până la clarificare. Dacă încălcarea este confirmată, comisioanele afectate vor fi anulate.",
      ],
    },
    {
      heading: "§ 8 Plată și creditare",
      paragraphs: [
        "Comisioanele plătibile sunt grupate lunar pe monedă și plătite odată ce ating suma minimă specificată pe pagina programului sau în tabloul de bord pentru moneda respectivă. Nu are loc nicio conversie între monede.",
        "Decontarea se face prin procedura de creditare (autofacturare, momsloven § 52a): myNextDays emite o notă de credit pentru fiecare plată; Partenerul nu emite o factură. Partenerul este de acord cu procedura de creditare.",
        "Întreprinderile primesc nota de credit cu o mențiune privind obligația fiscală a beneficiarului serviciului (taxare inversă); condiția prealabilă este un număr de identificare fiscală valid și confirmat. Persoanele fizice primesc nota de credit fără TVA și își impozitează singure comisionul.",
        "Plata se efectuează prin transfer SEPA, Wise sau PayPal către datele introduse de Partener în tabloul de bord.",
      ],
    },
    {
      heading: "§ 9 Date și acces",
      paragraphs: [
        "Partenerul vede unitățile alocate pseudonim (număr, țară, stare, sume). Numele, adresele de e-mail sau datele de rezervare ale unităților nu sunt divulgate. Un sponsor vede numele sau denumirea companiei, rangul, numărul de clienți plătitori și comisionul de echipă rezultat de la partenerii săi de echipă, dar nu și detaliile clienților.",
        "Pentru conturile conectate și postările create, myNextDays vede urmăritorii, vizualizările, interacțiunile, precum și clicurile și clienții per postare. Anomaliile (cum ar fi o creștere bruscă a urmăritorilor fără vizualizări corespunzătoare sau o abatere semnificativă între auto-declarație și valoarea verificată) sunt indicii pentru o verificare personală conform § 6 și § 10, nu o blocare automată.",
        "Prelucrarea datelor cu caracter personal în cadrul programului de parteneriat este descrisă în politica de confidențialitate.",
      ],
    },
    {
      heading: "§ 10 Durată, blocare și reziliere",
      paragraphs: [
        "Participarea este pe termen nelimitat și poate fi reziliată de ambele părți în orice moment, în formă text. Comisioanele deja generate și plătibile vor fi plătite conform § 8; după reziliere nu se vor genera noi comisioane.",
        "myNextDays poate bloca Partenerul în cazul încălcării acestor condiții. Pe durata blocării, comisioanele sunt suspendate; în cazul unei încălcări confirmate, acestea sunt anulate.",
      ],
    },
    {
      heading: "§ 11 Modificări",
      paragraphs: [
        "myNextDays poate modifica aceste condiții și nivelurile cu efect pentru viitor. Modificările vor fi publicate în tabloul de bord al partenerului și pe această pagină cu numărul versiunii; în cazul modificărilor substanțiale, partenerul va fi solicitat să își dea din nou acordul. Comisioanele deja generate rămân neafectate.",
      ],
    },
    {
      heading: "§ 12 Legea aplicabilă",
      paragraphs: [
        "Se aplică dreptul danez, cu excepția normelor de conflict de legi. Dispozițiile imperative privind protecția consumatorilor din statul în care un partener privat își are reședința obișnuită rămân neafectate.",
      ],
    },
  ],
};
