"use client";

import {
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Reveal, RevealItem } from "../../landing/reveal";
import { CheckIcon } from "../../landing/icons";
import { TeamIcon } from "../icons";
import { ShieldIcon } from "./icons";
import type { StatItem } from "../ui/stat-grid";
import {
  ProfileToast,
  type ToastState,
} from "../business-profile/profile-toast";
import { TeamFiltersBar } from "./team-filters";
import { TeamHeader } from "./team-header";
import { TeamStats } from "./team-stats";
import { TeamTable } from "./team-table";
import { MemberDrawer } from "./member-drawer";
import { MemberFormDrawer } from "./member-form-drawer";
import {
  inviteMemberAction,
  removeMemberAction,
  updateMemberAction,
} from "../../../src/server/actions/team";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type {
  MemberFilterRole,
  MemberFilterStatus,
  MemberRoleValue,
  MemberStatusValue,
  TeamFilters,
  TeamMemberListItem,
  TeamStats as TeamStatsData,
} from "../../../src/server/validators/team";

type OptimisticAction =
  | { type: "create"; member: TeamMemberListItem }
  | { type: "update"; member: TeamMemberListItem }
  | { type: "delete"; id: string };

interface TeamManagerProps {
  initialMembers: TeamMemberListItem[];
  stats: TeamStatsData;
  filters: TeamFilters;
}

interface FormState {
  open: boolean;
  mode: "create" | "edit";
  member: TeamMemberListItem | null;
}

export function TeamManager({
  initialMembers,
  stats,
  filters,
}: TeamManagerProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [members, applyOptimistic] = useOptimistic(
    initialMembers,
    (state, action: OptimisticAction) => {
      switch (action.type) {
        case "create":
          return [action.member, ...state];
        case "update":
          return state.map((m) =>
            m.id === action.member.id ? action.member : m,
          );
        case "delete":
          return state.filter((m) => m.id !== action.id);
      }
    },
  );

  const [search, setSearch] = useState(filters.search);
  const [role, setRole] = useState<MemberFilterRole>(filters.role);
  const [status, setStatus] = useState<MemberFilterStatus>(filters.status);
  const [isPending, startTransition] = useTransition();

  const [selected, setSelected] = useState<TeamMemberListItem | null>(null);
  const [form, setForm] = useState<FormState>({
    open: false,
    mode: "create",
    member: null,
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const navigate = useCallback(
    (
      nextSearch: string,
      nextRole: MemberFilterRole,
      nextStatus: MemberFilterStatus,
    ) => {
      const params = new URLSearchParams();
      if (nextSearch.trim()) params.set("q", nextSearch.trim());
      if (nextRole !== "all") params.set("role", nextRole);
      if (nextStatus !== "all") params.set("status", nextStatus);
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router],
  );

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const timer = window.setTimeout(
      () => navigate(search, role, status),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search, role, status, navigate]);

  const filtersActive =
    search.trim() !== "" || role !== "all" || status !== "all";

  const statItems: StatItem[] = [
    { id: "total", label: "Total members", value: String(stats.total), icon: TeamIcon },
    { id: "active", label: "Active members", value: String(stats.active), icon: CheckIcon },
    { id: "owners", label: "Owners", value: String(stats.owners), icon: ShieldIcon },
    { id: "managers", label: "Managers", value: String(stats.managers), icon: ShieldIcon },
  ];

  function clearFilters() {
    setSearch("");
    setRole("all");
    setStatus("all");
  }

  function openInvite() {
    setFieldErrors({});
    setForm({ open: true, mode: "create", member: null });
  }

  function openEdit(member: TeamMemberListItem) {
    setSelected(null);
    setFieldErrors({});
    setForm({ open: true, mode: "edit", member });
  }

  function closeForm() {
    setForm((prev) => ({ ...prev, open: false }));
  }

  function handleRemove(member: TeamMemberListItem) {
    startTransition(async () => {
      applyOptimistic({ type: "delete", id: member.id });
      const result = await removeMemberAction(member.id);
      setToast({
        tone: result.status === "success" ? "success" : "error",
        message: result.message,
      });
    });
  }

  function handleSubmit(formData: FormData) {
    const isEdit = form.mode === "edit" && form.member !== null;

    const optimisticMember: TeamMemberListItem = isEdit
      ? {
          ...form.member!,
          role: String(formData.get("role") ?? form.member!.role) as MemberRoleValue,
          status: String(
            formData.get("status") ?? form.member!.status,
          ) as MemberStatusValue,
        }
      : {
          id: `optimistic-${Date.now()}`,
          userId: `optimistic-${Date.now()}`,
          name: String(formData.get("name") ?? ""),
          email: String(formData.get("email") ?? ""),
          role: String(formData.get("role") ?? "employee") as MemberRoleValue,
          status: "active",
          title: null,
          createdAt: new Date(),
        };

    startTransition(async () => {
      applyOptimistic(
        isEdit
          ? { type: "update", member: optimisticMember }
          : { type: "create", member: optimisticMember },
      );

      const result = isEdit
        ? await updateMemberAction(form.member!.id, formData)
        : await inviteMemberAction(formData);

      if (result.status === "success") {
        setFieldErrors({});
        setForm((prev) => ({ ...prev, open: false }));
        setToast({ tone: "success", message: result.message });
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        setToast({ tone: "error", message: result.message });
      }
    });
  }

  return (
    <>
      <Reveal as="div" className="flex flex-col gap-6">
        <RevealItem>
          <TeamHeader onInvite={openInvite} />
        </RevealItem>
        <RevealItem>
          <TeamStats stats={statItems} />
        </RevealItem>
        <RevealItem>
          <TeamFiltersBar
            search={search}
            role={role}
            status={status}
            onSearch={setSearch}
            onRole={setRole}
            onStatus={setStatus}
          />
        </RevealItem>
        <RevealItem>
          <TeamTable
            members={members}
            filtersActive={filtersActive}
            pending={isPending}
            onView={setSelected}
            onEdit={openEdit}
            onRemove={handleRemove}
            onClearFilters={clearFilters}
            onInvite={openInvite}
          />
        </RevealItem>
      </Reveal>

      <MemberDrawer
        member={selected}
        onClose={() => setSelected(null)}
        onEdit={openEdit}
      />

      <MemberFormDrawer
        key={`${form.mode}-${form.member?.id ?? "new"}`}
        open={form.open}
        mode={form.mode}
        member={form.member}
        pending={isPending}
        fieldErrors={fieldErrors}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />

      <ProfileToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
