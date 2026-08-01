"use client";

// Admin-Bereich: neue Storybook-Nutzer anlegen (E-Mail -> Sofort-Passwort).
// Geschützt durch die Middleware (Login) + serverseitigen Admin-Check in /api/users.
import { useCallback, useEffect, useState } from "react";

type UserRow = {
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
};

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ email: string; password: string } | null>(
    null,
  );
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.status === 403) {
      setForbidden(true);
      return;
    }
    const data = await res.json();
    if (data.users) setUsers(data.users);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const createUser = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      setCreated(null);
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(data.error ?? "Anlegen fehlgeschlagen.");
        return;
      }
      setCreated({ email: data.email, password: data.password });
      setEmail("");
      setName("");
      loadUsers();
    },
    [email, name, loadUsers],
  );

  if (forbidden) {
    return (
      <main style={page}>
        <div style={card}>
          <h1 style={{ marginTop: 0 }}>Kein Zugriff</h1>
          <p style={{ color: "#a1a1a1" }}>
            Nur Administratoren dürfen Nutzer verwalten.
          </p>
          {/* /sb ist der statische Storybook-Build, keine Next-Route —
              <Link> würde clientseitig navigieren und ins Leere laufen. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/sb/" style={{ color: "#b82028" }}>
            ← Zurück zum Storybook
          </a>
        </div>
      </main>
    );
  }

  return (
    <main style={page}>
      <div style={{ width: "100%", maxWidth: "44rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h1 style={{ margin: 0 }}>Nutzer verwalten</h1>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/sb/" style={{ color: "#b82028", fontSize: "0.9rem" }}>
            ← Storybook
          </a>
        </div>

        <form onSubmit={createUser} style={card}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Neuen Nutzer anlegen</h2>
          <p style={{ color: "#a1a1a1", fontSize: "0.9rem", marginTop: 0 }}>
            E-Mail eingeben — der Account wird sofort angelegt und ein Passwort
            erzeugt, das du der Person weitergibst.
          </p>
          <div style={{ display: "grid", gap: "0.6rem" }}>
            <input
              style={input}
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              style={input}
              type="email"
              placeholder="E-Mail des Eigentümers / Nutzers"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" disabled={loading} style={btn}>
              {loading ? "Lege an…" : "Anlegen"}
            </button>
            {error ? (
              <span style={{ color: "#e0454d", fontSize: "0.85rem" }}>{error}</span>
            ) : null}
          </div>

          {created ? (
            <div style={successBox}>
              <strong>Angelegt — bitte diese Daten weitergeben:</strong>
              <div style={{ marginTop: "0.5rem", fontFamily: "monospace", fontSize: "0.9rem" }}>
                <div>E-Mail: {created.email}</div>
                <div>Passwort: {created.password}</div>
              </div>
              <p style={{ color: "#a1a1a1", fontSize: "0.8rem", marginBottom: 0 }}>
                Das Passwort wird nur jetzt angezeigt. Notiere es.
              </p>
            </div>
          ) : null}
        </form>

        <div style={{ ...card, marginTop: "1.25rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
            Vorhandene Nutzer ({users.length})
          </h2>
          <div style={{ display: "grid", gap: "0.4rem" }}>
            {users.map((u) => (
              <div
                key={u.email ?? Math.random()}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.85rem",
                  padding: "0.4rem 0",
                  borderBottom: "1px solid #2a2a2a",
                }}
              >
                <span>{u.email}</span>
                <span style={{ color: "#a1a1a1" }}>
                  {u.last_sign_in_at
                    ? `zuletzt: ${new Date(u.last_sign_in_at).toLocaleDateString("de-DE")}`
                    : "noch nie angemeldet"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0a0a0a",
  color: "#fafafa",
  fontFamily: "system-ui, sans-serif",
  display: "grid",
  placeItems: "start center",
  padding: "2.5rem 1rem",
};
const card: React.CSSProperties = {
  background: "#161616",
  border: "1px solid #2a2a2a",
  borderRadius: "0.6rem",
  padding: "1.5rem",
};
const input: React.CSSProperties = {
  padding: "0.6rem 0.8rem",
  borderRadius: "0.4rem",
  border: "1px solid #2a2a2a",
  background: "#0a0a0a",
  color: "#fafafa",
  fontSize: "0.95rem",
};
const btn: React.CSSProperties = {
  padding: "0.65rem",
  borderRadius: "0.4rem",
  border: "none",
  background: "#b82028",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "0.95rem",
};
const successBox: React.CSSProperties = {
  marginTop: "1rem",
  padding: "1rem",
  borderRadius: "0.4rem",
  border: "1px solid #16a34a",
  background: "#0d1f14",
};
