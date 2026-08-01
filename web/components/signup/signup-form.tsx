"use client";

// Echtes E-Mail-Registrierungsformular. Ruft die register()-Server-Action
// (FastAPI /auth/register → Tenant + Owner + Channel-Manager-Group) und leitet
// nach Erfolg in den Setup-Assistenten (/onboarding).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { register } from "@/lib/auth";
import { LAENDER, currencyForCountry } from "@/lib/laender";

export function SignupForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const t = useTranslations("signup");
  const tCountry = useTranslations("countries");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [hotelName, setHotelName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [country, setCountry] = useState<string>("DE");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== passwordConfirm) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }
    const currency = currencyForCountry(country);
    // Wurzel 4: keine Registrierung mit erfundener Währung — fehlt sie für das
    // gewählte Land, klar melden statt EUR zu unterstellen.
    if (!currency) {
      setError("Für das gewählte Land ist keine Währung hinterlegt.");
      return;
    }

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
          aria-label={t("back")}
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
          placeholder={t("companyPlaceholder")}
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
          placeholder={t("namePlaceholder")}
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
        <div className="relative">
          <Input
            id="password"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordHint")}
            required
            minLength={8}
            autoComplete="new-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? "Passwort verbergen" : "Passwort anzeigen"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <Icon icon={showPw ? "ph:eye-slash" : "ph:eye"} className="size-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="passwordConfirm" className="text-sm font-medium">
          Passwort bestätigen
        </label>
        <div className="relative">
          <Input
            id="passwordConfirm"
            type={showPw ? "text" : "password"}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder={t("passwordRepeat")}
            required
            minLength={8}
            autoComplete="new-password"
            className="pr-10"
          />
        </div>
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
