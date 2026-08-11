import { describe, expect, it } from 'vitest'
import {
  emptyDraft,
  RAW_TEXT_MAX_LENGTH,
  toCreateRequest,
  toDateTimeLocal,
  validateDraft,
  type HandoverDraft,
} from './handoverForm'

const 입력자 = '김하늘'

function 채운_폼(patch: Partial<HandoverDraft> = {}): HandoverDraft {
  return {
    careRecipientId: 1,
    proxyInput: false,
    infoSource: null,
    inputMethod: 'TEXT',
    rawText: '점심 드시고 나서 오른쪽 다리를 계속 주무르셨어요.',
    occurredAt: '2026-08-11T13:10',
    ...patch,
  }
}

function 항목들(draft: HandoverDraft, reporterName = 입력자) {
  return validateDraft(draft, reporterName).map((error) => error.field)
}

describe('제출 전 검증', () => {
  it('다 채우면 보완할 항목이 없다', () => {
    expect(validateDraft(채운_폼(), 입력자)).toEqual([])
  })

  it('빈 폼은 누락된 항목을 하나씩이 아니라 한 번에 모아 돌려준다', () => {
    const found = 항목들(emptyDraft(new Date(2026, 7, 11, 13, 10)), '')

    expect(found).toEqual(
      expect.arrayContaining([
        'proxyInput',
        'inputMethod',
        'rawText',
        'careRecipientId',
        'reporterName',
      ]),
    )
    expect(found.length).toBeGreaterThanOrEqual(5)
  })

  it('대리 입력인데 정보 출처가 없으면 출처를 짚어 준다', () => {
    expect(항목들(채운_폼({ proxyInput: true, infoSource: null }))).toContain('infoSource')
  })

  it('직접 관찰인데 정보 출처가 붙어 있으면 대리 입력 여부를 짚어 준다', () => {
    expect(항목들(채운_폼({ proxyInput: false, infoSource: 'DRIVER' }))).toContain('proxyInput')
  })

  it('대리 입력 여부를 고르지 않은 것과 직접 관찰을 구분한다', () => {
    expect(항목들(채운_폼({ proxyInput: null }))).toContain('proxyInput')
    expect(항목들(채운_폼({ proxyInput: false }))).not.toContain('proxyInput')
  })

  it('공백만 남긴 내용은 남기지 않은 것으로 본다', () => {
    expect(항목들(채운_폼({ rawText: '   ' }))).toContain('rawText')
  })

  it('원문이 2000자를 넘으면 보완 항목이 된다', () => {
    expect(항목들(채운_폼({ rawText: '가'.repeat(RAW_TEXT_MAX_LENGTH + 1) }))).toContain('rawText')
  })

  it('입력 시점이 비었거나 읽을 수 없으면 보완 항목이 된다', () => {
    expect(항목들(채운_폼({ occurredAt: '' }))).toContain('occurredAt')
    expect(항목들(채운_폼({ occurredAt: '어제 오후' }))).toContain('occurredAt')
  })
})

describe('요청으로 바꾸기', () => {
  it('직접 관찰이면 정보 출처를 아예 담지 않는다', () => {
    const request = toCreateRequest(채운_폼(), 입력자)

    expect(request.proxyInput).toBe(false)
    expect('infoSource' in request).toBe(false)
  })

  it('대리 입력이면 입력자와 정보 출처를 갈라서 담는다', () => {
    const request = toCreateRequest(
      채운_폼({ proxyInput: true, infoSource: 'GUARDIAN' }),
      '박데스크',
    )

    expect(request.reporterName).toBe('박데스크')
    expect(request.infoSource).toBe('GUARDIAN')
  })

  it('입력 시점은 계약 예시와 같게 초까지 붙여 보낸다', () => {
    expect(toCreateRequest(채운_폼(), 입력자).occurredAt).toBe('2026-08-11T13:10:00')
  })

  it('앞뒤 공백은 떼고 보낸다', () => {
    expect(toCreateRequest(채운_폼({ rawText: '  기침을 하셨어요.  ' }), 입력자).rawText).toBe(
      '기침을 하셨어요.',
    )
  })

  it('검증을 통과하지 않은 폼은 보내지 않는다', () => {
    expect(() => toCreateRequest(채운_폼({ careRecipientId: null }), 입력자)).toThrow()
  })
})

describe('입력 시점 기본값', () => {
  it('지금 시각을 지역 시각 그대로 채운다', () => {
    expect(toDateTimeLocal(new Date(2026, 7, 11, 9, 5))).toBe('2026-08-11T09:05')
  })
})
