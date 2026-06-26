"use client";

// Echtes E-Mail-Registrierungsformular. Ruft die register()-Server-Action
// (FastAPI /auth/register → Tenant + Owner + Channel-Manager-Group) und leitet
// nach Erfolg in den Setup-Assistenten (/onboarding).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { register } from "@/lib/auth";
import { LAENDER, currencyForCountry } from "@/lib/laender";

export function SignupForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const tCountry = useTranslations("countries");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [hotelName, setHotelName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState<string>("DE");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const currency = currencyForCountry(country);

    startTransition(async () => {
      const res = await register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        tenantName: hotelName.trim(),
        country,
        currency,
      });
      if (res.ok) {
        // Frisch registriert → in den Setup-Assistenten.
        router.replace("/onboarding");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Zurück"
        >
          <Icon icon="ph:arrow-left" className="size-5" />
        </button>
        <h1 className="font-display text-xl font-extrabold">
          Konto erstellen
        </h1>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="hotelName" className="text-sm font-medium">
          Name deines Betriebs
        </label>
        <Input
          id="hotelName"
          value={hotelName}
          onChange={(e) => setHotelName(e.target.value)}
          placeholder="z. B. Hotel Seeblick"
          required
          maxLength={200}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="fullName" className="text-sm font-medium">
          Dein Name
        </label>
        <Input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Vor- und Nachname"
          required
          maxLength={200}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          E-Mail
        </label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@betrieb.de"
          required
          autoComplete="email"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Passwort
        </label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mindestens 8 Zeichen"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="country" className="text-sm font-medium">
          Land
        </label>
        <NativeSelect
          id="country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="rounded-full pl-4"
        >
          {LAENDER.map((l) => (
            <option key={l.code} value={l.code}>
              {tCountry(l.code)} ({l.currency})
            </option>
          ))}
        </NativeSelect>
      </div>

      {error && (
        <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="gap-2">
        {pending ? (
          <>
            <Icon icon="ph:spinner" className="size-4 animate-spin" />
            Konto wird erstellt …
          </>
        ) : (
          "Kostenlos starten"
        )}
      </Button>
    </form>
  );
}
