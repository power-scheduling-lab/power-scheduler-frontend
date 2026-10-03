import { useRef, useState } from 'react'
import { ApiError, calculateSchedule } from './api'
import { copyExample } from './presets'
import type {
  CompanyInput,
  DraftCompany,
  DraftJob,
  PriceSeries,
  ScheduleResponse,
} from './types'

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
})

function asMoney(value: number | null | undefined): string {
  return value == null ? '—' : money.format(value)
}

function slotTime(first: string | undefined, slot: number, interval: number): string {
  if (!first) return String(slot) + '번 슬롯'
  const date = new Date(new Date(first).getTime() + slot * interval * 3_600_000)
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hour = String(date.getUTCHours()).padStart(2, '0')
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  return day + '일 ' + hour + ':' + minute
}

function shortHour(timestamp: string): string {
  return String(new Date(timestamp).getUTCHours()).padStart(2, '0')
}

function statusText(status: string): string {
  return {
    optimal: '최적 일정',
    feasible: '실행 가능',
    infeasible: '일정 불가능',
    timeout: '시간 초과',
  }[status] ?? status
}

function errorTitle(code: string): string {
  if (code === 'INVALID_INPUT') return '입력 조건을 확인하세요'
  if (code === 'MISSING_PRICE_DATA') return '가격 데이터가 없습니다'
  if (code === 'MODEL_UNAVAILABLE' || code === 'SERVER_CONNECTION') return '서버에 연결할 수 없습니다'
  if (code === 'MODEL_TIMEOUT' || code === 'OPTIMIZATION_ERROR') return '계산을 완료하지 못했습니다'
  return '요청을 처리하지 못했습니다'
}

function PowerChart({
  prices,
  load,
  siteLimit,
}: {
  prices: PriceSeries
  load: number[]
  siteLimit: number
}) {
  const [active, setActive] = useState<number | null>(null)
  const series = prices.prices_eur_mwh
  const count = series.length
  if (count === 0) return null
  const hasSchedule = load.length === count

  const left = 46
  const right = 918
  const top = 28
  const bottom = 202
  const width = right - left
  const step = width / count
  const lowest = Math.min(...series)
  const highest = Math.max(...series)
  const priceRange = Math.max(highest - lowest, 1)
  const peak = Math.max(siteLimit, ...load, 0.1)
  const priceY = (value: number) => top + (highest - value) / priceRange * (bottom - top)
  const pricePoints = series.map((value, index) => ({
    x: left + (index + 0.5) * step,
    y: priceY(value),
  }))
  const line = pricePoints
    .map((point, index) => (index === 0 ? 'M ' : 'L ') + point.x + ' ' + point.y)
    .join(' ')
  const selected = active ?? Math.min(12, count - 1)

  return (
    <div className="chart-wrap">
      <div className="chart-scroll">
        <svg viewBox="0 0 960 266" role="img" aria-label="시간별 가격과 전력 사용량 차트">
          {[0, 0.5, 1].map((fraction) => {
            const y = top + fraction * (bottom - top)
            return (
              <g key={fraction}>
                <line x1={left} x2={right} y1={y} y2={y} className="chart-grid" />
                <text x={left - 8} y={y + 4} className="chart-axis" textAnchor="end">
                  {Math.round(highest - fraction * (highest - lowest))}
                </text>
                {hasSchedule && <text x={right + 8} y={y + 4} className="chart-axis">
                  {(peak * (1 - fraction)).toFixed(1)}
                </text>}
              </g>
            )
          })}
          {hasSchedule && series.map((_, index) => {
            const height = (load[index] ?? 0) / peak * (bottom - top)
            return (
              <rect
                key={'bar-' + index}
                x={left + index * step + step * 0.17}
                y={bottom - height}
                width={step * 0.66}
                height={height}
                rx="3"
                className={index === selected ? 'chart-bar chart-bar-active' : 'chart-bar'}
              />
            )
          })}
          <path d={line} className="chart-line" />
          {pricePoints.map((point, index) => index % 3 === 0 || index === selected ? (
            <circle
              key={'point-' + index}
              cx={point.x}
              cy={point.y}
              r={index === selected ? 5 : 2.4}
              className="chart-point"
            />
          ) : null)}
          {series.map((_, index) => (
            <g key={'slot-' + index}>
              <rect
                x={left + index * step}
                y={top}
                width={step}
                height={bottom - top}
                fill="transparent"
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                tabIndex={0}
                aria-label={shortHour(prices.timestamps[index]) + '시 가격 ' + series[index] + ' 유로' + (hasSchedule ? ', 사용량 ' + load[index] + ' MW' : '')}
              />
              {index % 3 === 0 && (
                <text
                  x={left + (index + 0.5) * step}
                  y={bottom + 24}
                  textAnchor="middle"
                  className="chart-axis chart-hour"
                >
                  {shortHour(prices.timestamps[index])}
                </text>
              )}
            </g>
          ))}
          <text x={left} y="16" className="chart-unit">€/MWh</text>
          {hasSchedule && <text x={right} y="16" textAnchor="end" className="chart-unit">MW</text>}
          <text x={right} y="258" textAnchor="end" className="chart-unit">UTC 시각</text>
        </svg>
      </div>
      <div className="chart-caption">
        <div className="chart-legend">
          <span><i className="legend-line" />시간별 도매가격</span>
          {hasSchedule && <span><i className="legend-bar" />추천 전력 사용량</span>}
        </div>
        <div className="chart-inspector">
          <strong>{shortHour(prices.timestamps[selected])}:00 UTC</strong>
          <span>{series[selected].toFixed(2)} €/MWh</span>
          <span>{hasSchedule ? load[selected].toFixed(2) + ' MW' : '일정 없음'}</span>
        </div>
      </div>
      {!hasSchedule && <p className="chart-no-load">실행 가능한 일정이 없어 전력 사용량을 표시하지 않습니다.</p>}
    </div>
  )
}

function parseDraft(draft: DraftCompany, preset: 'A' | 'B' | 'custom'): CompanyInput {
  if (!draft.company_name.trim() || !draft.site_limit_mw.trim() || draft.jobs.length === 0) {
    throw new ApiError('INVALID_INPUT', '사업장 이름, 전력 한도와 작업을 입력하세요.')
  }
  const siteLimit = Number(draft.site_limit_mw)
  if (!Number.isFinite(siteLimit) || siteLimit <= 0) {
    throw new ApiError('INVALID_INPUT', '사업장 전력 한도는 0보다 큰 MW 값이어야 합니다.')
  }
  const jobs = draft.jobs.map((job) => {
    if (Object.values(job).some((value) => !value.trim())) {
      throw new ApiError('INVALID_INPUT', '모든 작업 항목을 입력하세요.')
    }
    const release = Number(job.release)
    const deadline = Number(job.deadline)
    const duration = Number(job.duration)
    const mw = Number(job.mw)
    if (![release, deadline, duration].every(Number.isInteger) || !Number.isFinite(mw)) {
      throw new ApiError('INVALID_INPUT', '작업 시각과 연속 가동시간은 정수 슬롯, 소비전력은 숫자여야 합니다.')
    }
    return { job_id: job.job_id.trim(), release, deadline, duration, mw }
  })
  return {
    company_name: draft.company_name.trim(),
    scenario_id: preset === 'custom' ? 'custom_demo' : 'poc_3jobs',
    site_limit_mw: siteLimit,
    timezone: draft.timezone,
    interval_hours: 1,
    jobs,
    metadata: { synthetic: true },
  }
}

function App() {
  const [draft, setDraft] = useState<DraftCompany>(() => copyExample('A'))
  const [preset, setPreset] = useState<'A' | 'B' | 'custom'>('A')
  const [priceDate, setPriceDate] = useState('2025-01-15')
  const [response, setResponse] = useState<ScheduleResponse | null>(null)
  const [submitted, setSubmitted] = useState<CompanyInput | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)
  const activeRequest = useRef<AbortController | null>(null)

  function changed() {
    requestId.current += 1
    activeRequest.current?.abort()
    activeRequest.current = null
    setResponse(null)
    setSubmitted(null)
    setError(null)
    setLoading(false)
  }

  function choosePreset(key: 'A' | 'B') {
    changed()
    setDraft(copyExample(key))
    setPreset(key)
    setPriceDate('2025-01-15')
  }

  function changeCompany(field: 'company_name' | 'site_limit_mw' | 'timezone', value: string) {
    changed()
    setPreset('custom')
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function changeJob(index: number, field: keyof DraftJob, value: string) {
    changed()
    setPreset('custom')
    setDraft((current) => ({
      ...current,
      jobs: current.jobs.map((job, position) => position === index ? { ...job, [field]: value } : job),
    }))
  }

  function addJob() {
    changed()
    setPreset('custom')
    setDraft((current) => ({
      ...current,
      jobs: [...current.jobs, { job_id: '', release: '0', deadline: '24', duration: '1', mw: '0.5' }],
    }))
  }

  function removeJob(index: number) {
    changed()
    setPreset('custom')
    setDraft((current) => ({
      ...current,
      jobs: current.jobs.filter((_, position) => position !== index),
    }))
  }

  function changePriceDate(value: string) {
    changed()
    setPriceDate(value)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    requestId.current += 1
    const id = requestId.current
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setResponse(null)
    setSubmitted(null)
    setError(null)
    setLoading(true)
    try {
      const company = parseDraft(draft, preset)
      const next = await calculateSchedule({ company, price_date: priceDate }, controller.signal)
      if (requestId.current === id) {
        setSubmitted(company)
        setResponse(next)
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      if (requestId.current === id) {
        setError(caught instanceof ApiError ? caught : new ApiError('SERVER_CONNECTION', '요청을 처리할 수 없습니다.'))
      }
    } finally {
      if (requestId.current === id) {
        setLoading(false)
        activeRequest.current = null
      }
    }
  }

  const decision = response?.decision
  const baseline = response?.baseline
  const canCompare = decision?.wholesale_cost_proxy != null &&
    baseline?.wholesale_cost_proxy != null
  const difference = canCompare
    ? baseline.wholesale_cost_proxy! - decision.wholesale_cost_proxy!
    : null
  const complete = decision?.status === 'optimal' || decision?.status === 'feasible'
  const count = decision?.scheduled_jobs.length ?? 0

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
          <div>
            <strong>Power Scheduler</strong>
            <small>Known-price planning · V1</small>
          </div>
        </div>
        <div className="topbar-right">
          <span className="topbar-tag">실험용 웹 데모</span>
          <span className="topbar-dot" />
          <span>과거 가격 · 가상 작업</span>
        </div>
      </header>

      <main className="page">
        <div className="page-intro">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> SCHEDULING LAB / 01</div>
            <h1>전력 사용 일정을<br /><em>한눈에 설계하세요.</em></h1>
            <p>가상의 작업 조건과 알려진 도매가격으로 모델이 실행 가능한 일정을 계산합니다.</p>
          </div>
          <div className="intro-stamp">
            <span>MODEL MODE</span>
            <strong>V1</strong>
            <small>Known price · MILP</small>
          </div>
        </div>

        <div className="workspace">
          <aside className="editor panel">
            <form onSubmit={submit}>
              <div className="section-heading">
                <div><span className="section-index">01</span><h2>사업장 조건</h2></div>
                <span className="subtle">가상 시나리오</span>
              </div>
              <p className="section-help">예시를 선택한 뒤 값을 직접 바꿀 수 있습니다.</p>
              <div className="preset-grid" role="group" aria-label="사업장 예시 선택">
                {(['A', 'B'] as const).map((key) => (
                  <button
                    className={preset === key ? 'preset active' : 'preset'}
                    type="button"
                    key={key}
                    onClick={() => choosePreset(key)}
                  >
                    <span>가상 사업장</span>
                    <strong>{key}</strong>
                    <small>{key === 'A' ? '1.0 MW 한도' : '2.0 MW 한도'}</small>
                  </button>
                ))}
              </div>
              <div className="field">
                <label htmlFor="company-name">사업장 이름</label>
                <input id="company-name" value={draft.company_name} onChange={(event) => changeCompany('company_name', event.target.value)} />
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="site-limit">전력 한도 <span>MW</span></label>
                  <input id="site-limit" type="number" min="0" step="0.1" value={draft.site_limit_mw} onChange={(event) => changeCompany('site_limit_mw', event.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="timezone">사업장 시간대</label>
                  <select id="timezone" value={draft.timezone} onChange={(event) => changeCompany('timezone', event.target.value)}>
                    <option value="Europe/Berlin">Europe/Berlin</option>
                    <option value="UTC">UTC</option>
                    <option value="Asia/Seoul">Asia/Seoul</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="price-date">가격 날짜 <span>UTC</span></label>
                <input id="price-date" type="date" value={priceDate} onInput={(event) => changePriceDate(event.currentTarget.value)} onChange={(event) => changePriceDate(event.target.value)} />
                <small className="field-note">현재 제공: 2025-01-15 · 다른 날짜는 가격 누락으로 안내됩니다.</small>
              </div>

              <div className="editor-divider" />
              <div className="section-heading jobs-heading">
                <div><span className="section-index">02</span><h2>연속 작업</h2></div>
                <span className="job-count">{draft.jobs.length}개 작업</span>
              </div>
              <p className="section-help">슬롯 0 = 00:00 UTC. 완료 마감은 해당 시각 전에 작업이 끝나야 합니다.</p>
              <div className="jobs-list">
                {draft.jobs.map((job, index) => (
                  <div className="job-card" key={index}>
                    <div className="job-card-head">
                      <span className="job-number">JOB {String(index + 1).padStart(2, '0')}</span>
                      <button type="button" className="remove-job" onClick={() => removeJob(index)} aria-label={String(index + 1) + '번 작업 삭제'}>삭제</button>
                    </div>
                    <div className="field">
                      <label htmlFor={'job-id-' + index}>작업 ID</label>
                      <input id={'job-id-' + index} value={job.job_id} onChange={(event) => changeJob(index, 'job_id', event.target.value)} />
                    </div>
                    <div className="job-fields">
                      <div className="field"><label htmlFor={'release-' + index}>시작 가능 <span>UTC 슬롯</span></label><input id={'release-' + index} type="number" min="0" step="1" value={job.release} onChange={(event) => changeJob(index, 'release', event.target.value)} /></div>
                      <div className="field"><label htmlFor={'deadline-' + index}>완료 마감 <span>UTC 슬롯</span></label><input id={'deadline-' + index} type="number" min="1" step="1" value={job.deadline} onChange={(event) => changeJob(index, 'deadline', event.target.value)} /></div>
                      <div className="field"><label htmlFor={'duration-' + index}>연속 가동 <span>시간</span></label><input id={'duration-' + index} type="number" min="1" step="1" value={job.duration} onChange={(event) => changeJob(index, 'duration', event.target.value)} /></div>
                      <div className="field"><label htmlFor={'mw-' + index}>소비전력 <span>MW</span></label><input id={'mw-' + index} type="number" min="0" step="0.1" value={job.mw} onChange={(event) => changeJob(index, 'mw', event.target.value)} /></div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="add-job" type="button" onClick={addJob}>＋ 작업 추가</button>
              <div className="submit-area">
                <button className="calculate-button" type="submit" disabled={loading}>
                  {loading ? '계산 중…' : '일정 계산'} <span aria-hidden="true">↗</span>
                </button>
                <small>1시간 간격 · 고정 전력 · 중단 없는 작업</small>
              </div>
            </form>
          </aside>

          <section className="results">
            <div className="results-topline">
              <span className="section-index">03</span>
              <h2>계산 결과</h2>
              <div className="results-rule" />
              <span className="results-mode">MODEL OUTPUT / V1</span>
            </div>

            {!response && !error && !loading && (
              <div className="empty-state panel">
                <div className="empty-visual" aria-hidden="true">
                  <span className="empty-orbit orbit-one" />
                  <span className="empty-orbit orbit-two" />
                  <span className="empty-center">↗</span>
                </div>
                <div className="eyebrow">READY TO OPTIMIZE</div>
                <h3>조건을 입력하고<br />일정을 계산해 보세요.</h3>
                <p>추천 일정, 시간별 사용량과 도매비용 대리값을 이곳에 표시합니다.</p>
              </div>
            )}

            {loading && (
              <div className="loading-state panel" role="status">
                <div className="loading-ring" />
                <h3>모델이 일정을 계산하고 있습니다</h3>
                <p>Python 공개 V1 함수와 CBC solver를 호출하는 중입니다.</p>
              </div>
            )}

            {error && (
              <div className="error-state panel" role="alert">
                <span className="error-icon">!</span>
                <div>
                  <div className="eyebrow">REQUEST STATUS / {error.code}</div>
                  <h3>{errorTitle(error.code)}</h3>
                  <p>{error.message}</p>
                  {error.code === 'MISSING_PRICE_DATA' && <small>검증된 데모 가격 날짜는 2025-01-15입니다.</small>}
                </div>
              </div>
            )}

            {response && decision && submitted && (
              <div className="result-stack">
                <div className="result-hero panel">
                  <div>
                    <span className={'status-pill status-' + decision.status}>
                      <i /> {statusText(decision.status)}
                    </span>
                    <h3>{complete ? '추천 일정이 준비되었습니다.' : '실행 가능한 일정을 반환하지 못했습니다.'}</h3>
                    <p>{complete ? '모델이 작업창과 사업장 전력 한도를 고려했습니다.' : decision.status === 'infeasible' ? '현재 작업창과 전력 한도에서 실행 가능한 일정이 없습니다.' : '제한시간에 일정을 반환하지 못했습니다.'}</p>
                  </div>
                  <div className="hero-runtime">계산 시간 <strong>{decision.runtime_sec.toFixed(3)}s</strong></div>
                </div>

                <div className="metric-grid">
                  <div className="metric-card panel">
                    <span>추천 일정 비용</span>
                    <strong>{asMoney(decision.wholesale_cost_proxy)}</strong>
                    <small>Wholesale Cost Proxy · EUR</small>
                  </div>
                  <div className="metric-card panel">
                    <span>가장 이른 시작 기준</span>
                    <strong>{asMoney(baseline?.wholesale_cost_proxy)}</strong>
                    <small>{baseline ? '모델 공개 earliest 기준 · 동일 입력' : '비교 가능한 기준 일정 없음'}</small>
                  </div>
                  <div className="metric-card metric-accent panel">
                    <span>기준 일정과 비용 차이</span>
                    <strong>{difference == null ? '—' : asMoney(Math.abs(difference))}</strong>
                    <small>{difference == null ? '두 일정이 모두 가능할 때 표시' : difference >= 0 ? '추천 일정이 기준보다 낮음' : '추천 일정이 기준보다 높음'}</small>
                  </div>
                </div>

                <div className="constraint-card panel">
                  <div className="card-title-row"><h3>제약 준수 요약</h3><span>MODEL VALIDATION</span></div>
                  <div className="constraint-grid">
                    <div><span>계산 상태</span><strong>{statusText(decision.status)}</strong><small>{decision.status === 'optimal' ? '최적성 확인' : decision.status === 'feasible' ? '실행 가능 · 최적성 미확인' : '일정 없음'}</small></div>
                    <div><span>배치된 작업</span><strong>{count} / {submitted.jobs.length}</strong><small>연속 작업</small></div>
                    <div><span>최대 전력 / 한도</span><strong>{decision.max_mw == null ? '—' : decision.max_mw.toFixed(2)} <em>/ {submitted.site_limit_mw.toFixed(2)} MW</em></strong><small>모델 평가 결과</small></div>
                  </div>
                </div>

                <div className="chart-card panel">
                  <div className="card-title-row"><div><span className="eyebrow">HOURLY PROFILE</span><h3>가격과 전력 사용량</h3></div><span>24 H · UTC</span></div>
                  <PowerChart prices={response.prices} load={decision.load_profile} siteLimit={submitted.site_limit_mw} />
                </div>

                {complete && (
                  <div className="schedule-card panel">
                    <div className="card-title-row"><div><span className="eyebrow">RECOMMENDED PLAN</span><h3>작업 일정 시간표</h3></div><span>종료 시각 미포함</span></div>
                    <div className="table-scroll">
                      <table>
                        <thead><tr><th>작업</th><th>시작 · UTC</th><th>종료 · UTC</th><th>연속 가동</th><th>소비전력</th></tr></thead>
                        <tbody>
                          {decision.scheduled_jobs.map((job) => (
                            <tr key={job.job_id}>
                              <td><span className="table-job">{job.job_id}</span></td>
                              <td>{slotTime(decision.target_timestamps[0], job.start, decision.interval_hours)}</td>
                              <td>{slotTime(decision.target_timestamps[0], job.end, decision.interval_hours)}</td>
                              <td>{((job.end - job.start) * decision.interval_hours).toFixed(1)}시간</td>
                              <td>{job.mw.toFixed(2)} MW</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="source-card">
                  <div><span className="source-label">데이터 출처</span><strong>{response.prices.source}</strong><small>{response.prices.region} · {response.prices.timestamps[0]?.slice(0, 10)} UTC · {response.prices.interval_hours}시간 간격</small></div>
                  <p>도매비용 대리값 / 가상 작업. 실제 기업 전기요금 또는 절감액이 아닙니다. 가격과 일정 시각은 UTC 기준이며 사업장 시간대({submitted.timezone})는 모델 입력 정보입니다.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
      <footer className="footer"><span>POWER SCHEDULER / RESEARCH DEMO</span><span>Known price V1 · model contract 0.3.0rc2</span></footer>
    </div>
  )
}

export default App
