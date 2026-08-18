import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Pristojbine izven platforme",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "Ta politika ureja, katere zneske sme ponudnik zahtevati izven Platforme in katerih ne. Ščiti goste pred tem, da bi se na kraju samem soočili z zahtevki, ki jih v oglasu ni bilo.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Načelo",
      paragraphs: [
        "Vse, kar je treba plačati za rezervirano storitev, mora biti pred zaključkom rezervacije navedeno v oglasu — bodisi kot del skupne cene bodisi kot postavka stroškov na kraju samem.",
        "Znesek, ki ni bil naveden ne v skupni ceni ne kot strošek na kraju samem, gost ni dolžan plačati.",
      ],
    },
    {
      id: "erlaubt",
      heading: "2. Kaj je mogoče zahtevati na kraju samem",
      paragraphs: ["Na kraju samem je mogoče zahtevati izključno:"],
      list: [
        "zneske, ki so v oglasu izrecno navedeni kot stroški na kraju samem (na primer končno čiščenje, paket perila, parkirno mesto);",
        "krajevne dajatve, kot je turistična taksa, kolikor se po krajevnih predpisih plača na kraju samem;",
        "varščino, navedeno v oglasu;",
        "storitve, ki jih gost naroči šele na kraju samem in prostovoljno, po vnaprej sporočeni ceni;",
        "povračilo dokazane škode, ki jo je povzročil gost.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "3. Česa ni mogoče zahtevati",
      paragraphs: ["Nedopustno je zlasti:"],
      list: [
        "naknadni zahtevek na ceno prenočitve po zaključku rezervacije;",
        "pristojbina za to, da je bila rezervacija opravljena prek myBestDays;",
        "obdelovalna, rezervacijska ali kartična pristojbina, ki ni bila navedena v oglasu;",
        "poziv, naj se rezervacija odpove in ista nastanitev znova rezervira izven Platforme;",
        "poziv, naj se cena ali njen del poravna z nakazilom, gotovino ali plačilno storitvijo izven Platforme, kadar oglas predvideva plačilo prek Platforme.",
      ],
    },
    {
      id: "umgehung",
      heading: "4. Obhod Platforme",
      paragraphs: [
        "Če je stik med gostom in ponudnikom nastal prek Platforme, rezervacije ni dovoljeno izvesti mimo nje. To velja za obe strani.",
        "Kdor obide Platformo, izgubi njeno zaščito: plačila niso zavarovana, naši politiki odpovedi in vračila se ne uporabljata, ob sporu pa ne moremo posredovati.",
        "Kršitve lahko vodijo do blokade računa. Pri ponudnikih lahko dodatno uveljavljamo izgubljeno storitveno pristojbino.",
      ],
    },
    {
      id: "melden",
      heading: "5. Prijava",
      paragraphs: [
        "Če od vas na kraju samem zahtevajo znesek, ki ga v oglasu ni bilo, ga ne plačajte in nam to prijavite prek kontaktnih poti v razdelku [Pritožbe in reševanje sporov](https://mybestdays.dk/rechtliches/beschwerden). Če ste že plačali, pomagamo pri izterjavi.",
      ],
    },
  ],
};
