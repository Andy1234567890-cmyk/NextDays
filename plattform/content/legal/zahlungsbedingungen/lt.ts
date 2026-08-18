import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Mokėjimo sąlygos",
  stand: "Atnaujinta: 2026 m. rugpjūčio 18 d.",
  intro: [
    "Šios mokėjimo sąlygos reglamentuoja, kaip vykdomi mokėjimai, susiję su rezervacija per myBestDays. Jos papildo [Naudojimosi sąlygas svečiams](https://mybestdays.dk/rechtliches/nutzungsbedingungen); esant prieštaravimams mokėjimo klausimais pirmenybė teikiama šioms mokėjimo sąlygoms.",
  ],
  sections: [
    {
      id: "rolle",
      heading: "1. Mūsų vaidmuo mokėjime",
      paragraphs: [
        "myBestDays vykdo mokėjimus teikėjo vardu. Nesame mokėjimo įstaiga ir nesame elektroninių pinigų įstaiga; pačią mokėjimo paslaugą teikia mūsų mokėjimo paslaugų teikėjas.",
        "Mokėjimus per Platformą vykdo Stripe (Stripe Payments Europe, Limited). Kortelių duomenis ir kitus mokėjimo duomenis tiesiogiai renka ir tvarko Stripe. myBestDays nesaugo visų kortelės duomenų.",
        "Jei mokate per Platformą, Jūsų mokėjimo pareiga teikėjui sumokėtos sumos apimtimi laikoma įvykdyta, kai tik mūsų mokėjimo paslaugų teikėjas mokėjimą sėkmingai autorizuoja ir nurašo.",
      ],
    },
    {
      id: "zahlungsarten",
      heading: "2. Mokėjimo būdai",
      paragraphs: [
        "Kokie mokėjimo būdai prieinami, priklauso nuo skelbimo, teikėjo šalies ir Jūsų šalies. Prieinami mokėjimo būdai Jums parodomi prieš užbaigiant rezervaciją.",
        "Tam tikriems mokėjimo būdams reikalingas griežtas kliento autentiškumo patvirtinimas pagal Direktyvą (ES) 2015/2366. Be sėkmingo patvirtinimo mokėjimo įvykdyti negalima.",
      ],
    },
    {
      id: "faelligkeit",
      heading: "3. Terminas, avansas ir likutis",
      paragraphs: [
        "Kada kuri suma tampa mokėtina, nustato teikėjas skelbime. Įprasti yra trys modeliai: visas mokėjimas rezervuojant, avansas rezervuojant su likučiu prieš atvykstant arba mokėjimas vietoje pas teikėją.",
        "Jūsų rezervacijai taikomas modelis ir mokėjimo terminai parodomi prieš užbaigiant rezervaciją ir pakartojami rezervacijos patvirtinime.",
        "Prieš likučio terminą primename Jums nurodytu el. pašto adresu. Jei likutis nesumokamas, teikėjas pagal savo atšaukimo sąlygas gali nuo sutarties atsisakyti.",
      ],
    },
    {
      id: "waehrung",
      heading: "4. Valiuta",
      paragraphs: [
        "Apskaičiuojama skelbimo valiuta. Ši valiuta nurodoma prie kiekvienos kainos ir mokėjimo procese.",
        "Jei suma Jums rodoma ir kita valiuta, tai neįpareigojantis perskaičiavimas orientacijai, o ne įpareigojanti kaina.",
        "Jei Jūsų mokėjimo paslaugų teikėjas konvertuoja į kitą valiutą arba taiko užsienio operacijos mokestį, šias išlaidas padengiate Jūs. Jos nėra bendros kainos dalis ir jų nei nustatome, nei gauname mes.",
      ],
    },
    {
      id: "kaution",
      heading: "5. Užstatas",
      paragraphs: [
        "Jei skelbimas numato užstatą, jo dydis nurodomas prieš užbaigiant rezervaciją.",
        "Priklausomai nuo skelbimo, užstatas Jūsų mokėjimo priemonėje iš anksto autorizuojamas (suma rezervuojama, bet nenurašoma) arba nurašomas. Išankstinis autorizavimas gali laikinai sumažinti Jūsų kortelės prieinamą limitą.",
        "Po viešnagės išankstinis autorizavimas atlaisvinamas arba nurašytas užstatas grąžinamas, jei teikėjas nereiškia žalos. Jei teikėjas reiškia žalą, jis turi ją pagrįsti; dėl pagrįstumo sprendžia santykis tarp Jūsų ir teikėjo.",
        "Jei teikėjas užstato vietoj to reikalauja vietoje, tai yra išlaidų vietoje pozicija ir per Platformą netvarkoma.",
      ],
    },
    {
      id: "rueckerstattungen",
      heading: "6. Grąžinimai",
      paragraphs: [
        "Grąžinimai atliekami į mokėjimo priemonę, naudotą mokėjimui, nebent susitarta kitaip arba tai techniškai neįmanoma.",
        "Grąžinimą inicijuojame nedelsdami, kai tik nustatoma jo priežastis. Kiek laiko užtruks, kol įskaitymas taps matomas Jūsų sąskaitoje ar kortelėje, nustato Jūsų mokėjimo paslaugų teikėjas; įprastai penkios–dešimt bankinių darbo dienų.",
        "Ar ir kokio dydžio yra teisė į grąžinimą, priklauso nuo [Atšaukimo sąlygų](https://mybestdays.dk/rechtliches/stornierungsbedingungen) ir [Perrezervavimo ir grąžinimo politikos](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "fehlgeschlagene-zahlungen",
      heading: "7. Nepavykę mokėjimai ir atšaukimai",
      paragraphs: [
        "Jei mokėjimas nepavyksta, Jus informuojame ir suteikiame galimybę įvesti kitą mokėjimo priemonę. Jei mokėjimas neįvykdomas, rezervacija gali būti atšaukta.",
        "Jei atšaukiate jau įvykdytą mokėjimą, nesant teisės į grąžinimą, teikėjas ir toliau gali reikalauti sumos. Išlaidas, kurios mums atsiranda dėl nepagrįsto atšaukimo, galime Jums pateikti apmokėti.",
        "Jei mokėjimą laikome apgaulingu, galime jį sulaikyti arba rezervaciją atšaukti. Apie tai Jus informuojame ir sprendimą pagrindžiame.",
      ],
    },
    {
      id: "belege",
      heading: "8. Dokumentai ir atsiskaitymai",
      paragraphs: [
        "Už per Platformą sumokėtas sumas pateikiame Jums dokumentą, kurį rasite savo paskyroje skiltyje „Rezervacijos“.",
        "Sąskaitą faktūrą už apgyvendinimo paslaugą išrašo teikėjas; jis yra paslaugą teikiantis verslininkas. Dėl mokesčių žr. [Mokesčių politiką](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "aenderungen",
      heading: "9. Šių mokėjimo sąlygų pakeitimai",
      paragraphs: [
        "Šių mokėjimo sąlygų pakeitimams taikomas [Naudojimosi sąlygų](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a22-aenderungen) A22 skirsnis.",
      ],
    },
  ],
};
