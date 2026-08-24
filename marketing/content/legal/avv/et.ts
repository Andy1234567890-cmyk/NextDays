// Estnische Fassung der Vereinbarung zur Auftragsverarbeitung.
// Übersetzung von `de.ts` — inhaltliche Änderungen gehören ZUERST dorthin
// (dort stehen auch die Belege für die technischen und organisatorischen
// Maßnahmen und die Liste der Unterauftragsverarbeiter).
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Isikuandmete töötlemise leping",
  metaDescription:
    "Isikuandmete töötlemine IKÜMi artikli 28 alusel myNextDays ApS-i ja platvormi kasutavate ettevõtete vahel: ese, juhised, turvalisus, alltöötlejad.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Käesolev leping (edaspidi „töötlemisleping“) kehtib platvormi myNextDays kasutava ettevõtte (edaspidi „vastutav töötleja“) ja ${ANBIETER.firma} (edaspidi „volitatud töötleja“ või „meie“) vahel ning täpsustab kohustusi, mis tulenevad määruse (EL) 2016/679 (isikuandmete kaitse üldmäärus, „IKÜM“) artiklist 28.`,
    `See lisatakse [üldtingimuste](${AGB_URL}) kaudu ja kehtib kogu platvormi kasutamise ajal. Sellel on üldtingimuste ees eesõigus niivõrd, kuivõrd tegemist on isikuandmete töötlemisega vastutava töötleja nimel.`,
    "Täiendavalt kehtib [privaatsusteade](/datenschutz) andmete kohta, mida töötleme iseseisva vastutava töötlejana — eelkõige konto ja ärisuhte andmete kohta.",
  ],
  sections: [
    {
      heading: "Ese ja rollide jaotus",
      unterpunkte: [
        {
          paragraphs: [
            "Ese on selliste isikuandmete töötlemine, mida vastutav töötleja platvormile sisestab või selle kaudu kogub, et me saaksime osutada lepingus kokku lepitud teenuseid: objektide, broneeringute ja täituvuse haldamine, suhtlus külalistega, maksete töötlemine, raamatupidamine ja omanikega arveldamine, ühendamine broneerimisportaalidega, veebilehe koostaja ning ülesannete ja meeskonna haldamine.",
          ],
        },
        {
          paragraphs: [
            "Vastutav töötleja otsustab selle töötlemise eesmärgid ja vahendid. Töötleme andmeid üksnes tema dokumenteeritud juhiste alusel ja mitte oma eesmärkidel.",
          ],
        },
        {
          paragraphs: [
            "Konto andmete, meie enda teenuste arveldamise, süsteemi turvalisuse ja seadusest tuleneva säilitamise osas oleme vastutav töötleja meie ise. See töötlemine ei ole käesoleva töötlemislepingu ese.",
          ],
        },
      ],
    },
    {
      heading: "Töötlemise laad, ulatus ja eesmärk",
      paragraphs: [
        "Töötlemine toimub kogumise, salvestamise, kuvamise, muutmise, vastutava töötleja valitud vastuvõtjatele edastamise (nt broneerimisportaalid, makseteenuse pakkujad), piiramise ja kustutamise teel — automatiseeritud kujul platvormil.",
        "Töötlemise koht on Euroopa Liit; erandid on ammendavalt nimetatud 8. jaos.",
      ],
    },
    {
      heading: "Andmesubjektide kategooriad",
      list: [
        "Külalised ja broneerijad, sealhulgas kaasreisijad",
        "Huvilised, kes esitavad päringuid või saadavad sõnumeid",
        "Hallatavate objektide omanikud",
        "Vastutava töötleja töötajad (meeskond, koristus, teenindus, vastuvõtt)",
        "Vastutava töötleja partnerite ja teenusepakkujate kontaktisikud",
      ],
    },
    {
      heading: "Isikuandmete kategooriad",
      list: [
        "Põhiandmed: nimi, aadress, sünnikuupäev, kui see on kogutud, kodakondsus, kui see on kogutud teatamiskohustuse tarbeks",
        "Kontaktandmed: e-posti aadress, telefoninumber",
        "Broneeringu andmed: periood, objekt, reisijate arv, hinnad, lisateenused, tühistamised",
        "Makseandmed: summa, vääring, makseviis, makse olek, viited (täielikud kaardiandmed ei jõua meie süsteemidesse)",
        "Suhtlusandmed: sõnumid, märkmed, hinnangud",
        "Töötajate juurdepääsu- ja kasutusandmed: roll, õigused, sisselogimise aeg, sisselogimise seade ja IP-aadress",
        "IKÜMi artikli 9 kohased eriliigilised andmed ei ole töövõtu ese; vastutav töötleja ei sisesta selliseid andmeid vabateksti väljadele.",
      ],
    },
    {
      heading: "Juhised",
      unterpunkte: [
        {
          paragraphs: [
            "Vastutav töötleja annab juhiseid platvormi kasutamise ja seadistamise kaudu ning kirjalikku taasesitamist võimaldavas vormis meie kontaktaadressile. Suulised juhised kinnitame kirjalikku taasesitamist võimaldavas vormis.",
          ],
        },
        {
          paragraphs: [
            "Kui peame juhist õigusvastaseks, teatame sellest viivitamata ja võime selle täitmise peatada, kuni vastutav töötleja seda kinnitab või muudab.",
          ],
        },
        {
          paragraphs: [
            "Kui oleme töötlemiseks seadusest tulenevalt kohustatud (näiteks ametiasutuste ees), teavitame vastutavat töötlejat eelnevalt, kuivõrd õigus seda meil lubab.",
          ],
        },
        {
          titel: "Vastutava töötleja enda teenuste ühendamine",
          paragraphs: [
            "Vastutav töötleja saab ühendada oma konto liidese kaudu teenusega, mille ta on ise valinud ja millega ta on sõlminud oma lepingu — näiteks tehisintellekti assistendiga. Kui ta sellise ühenduse annab, on see tema selgesõnaline juhis IKÜMi artikli 28 lõike 3 punkti a tähenduses vabastatud andmed sellele teenusele väljastada. See hõlmab sõnaselgelt ka sellega seotud edastamist kolmandasse riiki, kui teenuse asukoht on väljaspool Euroopa Liitu.",
            "Lühidalt: sellise ühenduse üle otsustab üksnes vastutav töötleja ja ühendatud teenuse eest vastutab ta ise.",
            "Anda saab selle üksnes konto, millel on õigus hallata väliseid ühendusi. See õigus on ette nähtud rollile „administraator“; piiratud õigustega kontod — ka roll „kaasadministraator“ — ei saa ühendust anda. Me talletame, kes, millal ja millise teenuse jaoks selle andis, millised andmeliigid vabastati ja millised päringud tehti; see talletus on vastutavale töötlejale kasutajaliideses kättesaadav jaotises „Konto → Ühendused“, et ta saaks täita oma vastutuskohustust ja vastata teabetaotlustele.",
            "Ühendatud teenus ei ole meie alltöötleja: me ei volita seda, ei vali seda ega anna sellele juhiseid. See töötleb andmeid lepingu alusel, mille vastutav töötleja ise sellega sõlmis. Selle töötlemise, selle õigusliku aluse ja kolmandasse riiki edastamise tagatiste eest vastutab seetõttu vastutav töötleja; see ei ole käesoleva töötlemislepingu ese.",
            "Vabateksti väljad — broneeringu märkmed ja külaliste sõnumite sisu — on sellisest ühendusest vaikimisi välja jäetud. Need võivad sisaldada IKÜMi artikli 9 kohaseid eriliigilisi isikuandmeid, näiteks terviseandmeid. Vastutav töötleja peab need ühenduse andmisel eraldi vabastama; ilma selle vabastuseta neid ei edastata.",
            "Vastutav töötleja saab antud ühenduse igal ajal kasutajaliideses katkestada. Uuendustunnused kustutatakse seejuures ja igal järgneval päringul kontrollitakse, kas nõusolek on veel olemas — katkestatud teenus ei saa seetõttu kohe enam midagi lugeda, mitte alles pärast oma juurdepääsutunnuse aegumist.",
          ],
        },
      ],
    },
    {
      heading: "Konfidentsiaalsus",
      paragraphs: [
        "Kõik isikud, kellel võib töövõtu kohaselt olla juurdepääs andmetele, on kohustatud hoidma konfidentsiaalsust ja neid juhendatakse korrapäraselt andmekaitse alal. Juurdepääs on piiratud vastava ülesande jaoks vajalikuga.",
        "Meie töötajad pääsevad klientide andmetele ligi üksnes vigade kõrvaldamiseks, tugitaotluse alusel või seadusest tulenevate kohustuste täitmiseks.",
      ],
    },
    {
      heading: "Töötlemise turvalisus",
      paragraphs: [
        "Võtame IKÜMi artikli 32 kohaselt nõutavad tehnilised ja korralduslikud meetmed. Rakendatud on eelkõige:",
      ],
      list: [
        "Ülekande krüpteerimine (TLS) kõigi ühenduste jaoks, HTTP turvapäised koos range Content-Security-Policyga",
        "Klientide eraldamine vahetult andmebaasis: reapõhised juurdepääsureeglid (Row Level Security) koos tundlike andmete tabeliõiguste äravõtmisega, nii et juurdepääs väljaspool oma ettevõtet on välistatud ka otse andmebaasi kaudu",
        "Rollipõhised õigused andmete eraldamisega: teenindus- ja koristustöötajad ei saa finants- ja müügiandmeid, omanikud üksnes oma objektid; külaliste andmed maskeeritakse rollidele, kellel puudub õigus",
        "Kahefaktoriline autentimine (TOTP) kontodele kättesaadav; uuesti sisselogimine turvalisuse seisukohalt kriitiliste muudatuste korral",
        "Sisselogimiste logi koos seadme, aja ja IP-aadressiga, mida vastutav töötleja saab vaadata",
        "Ühendusi väliste teenustega saab anda üksnes konto rolliga „administraator“; iga sellise ühenduse kaudu tehtud päring logitakse (tööriist, aeg, ulatus — ilma sisu endata) ja vastutav töötleja saab seda vaadata. Katkestatud ühendus kaotab juurdepääsu kohe: igal päringul kontrollitakse, kas nõusolek on veel olemas",
        "Päringute sageduse piiramine automatiseeritud rünnakute vastu, sissetulevate webhook-kutsete allkirjade kontroll",
        "Krüpteeritud varukoopiad, mida hoitakse väljaspool tootmissüsteemi, koos korrapärase taastamiskatsega",
        "Eraldi keskkonnad arenduse ja käitamise jaoks; andmebaasi muudatused üksnes versioonitud migratsioonide kaudu",
      ],
    },
    {
      heading: "Alltöötlejad",
      paragraphs: [
        "Vastutav töötleja kiidab heaks järgmiste alltöötlejate kasutamise. Igaühega neist on sõlmitud IKÜMi artikli 28 lõike 4 kohased lepingud kohustustega, mis vastavad käesolevale töötlemislepingule.",
      ],
      list: [
        "Hetzner Online GmbH, Saksamaa (serverid, andmebaas, meedia, postiserver; andmekeskus Helsingis, Soomes)",
        "Stripe Payments Europe, Limited, Iirimaa (maksed, väljamaksed, seadusest tulenev isikusamasuse kontroll)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., Luksemburg (maksed, kui vastutav töötleja need aktiveerib)",
        "Channex.io Ltd, Ühendkuningriik (ühendamine broneerimisportaalidega, kui see on aktiveeritud)",
        "Meta Platforms Ireland Limited, Iirimaa (WhatsAppi sõnumid, kui need on aktiveeritud)",
        "Google Ireland Limited, Iirimaa (sisu tõlkimine; sisselogimine Google’iga, kui seda kasutatakse)",
        "Groq, Inc., USA (vastusesoovitused postkastis, kui need on aktiveeritud)",
        "Cloudflare, Inc., USA (oma domeenide DNS-kirjete haldamine, kui seda kasutatakse)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Vahetusest või täiendusest teatame vähemalt 30 päeva ette. Vastutav töötleja võib selle tähtaja jooksul esitada vastuväite kaalukal andmekaitsega seotud põhjusel; kui vastuväidet ei kõrvaldata, võib ta üles öelda asjaomase teenuseosa või lepingu.",
          ],
        },
        {
          paragraphs: [
            "Teenused, mille vastutav töötleja ise kolmanda isikuga kokku lepib, ei ole alltöötlemine, vaid tema poolt algatatud edastamine. See kehtib broneerimisportaali kohta, millega tal on oma leping, samuti tehisintellekti assistendi või muu programmi kohta, mille ta liidese kaudu oma kontoga ühendab (vt jagu „Juhised“).",
            "Määrav ei ole seejuures see, kelle süsteemide kaudu andmed liiguvad, vaid see, kes teenuse kaasab: alltöötlemine tekib siis, kui MEIE kaasame oma teenuse osutamiseks veel ühe teenusepakkuja. Kui vastutav töötleja valib teenuse ise ja sõlmib sellega lepingu, töötleb see teenus vastutava töötleja jaoks — mitte meie jaoks. See piiritlus vastab võrreldavate pakkujate lepingupraktikale kliendi poolt ühendatud kolmandate isikute teenuste puhul.",
          ],
        },
      ],
    },
    {
      heading: "Edastamine kolmandatesse riikidesse",
      paragraphs: [
        "Edastamine vastuvõtjatele väljaspool ELi piirdub eespool nimetatud teenustega, mille asukoht on USA või Ühendkuningriik. Aluseks on Euroopa Komisjoni tüüptingimused andmekaitse kohta IKÜMi artikli 46 lõike 2 punkti c tähenduses või kehtiv kaitse piisavuse otsus; rakendatakse täiendavaid kaitsemeetmeid (krüpteerimine, andmete minimeerimine).",
      ],
    },
    {
      heading: "Vastutava töötleja toetamine",
      unterpunkte: [
        {
          paragraphs: [
            "Toetame vastutavat töötlejat andmesubjektide taotlustele vastamisel (IKÜMi artiklid 15 kuni 22). Platvorm pakub selleks andmetega tutvumist, parandamist, eksportimist ja kustutamist vahetult kasutajaliideses. Kui andmesubjektid pöörduvad otse meie poole, suuname nad vastutava töötleja juurde ja teavitame teda.",
          ],
        },
        {
          paragraphs: [
            "Toetame lisaks andmekaitsealaste mõjuhinnangute koostamisel, IKÜMi artiklites 32 kuni 36 sätestatud kohustuste täitmisel ja järelevalveasutuste päringute korral.",
          ],
        },
      ],
    },
    {
      heading: "Isikuandmetega seotud rikkumised",
      paragraphs: [
        "Kui saame teada isikuandmetega seotud rikkumisest, mis puudutab vastutava töötleja andmeid, teavitame teda viivitamata, hiljemalt 48 tunni jooksul pärast teadasaamist, kirjalikku taasesitamist võimaldavas vormis.",
        "Teade sisaldab, kuivõrd see on teada, juhtumi laadi ja aega, puudutatud andmekategooriaid ja isikute rühmi, tõenäolisi tagajärgi ning võetud ja kavandatud meetmeid. Toetame vastutavat töötlejat tema teavitamiskohustuste täitmisel IKÜMi artiklite 33 ja 34 alusel.",
      ],
    },
    {
      heading: "Tõendid ja kontrollid",
      unterpunkte: [
        {
          paragraphs: [
            "Tõendame nõudmisel käesoleva töötlemislepingu järgimist, eelkõige teabega võetud meetmete ja kasutatavate alltöötlejate kohta.",
          ],
        },
        {
          paragraphs: [
            "Vastutav töötleja võib teha kontrolle vajalikus ulatuses või lasta neid teha sõltumatul audiitoril, kes ei ole meiega konkurentsis. Kontrollid toimuvad etteteatamisel mõistliku tähtajaga, tavalisel tööajal ja tegevust häirimata. Teabe andmisest kaugemale ulatuva kontrolli kulud kannab vastutav töötleja, välja arvatud juhul, kui kontrolli tingis meie põhjustatud juhtum.",
          ],
        },
      ],
    },
    {
      heading: "Kustutamine ja tagastamine",
      paragraphs: [
        "Pärast lepingu lõppemist teeme vastutava töötleja andmed nõudmisel 30 päeva jooksul eksportimiseks kättesaadavaks levinud masinloetavas vormingus. Seejärel kustutame andmed koos koopiatega.",
        "Välja arvatud on andmed, mille kohta kehtib seadusest tulenev säilitamiskohustus (eelkõige arve- ja raamatupidamisandmed); need blokeeritakse ja kustutatakse pärast tähtaja möödumist. Varukoopiad kirjutatakse üle korrapärase rotatsioonitsükliga.",
      ],
    },
    {
      heading: "Vastutus ja järjestus",
      paragraphs: [
        "Kohaldatakse IKÜMi artiklit 82. Poolte vahelises suhtes kehtivad kõrvuti üldtingimuste vastutussätted, kuivõrd need ei ole IKÜMiga vastuolus.",
        "Kui üldtingimused ja käesolev töötlemisleping on vastutava töötleja nimel toimuva töötlemise osas vastuolus, kehtib käesolev töötlemisleping. Kui mõni säte muutub kehtetuks, jääb ülejäänud sisu kehtima; pooled asendavad selle lubatud sättega, millel on sama eesmärk.",
      ],
    },
    {
      heading: "Käesoleva lepingu muudatused",
      paragraphs: [
        "Võime käesolevat töötlemislepingut kohandada niivõrd, kuivõrd see osutub vajalikuks õigusaktide muudatuste, järelevalveasutuste nõuete, makseteenuse pakkujate nõuete või tehnilise arengu tõttu ja vastutava töötleja olukord ei halvene.",
        "Muudatustest teatame kirjalikku taasesitamist võimaldavas vormis vähemalt 30 päeva enne jõustumist. Kui vastutav töötleja ei esita selle tähtaja jooksul vastuväidet, loetakse need vastuvõetuks; sellele tagajärjele osutatakse teates. Vastuväite korral võib kumbki pool lepingu jõustumise ajaks üles öelda.",
      ],
    },
    {
      heading: "Kontakt",
      paragraphs: [
        `Käesoleva lepinguga seotud päringud, juhised ja teated palume saata aadressile [${ANBIETER.email}](mailto:${ANBIETER.email}) või ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts);
// der benannte Export bleibt daneben stehen.
export default avv;
