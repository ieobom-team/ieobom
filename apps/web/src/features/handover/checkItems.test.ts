import { describe, expect, it } from 'vitest'
import { buildCheckedText, CHECK_ITEMS } from './checkItems'

describe('체크 항목을 문장으로 합치기', () => {
  it('고른 항목의 라벨을 화면 순서대로 이어 붙인다', () => {
    const text = buildCheckedText(['MEDICATION_MISS', 'FALL_RISK'])

    expect(text).toBe('체크 항목: 낙상 위험 행동 관찰, 투약 거부 또는 누락')
  })

  it('한 항목만 골라도 문장이 된다', () => {
    expect(buildCheckedText(['OTHER'])).toBe('체크 항목: 기타 특이사항')
  })

  it('목록에 없는 값은 무시한다', () => {
    expect(buildCheckedText(['알수없음', 'OTHER'])).toBe('체크 항목: 기타 특이사항')
  })

  it('항목은 10개다', () => {
    expect(CHECK_ITEMS).toHaveLength(10)
  })
})
