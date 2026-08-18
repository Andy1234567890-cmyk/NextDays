import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Pritožbe in reševanje sporov",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "Ta stran opisuje, kako dosežete myBestDays, kako obravnavamo pritožbe in katere poti so vam na voljo, če se z našo odločitvijo ne strinjate.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. Kako nas dosežete",
      paragraphs: [
        "Najhitreje nas dosežete prek centra za pomoč in tam navedenih kontaktnih poti. Za obstoječo rezervacijo uporabite funkcijo sporočil v svojem računu — takrat imamo rezervacijo in zgodovino že na voljo.",
        `Pisno nas dosežete na ${ANBIETER.email} ali ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danska; po telefonu na ${ANBIETER.telefon}.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. Kaj naj vsebuje vaša pritožba",
      paragraphs: ["Da lahko hitro pomagamo, prosimo navedite:"],
      list: [
        "svojo številko rezervacije in e-naslov, uporabljen za rezervacijo;",
        "kratek opis težave;",
        "kakšno rešitev si želite;",
        "pripadajoča dokazila — fotografije, sporočila, potrdila, izpiske računa.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. Kako obravnavamo",
      paragraphs: [
        "Vsaka pritožba se zabeleži in prejme opravilno številko, pod katero lahko spremljate stanje.",
        "Prejem nemudoma potrdimo in vsebinsko odgovorimo praviloma v sedmih dneh. Če je potrebna daljša presoja, vam sporočimo vmesno stanje.",
        "Pritožbe, pri katerih so osebe ogrožene ali je prihod tik pred vrati, obravnavamo prednostno.",
        "Svojo odločitev obrazložimo in navedemo podlago, na kateri temelji.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Pritožba zoper naš ukrep",
      paragraphs: [
        "Če smo odstranili vsebino, omejili njeno vidnost, odpovedali rezervacijo ali blokirali račun, lahko zoper to v šestih mesecih brezplačno vložite pritožbo. To ustreza členu 20 Uredbe (EU) 2022/2065.",
        "Pritožbo presojajo ljudje, ne izključno avtomatizirani postopki. Če se izkaže za utemeljeno, ukrep umaknemo.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Izvensodno reševanje sporov",
      paragraphs: [
        "Platforma Evropske komisije za spletno reševanje sporov je bila razveljavljena z Uredbo (EU) 2024/3228 in je prenehala delovati. Prek nje pritožb ni več mogoče vlagati.",
        "Nismo dolžni in nismo pripravljeni sodelovati v postopku reševanja sporov pred organom za izvensodno reševanje potrošniških sporov.",
        `Neodvisno od tega se lahko kot potrošnik obrnete na pristojni danski organ: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Danska ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Če prebivate v drugi državi članici, vam pomaga Evropski potrošniški center v vaši državi.`,
        "Če se spor nanaša na ukrep, ki smo ga sprejeli zoper vašo vsebino ali račun, se lahko dodatno obrnete na organ za izvensodno reševanje sporov, certificiran po členu 21 Uredbe (EU) 2022/2065. Njegove odločitve za nas niso zavezujoče in k sodelovanju v takih postopkih nismo zavezani.",
      ],
    },
    {
      id: "gericht",
      heading: "6. Sodna pot",
      paragraphs: [
        "Pot do sodišč vam je kadar koli na voljo, tudi brez predhodnega pritožbenega postopka. Katera sodišča so pristojna, je navedeno v razdelku A19 [Pogojev uporabe](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand).",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Pritožbe ponudnikov",
      paragraphs: [
        "Ponudniki lahko po istem postopku vlagajo pritožbe glede uporabe teh pogojev, glede odločitev o razvrščanju in glede omejitev njihove ponudbe. To ustreza členu 11 Uredbe (EU) 2019/1150.",
        "O številu, predmetu in povprečnem trajanju obravnave takih pritožb poročamo letno; poročilo je na voljo v razdelku [Akt o digitalnih storitvah](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
  ],
};
