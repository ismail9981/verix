import { describe, it, expect } from "vitest";
import {
  appendedSection,
  canRedo,
  canUndo,
  editorReducer,
  initEditorState,
  type EditorSection,
} from "./editor-state";

function mk(id: string, position: number): EditorSection {
  return {
    id,
    typeKey: "hero",
    typeVersion: 1,
    props: { heading: id },
    isVisible: true,
    locale: "en-us",
    position,
  };
}
const base = () => [mk("a", 1000), mk("b", 2000), mk("c", 3000)];

describe("editorReducer", () => {
  it("initializes sorted by position", () => {
    const s = initEditorState([mk("c", 3000), mk("a", 1000)]);
    expect(s.present.map((x) => x.id)).toEqual(["a", "c"]);
    expect(canUndo(s)).toBe(false);
  });

  it("setProps updates content and pushes history", () => {
    let s = initEditorState(base());
    s = editorReducer(s, { type: "setProps", id: "b", props: { heading: "x" } });
    expect(s.present.find((x) => x.id === "b")!.props.heading).toBe("x");
    expect(canUndo(s)).toBe(true);
  });

  it("undo then redo restores a visibility toggle", () => {
    let s = initEditorState(base());
    s = editorReducer(s, { type: "setVisible", id: "a", isVisible: false });
    expect(s.present.find((x) => x.id === "a")!.isVisible).toBe(false);
    s = editorReducer(s, { type: "undo" });
    expect(s.present.find((x) => x.id === "a")!.isVisible).toBe(true);
    expect(canRedo(s)).toBe(true);
    s = editorReducer(s, { type: "redo" });
    expect(s.present.find((x) => x.id === "a")!.isVisible).toBe(false);
  });

  it("reorder is applied and is undoable", () => {
    let s = initEditorState(base());
    s = editorReducer(s, { type: "reorder", from: 0, to: 2 });
    expect(s.present.map((x) => x.id)).toEqual(["b", "c", "a"]);
    s = editorReducer(s, { type: "undo" });
    expect(s.present.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("insert (with/without index) and remove are undoable with stable ids", () => {
    let s = initEditorState(base());
    s = editorReducer(s, { type: "insert", section: mk("d", 4000) });
    expect(s.present.map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
    s = editorReducer(s, { type: "insert", section: mk("x", 1500), index: 1 });
    expect(s.present.map((x) => x.id)).toEqual(["a", "x", "b", "c", "d"]);
    s = editorReducer(s, { type: "remove", id: "b" });
    expect(s.present.map((x) => x.id)).toEqual(["a", "x", "c", "d"]);
    // Undo of a remove restores the same section (soft-delete/restore parity).
    s = editorReducer(s, { type: "undo" });
    expect(s.present.map((x) => x.id)).toEqual(["a", "x", "b", "c", "d"]);
  });

  it("remaps ids across present and history consistently", () => {
    let s = initEditorState(base());
    s = editorReducer(s, { type: "insert", section: mk("new-1", 4000) });
    s = editorReducer(s, { type: "remapIds", idMap: { "new-1": "real-1" } });
    expect(s.present.map((x) => x.id)).toContain("real-1");
    // Undo removes the (now real) section; redo restores it — no temp id leaks.
    s = editorReducer(s, { type: "undo" });
    expect(s.present.map((x) => x.id)).toEqual(["a", "b", "c"]);
    s = editorReducer(s, { type: "redo" });
    expect(s.present.map((x) => x.id)).toContain("real-1");
    expect(s.present.map((x) => x.id)).not.toContain("new-1");
  });

  it("clears the redo stack when a new change is made after an undo", () => {
    let s = initEditorState(base());
    s = editorReducer(s, { type: "setVisible", id: "a", isVisible: false });
    s = editorReducer(s, { type: "undo" });
    expect(canRedo(s)).toBe(true);
    s = editorReducer(s, { type: "setVisible", id: "b", isVisible: false });
    expect(canRedo(s)).toBe(false);
  });

  it("undo/redo at the boundaries are no-ops", () => {
    let s = initEditorState(base());
    s = editorReducer(s, { type: "undo" });
    expect(s.present.map((x) => x.id)).toEqual(["a", "b", "c"]);
    s = editorReducer(s, { type: "redo" });
    expect(s.present.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});

describe("appendedSection", () => {
  it("assigns the next spaced position after the max", () => {
    const s = appendedSection(base(), {
      id: "d",
      typeKey: "hero",
      typeVersion: 1,
      props: {},
      isVisible: true,
      locale: "en-us",
    });
    expect(s.position).toBe(4000);
  });
});
