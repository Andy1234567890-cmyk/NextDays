// Български превод на правната информация. Референтната версия е ./de.ts —
// съдържателните промени се правят НАЙ-НАПРЕД там, едва после тук.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Правна информация",
  metaDescription:
    "Данни за доставчика myNextDays ApS съгласно § 7 от датския Закон за електронната търговия (e-handelslov): фирма, адрес, управление, CVR номер и контакт.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Данни за доставчика на платформата myNextDays — property management system и channel manager, управлявани от ${ANBIETER.firma}.`,
    "Задължителна информация съгласно § 7 от датския Закон за електронната търговия (e-handelslov), който транспонира член 5 от Директива 2000/31/ЕО относно електронната търговия.",
  ],
  sections: [
    {
      heading: "Доставчик",
      zeilen: [
        {
          label: "Дружество",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Адрес",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Управление с право на представителство",
          werte: [`${ANBIETER.direktion.join(" и ")} (direktører)`],
        },
      ],
    },
    {
      heading: "Контакт",
      zeilen: [
        {
          label: "Имейл",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Телефон",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
        {
          label: "Интернет",
          werte: [ANBIETER.website],
          href: ANBIETER.websiteUrl,
        },
      ],
    },
    {
      heading: "Търговски регистър и ДДС",
      zeilen: [
        {
          label: "Търговски регистър",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Дания",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "Идентификационен номер по ДДС",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Точка за контакт съгласно Акта за цифровите услуги",
      paragraphs: [
        `Централна точка за контакт за органите съгласно член 11 и за потребителите съгласно член 12 от Регламент (ЕС) 2022/2065 (Digital Services Act): ${ANBIETER.email}.`,
        "Езиците за комуникация са немски, датски и английски.",
      ],
    },
    {
      heading: "Разрешаване на потребителски спорове",
      paragraphs: [
        "Ние не сме нито готови, нито задължени да участваме в процедура по разрешаване на спорове пред орган за разглеждане на потребителски спорове.",
      ],
    },
    {
      heading: "Отговорност за връзки",
      paragraphs: [
        "Въпреки внимателния контрол на съдържанието, ние не поемаме отговорност за съдържанието на външни връзки. За съдържанието на свързаните страници отговарят изключително съответните им оператори.",
      ],
    },
    {
      heading: "Авторско право",
      paragraphs: [
        `Съдържанието, текстовете, графиките и марките, публикувани на този уебсайт, са защитени от авторско право и право на марките. Всяко използване извън законно разрешените случаи изисква предварително писмено съгласие от ${ANBIETER.firma}.`,
      ],
    },
    {
      heading: "Други правни документи",
      paragraphs: [
        "Използването на платформата се урежда от нашите Общи условия. Начинът, по който обработваме лични данни, е описан в Политиката за поверителност; използваните бисквитки са изброени в Политиката за бисквитките.",
      ],
      links: [
        { label: "Общи условия", href: AGB_URL },
        { label: "Политика за поверителност", href: "/datenschutz" },
        { label: "Политика за бисквитките", href: "/cookie-richtlinie" },
        { label: "Споразумение за обработка на данни (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Приложимо право",
      paragraphs: [
        `${ANBIETER.firma} има седалище и е установено изключително в Дания. Затова спрямо това онлайн предложение се прилага датското право — включително за версията на български език (принципът на държавата по произход съгласно член 3 от Директива 2000/31/ЕО). Задълженията за информиране произтичат от § 7 от датския Закон за електронната търговия (e-handelslov).`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
