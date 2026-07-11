"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { syncPageSectionsAction } from "../../server/actions/website";
import { getSection } from "../sections/registry";
import {
  appendedSection,
  canRedo,
  canUndo,
  editorReducer,
  initEditorState,
  type EditorSection,
} from "./editor-state";

/*
 * Draft editing store for the visual builder. Wraps the pure reducer with
 * debounced autosave: every model change marks the draft dirty and, after a
 * quiet period, reconciles the whole page through a single server action.
 * New/duplicated sections carry client temp ids that the server maps to real
 * ids (adopted in place, history included). Only one sync runs at a time; a
 * change during a save re-arms the next one. Publishing stays manual.
 */

export type EditorStatus = "saved" | "dirty" | "saving" | "error";

const DEBOUNCE_MS = 700;

function serialize(sections: EditorSection[]): string {
  return JSON.stringify(
    sections.map((s) => [
      s.id,
      s.typeKey,
      s.typeVersion,
      s.props,
      s.isVisible,
      s.locale,
      s.position,
    ]),
  );
}

const tempId = (): string => `new-${crypto.randomUUID()}`;

const applyIdMap = (
  sections: EditorSection[],
  idMap: Record<string, string>,
): EditorSection[] =>
  sections.map((s) => (idMap[s.id] ? { ...s, id: idMap[s.id]! } : s));

export interface SectionEditor {
  sections: EditorSection[];
  status: EditorStatus;
  canUndo: boolean;
  canRedo: boolean;
  reorder: (from: number, to: number) => void;
  setProps: (id: string, props: Record<string, unknown>) => void;
  setVisible: (id: string, isVisible: boolean) => void;
  addSection: (typeKey: string) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  undo: () => void;
  redo: () => void;
}

export function useSectionEditor(
  pageId: string,
  initial: EditorSection[],
): SectionEditor {
  const [state, dispatch] = useReducer(editorReducer, initial, initEditorState);
  const [status, setStatus] = useState<EditorStatus>("saved");

  // Latest present, readable inside async callbacks without stale closures.
  const presentRef = useRef(state.present);
  presentRef.current = state.present;
  const lastSyncedRef = useRef<string>(serialize(state.present));
  const savingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncRef = useRef<() => void>(() => {});

  const scheduleSync = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => syncRef.current(), DEBOUNCE_MS);
  }, []);

  // Redefined every render so it closes over the latest present via the ref.
  async function runSync(): Promise<void> {
    if (savingRef.current) return;
    const snapshot = presentRef.current;
    if (serialize(snapshot) === lastSyncedRef.current) {
      setStatus("saved");
      return;
    }
    savingRef.current = true;
    setStatus("saving");

    const result = await syncPageSectionsAction({
      pageId,
      sections: snapshot.map((s) => ({
        id: s.id,
        typeKey: s.typeKey,
        typeVersion: s.typeVersion,
        props: s.props,
        isVisible: s.isVisible,
        locale: s.locale,
        position: s.position,
      })),
    });
    savingRef.current = false;

    if (result.status !== "success") {
      setStatus("error");
      scheduleSync();
      return;
    }

    const idMap = result.idMap ?? {};
    if (Object.keys(idMap).length > 0) dispatch({ type: "remapIds", idMap });
    // The clean baseline is exactly what we persisted, with ids remapped.
    lastSyncedRef.current = serialize(applyIdMap(snapshot, idMap));

    // Anything changed during the save (compared with ids remapped) stays dirty.
    if (serialize(applyIdMap(presentRef.current, idMap)) !== lastSyncedRef.current) {
      setStatus("dirty");
      scheduleSync();
    } else {
      setStatus("saved");
    }
  }
  syncRef.current = () => void runSync();

  // Mark dirty + (re)arm the debounce whenever the model diverges from saved.
  useEffect(() => {
    if (serialize(state.present) === lastSyncedRef.current) return;
    setStatus((s) => (s === "saving" ? s : "dirty"));
    scheduleSync();
  }, [state.present, scheduleSync]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const reorder = useCallback(
    (from: number, to: number) => dispatch({ type: "reorder", from, to }),
    [],
  );
  const setProps = useCallback(
    (id: string, props: Record<string, unknown>) =>
      dispatch({ type: "setProps", id, props }),
    [],
  );
  const setVisible = useCallback(
    (id: string, isVisible: boolean) =>
      dispatch({ type: "setVisible", id, isVisible }),
    [],
  );
  const remove = useCallback(
    (id: string) => dispatch({ type: "remove", id }),
    [],
  );
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  const addSection = useCallback((typeKey: string) => {
    const def = getSection(typeKey);
    if (!def) return;
    const section = appendedSection(presentRef.current, {
      id: tempId(),
      typeKey,
      typeVersion: def.version,
      props: structuredClone(def.defaultProps) as Record<string, unknown>,
      isVisible: true,
      locale: "en-us",
    });
    dispatch({ type: "insert", section });
  }, []);

  const duplicate = useCallback((id: string) => {
    const present = presentRef.current;
    const index = present.findIndex((s) => s.id === id);
    const source = present[index];
    if (!source) return;
    const copy = appendedSection(present, {
      id: tempId(),
      typeKey: source.typeKey,
      typeVersion: source.typeVersion,
      props: structuredClone(source.props),
      isVisible: source.isVisible,
      locale: source.locale,
    });
    dispatch({ type: "insert", section: copy, index: index + 1 });
  }, []);

  return {
    sections: state.present,
    status,
    canUndo: canUndo(state),
    canRedo: canRedo(state),
    reorder,
    setProps,
    setVisible,
    addSection,
    duplicate,
    remove,
    undo,
    redo,
  };
}
