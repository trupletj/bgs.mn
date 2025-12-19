// types/stats.ts
export type ActionType =
  | "IMPLEMENTATION"
  | "MONITORING"
  | "VERIFICATION"
  | "DEPLOYMENT";

export interface Clause {
  id: string;
  text: string;
  reference_number: string;
  section_id: string;
  policy_id: string;
}

export interface ClauseJobPosition {
  id: string;
  clause_id: string;
  job_position_id: string;
  type: ActionType;
  is_checked: boolean;
}

export interface Rating {
  id: string;
  score: number;
  description: string;
  clause_job_position_id: string;
  scored_date: string;
}

export interface JobPosition {
  id: string;
  name: string;
  description: string;
  organization_id: string;
}

export interface Policy {
  id: string;
  name: string;
  approved_date: string;
  reference_code: string;
}

export interface Section {
  id: string;
  policy_id: string;
  text: string;
  reference_number: string;
}

export interface PolicyImplementationStats {
  policyId: string;
  policyName: string;
  totalClauses: number;
  ratedClauses: number;
  implementationRate: number;
  averageScore: number;
}

export interface JobPositionStats {
  jobPositionId: string;
  jobPositionName: string;
  totalClauses: number;
  implementationClauses: number;
  monitoringClauses: number;
  verificationClauses: number;
  deploymentClauses: number;
  averageScore: number;
  scoresByType: {
    [key in ActionType]: number[];
  };
}
