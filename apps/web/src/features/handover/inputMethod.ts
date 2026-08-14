/**
 * 입력 방식 — 유저플로우 "새 플로우 3" n11 분기.
 *
 * 세 방식을 **모두 화면에 보여 준다.** #6(텍스트)·#7(체크)·#8(음성) 방식을 모두 만들었다.
 * 목록에서 빼 버리면 "입력 방식을 시각적으로 명확히 구분한다"는 display 슬롯이
 * 사라지고 나중에 붙일 때 화면 구조가 통째로 바뀐다.
 */
export type InputMethod = 'VOICE' | 'TEXT' | 'CHECK'

export type InputMethodOption = {
  value: InputMethod
  label: string
  summary: string
  /** 지금 고를 수 있는지. 아직 없는 방식은 담당 Issue를 함께 보여 준다 */
  ready: boolean
  plannedIn?: string
}

export const INPUT_METHODS: readonly InputMethodOption[] = [
  {
    value: 'TEXT',
    label: '텍스트로 쓰기',
    summary: '짧게 한두 줄로 남깁니다',
    ready: true,
  },
  {
    value: 'VOICE',
    label: '말로 남기기',
    summary: '손이 바쁠 때 말로 남깁니다',
    ready: true,
  },
  {
    value: 'CHECK',
    label: '체크로 고르기',
    summary: '자주 쓰는 항목을 눌러서 고릅니다',
    ready: true,
  },
]

export function findInputMethod(value: InputMethod): InputMethodOption {
  const found = INPUT_METHODS.find((method) => method.value === value)
  if (!found) {
    throw new Error(`알 수 없는 입력 방식입니다: ${value}`)
  }
  return found
}
