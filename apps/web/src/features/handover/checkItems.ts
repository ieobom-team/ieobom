/**
 * 체크 입력 화면(#7)의 선택 항목.
 *
 * Manyfast 와이어프레임 "체크 입력 화면"(유저플로우 n14에 해당)에 정의된 10개 그대로다.
 * 임의로 추가·축소하지 않는다 — 목록을 바꾸려면 와이어프레임이 먼저 바뀌어야 한다.
 */
export type CheckItem = {
  value: string
  label: string
}

export const CHECK_ITEMS: readonly CheckItem[] = [
  { value: 'MEAL_REFUSAL', label: '식사 거부 또는 소량 섭취' },
  { value: 'FALL_RISK', label: '낙상 위험 행동 관찰' },
  { value: 'TOILETING_ISSUE', label: '배변·배뇨 이상' },
  { value: 'SLEEP_ISSUE', label: '수면 불량 또는 야간 각성' },
  { value: 'PAIN_COMPLAINT', label: '통증 호소 또는 불편 표현' },
  { value: 'EMOTIONAL_DISTRESS', label: '정서 불안·혼란 행동' },
  { value: 'MEDICATION_MISS', label: '투약 거부 또는 누락' },
  { value: 'SKIN_ISSUE', label: '피부 상태 이상 (발적·욕창 등)' },
  { value: 'GUARDIAN_CONTACT_NEEDED', label: '보호자 연락 필요 사항 발생' },
  { value: 'OTHER', label: '기타 특이사항' },
]

/**
 * 체크된 항목을 원문 텍스트로 합친다. (Manyfast F-YJJJUX action — "시스템은 입력 원문과
 * 입력 방식을 저장"할 때 체크 방식의 원문은 이 문장이 된다)
 *
 * 순서는 화면에 보이는 순서(CHECK_ITEMS 순서)를 따른다. 선택한 순서로 섞이면 같은 체크
 * 조합이 매번 다른 문장으로 남아 다음 근무자가 훑어보기 어렵다.
 */
export function buildCheckedText(checkedValues: readonly string[]): string {
  const checkedSet = new Set(checkedValues)
  const labels = CHECK_ITEMS.filter((item) => checkedSet.has(item.value)).map((item) => item.label)
  return `체크 항목: ${labels.join(', ')}`
}
