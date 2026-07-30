import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Teachtaireachtaí & Aíonna",
  description: "Bosca isteach, teimpléid agus cumarsáid le haíonna.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Cumarsáid",
      articles: [
        {
          slug: "posteingang",
          title: "Bosca Isteach an Ardáin",
          excerpt: "Tagann gach teachtaireacht aoi ó do mhaoine le chéile go lárnach i mBosca Isteach an Ardáin.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Bosca isteach amháin do gach maoin" },
            {
              type: "p",
              text: "Cuireann Bosca Isteach an Ardáin gach teachtaireacht ó d'aíonna le chéile in aon áit amháin — is cuma cén mhaoin nó cén tréimhse a bhaineann leis an gcomhrá. Osclaíonn tú é faoi /nachrichten agus feiceann tú gach comhrá mar shnáithe ar leith ansin.",
            },
            { type: "h2", text: "Struchtúr an bhosca isteach" },
            {
              type: "ul",
              items: [
                "Colún ar chlé: liosta de gach comhrá, an ceann is nuaí ar dtús",
                "Colún sa lár: stair reatha na dteachtaireachtaí leis an aoi",
                "Colún ar dheis: comhthéacs na háirithinte — tréimhse, maoin, sonraí aoi",
              ],
            },
            { type: "h2", text: "Freagra a thabhairt ar theachtaireacht" },
            {
              type: "steps",
              items: [
                "Oscail /nachrichten agus roghnaigh an comhrá atá uait",
                "Scríobh do fhreagra sa réimse téacs nó úsáid freagra tapa",
                "Seol an teachtaireacht — faigheann an t-aoi í tríd an mbealach céanna a scríobh sé",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ní thaispeánann Bosca Isteach an Ardáin ach an chumarsáid dhíreach idir tusa agus d'aíonna ar myNextDays — próiseálann tú teachtaireachtaí ó na tairseacha ansin fós.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Freagraí Tapa",
          excerpt: "Sábhálann teimpléid do cheisteanna coitianta am i dteagmháil le haíonna.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Cad iad freagraí tapa" },
            {
              type: "p",
              text: "Is bloic téacs réamhchumtha iad freagraí tapa do cheisteanna athfhillteacha — faoi theacht, pasfhocal WiFi nó áit pháirceála, mar shampla. In áit gach freagra a chlóscríobh as an nua, cuireann tú an teimpléad ceart isteach le cliceáil amháin i [mBosca Isteach an Ardáin](/hilfe/nachrichten/posteingang).",
            },
            { type: "h2", text: "Freagra tapa a chruthú" },
            {
              type: "steps",
              items: [
                "Oscail /nachrichten agus cliceáil ar „Freagraí Tapa a bhainistiú\"",
                "Cliceáil ar „Teimpléad Nua\" agus tabhair teideal dó, mar shampla „Sonraí Seiceála Isteach\"",
                "Scríobh téacs an fhreagra; cuirtear ionadaithe ar nós ainm an aoi nó dáta teachta isteach go huathoibríoch nuair a sheoltar",
                "Sábháil an teimpléad — beidh sé ar fáil i ngach comhrá láithreach",
              ],
            },
            { type: "h2", text: "Freagraí tapa a úsáid sa saol laethúil" },
            {
              type: "p",
              text: "San fhuinneog teachtaireachtaí, osclaíonn tú liosta na dteimpléad tríd an tsiombail splanc, roghnaíonn tú an freagra cuí agus cuireann tú in oiriúint go pearsanta é más gá sula seolann tú é.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Cruthaigh teimpléid do na cúig go deich gceist is coitianta — clúdaíonn sé sin formhór na dteachtaireachtaí a thagann isteach i gcleachtas.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Teachtaireachtaí Uathoibríocha",
          excerpt: "Is féidir deimhnithe, sonraí seiceála isteach agus meabhrúcháin a sheoladh go huathoibríoch chuig aíonna.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Teachtaireachtaí athfhillteacha a uathoibriú" },
            {
              type: "p",
              text: "In áit deimhnithe áirithinte, sonraí seiceála isteach nó teachtaireachtaí buíochais a sheoladh de láimh, cuireann tú isteach uair amháin iad mar riail — seolann myNextDays iad go huathoibríoch ansin ag an am cuí roimh, le linn nó tar éis an fhanachta.",
            },
            { type: "h2", text: "Truicir tipiciúla do theachtaireachtaí uathoibríocha" },
            {
              type: "ul",
              items: [
                "Go díreach tar éis an áirithinte — deimhniú leis na sonraí is tábhachtaí",
                "Cúpla lá roimh theacht — sonraí seiceála isteach agus cód rochtana",
                "Ar lá an imeachta — buíochas agus iarratas ar léirmheas",
              ],
            },
            { type: "h2", text: "Teachtaireacht uathoibríoch a shocrú" },
            {
              type: "steps",
              items: [
                "Oscail /nachrichten, rannóg „Teachtaireachtaí Uathoibríocha\"",
                "Roghnaigh an truicir, mar shampla „X lá roimh theacht\"",
                "Cuir isteach an téacs — cuirtear ionadaithe ar nós ainm an aoi, maoin nó dáta teachta isteach go huathoibríoch",
                "Gníomhachtaigh an riail; baineann sí le gach maoin mura bhfuil sí srianta ar shlí eile",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Feictear teachtaireachtaí uathoibríocha go hiomlán gnáth i [mBosca Isteach an Ardáin](/hilfe/nachrichten/posteingang) agus is féidir iad a fheiceáil ansin ag am ar bith ina dhiaidh sin.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Cosc a chur ar theachtaireachtaí",
          excerpt: "Is féidir leat cosc a chur ar dhuine go díreach ó stair na dteachtaireachtaí ar theagmháil bhreise.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Cathain is ciallmhar cosc" },
            {
              type: "p",
              text: "I gcás teachtaireachtaí maslacha, ciapadh nó iompar mí-oiriúnach arís agus arís eile, is féidir leat cosc a chur go díreach ar dhuine ó shnáithe na dteachtaireachtaí. Ní féidir le duine coiscthe teachtaireachtaí nua a scríobh chugat a thuilleadh, ná áirithint nua a chruthú agat.",
            },
            { type: "h2", text: "Duine a chosc ó shnáithe" },
            {
              type: "steps",
              items: [
                "Oscail an comhrá lena mbaineann i [mBosca Isteach an Ardáin](/hilfe/nachrichten/posteingang)",
                "Cliceáil ar an roghchlár ag barr an tsnáithe agus roghnaigh „Cuir cosc ar dhuine\"",
                "Deimhnigh an próiseas — bíonn éifeacht ag an gcosc láithreach",
              ],
            },
            { type: "h2", text: "Cad a chiallaíonn an cosc — agus cad nach gciallaíonn" },
            {
              type: "ul",
              items: [
                "Ní chuirtear teachtaireachtaí nua ón duine coiscthe ar fáil a thuilleadh",
                "Diúltaítear iarratais áirithinte nua ón duine",
                "Má tá áirithint reatha ag an duine seo, fanann an chumarsáid indéanta go heisceachtúil ar feadh an fhanachta",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Is féidir cosc a bhaint ag am ar bith i bhforbhreathnú „Daoine Coiscthe\" sa Chuntas. Seiceáil sula gcuireann tú cosc ar cheann an bhfuil áirithint reatha ann cheana.",
            },
          ],
        },
      ],
    },
  ],
};
