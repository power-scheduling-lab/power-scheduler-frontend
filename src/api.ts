import type { ModelError, ScheduleRequest, ScheduleResponse } from './types'

const endpoint = '/api/v1/schedules/known-price'

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable = false,
    public httpStatus?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function modelError(value: unknown): ModelError | null {
  if (typeof value !== 'object' || value === null || !('error' in value)) return null
  const error = value.error
  if (typeof error !== 'object' || error === null || !('code' in error)) return null
  return error as ModelError
}

export async function calculateSchedule(
  request: ScheduleRequest,
  signal: AbortSignal,
): Promise<ScheduleResponse> {
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('SERVER_CONNECTION', 'Spring Boot 서버에 연결할 수 없습니다.', true)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ApiError('SERVER_CONNECTION', '서버가 JSON 응답을 보내지 않았습니다.', true, response.status)
  }

  if (!response.ok) {
    const error = modelError(payload)
    if (error) throw new ApiError(error.code, error.message, error.retryable, response.status)
    throw new ApiError('SERVER_CONNECTION', '서버 응답을 처리할 수 없습니다.', true, response.status)
  }
  if (typeof payload !== 'object' || payload === null || !('decision' in payload)) {
    throw new ApiError('SERVER_CONNECTION', '서버 결과 형식이 올바르지 않습니다.', true)
  }
  return payload as ScheduleResponse
}
