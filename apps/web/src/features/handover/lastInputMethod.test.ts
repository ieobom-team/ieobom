import { describe, expect, it } from 'vitest'
import {
  LAST_INPUT_METHOD_KEY,
  readLastInputMethod,
  resolveDefaultInputMethod,
  writeLastInputMethod,
} from './lastInputMethod'

describe('기기별 마지막 사용 입력 방식', () => {
  it('아직 쓴 적이 없으면 기억하는 값이 없다', () => {
    expect(readLastInputMethod()).toBeNull()
  })

  it('기록한 방식을 그대로 되살린다', () => {
    writeLastInputMethod('CHECK')

    expect(readLastInputMethod()).toBe('CHECK')
  })

  it('읽을 수 없는 값이 들어 있어도 진입을 막지 않는다', () => {
    window.localStorage.setItem(LAST_INPUT_METHOD_KEY, '깨진 값')

    expect(readLastInputMethod()).toBeNull()
  })
})

describe('기본 입력 방식 계산', () => {
  it('마지막으로 쓴 방식이 있으면 그대로 기본값이 된다', () => {
    expect(resolveDefaultInputMethod('TEXT', true)).toBe('TEXT')
    expect(resolveDefaultInputMethod('CHECK', true)).toBe('CHECK')
  })

  it('최초 사용 기기는 음성이 기본값이다', () => {
    expect(resolveDefaultInputMethod(null, true)).toBe('VOICE')
  })

  it('음성 인식을 지원하지 않으면 텍스트로 대체한다', () => {
    expect(resolveDefaultInputMethod(null, false)).toBe('TEXT')
    expect(resolveDefaultInputMethod('VOICE', false)).toBe('TEXT')
  })
})
