import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSpeechRecognizer, isSpeechRecognitionSupported } from './speechRecognition'

type Listener = ((event: never) => void) | null

class FakeRecognition {
  lang = ''
  continuous = false
  interimResults = false
  onresult: Listener = null
  onend: (() => void) | null = null
  onerror: Listener = null
  start = vi.fn()
  stop = vi.fn()
}

let fake: FakeRecognition

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('지원 여부', () => {
  it('webkitSpeechRecognition 이 없으면 지원하지 않는 것으로 본다', () => {
    expect(isSpeechRecognitionSupported()).toBe(false)
  })

  it('webkitSpeechRecognition 이 있으면 지원하는 것으로 본다', () => {
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
    expect(isSpeechRecognitionSupported()).toBe(true)
  })
})

describe('인식기', () => {
  function stub() {
    fake = new FakeRecognition()
    // 화살표 함수는 `new`로 부를 수 없다. 생성자 자리를 흉내 내려면 일반 함수여야 한다.
    vi.stubGlobal(
      'webkitSpeechRecognition',
      function FakeCtor() {
        return fake
      },
    )
  }

  it('지원하지 않으면 null 을 돌려준다', () => {
    expect(createSpeechRecognizer(vi.fn(), vi.fn(), vi.fn())).toBeNull()
  })

  it('한국어·세션 단위(연속 인식)로 설정해 시작한다', () => {
    stub()
    const recognizer = createSpeechRecognizer(vi.fn(), vi.fn(), vi.fn())

    recognizer?.start()

    expect(fake.lang).toBe('ko-KR')
    expect(fake.continuous).toBe(true)
    expect(fake.start).toHaveBeenCalledOnce()
  })

  it('중간·최종 결과를 이어 붙여 한 문장으로 돌려준다', () => {
    stub()
    const onTranscript = vi.fn()
    createSpeechRecognizer(onTranscript, vi.fn(), vi.fn())

    fake.onresult?.({
      results: [
        [{ transcript: '식사를 ' }],
        [{ transcript: '거의 안 하셨어요' }],
      ] as never,
    } as never)

    expect(onTranscript).toHaveBeenCalledWith('식사를 거의 안 하셨어요')
  })

  it('마이크 권한이 없으면 그 사실을 알려 준다', () => {
    stub()
    const onError = vi.fn()
    createSpeechRecognizer(vi.fn(), vi.fn(), onError)

    fake.onerror?.({ error: 'not-allowed' } as never)

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('마이크 권한'))
  })

  it('멈추면 stop 을 부른다', () => {
    stub()
    const recognizer = createSpeechRecognizer(vi.fn(), vi.fn(), vi.fn())

    recognizer?.stop()

    expect(fake.stop).toHaveBeenCalledOnce()
  })
})
