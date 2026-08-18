import type { InputMethod } from './inputMethod'

/**
 * 기기별 마지막으로 쓴 입력 방식 — 다음에 화면을 열 때 기본값으로 쓴다.
 * (Manyfast F-YJJJUX rules — "입력 방식 기본값은 이 기기에서 마지막으로 쓴 방식이며,
 * 처음 쓰는 기기에서는 음성을 기본값으로 한다")
 *
 * **저장(제출)에 성공했을 때만** 기록한다. 화면에서 방식만 눌러 보고 저장하지 않은 값까지
 * "쓴 방식"으로 치면, 실수로 다른 방식을 눌러 봤다가 취소한 다음 진입에도 그 값이 남는다.
 */
export const LAST_INPUT_METHOD_KEY = 'ieobom.handover.last-input-method.v1'

function isInputMethod(value: unknown): value is InputMethod {
  return value === 'VOICE' || value === 'TEXT' || value === 'CHECK'
}

/** 브라우저 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 기억하지 못할 뿐, 화면은 그대로 뜬다. */
export function readLastInputMethod(): InputMethod | null {
  try {
    const raw = window.localStorage.getItem(LAST_INPUT_METHOD_KEY)
    return isInputMethod(raw) ? raw : null
  } catch {
    return null
  }
}

export function writeLastInputMethod(method: InputMethod): void {
  try {
    window.localStorage.setItem(LAST_INPUT_METHOD_KEY, method)
  } catch {
    // 기억하지 못해도 이번 입력은 이미 저장이 끝난 뒤다.
  }
}

/**
 * 화면을 열 때 쓸 기본 입력 방식을 정한다.
 *
 * 이 기기에서 마지막으로 쓴 방식이 없으면(최초 사용) 음성이 기본값이다. 다만 음성을 남길 수
 * 없는 브라우저에서는 고를 수 없는 방식을 기본값으로 내밀지 않는다 — 수동 선택 시와 같은
 * 규칙(텍스트로 대체 안내)을 기본값 계산에도 그대로 적용한다.
 *
 * **두 번째 인자는 "녹음할 수 있는가"다.** 예전에는 "브라우저가 음성 인식을 지원하는가"였는데,
 * 인식이 서버로 옮겨 가면서 의미가 바뀌었다(#147). 그대로 뒀다면 Web Speech 가 없는
 * 브라우저에서 멀쩡히 되는 음성 입력이 기본값으로 안 잡혔을 것이다.
 */
export function resolveDefaultInputMethod(
  lastUsed: InputMethod | null,
  canRecordVoice: boolean,
): InputMethod {
  const candidate = lastUsed ?? 'VOICE'
  return candidate === 'VOICE' && !canRecordVoice ? 'TEXT' : candidate
}
