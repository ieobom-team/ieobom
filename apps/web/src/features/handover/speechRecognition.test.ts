import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  canRecordOriginalAudio,
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
  mergeTranscript,
} from './speechRecognition'

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

/**
 * 인식 결과를 이어 붙이는 규칙. (#146)
 *
 * 브라우저마다 결과를 쌓는 방식이 달라서, 그냥 이어 붙이면 Android 에서 같은 말이 겹쳐 쌓인다.
 */
describe('인식 조각 합치기', () => {
  it('데스크톱처럼 서로 다른 조각을 주면 이어 붙인다', () => {
    expect(mergeTranscript('식사를 ', '거의 안 하셨어요')).toBe('식사를 거의 안 하셨어요')
  })

  it('Android 처럼 앞 내용을 포함한 누적본을 주면 이어 붙이지 않고 교체한다', () => {
    expect(mergeTranscript('안녕하세요', '안녕하세요 테스트입니다')).toBe('안녕하세요 테스트입니다')
  })

  it('같은 조각을 다시 주면 무시한다', () => {
    expect(mergeTranscript('안녕하세요', '안녕하세요')).toBe('안녕하세요')
  })

  it('빈 조각은 문장을 건드리지 않는다', () => {
    expect(mergeTranscript('안녕하세요', '')).toBe('안녕하세요')
    expect(mergeTranscript('', '안녕하세요')).toBe('안녕하세요')
  })
})

describe('원본 음성을 저장할 수 있는 기기인지', () => {
  it('모바일이면 저장하지 않는다 — 마이크를 잡는 순간 인식이 멈춘다 (#146)', () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn() },
      userAgent:
        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/143.0.0.0 Mobile Safari/537.36',
    })
    expect(canRecordOriginalAudio()).toBe(false)
  })

  it('userAgentData 가 있으면 그것을 먼저 믿는다', () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn() },
      userAgentData: { mobile: true },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/151.0.0.0 Safari/537.36',
    })
    expect(canRecordOriginalAudio()).toBe(false)
  })

  it('PC 면 저장한다', () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn() },
      userAgentData: { mobile: false },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/151.0.0.0 Safari/537.36',
    })
    expect(canRecordOriginalAudio()).toBe(true)
  })

  it('녹음 자체를 지원하지 않으면 저장하지 않는다', () => {
    vi.stubGlobal('navigator', { userAgent: 'Chrome' })
    expect(canRecordOriginalAudio()).toBe(false)
  })
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
    // 멈추라고 해야 한 번의 말하기가 끝난다. 그냥 끊긴 것이라면 이어서 다시 시작한다. (#149)
    recognizer?.stop()
    fake.onend?.()

    expect(fake.start).toHaveBeenCalledOnce()
    expect(onEnd).toHaveBeenCalledWith(null)
  })

  it('Android 처럼 누적본을 여러 번 줘도 한 문장으로 돌려준다 (#146)', () => {
    stub()
    const onTranscript = vi.fn()
    createSpeechRecognizer(onTranscript, vi.fn(), vi.fn())

    // 실기기(삼성인터넷 30 / Android 10)에서 "안녕하세요 테스트입니다" 한 번에 나온 결과다.
    fake.onresult?.({
      results: [
        [{ transcript: '' }],
        [{ transcript: '안녕하세요' }],
        [{ transcript: '안녕하세요' }],
        [{ transcript: '안녕하세요 테스트입니다' }],
        [{ transcript: '안녕하세요 테스트입니다' }],
      ] as never,
    } as never)

    expect(onTranscript).toHaveBeenCalledWith('안녕하세요 테스트입니다')
  })

  it('아무것도 못 알아듣고 조용히 끝나면 안내한다 — 모바일은 에러를 주지 않는다 (#146)', async () => {
    stub()
    const onError = vi.fn()
    const recognizer = createSpeechRecognizer(vi.fn(), vi.fn(), onError)

    recognizer?.start()
    await Promise.resolve()
    recognizer?.stop()
    fake.onend?.()

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('아무 말도 들리지 않았습니다'))
  })

  it('인식된 내용이 있으면 끝나도 안내하지 않는다', async () => {
    stub()
    const onError = vi.fn()
    const recognizer = createSpeechRecognizer(vi.fn(), vi.fn(), onError)

    recognizer?.start()
    await Promise.resolve()
    fake.onresult?.({ results: [[{ transcript: '점심을 거의 안 드셨어요' }]] as never } as never)
    recognizer?.stop()
    fake.onend?.()

    expect(onError).not.toHaveBeenCalled()
  })

  it('에러로 끝났으면 같은 실패를 두 번 알리지 않는다', async () => {
    stub()
    const onError = vi.fn()
    const recognizer = createSpeechRecognizer(vi.fn(), vi.fn(), onError)

    recognizer?.start()
    await Promise.resolve()
    fake.onerror?.({ error: 'not-allowed' } as never)
    fake.onend?.()

    expect(onError).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('마이크 권한'))
  })
})

/**
 * 끊긴 인식 이어 가기. (#149)
 *
 * Android 는 `continuous` 를 지키지 않고 말이 끊기는 즉시 세션을 닫는다. 사용자가 멈추라고 하기
 * 전까지는 다시 시작해 한 번의 말하기로 이어 준다. 여기서 보는 것은 "앞 내용을 잃지 않는다"와
 * **"이어 가기가 상시 녹음이 되지 않는다"**(Manyfast F-YJJJUX rules)다.
 */
describe('끊긴 인식 이어 가기', () => {
  /** Android 가 무음에서 세션을 닫기까지 걸리는 시간. 진단 로그 기준 약 5초다. */
  const 무음_종료 = 6_000
  /** 재시작을 걸어 둔 간격(100ms)보다 넉넉히. */
  const 재시작_대기 = 300

  beforeEach(() => {
    vi.useFakeTimers()
    fake = new FakeRecognition()
    vi.stubGlobal('webkitSpeechRecognition', function FakeCtor() {
      return fake
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** 인식이 스스로 한 번 끊겼다가 이어지는 것을 흉내 낸다. */
  function 한_번_끊겼다_이어짐(조용한_시간 = 무음_종료) {
    vi.advanceTimersByTime(조용한_시간)
    fake.onend?.()
    vi.advanceTimersByTime(재시작_대기)
  }

  function 말함(transcript: string) {
    fake.onresult?.({ results: [[{ transcript }]] as never } as never)
  }

  it('말이 끊겨도 다시 시작하고 앞 문장을 잃지 않는다', () => {
    const onTranscript = vi.fn()
    createSpeechRecognizer(onTranscript, vi.fn(), vi.fn())?.start()

    말함('점심을 거의 안 드셨어요')
    한_번_끊겼다_이어짐()
    말함('오후에도 그러셨어요')

    expect(fake.start).toHaveBeenCalledTimes(2)
    expect(onTranscript).toHaveBeenLastCalledWith('점심을 거의 안 드셨어요 오후에도 그러셨어요')
  })

  it('중간에 쉬는 것만으로는 끝나지 않는다', () => {
    const onEnd = vi.fn()
    createSpeechRecognizer(vi.fn(), onEnd, vi.fn())?.start()

    말함('점심을 거의 안 드셨어요')
    한_번_끊겼다_이어짐()
    한_번_끊겼다_이어짐()

    expect(onEnd).not.toHaveBeenCalled()
  })

  it('20초 넘게 조용하면 끝내고 안내한다', () => {
    const onEnd = vi.fn()
    const onError = vi.fn()
    createSpeechRecognizer(vi.fn(), onEnd, onError)?.start()

    // 6초씩 네 번이면 마지막으로 인식된 시각에서 20초를 넘긴다.
    한_번_끊겼다_이어짐()
    한_번_끊겼다_이어짐()
    한_번_끊겼다_이어짐()
    한_번_끊겼다_이어짐()

    expect(onEnd).toHaveBeenCalledWith(null)
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('아무 말도 들리지 않았습니다'))
  })

  it('계속 말하는 중이어도 5분 상한을 넘기지 않는다 — 상시 녹음 금지', () => {
    const onEnd = vi.fn()
    createSpeechRecognizer(vi.fn(), onEnd, vi.fn())?.start()

    // 10초마다 말하며 끊겼다 이어지기를 6분치 반복한다.
    for (let i = 0; i < 40; i += 1) {
      말함(`${i}번째 `)
      한_번_끊겼다_이어짐(10_000)
    }

    expect(onEnd).toHaveBeenCalledWith(null)

    // 상한을 넘긴 뒤로는 아무리 기다려도 다시 시작하지 않는다.
    const 시작한_횟수 = fake.start.mock.calls.length
    vi.advanceTimersByTime(60_000)
    expect(fake.start).toHaveBeenCalledTimes(시작한_횟수)
  })

  it('사용자가 멈추면 다시 시작하지 않는다', () => {
    const recognizer = createSpeechRecognizer(vi.fn(), vi.fn(), vi.fn())
    recognizer?.start()

    말함('점심을 거의 안 드셨어요')
    recognizer?.stop()
    fake.onend?.()
    vi.advanceTimersByTime(재시작_대기)

    expect(fake.start).toHaveBeenCalledOnce()
  })

  it('시작하자마자 끝나는 것이 반복되면 접는다 — 마이크 표시만 깜빡이게 두지 않는다', () => {
    const onError = vi.fn()
    createSpeechRecognizer(vi.fn(), vi.fn(), onError)?.start()

    for (let i = 0; i < 5; i += 1) {
      한_번_끊겼다_이어짐(0)
    }

    expect(fake.start).toHaveBeenCalledTimes(3)
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('아무 말도 들리지 않았습니다'))
  })

  it('no-speech 는 잠깐 끊긴 것으로 보고 안내 없이 이어 간다', () => {
    const onError = vi.fn()
    createSpeechRecognizer(vi.fn(), vi.fn(), onError)?.start()

    말함('점심을')
    fake.onerror?.({ error: 'no-speech' } as never)
    한_번_끊겼다_이어짐()

    expect(fake.start).toHaveBeenCalledTimes(2)
    expect(onError).not.toHaveBeenCalled()
  })

  it('마이크 권한 거부는 되살릴 수 없으므로 그 자리에서 끝낸다', () => {
    const onError = vi.fn()
    createSpeechRecognizer(vi.fn(), vi.fn(), onError)?.start()

    fake.onerror?.({ error: 'not-allowed' } as never)
    한_번_끊겼다_이어짐()

    expect(fake.start).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('마이크 권한'))
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

  it('모바일이면 마이크를 잡지 않고 인식만 한다 — 잡는 순간 인식이 멈춘다 (#146)', async () => {
    const getUserMedia = vi.fn(() => Promise.resolve({ getTracks: () => tracks }))
    fake = new FakeRecognition()
    vi.stubGlobal('webkitSpeechRecognition', function FakeCtor() {
      return fake
    })
    vi.stubGlobal('MediaRecorder', FakeRecorder)
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia },
      userAgent:
        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/143.0.0.0 Mobile Safari/537.36',
    })
    const onEnd = vi.fn()

    createSpeechRecognizer(vi.fn(), onEnd, vi.fn())?.start()
    await Promise.resolve()

    expect(getUserMedia).not.toHaveBeenCalled()
    expect(FakeRecorder.instances).toHaveLength(0)
    expect(fake.start).toHaveBeenCalledOnce()
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
