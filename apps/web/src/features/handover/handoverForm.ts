import type { ApiFieldError } from '../../shared/api/client'
import { buildCheckedText } from './checkItems'
import type { HandoverCreateRequest } from './handoverApi'
import type { InfoSource } from './infoSource'
import type { InputMethod } from './inputMethod'

/**
 * 입력 화면의 폼 상태와 제출 전 검증.
 *
 * 서버도 같은 규칙을 갖고 있다(`docs/contracts/handover-api.md`). 그런데도 화면에서 한 번 더 보는 이유는,
 * **누락된 항목을 알려 주려고 굳이 네트워크를 한 번 다녀오게 만들 이유가 없기** 때문이다.
 * 돌봄 중이라 연결이 끊겨 있을 수도 있다.
 *
 * 서버가 최종 판단이므로 규칙을 여기서 느슨하게 바꾸지 않는다. 서버가 400 으로 돌려준 `fields` 도
 * 화면에서는 이 함수의 결과와 똑같은 모양으로 그린다.
 */

export const RAW_TEXT_MAX_LENGTH = 2000

export type HandoverDraft = {
  careRecipientId: number | null
  /** 아직 고르지 않았으면 `null`. 고르지 않은 것과 "직접 봤다"를 구분한다 */
  proxyInput: boolean | null
  infoSource: InfoSource | null
  inputMethod: InputMethod | null
  rawText: string
  /** 체크 방식일 때 고른 항목들. `checkItems.ts`의 `value`. 텍스트 방식이면 항상 빈 배열이다 */
  checkedItems: readonly string[]
  /** `<input type="datetime-local">` 값. `YYYY-MM-DDTHH:mm` */
  occurredAt: string
}

/** 보완 안내에서 어떤 항목인지 사람 말로 보여 준다. */
export const FIELD_LABELS: Record<string, string> = {
  careRecipientId: '대상 어르신',
  proxyInput: '대리 입력 여부',
  infoSource: '정보 출처',
  inputMethod: '입력 방식',
  rawText: '입력 내용',
  occurredAt: '입력 시점',
  reporterName: '입력자',
}

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field
}

export function emptyDraft(now: Date): HandoverDraft {
  return {
    careRecipientId: null,
    proxyInput: null,
    infoSource: null,
    inputMethod: null,
    rawText: '',
    checkedItems: [],
    occurredAt: toDateTimeLocal(now),
  }
}

/** `<input type="datetime-local">` 이 읽는 형식. 지역 시각이라 UTC 로 바꾸지 않는다. */
export function toDateTimeLocal(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/**
 * 보완할 항목을 **한 번에 모아** 돌려준다.
 *
 * 하나 고치면 다음 하나가 나오는 식이면 돌봄 중인 근무자가 화면을 몇 번씩 다시 봐야 한다.
 * (Manyfast F-YJJJUX exceptions)
 */
export function validateDraft(draft: HandoverDraft, reporterName: string): ApiFieldError[] {
  const errors: ApiFieldError[] = []

  if (draft.proxyInput === null) {
    errors.push({
      field: 'proxyInput',
      reason: '직접 보신 내용인지, 다른 분께 들은 내용인지 골라 주세요.',
    })
  }

  // 대리 입력인데 출처가 비면 "누구에게서 나온 내용인지"가 사라진다.
  if (draft.proxyInput === true && draft.infoSource === null) {
    errors.push({ field: 'infoSource', reason: '어느 분께 들은 내용인지 함께 골라 주세요.' })
  }

  // 직접 관찰인데 출처가 붙으면 둘 중 어느 쪽이 사실인지 알 수 없다.
  if (draft.proxyInput === false && draft.infoSource !== null) {
    errors.push({
      field: 'proxyInput',
      reason: '정보 출처가 골라져 있습니다. 들은 내용이면 대리 입력으로 바꿔 주세요.',
    })
  }

  if (draft.inputMethod === null) {
    errors.push({ field: 'inputMethod', reason: '입력 방식을 선택해 주세요.' })
  }

  if (draft.inputMethod === 'CHECK') {
    if (draft.checkedItems.length === 0) {
      errors.push({ field: 'rawText', reason: '체크할 항목을 하나 이상 선택해 주세요.' })
    }
  } else if (draft.rawText.trim() === '') {
    errors.push({ field: 'rawText', reason: '입력 내용을 남겨 주세요.' })
  } else if (draft.rawText.length > RAW_TEXT_MAX_LENGTH) {
    errors.push({
      field: 'rawText',
      reason: `입력 내용은 ${RAW_TEXT_MAX_LENGTH}자까지 남길 수 있습니다.`,
    })
  }

  if (draft.careRecipientId === null) {
    errors.push({ field: 'careRecipientId', reason: '대상 어르신을 선택해 주세요.' })
  }

  if (draft.occurredAt.trim() === '' || Number.isNaN(Date.parse(draft.occurredAt))) {
    errors.push({ field: 'occurredAt', reason: '입력 시점을 입력해 주세요.' })
  }

  if (reporterName.trim() === '') {
    errors.push({ field: 'reporterName', reason: '입력자를 선택해 주세요.' })
  }

  return errors
}

/**
 * 검증을 통과한 폼을 요청 형태로 바꾼다.
 *
 * 직접 관찰이면 `infoSource` 를 아예 담지 않는다. `null` 로 보내도 서버가 같게 보지만,
 * 계약에 없는 값을 굳이 실어 보내지 않는다.
 */
export function toCreateRequest(draft: HandoverDraft, reporterName: string): HandoverCreateRequest {
  if (draft.careRecipientId === null || draft.inputMethod === null || draft.proxyInput === null) {
    throw new Error('검증을 통과하지 않은 입력을 보내려 했습니다.')
  }

  const rawText =
    draft.inputMethod === 'CHECK' ? buildCheckedText(draft.checkedItems) : draft.rawText.trim()

  const request: HandoverCreateRequest = {
    careRecipientId: draft.careRecipientId,
    rawText,
    inputMethod: draft.inputMethod,
    occurredAt: withSeconds(draft.occurredAt),
    reporterName,
    proxyInput: draft.proxyInput,
  }

  if (draft.proxyInput && draft.infoSource !== null) {
    request.infoSource = draft.infoSource
  }
  return request
}

/** `datetime-local` 은 초를 빼고 주지만 계약의 예시는 초까지 있다. 형태를 맞춰 보낸다. */
function withSeconds(value: string): string {
  return value.length === 16 ? `${value}:00` : value
}
