import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politika prerezervacije in vračila",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "Ta politika se uporabi, kadar pri nastanitvi, rezervirani prek myBestDays, nekaj temeljno ni v redu — je torej zaveza, ki presega pogoj odpovedi ponudnika.",
    "Velja za rezervacije, sklenjene in plačane prek Platforme.",
  ],
  sections: [
    {
      id: "wann",
      heading: "1. Kdaj se ta politika uporabi",
      paragraphs: [
        "Uporabi se, kadar pred bivanjem ali med njim nastopi eden od naslednjih dogodkov:",
      ],
      list: [
        "Ponudnik odpove rezervacijo.",
        "Ponudnik ob prihodu ni dosegljiv ali ne prejmete dostopa do nastanitve.",
        "Nastanitev ni primerna za bivanje — na primer zaradi manjkajočega ogrevanja v mrazu, manjkajoče tekoče vode, nezadostne čistoče ali nevarnosti za zdravje.",
        "Nastanitev bistveno odstopa od oglasa — drugačno število ležišč ali prostorov, drug kraj, v oglasu obljubljena in dejansko manjkajoča osrednja oprema.",
        "V nastanitvi biva dodaten gost, ki ni bil napovedan.",
      ],
    },
    {
      id: "was-sie-tun",
      heading: "2. Kaj morate storiti",
      paragraphs: [
        "Težavo prijavite čim prej, najpozneje pa 24 ur po ugotovitvi — pri težavah ob prihodu torej na dan prihoda.",
        "Prijavite jo najprej ponudniku prek funkcije sporočil in mu dajte priložnost, da jo odpravi. Ob nevarnosti za vaše zdravje ali če ponudnik ni dosegljiv, ta obveznost odpade.",
        "Težavo, kolikor je mogoče, dokažite s fotografijami, videoposnetki ali sporočili. Brez dokazil dejanskega stanja pogosto ne moremo ugotoviti.",
      ],
    },
    {
      id: "was-wir-tun",
      heading: "3. Kaj storimo mi",
      paragraphs: [
        "Če se težava potrdi, imate izbiro med primerljivo nadomestno nastanitvijo in vračilom.",
        "Če izberete nadomestno nastanitev, prevzamemo razliko v ceni glede na vašo prvotno rezervacijo, kolikor je nadomestna nastanitev primerljiva po legi, opremi in velikosti.",
        "Če izberete vračilo, pri težavi pred prihodom povrnemo celoten znesek, plačan prek Platforme. Če težava nastopi med bivanjem, povrnemo delež za neuporabne noči ter primeren znesek za oteženo bivanje v že preživetih nočeh.",
        "O naši odločitvi vas obvestimo z obrazložitvijo. Lahko jo daste v ponovno presojo po poti, opisani v razdelku [Pritožbe in reševanje sporov](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "4. Kaj ni zajeto",
      paragraphs: ["Ta politika se ne uporabi pri:"],
      list: [
        "okoliščinah, ki so bile opisane v oglasu ali razvidne s fotografij;",
        "neznatnih odstopanjih, ki ne vplivajo na uporabo (na primer druga barva stene ali drug kavč);",
        "začasnih motnjah, ki jih ponudnik odpravi v primernem roku;",
        "okoliščinah izven nastanitve, na katere ponudnik nima vpliva — vreme, promet, občinska gradbišča, zaprtje znamenitosti (za te velja [Politika ob hudih motnjah](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen));",
        "težavah, ki ste jih povzročili vi ali vaši sopotniki;",
        "rezervacijah, sklenjenih ali plačanih izven Platforme.",
      ],
    },
    {
      id: "verhaeltnis",
      heading: "5. Razmerje do vaših zakonskih pravic",
      paragraphs: [
        "Ta politika je prostovoljna zaveza myBestDays. Vaši zakonski zahtevki do ponudnika — zlasti znižanje cene in odškodnina — s tem niso prizadeti in lahko sežejo dlje.",
        "Kolikor vam povrnemo, ustrezni zahtevki do ponudnika preidejo na nas.",
      ],
    },
  ],
};
