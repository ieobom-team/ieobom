import type { CareRecipient } from './recipientApi'

/**
 * 어르신 명단 화면의 판단만 모은 곳. 화면 없이 확인할 수 있게 컴포넌트에서 떼어 놓는다.
 */

/** 이름이 비어 있으면 저장하지 않는다. (Manyfast F-LUDCWW exceptions) */
export const NAME_REQUIRED = '어르신 이름을 입력해 주세요.'

/**
 * 입력한 이름을 저장할 수 있는 형태로 다듬는다.
 *
 * 공백만 넣은 것은 이름이 아니다. 서버도 같은 규칙으로 막지만, 화면에서 먼저 걸러야
 * 관리자가 저장 버튼을 누르고 기다린 뒤에 안내를 보지 않는다.
 */
export function normalizeName(raw: string): { name: string; error: string | null } {
  const name = raw.trim()
  return name === '' ? { name, error: NAME_REQUIRED } : { name, error: null }
}

/**
 * 같은 이름으로 이미 등록된 어르신들.
 *
 * 이용 종료한 어르신도 센다. 그쪽도 이름을 차지하고 있어서, 빼고 세면 관리자가
 * "이 이름은 처음 넣는 것" 이라고 잘못 알게 된다.
 */
export function duplicatesOf(name: string, recipients: readonly CareRecipient[]): CareRecipient[] {
  const target = name.trim()
  return target === '' ? [] : recipients.filter((recipient) => recipient.name === target)
}

/** 이름과 내부 ID 를 함께 보여 준다. 내부 ID 가 실명을 대신하지 않는다. (Manyfast F-LUDCWW display) */
export function recipientLabel(recipient: CareRecipient): string {
  return `${recipient.name} (${recipient.code})`
}

/** 동명이인 확인 안내 문구. 이미 있는 어르신의 내부 ID 를 함께 보여 줘야 관리자가 구분할 수 있다. */
export function duplicateNotice(duplicates: readonly CareRecipient[]): string {
  const codes = duplicates.map((recipient) => recipient.code).join(', ')
  return `같은 이름의 어르신(${codes})이 이미 있습니다. 다른 분이 맞으면 확인하고 등록해 주세요.`
}

/** 이용 중인 어르신이 먼저, 이용 종료한 어르신이 뒤로 간다. 그 안의 순서는 서버가 매긴 대로 둔다. */
export function activeFirst(recipients: readonly CareRecipient[]): CareRecipient[] {
  return [
    ...recipients.filter((recipient) => recipient.dischargedAt === null),
    ...recipients.filter((recipient) => recipient.dischargedAt !== null),
  ]
}
