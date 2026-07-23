"use client";

// 6-Kästchen-Code-Eingabe (Airbnb-„Enter your verification code"). Ein Feld pro
// Ziffer, Auto-Fokus-Weiterspringen, Backspace zurück, Paste über alle Felder.
// Ruft onComplete, sobald alle 6 Ziffern da sind.
import {
  type ClipboardEvent,
  type KeyboardEvent,
  useRef,
  useState,
} from "react";

export function CodeEingabe({
  onChange,
  onComplete,
  disabled,
}: {
  onChange?: (code: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function push(next: string[]) {
    setDigits(next);
    const code = next.join("");
    onChange?.(code);
    if (code.length === 6) onComplete?.(code);
  }

  function setAt(i: number, val: string) {
    const d = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    push(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
  }

  function onKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = Array(6)
      .fill("")
      .map((_, i) => pasted[i] ?? "");
    push(next);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  }

  return (
    <div className="flex gap-2" onPaste={onPaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={(e) => setAt(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={i === 0}
          className="size-12 rounded-xl border border-border bg-background text-center text-lg font-semibold outline-none focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        />
      ))}
    </div>
  );
}
