import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Privaatsuspoliitika",
  stand: "Uuendatud: 18. august 2026",
  intro: [
    "Käesolev poliitika kirjeldab, milliseid isikuandmeid myBestDays töötleb, millistel eesmärkidel, millisel õiguslikul alusel ja millised õigused Teil on. See kehtib veebisaidile, mobiilirakendustele ja kõigile muudele juurdepääsudele Platvormile.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Vastutav töötleja ja andmekaitsespetsialist",
      paragraphs: [
        `Vastutav töötleja määruse (EL) 2016/679 (isikuandmete kaitse üldmäärus) tähenduses on ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Taani, CVR nr ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. Täielikud teenusepakkuja andmed on kirjas [Õiguslikus teabes](https://mybestdays.dk/rechtliches/impressum).`,
        "Andmekaitsespetsialisti ei ole määratud; üldmääruse artikli 37 tingimused ei ole täidetud. Andmekaitset puudutavad küsimused saatke ülalnimetatud e-posti aadressile.",
        "Pakkujad, kelle juures broneerite, on neile meilt edastatud andmete osas iseseisvad vastutavad töötlejad. Neile kohalduvad [Andmekaitsestandardid võõrustajatele](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
      ],
    },
    {
      id: "kategorien",
      heading: "2. Milliseid andmeid töötleme",
      paragraphs: ["Olenevalt sellest, kuidas Platvormi kasutate, töötleme:"],
      list: [
        "põhiandmeid – nimi, e-posti aadress, telefoninumber, keel ja valuuta, parool krüpteeritud kujul;",
        "broneeringu andmeid – broneeritud majutuskoht, periood, reisijate arv ja nimed, erisoovid, broneeringu olek;",
        "makseandmeid – summa, valuuta, makse olek, maksevahendi viimased numbrid ja meie makseteenuse pakkuja tehingu tunnus. Täielikud kaardiandmed meieni ei jõua;",
        "suhtlusandmeid – sõnumid Teie ja pakkuja vahel, päringud meie klienditeenindusele, kaebused;",
        "sisuandmeid – arvustused, fotod, soovinimekirjad;",
        "kasutusandmeid – külastatud lehed, otsingupäringud, juurdepääsu aeg;",
        "tehnilisi andmeid – IP-aadress, brauseri ja seadme tunnused, operatsioonisüsteem, suunav leht.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Eesmärgid ja õiguslikud alused",
      paragraphs: [
        "Platvormi pakkumine, konto, otsing, broneerimine, maksete töötlemine ja suhtlus pakkujaga – üldmääruse artikli 6 lõike 1 punkt b (leping või lepingueelsed meetmed).",
        "Klienditeenindus, kaebuste menetlemine ja vaidluste lahendamine – üldmääruse artikli 6 lõike 1 punktid b ja f.",
        "Pettuste, kuritarvituste ja turvaintsidentide avastamine ja ennetamine, meie tingimuste jõustamine – üldmääruse artikli 6 lõike 1 punkt f (õigustatud huvi turvalise turuplatsi vastu).",
        "Arvustused ja nende avaldamine – üldmääruse artikli 6 lõike 1 punktid b ja f.",
        "Juriidiliste kohustuste täitmine, eelkõige äri- ja maksualased säilitamiskohustused, teatamiskohustused direktiivi (EL) 2021/514 (DAC7) alusel ja kohustused määruse (EL) 2022/2065 alusel – üldmääruse artikli 6 lõike 1 punkt c.",
        "Platvormi parandamine koondatud kasutusandmete analüüsi kaudu – üldmääruse artikli 6 lõike 1 punkt f.",
        "Reklaam-e-kirjad ja küpsised, mis ei ole vajalikud – üldmääruse artikli 6 lõike 1 punkt a (nõusolek), mille võite igal ajal tagasi võtta tulevikku suunatud mõjuga.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Vastuvõtjad",
      paragraphs: [
        "Pakkujad saavad andmed, mida nad vajavad Teie broneeringu täitmiseks ja oma juriidiliste kohustuste täitmiseks – eelkõige nime, kontaktandmed, perioodi, reisijate arvu ja Teie neile suunatud sõnumid.",
        "Meie makseteenuse pakkuja Stripe töötleb makseandmeid iseseisva vastutava töötlejana; lisaks kohaldub [Stripe'i privaatsuspoliitika](https://stripe.com/privacy).",
        "Teenusepakkujad, kes teostavad meie jaoks majutust, andmebaaside käitamist, e-kirjade saatmist, veadiagnostikat ja klienditeeninduse tööriistu, töötlevad andmeid üksnes meie juhiste alusel üldmääruse artikli 28 kohase lepingu alusel.",
        "Ametiasutused ja kohtud saavad andmeid üksnes niivõrd, kuivõrd oleme selleks kohustatud; vt [Ametiasutuste ja õiguskaitseasutuste päringute poliitika](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "Maksuhaldurid saavad DAC7 alusel teatatavad pakkujate andmed.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Edastamine kolmandatesse riikidesse",
      paragraphs: [
        "Meie serverid ja meie volitatud töötlejate serverid asuvad Euroopa Liidus.",
        "Kui üksikjuhtudel toimub töötlemine väljaspool Euroopa Majanduspiirkonda, toimub see üksnes Euroopa Komisjoni kaitse piisavuse otsuse või üldmääruse artikli 46 lõike 2 punkti c kohaste tüüptingimuste alusel koos täiendavate kaitsemeetmetega.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Säilitamistähtajad",
      paragraphs: [
        "Kontoandmeid säilitame nii kaua, kuni Teie konto on olemas, ja kustutame need seejärel, kui sellega ei ole vastuolus säilitamiskohustus.",
        "Broneeringu- ja makseandmetele kohalduvad äri- ja maksualased säilitamistähtajad; Taani raamatupidamisõiguse kohaselt on need üldjuhul viis aastat selle majandusaasta lõpust, mille kohta andmed käivad.",
        "Broneeringuga seotud sõnumeid säilitame kuni kolm aastat pärast viibimise lõppu, et vaidlusi oleks võimalik selgitada.",
        "Arvustused jäävad pärast Teie konto kustutamist anonüümitud kujul alles, kuna need on osa majutuskoha hindamisalusest.",
        "Pettuse- ja kuritarvitusjuhtumite andmeid säilitame nii kaua, kui see on vajalik edasiste rikkumiste tõrjumiseks, kuid mitte kauem kui kolm aastat viimasest juhtumist.",
      ],
    },
    {
      id: "rechte",
      heading: "7. Teie õigused",
      paragraphs: ["Üldmääruse kohaselt on Teil järgmised õigused:"],
      list: [
        "tutvuda Teie kohta salvestatud andmetega (artikkel 15);",
        "parandada ebaõigeid andmeid (artikkel 16);",
        "kustutamine (artikkel 17), kui sellega ei ole vastuolus säilitamiskohustus;",
        "töötlemise piiramine (artikkel 18);",
        "andmete ülekandmine (artikkel 20);",
        "esitada vastuväide õigustatud huvil põhinevale töötlemisele (artikkel 21), eelkõige otseturundusele;",
        "võtta antud nõusolek tagasi tulevikku suunatud mõjuga (artikli 7 lõige 3);",
        `esitada kaebus järelevalveasutusele (artikkel 77) – pädev on Teie elukoha, töökoha või väidetava rikkumise koha asutus. Vastutava töötleja asukohas on see ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Taani, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. Kuidas oma õigusi teostada",
      paragraphs: [
        `Paljusid andmeid saate vaadata, muuta või kustutada otse oma kontol. Kõige muu osas pöörduge aadressil ${ANBIETER.email}.`,
        "Vastame viivitamata, hiljemalt ühe kuu jooksul. Kui me tähtajast kinni pidada ei saa, teatame Teile sellest koos põhjendusega.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Automatiseeritud otsused",
      paragraphs: [
        "Kasutame automatiseeritud menetlusi pettuste, kuritarvituste ja õigusvastase sisu avastamiseks. Kui selline menetlus viib meetmeni Teie konto või sisu vastu, põhjendame seda ja Te võite nõuda inimese teostatavat läbivaatamist.",
        "Otsust, mis põhineb üksnes automatiseeritud töötlusel ja millel on õiguslikud tagajärjed üldmääruse artikli 22 tähenduses, me ei tee.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Andmete esitamise kohustus",
      paragraphs: [
        "Broneeringuks vajalikud andmed peate esitama; ilma nendeta ei saa lepingut sõlmida ega majutuskohta pakkuda. Kõik muud andmed on vabatahtlikud.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. Käesoleva poliitika muudatused",
      paragraphs: [
        "Kohandame käesolevat poliitikat, kui töötlemine või õiguslik olukord muutub. Hetkel kehtiv redaktsioon on kättesaadav siin; uuendamise kuupäev on märgitud ülal.",
      ],
    },
  ],
};
