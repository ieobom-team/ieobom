import { describe, expect, it } from 'vitest'
import {
  cardEntries,
  chipTextsFor,
  createdAtTimeLabel,
  dateLabel,
  dateLabelWithWeekday,
  filterByRecipientName,
  filterCards,
  findCard,
  observedDateTimeLabel,
  reviewStatusLabel,
  flattenCards,
  generalCards,
  getCardStats,
  highlightSummary,
  observedTimeLabel,
  safetyFirst,
  safetyRelatedCards,
  sortInboxCards,
  sortLatestFirst,
  suggestionLabel,
  totalCardCount,
  uncertainFieldLabels,
  withUpdatedCard,
} from './handoverCard'
import type { HandoverCard, HandoverCardList } from './handoverCardApi'

function 카드(patch: Partial<HandoverCard> = {}): HandoverCard {
  return {
    id: 31,
    handoverId: 12,
    careRecipientId: 1,
    careRecipientName: '김말순',
    observedAt: '2026-08-11T12:40:00',
    statusChange: '점심 식사량 저하',
    actionTaken: null,
    nextAction: '저녁 식사량 확인',
    evidenceText: '점심을 거의 안 드셨어요',
    safetyRelated: true,
    safetyFlagSource: 'KEYWORD',
    reviewStatus: 'NEEDS_REVIEW',
    suggestedJobRole: 'CAREGIVER',
    suggestedDueTime: '17:00',
    exportAllowed: false,
    exportBlockedReason: '검토 완료 후 생성할 수 있습니다.',
    createdAt: '2026-08-11T13:11:02.401',
    hasAudio: false,
    suggestedActions: [],
    ...patch,
  }
}

describe('카드 항목', () => {
  it('세 항목을 값이 없어도 모두 돌려준다', () => {
    const entries = cardEntries(카드({ actionTaken: null }))

    expect(entries.map((entry) => entry.label)).toEqual(['상태 변화', '조치', '다음 행동'])
    expect(entries[1].value).toBeNull()
  })
})

describe('안전 관련 우선 배치 및 최신순 정렬', () => {
  it('안전 항목을 앞으로 보낸다', () => {
    const 일반 = 카드({ id: 1, safetyRelated: false, createdAt: '2026-08-11T10:00:00' })
    const 안전 = 카드({ id: 2, safetyRelated: true, createdAt: '2026-08-11T09:00:00' })

    expect(safetyFirst([일반, 안전]).map((card) => card.id)).toEqual([2, 1])
  })

  it('같은 안전 상태면 최신 등록된 카드가 앞에 온다', () => {
    const 카드들 = [
      카드({ id: 1, safetyRelated: false, createdAt: '2026-08-11T10:00:00' }),
      카드({ id: 2, safetyRelated: true, createdAt: '2026-08-11T11:00:00' }),
      카드({ id: 3, safetyRelated: false, createdAt: '2026-08-11T12:00:00' }),
      카드({ id: 4, safetyRelated: true, createdAt: '2026-08-11T13:00:00' }),
    ]

    // 안전 항목(4, 2 최신순) -> 일반 항목(3, 1 최신순)
    expect(safetyFirst(카드들).map((card) => card.id)).toEqual([4, 2, 3, 1])
  })
})

describe('Inbox 정렬 및 필터링 (F-SNBVHR display · rules)', () => {
  const 카드목록 = [
    카드({ id: 1, careRecipientId: 1, reviewStatus: 'REVIEWED', safetyRelated: false, createdAt: '2026-08-11T09:00:00' }),
    카드({ id: 2, careRecipientId: 1, reviewStatus: 'NEEDS_REVIEW', safetyRelated: false, createdAt: '2026-08-11T10:00:00' }),
    카드({ id: 3, careRecipientId: 2, reviewStatus: 'NEEDS_REVIEW', safetyRelated: true, createdAt: '2026-08-11T11:00:00' }),
    카드({ id: 4, careRecipientId: 2, reviewStatus: 'REVIEWED', safetyRelated: true, createdAt: '2026-08-11T12:00:00' }),
  ]

  it('검토 필요 탭은 검토 필요 카드 중 안전 항목 최신순 -> 일반 항목 최신순으로 정렬한다', () => {
    const 결과 = filterCards(카드목록, 'NEEDS_REVIEW')
    expect(결과.map((c) => c.id)).toEqual([3, 2])
  })

  it('안전 관련 탭은 안전 카드만 최신 등록순으로 보여준다', () => {
    const 결과 = filterCards(카드목록, 'SAFETY')
    expect(결과.map((c) => c.id)).toEqual([4, 3])
  })

  it('검토 완료 탭은 완료된 카드만 최신 등록순으로 보여준다', () => {
    const 결과 = filterCards(카드목록, 'REVIEWED')
    expect(결과.map((c) => c.id)).toEqual([4, 1])
  })

  it('sortLatestFirst는 등록 시각 최신순으로 정렬한다', () => {
    const 정렬결과 = sortLatestFirst(카드목록)
    expect(정렬결과.map((c) => c.id)).toEqual([4, 3, 2, 1])
  })

  it('sortInboxCards는 검토 필요 우선 -> 안전 우선 -> 최신순으로 정렬한다', () => {
    const 정렬결과 = sortInboxCards(카드목록)
    expect(정렬결과.map((c) => c.id)).toEqual([3, 2, 4, 1])
  })

  it('flattenCards와 getCardStats로 목록의 카드와 통계를 계산한다', () => {
    const list: HandoverCardList = {
      date: '2026-08-11',
      recipients: [
        { careRecipientId: 1, careRecipientName: '김말순', cards: [카드목록[0], 카드목록[1]] },
        { careRecipientId: 2, careRecipientName: '박순자', cards: [카드목록[2], 카드목록[3]] },
      ],
      unresolved: [카드({ id: 5, careRecipientId: null, careRecipientName: null })],
    }

    expect(flattenCards(list)).toHaveLength(4)
    const stats = getCardStats(list)
    expect(stats.needsReviewCount).toBe(2)
    expect(stats.safetyCount).toBe(2)
    expect(stats.reviewedCount).toBe(2)
    expect(stats.totalCount).toBe(5)
    expect(stats.unresolvedCount).toBe(1)
  })

  it('createdAtTimeLabel은 등록 시각을 HH:MM으로 돌려준다', () => {
    expect(createdAtTimeLabel('2026-08-11T13:45:00')).toBe('13:45')
    expect(createdAtTimeLabel(null)).toBeNull()
  })
})

describe('안전/일반 분리와 대표 문구 (현장 홈 "오늘 특이사항" 요약)', () => {
  const 목록 = [
    카드({ id: 1, safetyRelated: false, statusChange: '점심 식사량 저하', createdAt: '2026-08-11T09:00:00' }),
    카드({ id: 2, safetyRelated: true, statusChange: '낙상 위험 발견', createdAt: '2026-08-11T11:00:00' }),
    카드({ id: 3, safetyRelated: false, statusChange: '기분 좋게 오전 활동 참여', createdAt: '2026-08-11T12:00:00' }),
  ]

  it('safetyRelatedCards는 안전 카드만 최신순으로 돌려준다', () => {
    expect(safetyRelatedCards(목록).map((c) => c.id)).toEqual([2])
  })

  it('generalCards는 일반 카드만 최신순으로 돌려준다', () => {
    expect(generalCards(목록).map((c) => c.id)).toEqual([3, 1])
  })

  it('대표 문구는 상태 변화를 우선 쓴다', () => {
    expect(highlightSummary(카드({ statusChange: '점심 식사량 저하' }))).toBe('점심 식사량 저하')
  })

  it('상태 변화가 없으면 조치, 다음 행동, 근거 원문 순으로 대신한다', () => {
    expect(
      highlightSummary(카드({ statusChange: null, actionTaken: '죽으로 변경' })),
    ).toBe('죽으로 변경')
    expect(
      highlightSummary(카드({ statusChange: null, actionTaken: null, nextAction: '보호자 안내' })),
    ).toBe('보호자 안내')
    expect(
      highlightSummary(
        카드({ statusChange: null, actionTaken: null, nextAction: null, evidenceText: '점심을 거의 안 드셨어요' }),
      ),
    ).toBe('점심을 거의 안 드셨어요')
  })
})

describe('제안값 표시', () => {
  it('다음 행동이 있으면 제안 직종과 기한을 한 줄로 보여 준다', () => {
    expect(suggestionLabel(카드())).toBe('제안 · 요양보호사 · 17:00까지')
  })

  it('다음 행동이 없으면 제안값을 붙이지 않는다', () => {
    expect(suggestionLabel(카드({ nextAction: null }))).toBeNull()
  })

  it('서버가 직종을 비워 보냈으면 비었다고 적는다', () => {
    expect(suggestionLabel(카드({ suggestedJobRole: null, suggestedDueTime: null }))).toBe(
      '제안 · 담당 직종 미정 · 기한 미정',
    )
  })
})

describe('AI 추천 액션 칩 (F-SNBVHR display)', () => {
  const 칩카드 = 카드({
    suggestedActions: [
      { targetField: 'ACTION_TAKEN', text: '죽으로 바꿔 드림' },
      { targetField: 'NEXT_ACTION', text: '저녁 식사량 재확인' },
      { targetField: 'NEXT_ACTION', text: '보호자에게 안내' },
    ],
  })

  it('대상 칸으로 나눠 문구만 돌려준다', () => {
    expect(chipTextsFor(칩카드, 'ACTION_TAKEN')).toEqual(['죽으로 바꿔 드림'])
    expect(chipTextsFor(칩카드, 'NEXT_ACTION')).toEqual(['저녁 식사량 재확인', '보호자에게 안내'])
  })

  it('추천이 없으면 빈 배열이다', () => {
    expect(chipTextsFor(카드({ suggestedActions: [] }), 'ACTION_TAKEN')).toEqual([])
  })
})

describe('시각과 날짜', () => {
  it('관찰 시각은 분까지만 보여 준다', () => {
    expect(observedTimeLabel('2026-08-11T12:40:00')).toBe('12:40')
  })

  it('원문에서 시각을 읽지 못한 카드는 시각을 보여 주지 않는다', () => {
    expect(observedTimeLabel(null)).toBeNull()
  })

  it('조회 기준일을 사람이 읽는 형태로 바꾼다', () => {
    expect(dateLabel('2026-08-11')).toBe('8월 11일')
  })

  it('요일 포함 날짜는 YYYY-MM-DD (요일) 형태로 바꾼다', () => {
    // 2026-08-14는 금요일이다
    expect(dateLabelWithWeekday('2026-08-14')).toBe('2026-08-14 (금)')
  })

  it('관찰 일시는 요일 포함 날짜와 시각을 한 줄로 합친다 (HandoverCardDetailPage 헤더)', () => {
    // 2026-08-11은 화요일이다
    expect(observedDateTimeLabel('2026-08-11T12:40:00')).toBe('2026-08-11 (화) 12:40')
  })

  it('원문에서 시각을 읽지 못한 카드는 관찰 일시를 보여주지 않는다', () => {
    expect(observedDateTimeLabel(null)).toBeNull()
  })
})

describe('검토 상태 라벨 (HandoverCardDetailPage 헤더 — CardBadges와 같은 문구)', () => {
  it('검토 필요/검토 완료 문구를 돌려준다', () => {
    expect(reviewStatusLabel('NEEDS_REVIEW')).toBe('검토 필요')
    expect(reviewStatusLabel('REVIEWED')).toBe('검토 완료')
  })
})

describe('어르신 이름 검색 (HandoverCreatePage TargetStep과 동일한 부분일치 방식)', () => {
  const 카드들 = [
    카드({ id: 1, careRecipientId: 1, careRecipientName: '김말순' }),
    카드({ id: 2, careRecipientId: 2, careRecipientName: '박순자' }),
  ]

  it('검색어가 비어 있으면 전체를 돌려준다', () => {
    expect(filterByRecipientName(카드들, '').map((c) => c.id)).toEqual([1, 2])
  })

  it('이름에 검색어가 포함된 카드만 남긴다', () => {
    expect(filterByRecipientName(카드들, '박순자').map((c) => c.id)).toEqual([2])
  })

  it('어르신을 가리지 못해 이름이 없는 카드는 검색어와 매칭되지 않는다', () => {
    const 미확정 = 카드({ id: 3, careRecipientId: null, careRecipientName: null })
    expect(filterByRecipientName([...카드들, 미확정], '김').map((c) => c.id)).toEqual([1])
  })
})

describe('AI 가 채우지 못한 자리', () => {
  it('다 채워진 카드에는 아무것도 알리지 않는다', () => {
    expect(uncertainFieldLabels(카드())).toEqual([])
  })

  it('어르신을 가리지 못했으면 알린다', () => {
    expect(uncertainFieldLabels(카드({ careRecipientId: null, careRecipientName: null }))).toEqual([
      '대상 어르신',
    ])
  })

  it('원문에서 시각을 읽지 못했으면 알린다', () => {
    expect(uncertainFieldLabels(카드({ observedAt: null }))).toEqual(['관찰 시각'])
  })

  it('다음 행동이 있는데 직종과 기한을 비웠으면 둘 다 알린다', () => {
    expect(
      uncertainFieldLabels(카드({ suggestedJobRole: null, suggestedDueTime: null })),
    ).toEqual(['제안 담당 직종', '제안 기한'])
  })

  it('다음 행동이 없으면 제안값이 비어 있어도 빈 자리로 보지 않는다', () => {
    const 다음행동없음 = 카드({
      nextAction: null,
      suggestedJobRole: null,
      suggestedDueTime: null,
    })

    expect(uncertainFieldLabels(다음행동없음)).toEqual([])
  })
})

describe('고쳐진 카드를 목록에 되꽂기', () => {
  const list: HandoverCardList = {
    date: '2026-08-11',
    recipients: [{ careRecipientId: 1, careRecipientName: '김말순', cards: [카드({ id: 31 })] }],
    unresolved: [카드({ id: 40, careRecipientId: null, careRecipientName: null })],
  }

  it('같은 어르신 안에서 고친 내용으로 갈아 끼운다', () => {
    const 고침 = 카드({ id: 31, statusChange: '점심과 저녁 모두 저하' })

    const 결과 = withUpdatedCard(list, 고침)

    expect(결과.recipients).toHaveLength(1)
    expect(결과.recipients[0].cards).toHaveLength(1)
    expect(결과.recipients[0].cards[0].statusChange).toBe('점심과 저녁 모두 저하')
  })

  it('어르신을 지정하면 검토 필요 항목에서 빼고 그 어르신 묶음으로 옮긴다', () => {
    const 확정 = 카드({ id: 40, careRecipientId: 1, careRecipientName: '김말순' })

    const 결과 = withUpdatedCard(list, 확정)

    expect(결과.unresolved).toEqual([])
    expect(결과.recipients[0].cards.map((card) => card.id)).toEqual([31, 40])
  })

  it('목록에 없던 어르신이면 묶음을 새로 만든다', () => {
    const 확정 = 카드({ id: 40, careRecipientId: 2, careRecipientName: '박순자' })

    const 결과 = withUpdatedCard(list, 확정)

    expect(결과.recipients.map((recipient) => recipient.careRecipientName)).toEqual([
      '김말순',
      '박순자',
    ])
    expect(결과.unresolved).toEqual([])
  })

  it('어르신을 비우면 검토 필요 항목으로 돌아가고 빈 묶음은 사라진다', () => {
    const 비움 = 카드({ id: 31, careRecipientId: null, careRecipientName: null })

    const 결과 = withUpdatedCard(list, 비움)

    expect(결과.recipients).toEqual([])
    expect(결과.unresolved.map((card) => card.id)).toEqual([40, 31])
  })
})

describe('목록에서 카드 찾기', () => {
  const list: HandoverCardList = {
    date: '2026-08-11',
    recipients: [{ careRecipientId: 1, careRecipientName: '김말순', cards: [카드({ id: 31 })] }],
    unresolved: [카드({ id: 32, careRecipientId: null, careRecipientName: null })],
  }

  it('어르신 묶음 안의 카드를 찾는다', () => {
    expect(findCard(list, 31)?.id).toBe(31)
  })

  it('어르신을 가리지 못한 카드도 찾는다', () => {
    expect(findCard(list, 32)?.careRecipientId).toBeNull()
  })

  it('없는 카드는 null 이다', () => {
    expect(findCard(list, 99)).toBeNull()
  })

  it('전체 건수는 가리지 못한 항목까지 센다', () => {
    expect(totalCardCount(list)).toBe(2)
  })
})
