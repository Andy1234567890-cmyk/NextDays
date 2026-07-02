"use client";

// Blöcke laden & speichern: die initialen site_blocks in den (von Craft
// erzeugten) ROOT-Canvas laden; „Veröffentlichen" serialisiert den Craft-Baum
// zurück in site_blocks und spielt die frischen DB-IDs zurück, damit erneutes
// Speichern sauber diff't.
import { useEditor } from "@craftjs/core";
import { ROOT_NODE } from "@craftjs/utils";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { Block, Page } from "@/lib/site-pages";
import { syncBlocks } from "@/lib/site-pages";

import { blocksToSerializedNodes, craftJsonToBlocks } from "../serialize";

export function usePageBlocks(page: Page, initialBlocks: Block[]) {
  const { query, actions } = useEditor();
  const [saving, setSaving] = useState(false);

  // Blöcke in den (von Craft erzeugten) ROOT-Canvas laden.
  // parseSerializedNode().toNode() löst jeden resolvedName gegen den laufenden
  // Resolver auf und hängt den Knoten an ROOT.
  const loadBlocks = (blocks: Block[]) => {
    const serialized = blocksToSerializedNodes(blocks);
    serialized.forEach((sn, i) => {
      const node = query.parseSerializedNode(sn).toNode();
      actions.add(node, ROOT_NODE, i);
    });
  };

  // Erst laden, wenn der ROOT-Canvas wirklich existiert (Frame gemountet). Beim
  // ersten Effect-Lauf ist ROOT sonst noch nicht da → Blöcke gingen verloren
  // (Symptom: leere Canvas trotz vorhandener Blöcke).
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current || initialBlocks.length === 0) return;
    let tries = 0;
    const tryLoad = () => {
      tries += 1;
      const rootExists = !!query.getNodes()[ROOT_NODE];
      if (rootExists) {
        loadedRef.current = true;
        loadBlocks(initialBlocks);
      } else if (tries < 30) {
        requestAnimationFrame(tryLoad);
      }
    };
    requestAnimationFrame(tryLoad);
    // nur beim ersten Mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setSaving(true);
    try {
      const json = query.serialize();
      const blocks = craftJsonToBlocks(json);
      const res = await syncBlocks(page.id, blocks);
      if (res.ok) {
        // Frische DB-IDs zurückspielen, damit erneutes Speichern sauber diff't:
        // ROOT-Kinder entfernen, dann mit den echten IDs neu laden.
        const rootChildren = [...query.node(ROOT_NODE).get().data.nodes];
        rootChildren.forEach((id) => actions.delete(id));
        loadBlocks(res.data.items);
        toast.success("Gespeichert");
      } else {
        toast.error(res.error);
      }
    } finally {
      setSaving(false);
    }
  }

  return { save, saving };
}
