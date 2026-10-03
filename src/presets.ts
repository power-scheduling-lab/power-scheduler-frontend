import type { DraftCompany } from './types'

export const examples: Record<'A' | 'B', DraftCompany> = {
  A: {
    company_name: '가상 사업장 A',
    site_limit_mw: '1',
    timezone: 'Europe/Berlin',
    jobs: [
      { job_id: 'A', release: '0', deadline: '12', duration: '4', mw: '1' },
      { job_id: 'B', release: '0', deadline: '24', duration: '6', mw: '1' },
      { job_id: 'C', release: '8', deadline: '24', duration: '3', mw: '1' },
    ],
  },
  B: {
    company_name: '가상 사업장 B',
    site_limit_mw: '2',
    timezone: 'Europe/Berlin',
    jobs: [
      { job_id: 'A', release: '0', deadline: '12', duration: '4', mw: '1' },
      { job_id: 'B', release: '0', deadline: '24', duration: '6', mw: '1' },
      { job_id: 'C', release: '8', deadline: '24', duration: '3', mw: '1' },
    ],
  },
}

export function copyExample(key: 'A' | 'B'): DraftCompany {
  return structuredClone(examples[key])
}
