import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  canRecordVoice,
  createVoiceRecorder,
  MAX_RECORDING_MS,
  recorderErrorMessage,
} from './voiceRecorder'

/**
 * 녹음기. **인식은 여기서 하지 않는다** — 서버가 한다. (#147 · Manyfast F-YJJJUX rules)
 *
 * 예전에 여기 있던 Web Speech 관련 검증(조각 합치기 · 끊긴 인식 이어 가기 · 모바일 UA 분기)은
 * 그 코드가 사라지면서 함께 사라졌다. 이 파일이 지키는 것은 세 가지다 — **녹음한 것을 Data URL
 * 로 넘긴다**, **상시 녹음이 되지 않는다**, **음성을 얻지 못한 경우가 조용히 지나가지 않는다.**
 */

/** 녹음 데이터 크기를 바꿔 가며 확인하려고 바이트 수를 받는다. */
class FakeRecorder {
  static instances: FakeRecorder[] = []
  static blobBytes = 10

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
    this.ondataavailable?.({
      data: new Blob([new Uint8Array(FakeRecorder.blobBytes)], { type: this.mimeType }),
    })
    this.onstop?.()
  }
}

const tracks = [{ stop: vi.fn() }]

function stubRecording(granted: Promise<unknown> = Promise.resolve({ getTracks: () => tracks })) {
  vi.stubGlobal('MediaRecorder', FakeRecorder)
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => granted } })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  FakeRecorder.instances = []
  FakeRecorder.blobBytes = 10
  tracks[0].stop.mockClear()
})

/**
 * 음성 방식을 고를 수 있는지가 이 값으로 갈린다.
 *
 * **브라우저의 음성 인식 지원 여부는 더 이상 보지 않는다.** 인식이 서버로 옮겨 갔으므로 Web
 * Speech 가 없는 브라우저에서도 음성 입력이 된다. (#147)
 */
describe('이 기기에서 녹음할 수 있는지', () => {
  it('getUserMedia 가 있으면 녹음할 수 있다', () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } })
    expect(canRecordVoice()).toBe(true)
  })

  it('모바일이어도 녹음할 수 있다 — 더 이상 기기로 가르지 않는다 (#147)', () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn() },
      userAgentData: { mobile: true },
      userAgent:
        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 SamsungBrowser/30.0 Mobile Safari/537.36',
    })
    expect(canRecordVoice()).toBe(true)
  })

  it('녹음 자체를 지원하지 않으면 고를 수 없다', () => {
    vi.stubGlobal('navigator', { userAgent: 'Chrome' })
    expect(canRecordVoice()).toBe(false)
  })
})

describe('안내 문구', () => {
  it('권한 거부는 무엇을 해야 하는지 짚는다', () => {
    expect(recorderErrorMessage('not-allowed')).toContain('마이크 권한')
    expect(recorderErrorMessage('permission-denied')).toContain('마이크 권한')
  })

  it('아무 소리도 안 담겼으면 다시 눌러 말하게 한다', () => {
    expect(recorderErrorMessage('no-audio')).toContain('다시 눌러')
  })

  it('모르는 실패는 텍스트로 대신 남기게 안내한다', () => {
    expect(recorderErrorMessage('그 밖의 무엇')).toContain('텍스트')
  })
})

describe('녹음기', () => {
  it('멈추면 녹음한 음성을 Data URL 로 넘긴다', async () => {
    stubRecording()
    const onEnd = vi.fn()
    const recorder = createVoiceRecorder(onEnd, vi.fn())

    recorder.start()
    await vi.waitFor(() => expect(FakeRecorder.instances).toHaveLength(1))
    recorder.stop()

    await vi.waitFor(() => expect(onEnd).toHaveBeenCalledOnce())
    expect(onEnd.mock.calls[0][0]).toMatch(/^data:audio\/webm;base64,/)
    expect(tracks[0].stop).toHaveBeenCalled()
  })

  it('마이크 권한을 거부하면 안내하고 음성 없이 끝낸다 — 텍스트로 이어 갈 수 있다', async () => {
    stubRecording(Promise.reject(new Error('NotAllowedError')))
    const onEnd = vi.fn()
    const onError = vi.fn()

    createVoiceRecorder(onEnd, onError).start()

    await vi.waitFor(() => expect(onError).toHaveBeenCalled())
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('마이크 권한'))
    expect(onEnd).toHaveBeenCalledWith(null)
    expect(FakeRecorder.instances).toHaveLength(0)
  })

  it('녹음을 지원하지 않는 브라우저면 마이크를 잡지 않는다', () => {
    vi.stubGlobal('MediaRecorder', FakeRecorder)
    vi.stubGlobal('navigator', { userAgent: 'Chrome' })
    const onEnd = vi.fn()
    const onError = vi.fn()

    createVoiceRecorder(onEnd, onError).start()

    expect(onError).toHaveBeenCalledOnce()
    expect(onEnd).toHaveBeenCalledWith(null)
    expect(FakeRecorder.instances).toHaveLength(0)
  })

  /**
   * 아무 소리도 담기지 않은 녹음. 예전에는 기기가 인식한 글이라도 남았지만, 이제는 글도 이
   * 음성에서 나오므로 조용히 지나가면 화면에 아무 일도 일어나지 않은 것처럼 보인다.
   */
  it('아무것도 녹음되지 않았으면 알리고 음성 없이 끝낸다', async () => {
    FakeRecorder.blobBytes = 0
    stubRecording()
    const onEnd = vi.fn()
    const onError = vi.fn()
    const recorder = createVoiceRecorder(onEnd, onError)

    recorder.start()
    await vi.waitFor(() => expect(FakeRecorder.instances).toHaveLength(1))
    recorder.stop()

    await vi.waitFor(() => expect(onEnd).toHaveBeenCalled())
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('아무 소리도'))
    expect(onEnd).toHaveBeenCalledWith(null)
  })

  /** 서버가 받지 않는 크기다. 버리면 글도 남지 않으므로 다시 남기게 한다. */
  it('서버 상한을 넘는 녹음은 넘기지 않고 다시 남기게 안내한다', async () => {
    FakeRecorder.blobBytes = 10 * 1024 * 1024 + 1
    stubRecording()
    const onEnd = vi.fn()
    const onError = vi.fn()
    const recorder = createVoiceRecorder(onEnd, onError)

    recorder.start()
    await vi.waitFor(() => expect(FakeRecorder.instances).toHaveLength(1))
    recorder.stop()

    await vi.waitFor(() => expect(onEnd).toHaveBeenCalled())
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('짧게 나눠'))
    expect(onEnd).toHaveBeenCalledWith(null)
  })

  it('두 번 멈춰도 한 번만 끝낸다', async () => {
    stubRecording()
    const onEnd = vi.fn()
    const recorder = createVoiceRecorder(onEnd, vi.fn())

    recorder.start()
    await vi.waitFor(() => expect(FakeRecorder.instances).toHaveLength(1))
    recorder.stop()
    await vi.waitFor(() => expect(onEnd).toHaveBeenCalledOnce())
    recorder.stop()

    expect(onEnd).toHaveBeenCalledOnce()
  })
})

/**
 * 상시 녹음 금지. (Manyfast F-YJJJUX rules)
 *
 * 사용자가 시작한 세션만 허용하고, 5분이 지나면 스스로 멈추며, 화면을 벗어난 뒤에는 마이크가
 * 켜지지 않는다.
 */
describe('상시 녹음 금지', () => {
  it('5분이 지나면 스스로 멈춘다', async () => {
    vi.useFakeTimers()
    stubRecording()
    const onEnd = vi.fn()
    const recorder = createVoiceRecorder(onEnd, vi.fn())

    recorder.start()
    await vi.waitFor(() => expect(FakeRecorder.instances).toHaveLength(1))
    expect(FakeRecorder.instances[0].state).toBe('recording')

    vi.advanceTimersByTime(MAX_RECORDING_MS)

    expect(FakeRecorder.instances[0].state).toBe('inactive')
    expect(tracks[0].stop).toHaveBeenCalled()
  })

  it('상한 전에는 스스로 멈추지 않는다', async () => {
    vi.useFakeTimers()
    stubRecording()
    const recorder = createVoiceRecorder(vi.fn(), vi.fn())

    recorder.start()
    await vi.waitFor(() => expect(FakeRecorder.instances).toHaveLength(1))
    vi.advanceTimersByTime(MAX_RECORDING_MS - 1000)

    expect(FakeRecorder.instances[0].state).toBe('recording')
  })

  it('허용이 떨어지기 전에 화면을 벗어나면 녹음을 시작하지 않는다', async () => {
    let allow: (stream: unknown) => void = () => {}
    stubRecording(new Promise((resolve) => (allow = resolve)))
    const onEnd = vi.fn()
    const recorder = createVoiceRecorder(onEnd, vi.fn())

    recorder.start()
    recorder.stop()
    allow({ getTracks: () => tracks })

    await vi.waitFor(() => expect(onEnd).toHaveBeenCalled())
    expect(FakeRecorder.instances).toHaveLength(0)
    expect(tracks[0].stop).toHaveBeenCalled()
  })

  it('멈추면 마이크를 놓는다', async () => {
    stubRecording()
    const recorder = createVoiceRecorder(vi.fn(), vi.fn())

    recorder.start()
    await vi.waitFor(() => expect(FakeRecorder.instances).toHaveLength(1))
    recorder.stop()

    await vi.waitFor(() => expect(tracks[0].stop).toHaveBeenCalled())
  })
})
