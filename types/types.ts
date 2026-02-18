export interface OrderItemForm {
  part_number: string;
  part_name: string;
  part_description?: string;
  manufacturer?: string;
  quantity: number;
  notes?: string;
  image_url?: string;
  unit?: string;
  spare_type: SparePartType;
}

export interface JobDescription {
  job_position_id: string;
  a_code: string;
  at_code: string;
  supervisor_pos_id: string | string[];
  subordinate_pos_id: string | string[];
  communication_scope: string;
  job_condition: string;
  purpose: string;
  schedule: string;
  daily_hours: string;
  break_time: string;
  duties: string[];
  education_level: string;
  work_experience: string;
  general_skills: string[];
  professional_skills: string[];
  additional_courses: string[];
  resources: string;
  authority: string[];
  responsibilities: string[];
  property_liability: string[];
  relevant_laws: string[];
  note: string;
}

export interface OrderFormData {
  title: string;
  description: string;
  order_type:
    | "emergency"
    | "service"
    | "major repairs"
    | "safety reserves"
    | "other";
  // equipment_name: string;
  // equipment_model: string;
  // equipment_serial: string;
  // equipment_location: string;
  urgency_level: "";
  requested_delivery_date: string;
  notes: string;
  status: string;
}

// export interface Clause {
//   id: string;
//   reference_number: string;
//   text: string;
//   section_id: string;
//   parent_id: string | null;
//   policy_id: string;
//   is_deleted: boolean;
// }

export interface Rating {
  id: string;
  score: number;
  description: string | null;
  clause_job_position_id: string;
  rating_session_id: string | null;
  scored_date: string;
  is_deleted: boolean;
}

export interface Organization {
  id: string;
  bteg_id: string;
  name: string;
  sub_title: string | null;
  is_hr: boolean;
  is_active: boolean;
  description: string | null;
  created_at: string;
}

export interface Heltes {
  id: string;
  bteg_id: string;
  name: string;
  sub_title: string | null;
  organization_id: string;
  is_active: boolean;
  description: string | null;
  created_at: string;
}

export interface Alba {
  id: string;
  bteg_id: string;
  name: string;
  sub_title: string | null;
  heltes_id: string | null;
  organization_id: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface JobPosition {
  id: string;
  bteg_id: string | null;
  gazar_id: string | null;
  alba_id: string | null;
  heltes_id: string | null;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
  is_active: boolean;
  organization: Organization;
}

export interface ClauseJobPosition {
  id: string;
  clause_id: string;
  job_position_id: string;
  type: string;
  is_checked: boolean;
  job_position: JobPosition;
}

export interface OrganizationWithJobRelations extends Organization {
  job_position: JobPosition[];
  heltes: HeltesWithJobRelations[];
  alba: AlbaWithJobRelations[];
}

export interface HeltesWithJobRelations extends Heltes {
  job_position: JobPosition[];
  alba: AlbaWithJobRelations[];
}

export interface AlbaWithJobRelations extends Alba {
  job_position: JobPosition[];
}

export interface JobPositionWithOrganization extends JobPosition {
  organization: Organization;
}

export interface Clause {
  id?: string;
  policy_id?: string | null;
  reference_number: string;
  text: string;
  parent_id?: string | null;
  section_id?: string;
  children?: Clause[];
  job_position?: { job_position_id: string; type: ActionType }[];
}

export interface Section {
  id?: string;
  reference_number: string;
  policy_id?: string;
  text: string;
  clause: Clause[];
}

export interface Policy {
  id?: string;
  name: string;
  reference_code: string;
  approved_date: Date | null;
  section: Section[];
}

export function getUnitOptionLabel(value?: string) {
  return UNIT_OPTIONS.find((u) => u.value === value)?.label || "Ширхэг";
}

export const UNIT_OPTIONS = [
  { value: "piece", label: "Ширхэг", type: "count" },
  { value: "meter", label: "Метр (м)", type: "length" },
  { value: "square_meter", label: "Квадрат метр (м²)", type: "area" },
  { value: "cubic_meter", label: "Куб метр (м³)", type: "volume" },
  { value: "kilogram", label: "Килограмм (кг)", type: "weight" },
  { value: "gram", label: "Грам (г)", type: "weight" },
  { value: "liter", label: "Литр (л)", type: "volume" },
  { value: "set", label: "Баглаа/Сэт", type: "count" },
  { value: "package", label: "Багц", type: "count" },
  { value: "roll", label: "Ороомог", type: "count" },
] as const;

export type UnitType = (typeof UNIT_OPTIONS)[number]["value"];

export function getSparePartLabel(value?: string) {
  return SPARE_PART_OPTIONS.find((u) => u.value === value)?.label || "Бусад";
}

export const SPARE_PART_OPTIONS = [
  { value: "safety_equipment", label: "Аюулгүй ажиллагааны тоноглол" },
  { value: "work_equipment", label: "Ажлын тоноглол" },
  { value: "cooling_system", label: "Жолоодлогийн систем" },
  { value: "electrical_system", label: "Цахилгаан систем" },
  { value: "rotation_mechanism", label: "Эргэлтийн механизм" },
  { value: "gas_system", label: "Хийн систем" },
  { value: "electric_mechanism", label: "Цахилгаан механизм" },
  { value: "movement_parts", label: "Явах эд анги" },
  { value: "engine_control_system", label: "Хөдөлгүүрийн хяналтын систем" },
  { value: "engine", label: "Хөдөлгүүр" },
  { value: "hydro_system", label: "Гидро систем" },
  { value: "brake_system", label: "Тормозны систем" },
  { value: "lubrication_system", label: "Тосолгооны систем" },
  { value: "fluid_level", label: "Шингэн" },
  { value: "kuzov", label: "Кузов" },
  { value: "other", label: "Бусад" },
] as const;

export type SparePartType = (typeof SPARE_PART_OPTIONS)[number]["value"];

export type ActionType =
  | "IMPLEMENTATION"
  | "MONITORING"
  | "VERIFICATION"
  | "DEPLOYMENT";

export const actionTypes: { value: ActionType; label: string }[] = [
  { value: "IMPLEMENTATION", label: "Хэрэгжүүлэлт" },
  { value: "MONITORING", label: "Хяналт" },
  { value: "VERIFICATION", label: "Баталгаажуулалт" },
  { value: "DEPLOYMENT", label: "Нэвтрүүлэлт" },
];

export interface Permission {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  module: string;
  action: string;
  created_at: string;
}

export interface RolePermission {
  id: number;
  role_id: number;
  permission_id: number;
  assigned_by?: string;
  created_at: string;
  is_active: boolean;
  permission?: Permission;
}

export interface Role {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface RoleWithPermissions extends Role {
  permissions?: Permission[];
}

export interface Profile {
  id: number;
  created_at: string;
  auth_user_id: string;
  name: string;
  phone: string;
  position_name: string;
  department_name: string;
  email?: string;
  roles?: RoleWithPermissions[];
}

export interface RolesProfile {
  id: number;
  role_id: number;
  assigned_by?: string;
  assigned_at?: string;
  notes?: string;
  profile_id: number;
  profile?: Profile;
}
