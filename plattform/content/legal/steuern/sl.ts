import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Davčna politika",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "Ta stran pojasnjuje, kateri davki in dajatve lahko nastanejo pri rezervaciji prek myBestDays, kdo jih dolguje in katere obveznosti poročanja imamo mi kot upravljavec platforme.",
    "To ni davčno svetovanje. Za davčno obravnavo v posameznem primeru se obrnite na davčnega svetovalca.",
  ],
  sections: [
    {
      id: "gaeste",
      heading: "1. Kar zadeva goste",
      paragraphs: [
        "Prikazana skupna cena vsebuje davke, ki se obračunajo prek Platforme — zlasti DDV na nastanitveno storitev, kolikor ga dolguje ponudnik.",
        "Krajevne dajatve, kot so turistična taksa, davek na prenočitev ali turistična pristojbina, se glede na občino bodisi obračunajo prek Platforme bodisi pobirajo na kraju samem. Kateri primer velja, navedemo pred zaključkom rezervacije.",
        "Račun za nastanitveno storitev izda ponudnik; on je izvajalec kot podjetnik. Če potrebujete račun z izkazanim DDV, ga zahtevajte pri ponudniku.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Kar zadeva ponudnike",
      paragraphs: [
        "Ponudniki so sami odgovorni za pravilno davčno obravnavo svojih dohodkov — dohodnina ali davek od dohodkov pravnih oseb, DDV in krajevne dajatve.",
        "Ali je oddajanje predmet DDV in katera stopnja velja, se ravna po pravu države, v kateri je nastanitev (kraj opravljanja pri nepremičninah).",
        "Ponudniki dajatve, ki veljajo za njihovo nastanitev, vnesejo v objekt, da se v oglasu pravilno prikažejo.",
      ],
    },
    {
      id: "dac7",
      heading: "3. Poročanje davčnim organom (DAC7)",
      paragraphs: [
        "Kot upravljavec digitalne platforme smo po Direktivi (EU) 2021/514 (»DAC7«) in nacionalnih predpisih za njen prenos dolžni pristojnemu davčnemu organu letno poročati podatke o ponudnikih, o katerih se poroča, in o njihovih prek Platforme doseženih prejemkih.",
        "Poročajo se zlasti ime, naslov, davčna identifikacijska številka, datum rojstva ali matična številka, podatki o računu za izplačilo, naslov nastanitve in po četrtletjih izplačani prejemki ter zadržane pristojbine.",
        "Ponudniki prejmejo kopijo poročanih podatkov, ki se nanašajo nanje.",
        "Če ponudnik kljub dvakratnemu pozivu ne zagotovi podatkov, potrebnih za poročanje, smo dolžni zadržati izplačila in blokirati račun.",
      ],
    },
    {
      id: "quellensteuer",
      heading: "4. Odtegljaji",
      paragraphs: [
        "Če nas pravo posamezne države zavezuje, da od izplačila odtegnemo in odvedemo davke, to storimo in odtegljaj prikažemo v obračunu.",
      ],
    },
  ],
};
