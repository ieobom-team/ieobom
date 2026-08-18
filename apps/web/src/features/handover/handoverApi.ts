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

export type HandoverTranscribeResponse = {
  /** 인식된 글. 아무 말도 담기지 않았으면 빈 문자열이다 */
  text: string
}

export function createHandover(request: HandoverCreateRequest): Promise<HandoverResponse> {
  return apiFetch<HandoverResponse>('/api/handovers', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

/**
 * 녹음한 음성을 글로 바꿔 달라고 서버에 부탁한다.
 * (Manyfast F-YJJJUX rules — 기기가 녹음만 하고 서버가 그 음성을 글로 바꿔 돌려준다)
 *
 * **아무것도 저장되지 않는다.** 부르는 시점에는 인계 기록이 아직 없다 — 직원이 글을 확인하고
 * 어르신을 고른 다음에야 `createHandover` 가 음성과 함께 저장한다. 그래서 같은 음성이 두 번
 * 올라가지만, 저장 전에 글을 고칠 수 있어야 한다는 요구가 먼저다.
 *
 * 실패하면 `ApiError` 다(키 미설정·제공자 거부는 503, 연결 끊김은 `NETWORK_UNAVAILABLE`).
 * 화면은 그때도 녹음한 원본 음성을 들고 있고, 글 칸에 직접 입력해 저장을 마칠 수 있다.
 */
export function transcribeAudio(audioData: string): Promise<HandoverTranscribeResponse> {
  return apiFetch<HandoverTranscribeResponse>('/api/handovers/transcribe', {
    method: 'POST',
    body: JSON.stringify({ audioData }),
  })
}
