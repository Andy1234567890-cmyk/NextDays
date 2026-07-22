// Codeüberschreibungen (Framer „Code Overrides"): Vorlage für neue Dateien +
// Export-Parser für das „Überschreiben"-Select.

// Vorlage für neue Code-Override-Dateien (wie Framers „Examples"-Datei):
// drei Beispiel-Overrides. Jeder Export erscheint im „Überschreiben"-Select
// und wirkt real auf den Frame (Motion-Props/Farbe).
export const CODE_TEMPLATE = `import { forwardRef, type ComponentType } from "react"

// Overrides erweitern eine Komponente (Motion-Props, Farben, Events).
// Jeder Export erscheint im Inspektor unter „Überschreiben".

export function withRotate(Component): ComponentType {
    return forwardRef((props, ref) => {
        return (
            <Component
                ref={ref}
                {...props}
                animate={{ rotate: 90 }}
                transition={{ duration: 2 }}
            />
        )
    })
}

export function withHover(Component): ComponentType {
    return forwardRef((props, ref) => {
        return <Component ref={ref} {...props} whileHover={{ scale: 1.05 }} />
    })
}

export function withRandomColor(Component): ComponentType {
    return forwardRef((props, ref) => {
        const hue = Math.round(Math.random() * 360)
        return <Component ref={ref} {...props} background={\`hsl(\${hue}, 80%, 60%)\`} />
    })
}
`;

// Export-Namen aus dem Quelltext lesen (→ Optionen im „Überschreiben"-Select).
export function parseOverrides(src: string): string[] {
  const out: string[] = [];
  const re = /export\s+(?:function|const)\s+(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return out;
}
