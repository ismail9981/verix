"use client";

import { useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Toggle } from "../business-profile/toggle";
import { SectionCard } from "../home/section-card";
import { ChevronDownIcon, ChevronUpIcon, GripIcon } from "./icons";
import { SECTIONS } from "./mock-data";
import type { BuilderSection } from "./types";

interface SectionRowProps {
  section: BuilderSection;
  index: number;
  count: number;
  onMove: (index: number, direction: -1 | 1) => void;
  onToggle: (id: string, enabled: boolean) => void;
}

function SectionRow({ section, index, count, onMove, onToggle }: SectionRowProps) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={section}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-3 rounded-xl border border-hairline bg-canvas/40 p-3"
    >
      {/* Drag handle initiates drag; buttons/toggle stay clickable */}
      <button
        type="button"
        aria-label={`Drag ${section.name} to reorder`}
        onPointerDown={(event) => controls.start(event)}
        className="cursor-grab touch-none rounded-md p-1 text-muted transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
      >
        <GripIcon className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{section.name}</p>
        <p className="truncate text-xs text-muted">{section.description}</p>
      </div>

      {/* Keyboard-accessible reordering */}
      <div className="flex items-center">
        <button
          type="button"
          aria-label={`Move ${section.name} up`}
          disabled={index === 0}
          onClick={() => onMove(index, -1)}
          className="rounded-md p-1 text-muted transition-colors hover:text-white disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ChevronUpIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={`Move ${section.name} down`}
          disabled={index === count - 1}
          onClick={() => onMove(index, 1)}
          className="rounded-md p-1 text-muted transition-colors hover:text-white disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </button>
      </div>

      <Toggle
        checked={section.enabled}
        onChange={(value) => onToggle(section.id, value)}
        label={`${section.name} ${section.enabled ? "enabled" : "disabled"}`}
      />
    </Reorder.Item>
  );
}

export function SectionsPanel() {
  const [items, setItems] = useState<BuilderSection[]>(SECTIONS);

  const move = (index: number, direction: -1 | 1) => {
    const to = index + direction;
    if (to < 0 || to >= items.length) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  };

  const toggle = (id: string, enabled: boolean) =>
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, enabled } : item)),
    );

  return (
    <SectionCard
      id="sections"
      title="Sections"
      action={<span className="text-xs text-muted">Drag to reorder</span>}
    >
      <Reorder.Group
        axis="y"
        values={items}
        onReorder={setItems}
        className="flex flex-col gap-2"
      >
        {items.map((section, index) => (
          <SectionRow
            key={section.id}
            section={section}
            index={index}
            count={items.length}
            onMove={move}
            onToggle={toggle}
          />
        ))}
      </Reorder.Group>
    </SectionCard>
  );
}
