import type { IconComponent } from "../types";

export interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  defaultOn: boolean;
}

export interface Session {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  masked: string;
  created: string;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: IconComponent;
  connected: boolean;
}

export interface ThemeOption {
  id: string;
  label: string;
}
