export type DeviceType =
  | "desktop"
  | "laptop"
  | "printer"
  | "scanner"
  | "copier"
  | "monitor";

export type DeviceStatus = "active";

// Type-specific specs stored in jsonb
export interface ComputerSpecs {
  cpu?: string;
  ram_gb?: number;
  ssd_gb?: number;
  hdd_gb?: number;
  gpu?: string;
  os?: string;
}
export interface MonitorSpecs {
  size_inch?: number;
  resolution?: string;
  panel_type?: string;
}
export interface PrinterSpecs {
  connection?: string;
  color_capable?: boolean;
}

export type DeviceSpecs =
  | ComputerSpecs
  | MonitorSpecs
  | PrinterSpecs
  | Record<string, unknown>;

export interface Device {
  id: string;
  name: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  device_type: DeviceType;
  status: DeviceStatus;
  location?: string;
  purchase_date?: string;
  warranty_expiry_date?: string;
  notes?: string;
  specs: DeviceSpecs;
  // org FK ids
  organization_id?: string;
  heltes_id?: string;
  alba_id?: string;
  // text fallback (legacy / imported data)
  department_name?: string;
  heltes_name?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  // joined
  organization?: { id: string; name: string } | null;
  heltes?: { id: string; name: string } | null;
  alba?: { id: string; name: string } | null;
  device_assignments?: DeviceAssignment[];
}

export interface OrgOption { id: string; name: string }
export interface HeltesOption { id: string; name: string; organization_id: string | null }
export interface AlbaOption { id: string; name: string; heltes_id: string | null; organization_id: string | null }
export interface OrgStructure {
  organizations: OrgOption[];
  heltes: HeltesOption[];
  alba: AlbaOption[];
}

export interface DeviceAssignment {
  id: string;
  device_id: string;
  user_id: string;
  is_primary: boolean;
  assigned_at: string;
  notes?: string;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    position_name?: string;
    department_name?: string;
    phone?: string;
  };
}

export interface DeviceHistory {
  id: string;
  device_id: string;
  action_type: string;
  description: string;
  old_value?: string;
  new_value?: string;
  changed_by?: number;
  created_at: string;
  profile?: { name: string } | null;
}

export interface DeviceMaintenance {
  id: string;
  device_id: string;
  maintenance_date: string;
  description: string;
  technician?: string;
  status: "completed" | "ongoing";
  created_by?: number;
  created_at: string;
  profile?: { name: string } | null;
}

// ─── UI label / style maps ────────────────────────────────────────────────────

export const DEVICE_TYPE_CONFIG: Record<DeviceType, { label: string; group: string }> = {
  desktop: { label: "Десктоп компьютер",  group: "Компьютер" },
  laptop:  { label: "Зөөврийн компьютер", group: "Компьютер" },
  printer: { label: "Принтер",            group: "Принтер / Сканнер" },
  scanner: { label: "Сканнер",            group: "Принтер / Сканнер" },
  copier:  { label: "Копи машин",         group: "Принтер / Сканнер" },
  monitor: { label: "Монитор",            group: "Монитор" },
};

export const DEVICE_STATUS_CONFIG: Record<DeviceStatus, { label: string; className: string }> = {
  active: { label: "Идэвхтэй", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export const DEVICE_TYPES_WITH_SPECS: DeviceType[] = ["desktop", "laptop", "printer", "scanner", "copier", "monitor"];
