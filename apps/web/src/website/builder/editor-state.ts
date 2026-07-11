import { nextPosition, reorderWithPositions } from "./position";

/*
 * Pure editor model + undo/redo history for the visual builder's draft. The
 * reducer only manipulates the in-memory section model; persistence (autosave,
 * structural actions) is layered on top in `use-section-editor`. Snapshot-based
 * history keeps undo/redo trivial: content, visibility, order, add and remove
 * are all reversible against the same stable ids.
 */

export interface EditorSection {
  id: string;
  typeKey: string;
  typeVersion: number;
  props: Record<string, unknown>;
  isVisible: boolean;
  locale: string;
  position: number;
}

export interface EditorState {
  present: EditorSection[];
  past: EditorSection[][];
  future: EditorSection[][];
}

export type EditorAction =
  | { type: "reset"; sections: EditorSection[] }
  | { type: "reorder"; from: number; to: number }
  | { type: "setProps"; id: string; props: Record<string, unknown> }
  | { type: "setVisible"; id: string; isVisible: boolean }
  | { type: "insert"; section: EditorSection; index?: number }
  | { type: "remove"; id: string }
  | { type: "remapIds"; idMap: Record<string, string> }
  | { type: "undo" }
  | { type: "redo" };

export function initEditorState(sections: EditorSection[]): EditorState {
  return { present: sortByPosition(sections), past: [], future: [] };
}

function sortByPosition(sections: EditorSection[]): EditorSection[] {
  return [...sections].sort((a, b) => a.position - b.position);
}

/** Commit a new present, pushing the old one onto the undo stack. */
function commit(state: EditorState, present: EditorSection[]): EditorState {
  return { present, past: [...state.past, state.present], future: [] };
}

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case "reset":
      return initEditorState(action.sections);

    case "reorder": {
      const present = reorderWithPositions(
        state.present,
        action.from,
        action.to,
      );
      return commit(state, present);
    }

    case "setProps": {
      const present = state.present.map((s) =>
        s.id === action.id ? { ...s, props: action.props } : s,
      );
      return commit(state, present);
    }

    case "setVisible": {
      const present = state.present.map((s) =>
        s.id === action.id ? { ...s, isVisible: action.isVisible } : s,
      );
      return commit(state, present);
    }

    case "insert": {
      const index = action.index ?? state.present.length;
      const present = [...state.present];
      present.splice(index, 0, action.section);
      return commit(state, present);
    }

    case "remove": {
      const present = state.present.filter((s) => s.id !== action.id);
      return commit(state, present);
    }

    case "remapIds": {
      // History-preserving id substitution (temp → real) after a sync. Applied
      // across every snapshot so undo/redo stay consistent. Not itself undoable.
      const remap = (list: EditorSection[]) =>
        list.map((s) => ({ ...s, id: action.idMap[s.id] ?? s.id }));
      return {
        present: remap(state.present),
        past: state.past.map(remap),
        future: state.future.map(remap),
      };
    }

    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1]!;
      return {
        present: previous,
        past: state.past.slice(0, -1),
        future: [state.present, ...state.future],
      };
    }

    case "redo": {
      if (state.future.length === 0) return state;
      const next = state.future[0]!;
      return {
        present: next,
        past: [...state.past, state.present],
        future: state.future.slice(1),
      };
    }

    default:
      return state;
  }
}

export const canUndo = (state: EditorState): boolean => state.past.length > 0;
export const canRedo = (state: EditorState): boolean => state.future.length > 0;

/** Append a new section at the end with the next spaced position. */
export function appendedSection(
  present: EditorSection[],
  section: Omit<EditorSection, "position">,
): EditorSection {
  const maxPosition = present.reduce((m, s) => Math.max(m, s.position), 0);
  return { ...section, position: nextPosition(maxPosition) };
}
