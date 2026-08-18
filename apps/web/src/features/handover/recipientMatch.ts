import type { CareRecipient } from '../recipient/recipientApi'

/**
 * 발화 원문 기반 대상 어르신 자동 매칭. (#141, Manyfast `F-YJJJUX` v46 action/rules)
 *
 * 입력 원문(텍스트/음성 인식 결과)과 화면이 이미 들고 있는 어르신 명단을 **로컬 문자열로만**
 * 대조한다. LLM을 부르지 않는다 — 실명을 내부 ID로 바꿔 LLM에 보내는 일은 인계 카드 정리 단계
 * (`F-SNBVHR`)에서만 일어나고 이 매칭과는 무관하다.
 */
export type RecipientMatchResult = {
  /**
   * 이름(3글자면 성 뺀 나머지도 인정)이 원문과 정확히 1명만 일치할 때만 채워진다.
   * 그 외에는 `null`(자동 채움 안 함).
   */
  autoSelectedId: number | null
  /** 유사도 높은 순으로 정렬한 후보 목록. 원문이 비어 있으면 원래 순서를 그대로 돌려준다. */
  sorted: CareRecipient[]
}

export function matchRecipients(
  rawText: string,
  recipients: readonly CareRecipient[],
): RecipientMatchResult {
  const text = rawText.trim()
  if (text === '') {
    return { autoSelectedId: null, sorted: [...recipients] }
  }

  const scored = recipients.map((recipient) => ({
    recipient,
    // 이름이 3글자면 성 1글자를 뺀 나머지가 원문에 포함돼도 "일치"로 본다(#142 후속 개선).
    // 2·4글자 이상(2글자 성 등)은 성/이름 경계를 알 수 없어 전체 성함 일치만 본다.
    match: isNameMatch(text, recipient.name),
    score: longestCommonSubstringLength(text, recipient.name),
  }))

  const matches = scored.filter((entry) => entry.match)
  const autoSelectedId = matches.length === 1 ? matches[0].recipient.id : null

  // Array.prototype.sort는 안정 정렬이라, 점수가 같으면 원래 명단 순서를 그대로 지킨다.
  const sorted = [...scored].sort((a, b) => b.score - a.score).map((entry) => entry.recipient)

  return { autoSelectedId, sorted }
}

function isNameMatch(text: string, name: string): boolean {
  if (text.includes(name)) {
    return true
  }
  if (name.length === 3) {
    const givenName = name.slice(1)
    return text.includes(givenName)
  }
  return false
}

/** 두 문자열이 공유하는 가장 긴 연속 부분 문자열의 길이. 규칙 기반 로컬 유사도 척도로 쓴다. */
function longestCommonSubstringLength(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) {
    return 0
  }

  let previousRow = new Array<number>(b.length + 1).fill(0)
  let longest = 0

  for (let i = 1; i <= a.length; i++) {
    const currentRow = new Array<number>(b.length + 1).fill(0)
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        currentRow[j] = previousRow[j - 1] + 1
        longest = Math.max(longest, currentRow[j])
      }
    }
    previousRow = currentRow
  }

  return longest
}
