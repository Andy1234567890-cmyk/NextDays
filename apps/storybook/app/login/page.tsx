"use client";

// Login-Gate für das Storybook. Nur befugte Nutzer (Supabase Auth) kommen rein.
// Nach erfolgreicher Anmeldung Weiterleitung zum Storybook (/sb).
import { useState } from "react";

import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.25rem" }}>
          NextDays Design-System
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
        <input
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />
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
