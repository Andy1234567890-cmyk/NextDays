"use client";

// Login-Gate für das Storybook. Nur befugte Nutzer (Supabase Auth) kommen rein.
// Nach erfolgreicher Anmeldung Weiterleitung zum Storybook (/sb).
import { Icon } from "@iconify/react";
import { useState } from "react";

import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("denied")
      ? "Dieser Account hat keinen Zugang zum Design-System."
      : null,
  );
  const [loading, setLoading] = useState(false);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: e2 } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (e2) {
      setError("Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.");
      return;
    }
    // Ziel aus ?next= übernehmen, sonst zum Storybook.
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    window.location.href = next && next !== "/login" ? next : "/sb/";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0a0a0a",
        color: "#fafafa",
      }}
    >
      <form
        onSubmit={signIn}
        style={{
          width: "22rem",
          background: "#161616",
          border: "1px solid #2a2a2a",
          borderRadius: "0.6rem",
          padding: "2rem",
          display: "grid",
          gap: "0.85rem",
        }}
      >
        {/* Original-Logo (Logo_transparent.png, schwarze Schrift) — auf weißem
            Chip, damit es auf der dunklen Karte sichtbar bleibt und die
            Markenfarben erhalten sind. Die Datei hat viel transparente Fläche;
            wie in apps/web/components/logo.tsx zeigen wir nur den sichtbaren
            Bereich (bbox 1446×375 @ 87/420 von 1600). */}
        <span
          style={{
            justifySelf: "center",
            background: "#fff",
            borderRadius: "0.5rem",
            padding: "0.6rem 0.9rem",
            lineHeight: 0,
          }}
        >
          <span
            style={{
              width: `${3 * (1446 / 375)}rem`,
              height: "3rem",
              display: "inline-block",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <img
              src="/Logo_transparent.png"
              alt="myNextDays — powered by AirSmil"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: `${(1600 / 1446) * 100}%`,
                height: "auto",
                maxWidth: "none",
                transform: `translate(-${(87 / 1600) * 100}%, -${(420 / 1600) * 100}%)`,
              }}
            />
          </span>
        </span>
        <h1 style={{ margin: "0.25rem 0 0.25rem", fontSize: "1.25rem" }}>
          myNextDays Design-System
        </h1>
        <p style={{ margin: 0, color: "#a1a1a1", fontSize: "0.9rem" }}>
          Geschützter Bereich. Bitte anmelden.
        </p>
        <input
          type="email"
          placeholder="E-Mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        {/* Passwort mit Sichtbarkeits-Umschalter (Auge) */}
        <div style={{ position: "relative" }}>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ ...inputStyle, width: "100%", paddingRight: "2.6rem" }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
            title={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
            style={{
              position: "absolute",
              right: "0.5rem",
              top: "50%",
              transform: "translateY(-50%)",
              display: "grid",
              placeItems: "center",
              width: "1.9rem",
              height: "1.9rem",
              border: "none",
              background: "transparent",
              color: "#a1a1a1",
              cursor: "pointer",
              borderRadius: "0.3rem",
            }}
          >
            <Icon
              icon={showPassword ? "ph:eye-slash" : "ph:eye"}
              width="1.1rem"
              height="1.1rem"
            />
          </button>
        </div>
        <button type="submit" disabled={loading} style={btnStyle}>
          {loading ? "Anmelden…" : "Anmelden"}
        </button>
        {error ? (
          <span style={{ color: "#e0454d", fontSize: "0.85rem" }}>{error}</span>
        ) : null}
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "0.6rem 0.8rem",
  borderRadius: "0.4rem",
  border: "1px solid #2a2a2a",
  background: "#0a0a0a",
  color: "#fafafa",
  fontSize: "0.95rem",
  boxSizing: "border-box",
};

const btnStyle: React.CSSProperties = {
  padding: "0.65rem",
  borderRadius: "0.4rem",
  border: "none",
  background: "#b82028",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "0.95rem",
};
