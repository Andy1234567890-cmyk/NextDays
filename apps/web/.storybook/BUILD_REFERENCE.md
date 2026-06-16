# Storybook Bau-Referenz (verbindlich für alle Komponenten)

Diese Datei ist die einzige Quelle der Wahrheit für den Komponenten-Bau. Nicht abweichen.

## Stil-Standard (shadcn, exakt wie components/ui/button.tsx)
- React-Funktionskomponenten, named export, `import type { ComponentProps } from "react"`.
- Klassen-Merge via `import { cn } from "@/lib/utils"`.
- Varianten via `class-variance-authority` (cva) + `VariantProps`.
- Radix-Primitive nutzen, wo sinnvoll (Dialog, Tabs, Checkbox, Switch, Select, Tooltip, Popover, Avatar, Label, Separator, Accordion, DropdownMenu).
- Icons NUR via `@iconify/react` (`<Icon icon="ph:..." />`) — NIEMALS lucide-react.
- KEINE hartkodierten Hex-Farben. Nur semantische Token-Klassen: `bg-background text-foreground bg-primary text-primary-foreground bg-accent text-accent-foreground bg-secondary text-muted-foreground border-border ring-[var(--ring)] bg-destructive`.
- Radius: `rounded-[var(--radius)]`.
- Kommentare auf Deutsch, knapp.

## Story-Standard (Storybook 8, react-vite)
- `import type { Meta, StoryObj } from "@storybook/react"`.
- `tags: ["autodocs"]` setzen (erzeugt Doku-Seite).
- Sinnvolle `title`-Hierarchie (siehe unten).
- Mehrere Stories pro Komponente: alle relevanten Zustände/Varianten.
- Bei interaktiven/fachlichen Komponenten: realistische Beispieldaten (echte Enum-Werte unten).
- Deutsche Story-Namen (Standard, Varianten, Zustände …) und deutsche Beispieltexte.

## Sidebar-Titel-Hierarchie (genau so)
- Doku (MDX): `Einführung/...`  → z.B. `Einführung/Was ist NextDays`
- Design-Tokens: `Design/Tokens`
- Primitive: `UI-Bausteine/<Name>`  → z.B. `UI-Bausteine/Input`
- Fachlich: `PMS-Komponenten/<Name>` → z.B. `PMS-Komponenten/Multi-Kalender`

## ECHTE Enum-Werte (aus supabase/migrations — verbindlich)
- user_role: `admin | co_admin | owner | staff | cleaner`
- property_type: `ferienhaus | appartement | glamping | tiny_house | stellplatz | hausboot`
- property_status: `draft | active | inactive`
- availability_status: `open | booked | blocked`
- availability_source / reservation_channel: `direct | portal | booking | airbnb | vrbo` (source zusätzlich `manual`)
- reservation_status: `pending | confirmed | cancelled | completed`
- task_status: `open | in_progress | done | cancelled`
- payment_type: `deposit | full | refund`
- payment_status: `pending | succeeded | failed | refunded`
- payment_gateway: `revolut | stripe`
- surcharge_kind: `cleaning | utilities | pet | linen | other`
- block_request_status: `pending | approved | rejected`
- substitution_status: `requested | accepted | declined`
- commission_status: `pending | invoiced | paid`
- discount_kind: `percent | fixed`

## Fachliche Regeln (Lastenheft)
- Beträge sind GLATT (keine Cent): `1.250 €` oder `8.500 Kr`. Sprachen DE/DK/EN.
- Eigentümer sieht von Gästen nur Vorname + Netto/Nacht; Mitarbeiter keine Finanzen/Namen.
- Zahlungs-Gateway: Revolut primär, Stripe sekundär.
- Status-Farben (Vorschlag, über Tokens/utility): pending=amber, confirmed/done=grün, cancelled=grau, completed=dunkelgrün, failed/blocked=destructive.

## Dateiort
- Primitive: `components/ui/<name>.tsx` + `<name>.stories.tsx`
- Fachlich: `components/pms/<name>.tsx` + `<name>.stories.tsx`
- Doku: `stories/<thema>.mdx`
