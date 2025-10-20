export interface OrderItemForm {
  // part_id?: number;
  part_number?: string;
  part_name: string;
  part_description?: string;
  manufacturer?: string;
  quantity: number;
  notes?: string;
  image_url?: string;
  unit?: string;
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
  order_type: string;
  // equipment_name: string;
  // equipment_model: string;
  // equipment_serial: string;
  // equipment_location: string;
  urgency_level: "low" | "medium" | "high" | "critical";
  requested_delivery_date: string;
  notes: string;
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
