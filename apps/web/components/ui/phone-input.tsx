"use client";

// Telefonfeld mit Ländervorwahl-Auswahl (alle 27 EU-Staaten + CH/UK).
// Speichert eine zusammengesetzte, international gültige Nummer („+49 15251…").
// Die Vorwahl-/Rest-Zerlegung liegt zentral in lib/countries (splitPhone/
// joinPhone), damit es nur EINE Quelle gibt. Kein Erfinden einer Vorwahl: ist
// in einem gespeicherten Wert keine bekannte Vorwahl erkennbar, bleibt der
// Selektor leer und der Wert steht im Nummern-Teil.
import { useEffect, useState } from "react";

import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { COUNTRIES, joinPhone, splitPhone } from "@/lib/countries";

type Props = {
  id?: string;
  value: string; // gespeicherte Gesamt-Nummer (E.164-nah)
  onChange: (value: string) => void;
  // Vorwahl-Vorbelegung (z. B. Land des Unternehmens), falls der Wert noch leer
  // ist. ISO-Alpha-2.
  defaultCountry?: string;
  required?: boolean;
  placeholder?: string;
};

export function PhoneInput({
  id,
  value,
  onChange,
  defaultCountry = "DE",
  required,
  placeholder = "1525 1239026",
}: Props) {
  const parsed = splitPhone(value);
  // Vorwahl: aus dem Wert, sonst aus dem Default-Land.
  const fallbackDial =
    COUNTRIES.find((c) => c.code === defaultCountry.toUpperCase())?.dialCode ??
    "";
  const [dial, setDial] = useState(parsed.dial || fallbackDial);
  const [rest, setRest] = useState(parsed.rest);

  // Externen Wert übernehmen, wenn er sich ändert (z. B. nach dem Laden).
  useEffect(() => {
    const p = splitPhone(value);
    if (p.dial) setDial(p.dial);
    setRest(p.rest);
    // Nur auf Wertänderung reagieren.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function emit(nextDial: string, nextRest: string) {
    onChange(joinPhone(nextDial, nextRest));
  }

  return (
    <div className="flex gap-2">
      <NativeSelect
        aria-label="Ländervorwahl"
        className="w-28 shrink-0"
        value={dial}
        onChange={(e) => {
          setDial(e.target.value);
          emit(e.target.value, rest);
        }}
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.dialCode}>
            {c.code} {c.dialCode}
          </option>
        ))}
      </NativeSelect>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        required={required}
        placeholder={placeholder}
        value={rest}
        onChange={(e) => {
          setRest(e.target.value);
          emit(dial, e.target.value);
        }}
      />
    </div>
  );
}
