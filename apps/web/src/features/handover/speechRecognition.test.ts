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

  it('녹음을 지원하지 않는 환경이면 원본 음성 없이 인식만 한다', async () => {
    stub()
    const onEnd = vi.fn()
    const recognizer = createSpeechRecognizer(vi.fn(), onEnd, vi.fn())

    recognizer?.start()
    await Promise.resolve()
    fake.onend?.()

    expect(fake.start).toHaveBeenCalledOnce()
    expect(onEnd).toHaveBeenCalledWith(null)
  })
})

/**
 * 원본 음성 캡처. (#44 · Manyfast F-SNBVHR)
 *
 * 인식 결과와 나란히 녹음이 돌고, 세션이 끝날 때 Data URL 로 넘어온다. 여기서 확인하는 것은
 * "음성을 얻지 못해도 텍스트 흐름은 살아 있다"와 "화면을 벗어난 뒤에는 마이크가 켜지지 않는다"다.
 */
describe('원본 음성 캡처', () => {
  class FakeRecorder {
    static instances: FakeRecorder[] = []
    state: 'inactive' | 'recording' = 'inactive'
    mimeType = 'audio/webm'
    ondataavailable: ((event: { data: Blob }) => void) | null = null
    onstop: (() => void) | null = null

    constructor() {
      FakeRecorder.instances.push(this)
    }

    start() {
      this.state = 'recording'
    }

    stop() {
      this.state = 'inactive'
      this.ondataavailable?.({ data: new Blob(['가짜-음성'], { type: this.mimeType }) })
      this.onstop?.()
    }
  }

  const tracks = [{ stop: vi.fn() }]

  function stubRecording(granted: Promise<unknown> = Promise.resolve({ getTracks: () => tracks })) {
    fake = new FakeRecognition()
    vi.stubGlobal('webkitSpeechRecognition', function FakeCtor() {
      return fake
    })
    vi.stubGlobal('MediaRecorder', FakeRecorder)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => granted } })
  }

  afterEach(() => {
    FakeRecorder.instances = []
    tracks[0].stop.mockClear()
  })

  it('세션이 끝나면 인식된 텍스트와 함께 원본 음성을 Data URL 로 넘긴다', async () => {
    stubRecording()
    const onEnd = vi.fn()
    const recognizer = createSpeechRecognizer(vi.fn(), onEnd, vi.fn())

    recognizer?.start()
    await vi.waitFor(() => expect(fake.start).toHaveBeenCalledOnce())

    recognizer?.stop()

    await vi.waitFor(() => expect(onEnd).toHaveBeenCalledOnce())
    expect(onEnd.mock.calls[0][0]).toMatch(/^data:audio\/webm;base64,/)
    expect(tracks[0].stop).toHaveBeenCalled()
  })

  it('마이크 권한을 거부하면 안내만 하고 음성 없이 끝낸다 — 텍스트로 이어 갈 수 있다', async () => {
    stubRecording(Promise.reject(new Error('NotAllowedError')))
    const onEnd = vi.fn()
    const onError = vi.fn()
    createSpeechRecognizer(vi.fn(), onEnd, onError)?.start()

    await vi.waitFor(() => expect(onError).toHaveBeenCalled())

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('마이크 권한'))
    expect(onEnd).toHaveBeenCalledWith(null)
    expect(fake.start).not.toHaveBeenCalled()
  })

  it('허용이 떨어지기 전에 화면을 벗어나면 녹음을 시작하지 않는다 — 상시 녹음 금지', async () => {
    let allow: (stream: unknown) => void = () => {}
    stubRecording(new Promise((resolve) => (allow = resolve)))
    const onEnd = vi.fn()
    const recognizer = createSpeechRecognizer(vi.fn(), onEnd, vi.fn())

    recognizer?.start()
    recognizer?.stop()
    allow({ getTracks: () => tracks })
    await vi.waitFor(() => expect(onEnd).toHaveBeenCalled())

    expect(FakeRecorder.instances).toHaveLength(0)
    expect(fake.start).not.toHaveBeenCalled()
    expect(tracks[0].stop).toHaveBeenCalled()
  })
})
