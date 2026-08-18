import { describe, expect, it } from 'vitest'
import { matchRecipients } from './recipientMatch'

const 강복순 = { id: 6, name: '강복순', code: 'IB-006', dischargedAt: null }
const 김말순 = { id: 1, name: '김말순', code: 'IB-001', dischargedAt: null }
const 박순자 = { id: 2, name: '박순자', code: 'IB-002', dischargedAt: null }
const 어르신들 = [강복순, 김말순, 박순자]

describe('matchRecipients', () => {
  it('원문이 비어 있으면 자동 선택 없이 원래 순서를 그대로 돌려준다', () => {
    const result = matchRecipients('', 어르신들)

    expect(result.autoSelectedId).toBeNull()
    expect(result.sorted).toEqual(어르신들)
  })

  it('원문에 이름이 정확히 1명 포함되면 그 어르신을 자동 선택한다', () => {
    const result = matchRecipients('김말순 어르신이 점심을 거의 안 드셨어요', 어르신들)

    expect(result.autoSelectedId).toBe(김말순.id)
    expect(result.sorted[0]).toEqual(김말순)
  })

  it('아무도 일치하지 않으면 자동 선택은 없고, 이름 일부가 겹치는 어르신이 후보 상단에 온다', () => {
    const result = matchRecipients('말순 언니가 오늘 컨디션이 좋아 보이셨어요', 어르신들)

    expect(result.autoSelectedId).toBeNull()
    expect(result.sorted[0]).toEqual(김말순)
  })

  it('두 명 이상의 이름이 원문에 포함되면 자동 선택하지 않고 둘 다 후보 상단에 정렬한다', () => {
    const result = matchRecipients('김말순 님과 박순자 님이 함께 산책하셨어요', 어르신들)

    expect(result.autoSelectedId).toBeNull()
    expect(result.sorted.slice(0, 2)).toEqual(expect.arrayContaining([김말순, 박순자]))
  })

  it('일치하는 이름이 없으면 자동 선택 없이 원래 순서를 유지한다', () => {
    const result = matchRecipients('오후 내내 기침을 하셨어요', 어르신들)

    expect(result.autoSelectedId).toBeNull()
    expect(result.sorted).toEqual(어르신들)
  })
})
