import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politika ob hudih motnjah",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "Včasih potovanje ali bivanje prepreči dogodek, za katerega nista kriva ne gost ne ponudnik. Ta politika opisuje, kateri dogodki so to in kaj takrat velja.",
    "Ima prednost pred pogojem odpovedi, izbranim v oglasu.",
  ],
  sections: [
    {
      id: "erfasst",
      heading: "1. Kateri dogodki so zajeti",
      paragraphs: [
        "Zajeti so dogodki, ki nastopijo po rezervaciji, sta jih obe strani nista mogli predvideti in ki potovanje ali bivanje onemogočijo oziroma pravno nedopustno:",
      ],
      list: [
        "uradne prepovedi potovanja ali bivanja, policijske ure in zaprtja meja, ki zadevajo ciljni kraj ali kraj izvora;",
        "naravne nesreče in naravni pojavi, ki zadevajo ciljni kraj — potres, poplava, neurje, velik požar, vulkanski izbruh;",
        "vojna, oboroženi spopadi, teroristični napadi in nemiri v ciljnem kraju;",
        "uradno ugotovljena epidemija ali pandemija z ukrepi, ki bivanje prepovedujejo;",
        "izpad oskrbe z elektriko, vodo ali toploto v ciljnem kraju za daljše obdobje;",
        "popolna nezmožnost prihoda v ciljni kraj zaradi enega od navedenih dogodkov.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "2. Kateri dogodki niso zajeti",
      paragraphs: ["Zajeti niso zlasti:"],
      list: [
        "bolezen ali poškodba gosta oziroma njegovih svojcev — za to je predvideno potovalno zavarovanje;",
        "službena zadržanost, izpitni roki ali odpad dopusta;",
        "odpoved prireditve, zaradi katere je bilo potovanje rezervirano, če nastanitev ostaja uporabna;",
        "vreme, ki ne predstavlja naravne nesreče — dež, mraz, vročina, pomanjkanje snega;",
        "izpad posameznih prevoznih sredstev, dokler ostaja mogoč razumen prihod;",
        "odpoved leta ali stavka pri prevozniku — za to obstajajo zahtevki do prevoznika.",
      ],
    },
    {
      id: "folgen",
      heading: "3. Kaj velja, ko nastopi zajeti dogodek",
      paragraphs: [
        "Če dogodek zadeva obdobje vaše rezervacije, lahko brezplačno odpoveste. Znesek, plačan prek Platforme, prejmete v celoti povrnjen.",
        "Če je bivanje že nastopilo, povrnemo delež za noči, ki jih ni več mogoče uporabiti.",
        "Ponudniku iz take odpovedi ne nastanejo slabosti pri oceni njegove zanesljivosti.",
        "Kot alternativo se s ponudnikom lahko dogovorite za prestavitev; pomagamo pri prerezervaciji.",
      ],
    },
    {
      id: "geltendmachung",
      heading: "4. Kako se nanjo sklicujete",
      paragraphs: [
        "Oglasite se prek kontaktnih poti v razdelku [Pritožbe in reševanje sporov](https://mybestdays.dk/rechtliches/beschwerden) ter navedite številko rezervacije in dogodek.",
        "Preverjamo na podlagi javno dostopnih virov — uradnih odredb, uradnih opozoril, poročil priznanih novičarskih virov — in odločimo hitro.",
        "Če stanja še ni mogoče dokončno oceniti, počakamo na razvoj do kratko pred dnevom prihoda in nato odločimo. Vaša rezervacija do tedaj ostane nespremenjena.",
      ],
    },
  ],
};
