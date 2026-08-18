import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Tinkamo turinio taisyklės",
  stand: "Atnaujinta: 2026 m. rugpjūčio 18 d.",
  intro: [
    "Šios taisyklės taikomos visam turiniui, kurį naudotojai skelbia myBestDays: skelbimams, nuotraukoms, atsiliepimams, žinutėms, profilio duomenims ir atsakymams į atsiliepimus.",
    "Jos yra [Naudojimosi sąlygų](https://mybestdays.dk/rechtliches/nutzungsbedingungen) dalis. Pažeidimas gali lemti turinio pašalinimą ir priemones prieš paskyrą.",
  ],
  sections: [
    {
      id: "nicht-erlaubt",
      heading: "1. Kas neleidžiama",
      paragraphs: ["myBestDays neleidžiamas visų pirma toks turinys:"],
      list: [
        "bet kokios rūšies neteisėtas turinys, visų pirma raginimai daryti nusikalstamas veikas, teroristinis turinys ir vaikų seksualinio išnaudojimo vaizdai;",
        "turinys, kurstantis neapykantą ar smurtą prieš asmenis ar grupes dėl kilmės, odos spalvos, religijos, įsitikinimų, lyties, lytinės tapatybės, seksualinės orientacijos, negalios ar amžiaus;",
        "įžeidimai, grasinimai, priekabiavimas ir tikslinis atskirų asmenų viešas žeminimas;",
        "trečiųjų asmenų asmens duomenys be jų sutikimo, visų pirma vardai, adresai, telefono numeriai, asmens dokumentų ar mokėjimo duomenys;",
        "klaidinantys duomenys apie apgyvendinimo vietą, jos vietą, įrangą, dydį ar prieinamumą;",
        "svetimos nuotraukos, tekstai ar prekių ženklai be reikiamų teisių;",
        "reklama, brukalas ir turinys, vedantis į kitus rezervavimo kelius už Platformos ribų;",
        "kenkėjiška programinė įranga, sukčiavimo apsimetant bandymai ir nuorodos į tokį turinį;",
        "skelbimai apie ką kita nei apgyvendinimo paslauga.",
      ],
    },
    {
      id: "fotos",
      heading: "2. Nuotraukos",
      paragraphs: [
        "Nuotraukos turi vaizduoti faktiškai siūlomą apgyvendinimo vietą ir būti padarytos tokios būklės, kuri atitinka dabartinę.",
        "Nuotraukose negali būti atpažįstamų asmenų be jų sutikimo. Apdorojimas leidžiamas tiek, kiek jis neiškraipo įspūdžio apie apgyvendinimo vietą – pašviesinimas taip, retušuotas kaimyninis pastatas ne.",
        "Vaizdo stebėjimas apgyvendinimo vietoje turi būti atskleistas skelbime. Vidaus patalpose, kuriose svečiai pagrįstai tikisi privatumo – miegamuosiuose, vonios kambariuose – kameros neleidžiamos, net išjungtos.",
      ],
    },
    {
      id: "melden",
      heading: "3. Pranešimas apie turinį",
      paragraphs: [
        "Jei turinį laikote neteisėtu arba pažeidžiančiu šias taisykles, galite apie jį pranešti per pranešimo funkciją prie kiekvieno skelbimo, kiekvieno atsiliepimo ir kiekvienos žinutės.",
        "Pranešimo procedūra pagal Reglamento (ES) 2022/2065 16 straipsnį ir pranešimų nagrinėjimas aprašyti skiltyje [Skaitmeninių paslaugų aktas](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "durchsetzung",
      heading: "4. Kaip taisykles taikome",
      paragraphs: [
        "Kiekvieną praneštą turinį patikriname ir renkamės švelniausią tinkamą priemonę: įspėjimą, atitinkamos dalies pašalinimą, viso turinio pašalinimą, matomumo apribojimą, funkcijos blokavimą arba paskyros blokavimą.",
        "Pakartotiniai ar sunkūs pažeidimai sveria daugiau. Esant akivaizdžiai neteisėtam turiniui ar pavojui asmenims veikiame nedelsdami.",
        "Kiekvieną priemonę pagrindžiame nukentėjusiam asmeniui ir nurodome skundo kelią. Skundą nagrinėja žmonės.",
      ],
    },
  ],
};
