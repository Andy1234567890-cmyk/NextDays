import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Ráiteas cosanta sonraí",
  stand: "Nuashonraithe: 18 Lúnasa 2026",
  intro: [
    "Cuireann an ráiteas seo síos ar na sonraí pearsanta a phróiseálann myBestDays, ar na cuspóirí, ar an mbunús dlí agus ar na cearta atá agat. Baineann sé leis an suíomh gréasáin, leis na feidhmchláir mhóibíleacha agus le gach bealach eile isteach ar an Ardán.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Rialaitheoir agus oifigeach cosanta sonraí",
      paragraphs: [
        `Is é an rialaitheoir de réir bhrí Rialachán (AE) 2016/679 (RGCS) ná ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-nr. ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. Tá sonraí iomlána an tsoláthraí san [Fhaisnéis dlíthiúil](https://mybestdays.dk/rechtliches/impressum).`,
        "Níl oifigeach cosanta sonraí ainmnithe; níl coinníollacha Airteagal 37 RGCS comhlíonta. Cuir ceisteanna faoi chosaint sonraí chuig an seoladh ríomhphoist thuas.",
        "Is rialaitheoirí neamhspleácha iad na soláthraithe a gcuireann tú in áirithe leo maidir leis na sonraí a fhaigheann siad uainn. Baineann na [Caighdeáin cosanta sonraí d'óstaigh](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber) leo.",
      ],
    },
    {
      id: "kategorien",
      heading: "2. Cé na sonraí a phróiseálaimid",
      paragraphs: ["Ag brath ar an gcaoi a n-úsáideann tú an tArdán, próiseálaimid:"],
      list: [
        "sonraí bunúsacha — ainm, seoladh ríomhphoist, uimhir theileafóin, teanga agus airgeadra, pasfhocal i bhfoirm chriptithe;",
        "sonraí áirithinte — an lóistín a cuireadh in áirithe, an tréimhse, líon agus ainmneacha na dtaistealaithe, iarratais speisialta, stádas na háirithinte;",
        "sonraí íocaíochta — an tsuim, an t-airgeadra, stádas na híocaíochta, digití deiridh an mhodha íocaíochta chomh maith le haitheantóir idirbhirt ár soláthraí íocaíochta. Ní shroicheann sonraí iomlána cárta sinn;",
        "sonraí cumarsáide — teachtaireachtaí idir tú féin agus an soláthraí, ceisteanna chuig ár seirbhís do chustaiméirí, gearáin;",
        "sonraí ábhair — léirmheasanna, grianghraif, liostaí mianta;",
        "sonraí úsáide — na leathanaigh a osclaíodh, na cuardaigh, am na rochtana;",
        "sonraí teicniúla — seoladh IP, aitheantóirí brabhsálaí agus gléis, córas oibriúcháin, tarchuradóir.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Cuspóirí agus bunúis dlí",
      paragraphs: [
        "An tArdán, an cuntas, an cuardach, an áirithint, próiseáil na híocaíochta agus an chumarsáid leis an soláthraí a sholáthar — Airteagal 6(1)(b) RGCS (conradh nó beart réamhchonarthach).",
        "Seirbhís do chustaiméirí, gearáin a láimhseáil agus díospóidí a réiteach — Airteagal 6(1)(b) agus (f) RGCS.",
        "Calaois, mí-úsáid agus teagmhais slándála a bhrath agus a chosc, ár gcoinníollacha a fhorfheidhmiú — Airteagal 6(1)(f) RGCS (leas dlisteanach i margadh slán).",
        "Léirmheasanna agus a bhfoilsiú — Airteagal 6(1)(b) agus (f) RGCS.",
        "Oibleagáidí dlíthiúla a chomhlíonadh, go háirithe oibleagáidí coinneála tráchtála agus cánach, an oibleagáid tuairiscithe faoi Threoir (AE) 2021/514 (DAC7) agus na hoibleagáidí ó Rialachán (AE) 2022/2065 — Airteagal 6(1)(c) RGCS.",
        "An tArdán a fheabhsú trí anailís ar shonraí úsáide comhiomlánaithe — Airteagal 6(1)(f) RGCS.",
        "Ríomhphoist fhógraíochta agus fianáin nach bhfuil riachtanach — Airteagal 6(1)(a) RGCS (toiliú), ar féidir leat é a tharraingt siar am ar bith le héifeacht chun cinn.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Faighteoirí",
      paragraphs: [
        "Faigheann soláthraithe na sonraí a theastaíonn uathu chun d'áirithint a chur i gcrích agus chun a n-oibleagáidí dlíthiúla a chomhlíonadh — go háirithe ainm, sonraí teagmhála, an tréimhse, líon na dtaistealaithe agus do theachtaireachtaí chucu.",
        "Próiseálann ár soláthraí íocaíochta Stripe sonraí íocaíochta mar rialaitheoir neamhspleách; baineann [ráiteas cosanta sonraí Stripe](https://stripe.com/privacy) leis sin freisin.",
        "Ní phróiseálann soláthraithe seirbhíse a chuireann óstáil, oibriú bunachar sonraí, seoladh ríomhphoist, diagnóisic earráidí agus uirlisí seirbhíse do chustaiméirí ar fáil dúinn sonraí ach faoinár dtreoir ar bhonn conartha faoi Airteagal 28 RGCS.",
        "Ní fhaigheann údaráis agus cúirteanna sonraí ach a mhéid atá oibleagáid orainn; féach na [Treoirlínte um iarratais ó údaráis agus ó fhorfheidhmiú dlí](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "Faigheann údaráis chánach na sonraí faoi sholáthraithe atá le tuairisciú faoi DAC7.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Aistriú chuig tríú tíortha",
      paragraphs: [
        "Tá ár bhfreastalaithe agus freastalaithe ár bpróiseálaithe san Aontas Eorpach.",
        "A mhéid a tharlaíonn próiseáil lasmuigh den Limistéar Eorpach Eacnamaíoch i gcás aonair, ní tharlaíonn sé ach ar bhonn cinneadh leordhóthanachta ón gCoimisiún Eorpach nó na gClásal Caighdeánach Conarthach faoi Airteagal 46(2)(c) RGCS mar aon le bearta cosanta forlíontacha.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Fad stórála",
      paragraphs: [
        "Stórálaimid sonraí cuntais fad atá do chuntas ann agus scriosaimid ina dhiaidh sin iad, a mhéid nach bhfuil oibleagáid coinneála ina choinne sin.",
        "Tá sonraí áirithinte agus íocaíochta faoi réir tréimhsí coinneála tráchtála agus cánach; is gnách go bhfuil siad cúig go deich mbliana ó dheireadh na bliana inar tugadh an áirithint chun críche, ag brath ar an stát bunaíochta.",
        "Stórálaimid teachtaireachtaí a bhaineann le háirithint go dtí trí bliana tar éis dheireadh an fhanachta, ionas gur féidir díospóidí a shoiléiriú.",
        "Fanann léirmheasanna ann i bhfoirm anaithnid tar éis do chuntas a scriosadh, toisc gur cuid de bhonn measúnaithe lóistín iad.",
        "Stórálaimid sonraí faoi chásanna calaoise agus mí-úsáide chomh fada agus is gá chun tuilleadh sáruithe a chosc, ach trí bliana ar a mhéad tar éis an teagmhais dheireanaigh.",
      ],
    },
    {
      id: "rechte",
      heading: "7. Do chearta",
      paragraphs: ["Tá na cearta seo a leanas agat faoin RGCS:"],
      list: [
        "rochtain ar na sonraí atá stóráilte fút (Airteagal 15);",
        "ceartúchán sonraí míchearta (Airteagal 16);",
        "scriosadh (Airteagal 17), a mhéid nach bhfuil oibleagáid coinneála ina choinne sin;",
        "srianadh na próiseála (Airteagal 18);",
        "iniomparthacht sonraí (Airteagal 20);",
        "agóid i gcoinne próiseála ar bhonn leasanna dlisteanacha (Airteagal 21), go háirithe i gcoinne margaíochta dírí;",
        "toiliú a tugadh a tharraingt siar le héifeacht chun cinn (Airteagal 7(3));",
        `gearán le húdarás maoirseachta (Airteagal 77) — is é an t-údarás inniúil ná an ceann ag d'áit chónaithe, ag d'áit oibre nó ag áit an tsáraithe líomhnaithe. Ag suíomh an rialaitheora is é sin ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. Conas a fheidhmíonn tú do chearta",
      paragraphs: [
        `Is féidir leat a lán sonraí a fheiceáil, a athrú nó a scriosadh go díreach i do chuntas. Le haghaidh gach ní eile téigh i dteagmháil le ${ANBIETER.email}.`,
        "Freagraímid gan mhoill, ar a dhéanaí laistigh de mhí amháin. Mura féidir linn an sprioc a chomhlíonadh, cuirimid é sin in iúl duit le cúis.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Cinntí uathoibrithe",
      paragraphs: [
        "Úsáidimid nósanna imeachta uathoibrithe chun calaois, mí-úsáid agus ábhar mídhleathach a bhrath. Má thagann beart i gcoinne do chuntais nó d'ábhair as nós imeachta den sórt sin, tugaimid cúis leis agus is féidir leat athbhreithniú ó dhuine a éileamh.",
        "Ní dhéanaimid cinneadh atá bunaithe go hiomlán ar phróiseáil uathoibrithe agus a bhfuil éifeacht dhlíthiúil aige de réir bhrí Airteagal 22 RGCS.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Oibleagáid sonraí a chur ar fáil",
      paragraphs: [
        "Ní mór duit na sonraí a theastaíonn le haghaidh áirithinte a chur ar fáil; gan iad ní féidir conradh a thabhairt chun críche ná an lóistín a sholáthar. Tá gach sonra eile deonach.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. Athruithe ar an ráiteas seo",
      paragraphs: [
        "Cuirimid an ráiteas seo in oiriúint nuair a athraíonn an phróiseáil nó an staid dlí. Tá an leagan atá i bhfeidhm ar fáil anseo; tá dáta an leagain thuas.",
      ],
    },
  ],
};
