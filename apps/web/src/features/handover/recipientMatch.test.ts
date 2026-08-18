import { describe, expect, it } from 'vitest'
import { matchRecipients } from './recipientMatch'

const 강복순 = { id: 6, name: '강복순', code: 'IB-006', dischargedAt: null }
const 김말순 = { id: 1, name: '김말순', code: 'IB-001', dischargedAt: null }
const 박순자 = { id: 2, name: '박순자', code: 'IB-002', dischargedAt: null }
const 어르신들 = [강복순, 김말순, 박순자]

const 권태호 = { id: 15, name: '권태호', code: 'IB-015', dischargedAt: null }
const 이태호 = { id: 16, name: '이태호', code: 'IB-016', dischargedAt: null }
const 김민 = { id: 17, name: '김민', code: 'IB-017', dischargedAt: null }

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

  describe('성 뺀 이름 매칭 (#142) — 이름이 3글자일 때만 성 1글자를 뺀 나머지도 일치로 본다', () => {
    it('성을 빼고 불러도 그 이름이 유일하면 자동 선택한다', () => {
      const 명단 = [권태호, 김말순, 박순자]

      const result = matchRecipients('태호 어르신 오늘 휘청거려서 주의 요망', 명단)

      expect(result.autoSelectedId).toBe(권태호.id)
      expect(result.sorted[0]).toEqual(권태호)
    })

    it('전체 성함을 불러도 여전히 자동 선택된다', () => {
      const 명단 = [권태호, 김말순, 박순자]

      const result = matchRecipients('권태호 어르신 오늘 휘청거려서 주의 요망', 명단)

      expect(result.autoSelectedId).toBe(권태호.id)
    })

    it('성 뺀 이름이 여러 명과 겹치면 자동 선택하지 않고 둘 다 후보 상단에 정렬한다', () => {
      const 명단 = [권태호, 이태호, 김말순]

      const result = matchRecipients('태호 어르신이 오늘 컨디션이 좋아 보이셨어요', 명단)

      expect(result.autoSelectedId).toBeNull()
      expect(result.sorted.slice(0, 2)).toEqual(expect.arrayContaining([권태호, 이태호]))
    })

    it('이름이 3글자가 아니면 성을 뺀 매칭을 적용하지 않고 전체 성함 일치만 본다', () => {
      const 명단 = [김민, 김말순, 박순자]

      const result = matchRecipients('민 어르신이 오늘 산책하셨어요', 명단)

      expect(result.autoSelectedId).toBeNull()
    })
  })
})
