export type EntityStatus = "Active" | "Draft" | "Inactive";

export interface SelectOption {
  value: string;
  label: string;
}

export interface DayHours {
  day: string;
  open: boolean;
  from: string;
  to: string;
}

export interface LocationRow {
  id: string;
  name: string;
  address: string;
  city: string;
  status: EntityStatus;
}

export interface ServiceRow {
  id: string;
  name: string;
  duration: string;
  price: string;
  status: EntityStatus;
}

export interface CompanyInfo {
  name: string;
  legalName: string;
  email: string;
  phone: string;
  website: string;
  description: string;
}

export interface SocialLinksData {
  facebook: string;
  instagram: string;
  linkedin: string;
  x: string;
}
