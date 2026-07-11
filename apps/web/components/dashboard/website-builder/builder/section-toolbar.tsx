"use client";

import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";

/*
 * Per-section action bar: drag handle, keyboard move up/down, and the four
 * required actions (Edit, Duplicate, Hide/Show, Delete). Every control is a
 * real <button> with an aria-label; the drag handle also carries dnd-kit's
 * keyboard-sortable attributes so reordering works without a pointer.
 */

interface SectionToolbarProps {
  label: string;
  isVisible: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  dragHandleProps: {
    attributes: DraggableAttributes;
    listeners: SyntheticListenerMap | undefined;
  };
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleVisible: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const btn =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 disabled:hover:bg-transparent";

export function SectionToolbar({
  label,
  isVisible,
  canMoveUp,
  canMoveDown,
  dragHandleProps,
  onEdit,
  onDuplicate,
  onToggleVisible,
  onDelete,
  onMoveUp,
  onMoveDown,
}: SectionToolbarProps) {
  return (
    <div className="flex items-center gap-1 border-b border-hairline bg-surface/60 px-2 py-1.5">
      <button
        type="button"
        className={`${btn} cursor-grab active:cursor-grabbing`}
        aria-label={`Drag to reorder ${label}`}
        {...dragHandleProps.attributes}
        {...dragHandleProps.listeners}
      >
        <GripIcon />
      </button>
      <button
        type="button"
        className={btn}
        onClick={onMoveUp}
        disabled={!canMoveUp}
        aria-label={`Move ${label} up`}
      >
        <ChevronIcon dir="up" />
      </button>
      <button
        type="button"
        className={btn}
        onClick={onMoveDown}
        disabled={!canMoveDown}
        aria-label={`Move ${label} down`}
      >
        <ChevronIcon dir="down" />
      </button>

      <span className="ml-1 truncate text-xs font-medium text-white">{label}</span>

      <div className="ml-auto flex items-center gap-1">
        <button type="button" className={btn} onClick={onEdit} aria-label={`Edit ${label}`}>
          <EditIcon />
        </button>
        <button
          type="button"
          className={btn}
          onClick={onDuplicate}
          aria-label={`Duplicate ${label}`}
        >
          <DuplicateIcon />
        </button>
        <button
          type="button"
          className={btn}
          onClick={onToggleVisible}
          aria-label={isVisible ? `Hide ${label}` : `Show ${label}`}
          aria-pressed={!isVisible}
        >
          {isVisible ? <EyeIcon /> : <EyeOffIcon />}
        </button>
        <button
          type="button"
          className={`${btn} hover:text-danger`}
          onClick={onDelete}
          aria-label={`Delete ${label}`}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

/* --- Inline icons (currentColor, decorative) --- */
const svg = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function GripIcon() {
  return (
    <svg {...svg}>
      <circle cx="9" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
      <circle cx="15" cy="6" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="18" r="1" />
    </svg>
  );
}
function ChevronIcon({ dir }: { dir: "up" | "down" }) {
  return (
    <svg {...svg}>
      {dir === "up" ? <path d="m18 15-6-6-6 6" /> : <path d="m6 9 6 6 6-6" />}
    </svg>
  );
}
function EditIcon() {
  return (
    <svg {...svg}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
function DuplicateIcon() {
  return (
    <svg {...svg}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg {...svg}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg {...svg}>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.1 9.1 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg {...svg}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
