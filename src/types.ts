export type DecisionStatus = 'optimal' | 'feasible' | 'infeasible' | 'timeout'

export interface ModelError {
  code: string
  message: string
  details: Record<string, unknown>
  retryable: boolean
}

export interface JobInput {
  job_id: string
  release: number
  deadline: number
  duration: number
  mw: number
}

export interface CompanyInput {
  company_name: string
  scenario_id: string
  site_limit_mw: number
  timezone: string
  interval_hours: number
  jobs: JobInput[]
  metadata: Record<string, unknown>
}

export interface PriceSeries {
  timestamps: string[]
  prices_eur_mwh: number[]
  interval_hours: number
  timezone: string
  source: string
  region: string
  price_mode: string
}

export interface ScheduledJob {
  job_id: string
  start: number
  end: number
  mw: number
}

export interface DecisionResult {
  mode: string
  status: DecisionStatus
  scheduled_jobs: ScheduledJob[]
  load_profile: number[]
  target_timestamps: string[]
  interval_hours: number
  timezone: string
  expected_cost: number | null
  wholesale_cost_proxy: number | null
  max_mw: number | null
  cost_basis: string
  warnings: string[]
  model_metadata: Record<string, unknown>
  solver: string
  runtime_sec: number
  objective: number | null
  error: ModelError | null
}

export interface ScheduleResponse {
  decision: DecisionResult
  prices: PriceSeries
  baseline: DecisionResult | null
}

export interface ScheduleRequest {
  company: CompanyInput
  price_date: string
}

export interface DraftJob {
  job_id: string
  release: string
  deadline: string
  duration: string
  mw: string
}

export interface DraftCompany {
  company_name: string
  site_limit_mw: string
  timezone: string
  jobs: DraftJob[]
}
