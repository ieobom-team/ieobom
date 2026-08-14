import { apiFetch } from '../../shared/api/client'

/** 계약은 `docs/contracts/handover-api.md` 에 있다. */

export type CareRecipient = {
  id: number
  name: string
  /** 내부 ID. 실명을 대신하지 않고 화면에 함께 표시한다. (Manyfast F-LUDCWW display) */
  code: string
  /** 이용 종료 시점. 이용 중이면 `null` */
  dischargedAt: string | null
}

/** 동명이인이 이미 있을 때 서버가 돌려주는 코드. 저장 실패가 아니라 **확인 요청**이다. */
export const DUPLICATE_RECIPIENT_NAME = 'DUPLICATE_RECIPIENT_NAME'

type CareRecipientListResponse = {
  careRecipients: CareRecipient[]
}

/**
 * 어르신 명단.
 *
 * @param includeDischarged 이용 종료한 어르신까지 받을지. 기본은 이용 중인 어르신만이다.
 *   **새 입력의 대상 목록**은 기본값을 쓰고, 명단 관리 화면과 이미 남은 기록을 고치는 화면만
 *   `true` 를 준다. (Manyfast F-LUDCWW rules)
 */
export async function fetchCareRecipients(
  { includeDischarged = false }: { includeDischarged?: boolean } = {},
): Promise<CareRecipient[]> {
  const query = includeDischarged ? '?includeDischarged=true' : ''
  const response = await apiFetch<CareRecipientListResponse>(`/api/care-recipients${query}`)
  return response.careRecipients
}

/**
 * 어르신을 등록한다. 내부 ID 는 서버가 붙인다.
 *
 * `confirmDuplicateName` 없이 보냈다가 동명이인이 있으면 409 `DUPLICATE_RECIPIENT_NAME` 이 온다.
 * 저장을 막는 게 아니라 한 번 확인시키는 것이므로, 화면은 안내를 보여 준 뒤 `true` 로 다시 보낸다.
 * (유저플로우 "AI 인계 도구 내비게이션 맵" n52 → n53)
 */
export function createCareRecipient(
  name: string,
  confirmDuplicateName = false,
): Promise<CareRecipient> {
  return apiFetch<CareRecipient>('/api/care-recipients', {
    method: 'POST',
    body: JSON.stringify({ name, confirmDuplicateName }),
  })
}

/** 이름을 고친다. 내부 ID 는 그대로다. (n54) */
export function renameCareRecipient(id: number, name: string): Promise<CareRecipient> {
  return apiFetch<CareRecipient>(`/api/care-recipients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
}

/** 이용 종료로 표시한다. 지우지 않는다 — 기존 인계 기록이 이 어르신을 가리키고 있다. (n55) */
export function dischargeCareRecipient(id: number): Promise<CareRecipient> {
  return apiFetch<CareRecipient>(`/api/care-recipients/${id}/discharge`, { method: 'POST' })
}
