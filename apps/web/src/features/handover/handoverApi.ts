import { apiFetch } from '../../shared/api/client'
import type { InfoSource } from './infoSource'
import type { InputMethod } from './inputMethod'

/** 계약은 `docs/contracts/handover-api.md` 에 있다. */

export type HandoverCreateRequest = {
  careRecipientId: number
  rawText: string
  inputMethod: InputMethod
  /** 오프셋 없는 지역 시각. `2026-08-11T09:20:00` */
  occurredAt: string
  reporterName: string
  proxyInput: boolean
  /** 직접 관찰이면 보내지 않는다. 붙여 보내면 서버가 400 으로 되돌린다 */
  infoSource?: InfoSource
  /** 녹음된 음성 파일 (base64 Data URL) */
  audioData?: string
}

export type HandoverResponse = {
  id: number
  careRecipientId: number
  careRecipientName: string
  rawText: string
  inputMethod: InputMethod
  occurredAt: string
  reporterName: string
  proxyInput: boolean
  infoSource: InfoSource | null
  createdAt: string
}

export function createHandover(request: HandoverCreateRequest): Promise<HandoverResponse> {
  return apiFetch<HandoverResponse>('/api/handovers', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}
