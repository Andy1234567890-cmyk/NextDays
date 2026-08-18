import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Plângeri și soluționarea litigiilor",
  stand: "Actualizat: 18 august 2026",
  intro: [
    "Această pagină descrie cum ne puteți contacta, cum prelucrăm plângerile și ce căi vă stau la dispoziție dacă nu sunteți de acord cu decizia noastră.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. Cum ne găsiți",
      paragraphs: [
        "Cel mai rapid ne găsiți prin centrul de ajutor și căile de contact indicate acolo. Pentru o rezervare existentă utilizați funcția de mesaje din contul dumneavoastră — atunci dispunem deja de rezervare și de istoric.",
        `În scris ne găsiți la ${ANBIETER.email} sau ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danemarca; telefonic la ${ANBIETER.telefon}.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. Ce ar trebui să conțină plângerea dumneavoastră",
      paragraphs: ["Pentru a putea ajuta rapid, vă rugăm să indicați:"],
      list: [
        "numărul rezervării dumneavoastră și adresa de e-mail folosită pentru rezervare;",
        "o scurtă descriere a problemei;",
        "ce soluție doriți;",
        "dovezile aferente — fotografii, mesaje, chitanțe, extrase de cont.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. Cum prelucrăm",
      paragraphs: [
        "Fiecare plângere este înregistrată și primește un număr de dosar, cu care puteți urmări stadiul.",
        "Confirmăm primirea fără întârziere și răspundem pe fond, de regulă, în termen de șapte zile. Dacă este necesară o verificare mai îndelungată, vă comunicăm stadiul intermediar.",
        "Plângerile în care sunt puse în pericol persoane sau este iminentă o sosire le tratăm cu prioritate.",
        "Decizia noastră o motivăm și indicăm temeiul pe care se sprijină.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Plângere împotriva unei măsuri a noastră",
      paragraphs: [
        "Dacă am eliminat conținut, i-am restrâns vizibilitatea, am anulat o rezervare sau am blocat un cont, puteți depune împotriva acestora gratuit plângere în termen de șase luni. Aceasta corespunde articolului 20 din Regulamentul (UE) 2022/2065.",
        "Plângerea este examinată de oameni, nu exclusiv de procedee automatizate. Dacă se dovedește întemeiată, retragem măsura.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Soluționarea extrajudiciară a litigiilor",
      paragraphs: [
        "Platforma Comisiei Europene de soluționare online a litigiilor a fost abrogată prin Regulamentul (UE) 2024/3228 și și-a încetat activitatea. Prin ea nu mai pot fi depuse plângeri.",
        "Nu suntem obligați și nici dispuși să participăm la o procedură de soluționare a litigiilor în fața unui organism de soluționare alternativă a litigiilor cu consumatorii.",
        `Independent de aceasta, în calitate de consumator vă puteți adresa organismului danez competent: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Danemarca ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Dacă locuiți în alt stat membru, vă ajută Centrul European al Consumatorilor din țara dumneavoastră.`,
        "Dacă litigiul privește o măsură pe care am luat-o împotriva conținutului sau contului dumneavoastră, vă puteți adresa suplimentar unui organism de soluționare extrajudiciară a litigiilor certificat conform articolului 21 din Regulamentul (UE) 2022/2065. Deciziile acestuia nu sunt obligatorii pentru noi și nu suntem obligați să participăm la astfel de proceduri.",
      ],
    },
    {
      id: "gericht",
      heading: "6. Calea judiciară",
      paragraphs: [
        "Calea către instanțe vă stă oricând la dispoziție, chiar și fără o procedură prealabilă de plângere. Ce instanțe sunt competente este indicat în secțiunea A19 din [Condițiile de utilizare](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand).",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Plângerile furnizorilor",
      paragraphs: [
        "Furnizorii pot depune prin aceeași procedură plângeri privind aplicarea prezentelor condiții, privind deciziile de clasare și privind restricțiile asupra ofertei lor. Aceasta corespunde articolului 11 din Regulamentul (UE) 2019/1150.",
        "Cu privire la numărul, obiectul și durata medie de soluționare a unor astfel de plângeri raportăm anual; raportul este disponibil în [Actul privind serviciile digitale](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
  ],
};
