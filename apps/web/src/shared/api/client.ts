/**
 * 백엔드 호출 한 겹.
 *
 * 서버 오류 응답(`docs/contracts/handover-api.md` 의 공통 오류 형태)을 `ApiError` 로 바꿔서 던진다.
 * 화면이 `fields` 를 그대로 받아 **보완할 항목을 한 번에 모아** 보여줄 수 있어야 하므로,
 * 메시지 한 줄로 뭉개지 않고 항목 목록을 살려 둔다.
 */

/** 보완해야 할 항목 하나. */
export type ApiFieldError = {
  field: string
  reason: string
}

export class ApiError extends Error {
  readonly code: string
  readonly fields: readonly ApiFieldError[]
  /** 응답을 받지 못한 경우(연결 실패) 0 이다. */
  readonly status: number

  constructor(code: string, message: string, fields: readonly ApiFieldError[], status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.fields = fields
    this.status = status
  }
}

/**
 * 연결 자체가 실패했을 때 쓰는 코드.
 *
 * 인계 저장 화면은 이 코드를 보면 오류로 끝내지 않고 대기열에 넣은 뒤 연결이 회복되면
 * 자동으로 다시 보낸다(`features/handover/offlineQueue.ts`, `OfflineQueueSync.tsx`).
 * 돌봄 중인 근무자에게 재입력을 요구하지 않기 위해서다.
 */
export const NETWORK_UNAVAILABLE = 'NETWORK_UNAVAILABLE'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

function isFieldErrorList(value: unknown): value is ApiFieldError[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as ApiFieldError).field === 'string' &&
        typeof (item as ApiFieldError).reason === 'string',
    )
  )
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // 오류 응답이 JSON 이 아닐 수도 있다. 그래도 상태 코드는 살려서 던진다.
  }

  const parsed = (body ?? {}) as Partial<{ code: string; message: string; fields: unknown }>
  return new ApiError(
    parsed.code ?? 'UNKNOWN_ERROR',
    parsed.message ?? '요청을 처리하지 못했습니다.',
    isFieldErrorList(parsed.fields) ? parsed.fields : [],
    response.status,
  )
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError(
      NETWORK_UNAVAILABLE,
      '연결이 끊겨 저장하지 못했습니다. 입력한 내용은 그대로 있으니 잠시 뒤 다시 눌러 주세요.',
      [],
      0,
    )
  }

  if (!response.ok) {
    throw await toApiError(response)
  }

  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

/** 서버가 만들어 내려준 파일 하나. */
export type DownloadedFile = {
  blob: Blob
  /** 서버가 헤더로 준 이름. 읽지 못했으면 `null` */
  fileName: string | null
}

/**
 * 파일을 받아 오는 한 겹.
 *
 * `apiFetch`는 본문을 JSON으로 읽으므로 바이너리에 쓸 수 없다. 오류 응답은 여전히 JSON이라
 * 같은 `ApiError`로 바꿔 던진다 — 화면이 "내려받을 문구가 없습니다" 같은 서버 문장을 그대로 보여줄 수 있어야 한다.
 */
export async function apiDownload(path: string): Promise<DownloadedFile> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`)
  } catch {
    throw new ApiError(
      NETWORK_UNAVAILABLE,
      '연결이 끊겨 파일을 받지 못했습니다. 잠시 뒤 다시 눌러 주세요.',
      [],
      0,
    )
  }

  if (!response.ok) {
    throw await toApiError(response)
  }

  return {
    blob: await response.blob(),
    fileName: fileNameOf(response.headers.get('Content-Disposition')),
  }
}

/**
 * `Content-Disposition` 에서 파일 이름을 꺼낸다.
 *
 * 서버가 한글 이름을 RFC 5987 `filename*=UTF-8''…` 로 인코딩해 보낸다. 프론트와 API가 같은 출처라
 * (`docs/architecture.md`) CORS 설정 없이 이 헤더를 읽을 수 있다.
 */
function fileNameOf(header: string | null): string | null {
  if (header === null) {
    return null
  }
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (encoded !== null) {
    try {
      return decodeURIComponent(encoded[1])
    } catch {
      // 이름을 못 읽어도 파일 자체는 멀쩡하다. 부르는 쪽이 대신 쓸 이름을 정한다.
      return null
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header)
  return plain === null ? null : plain[1]
}
