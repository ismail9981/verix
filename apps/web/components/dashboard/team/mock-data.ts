import { CheckIcon } from "../../landing/icons";
import type { SelectOption } from "../business-profile/types";
import { TeamIcon } from "../icons";
import type { StatItem } from "../ui/stat-grid";
import { CalendarIcon, ShieldIcon } from "./icons";
import type { Member } from "./types";

/* All team content is mock (Bloom Studio, a salon). Kept here so a real
   team/roster API can be dropped in without touching any component. */

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const STATS: StatItem[] = [
  { id: "total", label: "Total members", value: "8", icon: TeamIcon },
  { id: "active", label: "Active today", value: "5", icon: CheckIcon },
  { id: "managers", label: "Managers", value: "2", icon: ShieldIcon },
  { id: "availability", label: "Staff availability", value: "86%", icon: CalendarIcon },
];

function week(...hours: (string | null)[]): Member["weekly"] {
  return WEEKDAYS.map((day, index) => ({ day, hours: hours[index] ?? null }));
}

export const MEMBERS: Member[] = [
  {
    id: "m1",
    name: "Ava Thompson",
    title: "Owner · Senior Stylist",
    email: "ava@bloomstudio.com",
    phone: "+1 (415) 555-0110",
    initials: "AT",
    color: "#6d5ef9",
    role: "Owner",
    status: "Active",
    schedule: "Mon–Fri · 9–6",
    services: ["Balayage & Cut", "Color & Cut", "Blowout"],
    weekly: week("9:00–18:00", "9:00–18:00", "9:00–18:00", "9:00–20:00", "9:00–20:00", null, null),
    performance: { bookings: 86, revenue: "$15,480", rating: "4.9" },
    notes: "Founder. Leads the color team and mentors new stylists.",
    activeToday: true,
  },
  {
    id: "m2",
    name: "Diego Martinez",
    title: "Manager · Barber",
    email: "diego@bloomstudio.com",
    phone: "+1 (415) 555-0131",
    initials: "DM",
    color: "#2dd4bf",
    role: "Manager",
    status: "Active",
    schedule: "Tue–Sat · 10–7",
    services: ["Beard Trim", "Haircut"],
    weekly: week(null, "10:00–19:00", "10:00–19:00", "10:00–19:00", "10:00–19:00", "10:00–16:00", null),
    performance: { bookings: 64, revenue: "$2,240", rating: "4.8" },
    notes: "Runs the front-of-house schedule and inventory.",
    activeToday: true,
  },
  {
    id: "m3",
    name: "Mia Chen",
    title: "Nail Technician",
    email: "mia@bloomstudio.com",
    phone: "+1 (415) 555-0147",
    initials: "MC",
    color: "#f59e0b",
    role: "Employee",
    status: "Active",
    schedule: "Wed–Sun · 11–7",
    services: ["Gel Manicure", "Scalp Treatment"],
    weekly: week(null, null, "11:00–19:00", "11:00–19:00", "11:00–19:00", "11:00–19:00", "11:00–17:00"),
    performance: { bookings: 72, revenue: "$3,240", rating: "4.9" },
    notes: "Specializes in gel and nail art. Fully booked most weekends.",
    activeToday: true,
  },
  {
    id: "m4",
    name: "Noah Patel",
    title: "Colorist",
    email: "noah@bloomstudio.com",
    phone: "+1 (415) 555-0163",
    initials: "NP",
    color: "#38bdf8",
    role: "Employee",
    status: "Away",
    schedule: "Mon–Thu · 9–5",
    services: ["Color & Cut", "Balayage & Cut"],
    weekly: week("9:00–17:00", "9:00–17:00", "9:00–17:00", "9:00–17:00", null, null, null),
    performance: { bookings: 48, revenue: "$7,200", rating: "4.7" },
    notes: "On vacation until next Monday.",
    activeToday: false,
  },
  {
    id: "m5",
    name: "Isabella Rossi",
    title: "Manager · Stylist",
    email: "isabella@bloomstudio.com",
    phone: "+1 (415) 555-0175",
    initials: "IR",
    color: "#ec4899",
    role: "Manager",
    status: "Active",
    schedule: "Mon–Fri · 10–6",
    services: ["Blowout", "Color & Cut"],
    weekly: week("10:00–18:00", "10:00–18:00", "10:00–18:00", "10:00–18:00", "10:00–18:00", null, null),
    performance: { bookings: 58, revenue: "$8,120", rating: "4.8" },
    notes: "Oversees stylist training and client experience.",
    activeToday: true,
  },
  {
    id: "m6",
    name: "Ethan Kim",
    title: "Barber",
    email: "ethan@bloomstudio.com",
    phone: "+1 (415) 555-0188",
    initials: "EK",
    color: "#a78bfa",
    role: "Employee",
    status: "Active",
    schedule: "Thu–Sun · 11–8",
    services: ["Beard Trim", "Haircut"],
    weekly: week(null, null, null, "11:00–20:00", "11:00–20:00", "11:00–20:00", "11:00–18:00"),
    performance: { bookings: 40, revenue: "$1,400", rating: "4.6" },
    notes: "Weekend specialist. Great with fades.",
    activeToday: true,
  },
  {
    id: "m7",
    name: "Olivia Brooks",
    title: "Receptionist",
    email: "olivia@bloomstudio.com",
    phone: "+1 (415) 555-0192",
    initials: "OB",
    color: "#34d399",
    role: "Employee",
    status: "Offline",
    schedule: "Mon–Fri · 8–4",
    services: ["Front desk"],
    weekly: week("8:00–16:00", "8:00–16:00", "8:00–16:00", "8:00–16:00", "8:00–16:00", null, null),
    performance: { bookings: 0, revenue: "$0", rating: "—" },
    notes: "Handles bookings, check-ins, and payments at the desk.",
    activeToday: false,
  },
  {
    id: "m8",
    name: "Liam Carter",
    title: "Stylist",
    email: "liam@bloomstudio.com",
    phone: "+1 (415) 555-0161",
    initials: "LC",
    color: "#fb7185",
    role: "Employee",
    status: "Offline",
    schedule: "Fri–Sun · 12–8",
    services: ["Haircut", "Blowout"],
    weekly: week(null, null, null, null, "12:00–20:00", "12:00–20:00", "12:00–18:00"),
    performance: { bookings: 33, revenue: "$2,310", rating: "4.5" },
    notes: "Newest stylist. Building a weekend clientele.",
    activeToday: false,
  },
];

export const RECENT_ACTIVITY = [
  { id: "a1", member: "Ava Thompson", action: "clocked in for the day", time: "8:58 AM" },
  { id: "a2", member: "Diego Martinez", action: "completed a booking — Beard Trim", time: "10:47 AM" },
  { id: "a3", member: "Mia Chen", action: "updated her weekly availability", time: "Yesterday" },
  { id: "a4", member: "Isabella Rossi", action: "invited a new team member", time: "Yesterday" },
  { id: "a5", member: "Noah Patel", action: "set status to Away until Monday", time: "2 days ago" },
];

const toOptions = (values: string[]): SelectOption[] =>
  values.map((value) => ({ value, label: value }));

export const ROLE_OPTIONS: SelectOption[] = [
  { value: "all", label: "All roles" },
  ...toOptions(["Owner", "Manager", "Employee"]),
];

export const STATUS_OPTIONS: SelectOption[] = [
  { value: "all", label: "All statuses" },
  ...toOptions(["Active", "Away", "Offline"]),
];
