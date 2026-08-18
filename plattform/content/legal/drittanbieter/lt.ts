import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Tretieji teikėjai ir mokėjimo paslaugos",
  stand: "Atnaujinta: 2026 m. rugpjūčio 18 d.",
  intro: [
    "Platformos veiklai myBestDays naudoja trečiųjų šalių paslaugas. Šiame puslapyje jos įvardijamos ir paaiškinama, kokį vaidmenį jos atlieka ir kieno sąlygos kiekvienu atveju taikomos.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principas",
      paragraphs: [
        "Ten, kur trečiasis teikėjas teikia paslaugą tiesiogiai Jums, be mūsų sąlygų taikomos jo sąlygos ir jo privatumo politika. Atitinkamoje vietoje į tai atkreipiame dėmesį.",
        "Ten, kur trečiasis teikėjas tvarko duomenis tik mūsų pavedimu, mes liekame Jūsų kontaktinis asmuo. Kokius duomenų tvarkytojus pasitelkiame, nurodyta [Privatumo politikoje](https://mybestdays.dk/rechtliches/datenschutz).",
      ],
    },
    {
      id: "zahlungsdienst",
      heading: "2. Mokėjimo paslaugų teikėjas",
      paragraphs: [
        "Mokėjimus per Platformą vykdo Stripe. Stripe mokėjimo duomenis renka ir tvarko tiesiogiai ir yra jiems savarankiškas duomenų valdytojas. Papildomai taikoma [Stripe privatumo politika](https://stripe.com/privacy).",
        "Išmokėjimui šeimininkams Stripe atlieka teisės aktų nustatytą tapatybės patikrą.",
      ],
    },
    {
      id: "psd2",
      heading: "3. Mokėjimo paslaugų direktyva ir trečiųjų šalių prieiga",
      paragraphs: [
        "Direktyva (ES) 2015/2366 („PSD2“) daugeliui mokėjimų reikalauja griežto kliento autentiškumo patvirtinimo. Jį atlieka Jūsų bankas arba kortelės išdavėjas; be sėkmingo patvirtinimo mokėjimas gali būti atmestas.",
        "myBestDays nėra mokėjimo inicijavimo ar sąskaitos informacijos paslauga ir neturi prieigos prie Jūsų banko sąskaitų.",
      ],
    },
    {
      id: "karten-und-inhalte",
      heading: "4. Žemėlapiai, vaizdai ir įterptasis turinys",
      paragraphs: [
        "Žemėlapiams ir vietos duomenims įterpiame trečiųjų šalių žemėlapių paslaugas. Įkeliant tokį turinį duomenys gali būti perduoti atitinkamam teikėjui; išsamiau ir sutikimo valdymas nurodyti [Slapukų politikoje](https://mybestdays.dk/rechtliches/cookies).",
        "Skelbimų vaizdai ir aprašymai pateikiami atitinkamo teikėjo, o ne mūsų.",
      ],
    },
    {
      id: "verlinkung",
      heading: "5. Susietos svetainės",
      paragraphs: [
        "Platformoje gali būti nuorodų į trečiųjų šalių svetaines. Jų turiniui įtakos neturime ir už jį neprisiimame atsakomybės. Sužinoję apie teisės pažeidimą, nuorodą nedelsdami pašaliname.",
      ],
    },
    {
      id: "app-stores",
      heading: "6. Programėlių parduotuvės",
      paragraphs: [
        "Jei myBestDays programėlę įsigyjate per programėlių parduotuvę, papildomai taikomos atitinkamo parduotuvės operatoriaus sąlygos. Parduotuvės operatorius nėra sutarties tarp Jūsų ir mūsų šalis ir neprivalo teikti nei palaikymo, nei garantijos programėlei.",
      ],
    },
  ],
};
