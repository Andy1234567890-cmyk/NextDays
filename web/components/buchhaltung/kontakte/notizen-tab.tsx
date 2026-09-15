"use client";

// Reiter „Notizen": Verlauf (neueste zuerst) mit Autor, Zeit und
// Schlagwörtern; neue Notiz oben, Bearbeiten inline, Löschen mit Rückfrage.
// Kein Realtime (customer_notes gesperrt, Wurzel 6) — `router.refresh()`.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { Textarea } from "@nextdays/ui/textarea";
import { createNotiz, deleteNotiz, updateNotiz } from "@/lib/buchhaltung-kontakte";
import type { Notiz } from "@/lib/buchhaltung-kontakte-typen";

function tagsAusText(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function NotizenTab({ customerId, notizen }: { customerId: string; notizen: Notiz[] }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const router = useRouter();
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [bearbeitetId, setBearbeitetId] = useState<string | null>(null);
  const [bearbeitetText, setBearbeitetText] = useState("");
  const [bearbeitetTags, setBearbeitetTags] = useState("");

  const zeit = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

  async function anlegen() {
    if (!text.trim()) {
      setFehler(t("kontaktePage.notizen.textRequired"));
      return;
    }
    setBusy(true);
    setFehler(null);
    const res = await createNotiz(customerId, { text: text.trim(), tags: tagsAusText(tags) });
    setBusy(false);
    if (res.ok) {
      setText("");
      setTags("");
      router.refresh();
    } else {
      setFehler(res.error);
    }
  }

  function bearbeitenStarten(n: Notiz) {
    setBearbeitetId(n.id);
    setBearbeitetText(n.text);
    setBearbeitetTags(n.tags.join(", "));
    setFehler(null);
  }

  async function bearbeitenSpeichern() {
    if (!bearbeitetId || !bearbeitetText.trim()) return;
    setBusy(true);
    const res = await updateNotiz(customerId, bearbeitetId, {
      text: bearbeitetText.trim(),
      tags: tagsAusText(bearbeitetTags),
    });
    setBusy(false);
    if (res.ok) {
      setBearbeitetId(null);
      router.refresh();
    } else {
      setFehler(res.error);
    }
  }

  async function loeschen(n: Notiz) {
    if (!window.confirm(t("kontaktePage.notizen.deleteConfirm"))) return;
    setFehler(null);
    const res = await deleteNotiz(customerId, n.id);
    if (res.ok) router.refresh();
    else setFehler(res.error);
  }

  return (
    <div className="flex flex-col gap-3">
      <NeueNotiz
        text={text}
        setText={setText}
        tags={tags}
        setTags={setTags}
        busy={busy}
        fehler={fehler}
        onAnlegen={anlegen}
      />

      {notizen.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <Icon icon="ph:note" className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("kontaktePage.notizen.empty")}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {notizen.map((n) => (
            <li key={n.id}>
              <Card className="flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {n.authorName ?? t("kontaktePage.notizen.unknownAuthor")} · {zeit(n.createdAt)}
                    {n.updatedAt !== n.createdAt ? ` · ${t("kontaktePage.notizen.edited")}` : ""}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => bearbeitenStarten(n)}>
                      <Icon icon="ph:pencil-simple" className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => loeschen(n)}>
                      <Icon icon="ph:trash" className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {bearbeitetId === n.id ? (
                  <div className="flex flex-col gap-2">
                    <Textarea
                      value={bearbeitetText}
                      onChange={(e) => setBearbeitetText(e.target.value)}
                      maxLength={5000}
                    />
                    <Input
                      value={bearbeitetTags}
                      onChange={(e) => setBearbeitetTags(e.target.value)}
                      placeholder={t("kontaktePage.notizen.tagsPlaceholder")}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => setBearbeitetId(null)}>
                        {t("kontaktePage.cancel")}
                      </Button>
                      <Button size="sm" disabled={busy} onClick={bearbeitenSpeichern}>
                        {t("kontaktePage.save")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-line text-sm">{n.text}</p>
                    {n.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {n.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Das Formular für eine neue Notiz. */
function NeueNotiz({
  text,
  setText,
  tags,
  setTags,
  busy,
  fehler,
  onAnlegen,
}: {
  text: string;
  setText: (v: string) => void;
  tags: string;
  setTags: (v: string) => void;
  busy: boolean;
  fehler: string | null;
  onAnlegen: () => void;
}) {
  const t = useTranslations("finance");
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nz-text">{t("kontaktePage.notizen.newNote")}</Label>
        <Textarea
          id="nz-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("kontaktePage.notizen.placeholder")}
          maxLength={5000}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nz-tags">{t("kontaktePage.notizen.tags")}</Label>
        <Input
          id="nz-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={t("kontaktePage.notizen.tagsPlaceholder")}
        />
      </div>
      {fehler && (
        <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {fehler}
        </p>
      )}
      <div className="flex justify-end">
        <Button onClick={onAnlegen} disabled={busy} className="gap-2">
          <Icon icon="ph:note-pencil" className="size-4" />
          {busy ? t("kontaktePage.saving") : t("kontaktePage.notizen.add")}
        </Button>
      </div>
    </Card>

  );
}
