/**
 * Web Speech API 위의 얇은 래퍼. 인식된 텍스트와 함께 **원본 녹음도 같이 받는다.** (#44)
 *
 * 데모 환경은 Chrome 기준으로 고정한다(이슈 #8) — `webkitSpeechRecognition`만 있으면
 * 충분하고, 다른 브라우저의 지원 편차까지 흡수하려 하지 않는다.
 *
 * 녹음은 `MediaRecorder`가 인식과 나란히 돈다. Web Speech API는 인식 결과에 타임스탬프를
 * 주지 않으므로 **입력 한 건 전체가 한 덩어리**다 — 항목별 구간 재생은 STT를 바꿔야 한다.
 * (Manyfast F-SNBVHR dataSpec 미결 질문)
 *
 * **세션 단위만 허용한다.** (Manyfast F-YJJJUX rules) 시작은 사용자가 마이크를 눌러야만
 * 일어나고, 화면을 벗어나면 호출한 쪽이 반드시 `stop()`을 불러야 한다 — 상시 녹음 금지는
 * 화면(`HandoverCreatePage`)의 책임이다. 다만 마이크 허용이 화면을 벗어난 뒤에 떨어지는
 * 경우까지 화면이 막을 수는 없어서, 그 한 경우만 이 파일이 함께 막는다.
 *
 * ---
 *
 * ## 진단 모드 (임시 — 원인 확정 후 되돌린다)
 *
 * Android 모바일 배포에서만 인식 결과가 하나도 오지 않고, 아무 안내 없이 세션이 조용히 끝나는
 * 현상을 조사하기 위한 코드가 `SpeechDiagnostics` 로 들어와 있다.
 *
 * 화면에서 `?voicedebug=1` 로만 켜지며, 파라미터가 없으면 아래 동작은 종전과 완전히 같다.
 *
 * ### 1차 (완료) — 마이크 경합으로 원인 확정
 *
 * - `default` — 녹음(`getUserMedia` → `MediaRecorder`)을 먼저 띄우고 그 `Promise` 안에서
 *   인식을 시작한다. 지금 배포된 동작 그대로다.
 * - `recognition-only` — 녹음을 아예 걸지 않고 인식만 한다.
 * - `recognition-first` — 인식을 클릭 핸들러 안에서 **동기로** 먼저 시작하고 녹음을 뒤에 붙인다.
 *
 * 삼성인터넷 30(Android 10) 실기기 결과: `recognition-only` 만 인식됐고, `recognition-first` 는
 * 인식이 마이크를 먼저 잡았는데도 `MediaRecorder.start()` 직후부터 소리 이벤트가 끊겼다.
 * 제스처 소실이 아니라 **마이크 경합**이다.
 *
 * ### 2차 — 경합의 주체가 `getUserMedia` 인지 `MediaRecorder` 인지
 *
 * 1차에서는 둘이 1ms 차이로 붙어 있어 갈리지 않았다. 여기서 갈리면 원본 음성(#44)을 모바일에서도
 * 지킬 수 있는지가 정해진다.
 *
 * - `stream-only` — `getUserMedia` 로 스트림만 잡고 `MediaRecorder` 는 만들지 않는다.
 *   인식되면 `MediaRecorder` 가, 안 되면 마이크 세션 자체가 범인이다.
 * - `web-audio` — 스트림을 Web Audio 로 소비한다. `stream-only` 가 통과했을 때, 직접 캡처하는
 *   우회가 실제로 살아남는지 본다.
 */

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

interface SpeechRecognitionInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null
  /** 아래는 진단 로그에서만 쓴다. 브라우저가 실제로 어디까지 오는지 보려는 것뿐이다. */
  onstart?: (() => void) | null
  onaudiostart?: (() => void) | null
  onsoundstart?: (() => void) | null
  onspeechstart?: (() => void) | null
  onspeechend?: (() => void) | null
  onsoundend?: (() => void) | null
  onaudioend?: (() => void) | null
  onnomatch?: (() => void) | null
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}

interface SpeechRecognitionErrorLike {
  error: string
}

export type SpeechRecognizer = {
  start: () => void
  stop: () => void
}

/** 진단 모드에서 갈라 볼 조합. 무엇을 가르는지는 파일 맨 위 주석에 있다. */
export type SpeechDiagnosticsMode =
  | 'default'
  | 'recognition-only'
  | 'recognition-first'
  | 'stream-only'
  | 'web-audio'

/** 진단 설정. 넘기지 않으면 로그도 남지 않고 동작도 종전과 같다. */
export type SpeechDiagnostics = {
  mode: SpeechDiagnosticsMode
  log: (line: string) => void
}

/** Chrome 이 실제로 녹음하는 형식. 지원하지 않으면 브라우저 기본값으로 떨어진다. */
const PREFERRED_MIME_TYPE = 'audio/webm'

/** 한 번에 녹음할 수 있는 길이. 서버 상한(10MB)에 닿기 한참 전에 스스로 멈춘다. */
export const MAX_RECORDING_MS = 5 * 60 * 1000

/** 서버가 받아 주는 원본 음성의 상한. `HandoverService.AUDIO_MAX_BYTES` 와 같은 값이다. */
const AUDIO_MAX_BYTES = 10 * 1024 * 1024

function speechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') {
    return null
  }
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return speechRecognitionConstructor() !== null
}

/** 인식 안내 문구. 마이크 권한 거부가 가장 흔한 실패라 그것만 따로 짚는다. */
export function speechErrorMessage(error: string): string {
  if (error === 'not-allowed' || error === 'permission-denied') {
    return '마이크 권한이 없어 음성을 들을 수 없습니다. 브라우저 설정에서 허용해 주세요.'
  }
  if (error === 'no-speech') {
    return '아무 말도 들리지 않았습니다. 다시 눌러 말씀해 주세요.'
  }
  return '음성 인식 중 문제가 생겼습니다. 다시 시도하거나 텍스트로 남겨 주세요.'
}

/**
 * 인식기를 하나 만든다. 지원하지 않는 브라우저면 `null`을 돌려준다.
 *
 * `onTranscript`는 지금까지 인식된 전체 문장을 매번 통째로 준다 — 중간 결과와 최종
 * 결과를 이어 붙이는 계산을 화면 쪽이 다시 하지 않게 하기 위해서다.
 *
 * `diagnostics`는 임시 조사용이다. 넘기지 않으면 동작이 달라지지 않는다.
 */
export function createSpeechRecognizer(
  onTranscript: (transcript: string) => void,
  onEnd: (audioBase64: string | null) => void,
  onError: (message: string) => void,
  diagnostics?: SpeechDiagnostics,
): SpeechRecognizer | null {
  const Ctor = speechRecognitionConstructor()
  if (Ctor === null) {
    return null
  }

  const log = (line: string) => diagnostics?.log(line)
  const mode: SpeechDiagnosticsMode = diagnostics?.mode ?? 'default'

  const recognition = new Ctor()
  recognition.lang = 'ko-KR'
  recognition.continuous = true
  recognition.interimResults = true

  let mediaRecorder: MediaRecorder | null = null
  const audioChunks: Blob[] = []
  let stream: MediaStream | null = null
  let ended = false
  /** `stop()` 이 이미 불렸는지. 마이크 허용이 늦게 떨어져도 녹음을 시작하지 않기 위해 본다. */
  let stopped = false
  /** 녹음을 Data URL 로 바꾸는 중인지. 인식 종료가 먼저 와도 음성을 버리지 않기 위해 본다. */
  let encoding = false
  let limitTimer: ReturnType<typeof setTimeout> | null = null
  /** `web-audio` 진단 모드에서만 쓴다. 다른 모드에서는 끝까지 `null` 이다. */
  let audioContext: AudioContext | null = null

  /** 마이크를 놓는다. 이걸 빠뜨리면 화면을 떠난 뒤에도 브라우저 탭에 녹음 표시가 남는다. */
  const releaseMic = () => {
    if (limitTimer !== null) {
      clearTimeout(limitTimer)
      limitTimer = null
    }
    void audioContext?.close()
    audioContext = null
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
  }

  /**
   * 한 세션의 끝. 음성을 못 얻었으면 `null` 이고, 그때도 인식된 텍스트는 그대로 남는다.
   *
   * 인식 종료(`onend`)와 녹음 종료가 거의 동시에 오고 Data URL 변환만 비동기다. 변환을
   * 기다리는 동안 들어온 "음성 없음"은 무시해야 방금 녹음한 음성을 잃지 않는다.
   */
  const finish = (audio: string | null) => {
    if (ended || (audio === null && encoding)) {
      return
    }
    ended = true
    log(`finish(음성 ${audio === null ? '없음' : `${audio.length}자`})`)
    releaseMic()
    onEnd(audio)
  }

  /** 녹음기가 살아 있으면 그쪽 `onstop` 이 마무리하고, 아니면 여기서 끝낸다. */
  const stopRecording = () => {
    if (mediaRecorder !== null && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      return
    }
    finish(null)
  }

  /** 마지막 `onresult` 의 인덱스별 스냅샷. 세션이 끝날 때 통째로 한 번 더 남긴다. */
  let lastResults: { index: number; final: boolean; text: string }[] = []

  /**
   * 인식 결과를 진단 로그로 남긴다. **`isFinal` 을 보려는 것**이다.
   *
   * 삼성인터넷에서 같은 말이 수십 번 겹쳐 쌓이는데, 중간 결과를 같은 인덱스에 덮어쓰지 않고 새
   * 인덱스에 계속 붙이기 때문인지 확인해야 위 `onresult` 의 이어 붙이기를 어떻게 고칠지 정할 수 있다.
   */
  const logResults = (event: SpeechRecognitionEventLike) => {
    if (diagnostics === undefined || event.results.length === 0) {
      return
    }
    lastResults = []
    let flags = ''
    for (let i = 0; i < event.results.length; i += 1) {
      const result = event.results[i]
      flags += result.isFinal ? 'F' : 'i'
      lastResults.push({ index: i, final: result.isFinal, text: result[0].transcript })
    }
    const last = lastResults[lastResults.length - 1]
    log(
      `rec.onresult ${event.results.length}건 flags=${flags} | 끝 ${last.index}${last.final ? 'F' : 'i'} "${last.text}"`,
    )
  }

  /** 세션이 끝날 때 인덱스별 내용을 한 번에 남긴다. 중복이 어디서 생기는지 눈으로 보려는 것이다. */
  const dumpResults = () => {
    if (diagnostics === undefined || lastResults.length === 0) {
      return
    }
    log(`--- 결과 덤프 (${lastResults.length}건) ---`)
    lastResults.forEach((item) => log(`  ${item.index}${item.final ? 'F' : 'i'} "${item.text}"`))
  }

  recognition.onresult = (event) => {
    let combined = ''
    for (let i = 0; i < event.results.length; i += 1) {
      combined += event.results[i][0].transcript
    }
    logResults(event)
    onTranscript(combined)
  }

  recognition.onerror = (event) => {
    log(`rec.onerror — ${event.error}`)
    onError(speechErrorMessage(event.error))
    stopRecording()
  }

  recognition.onend = () => {
    log('rec.onend')
    dumpResults()
    stopRecording()
  }

  // 진단용 이벤트. 어디까지 오고 어디서 끊기는지 보려는 것뿐이라 동작에는 관여하지 않는다.
  if (diagnostics !== undefined) {
    recognition.onstart = () => log('rec.onstart')
    recognition.onaudiostart = () => log('rec.onaudiostart — 마이크 입력 열림')
    recognition.onsoundstart = () => log('rec.onsoundstart — 소리 감지')
    recognition.onspeechstart = () => log('rec.onspeechstart — 말소리 감지')
    recognition.onspeechend = () => log('rec.onspeechend')
    recognition.onsoundend = () => log('rec.onsoundend')
    recognition.onaudioend = () => log('rec.onaudioend')
    recognition.onnomatch = () => log('rec.onnomatch')
  }

  /**
   * 인식만 시작한다. 녹음과 분리해 둔 것은 시작 순서를 갈라 보기 위해서다.
   *
   * 길이 상한도 여기서 건다 — 녹음 없이 인식만 도는 경우에도 상시 녹음 금지는 지켜야 한다.
   *
   * 예외를 밖으로 던지지 않고 여기서 끝내는 이유는, 인식이 클릭 핸들러에서 **동기로** 시작되는
   * 경로가 생겼기 때문이다. 던지면 화면 쪽 클릭 핸들러가 통째로 깨진다. 처리 내용은 종전에
   * `getUserMedia` 의 `catch` 가 하던 것과 같다.
   */
  const startRecognition = () => {
    // 상시 녹음이 되지 않게 길이에도 상한을 둔다. (Manyfast F-YJJJUX rules)
    limitTimer = setTimeout(() => recognition.stop(), MAX_RECORDING_MS)
    try {
      recognition.start()
      log('rec.start() 호출 성공')
    } catch (error) {
      log(`rec.start() 예외 — ${String(error)}`)
      onError(speechErrorMessage('not-allowed'))
      finish(null)
    }
  }

  const startRecording = (granted: MediaStream) => {
    stream = granted
    try {
      mediaRecorder = new MediaRecorder(granted, { mimeType: PREFERRED_MIME_TYPE })
    } catch {
      // 형식을 지원하지 않는 브라우저면 기본 형식으로 녹음한다. 무엇으로 녹음됐는지는
      // Data URL 앞부분에 그대로 실려 서버까지 간다.
      mediaRecorder = new MediaRecorder(granted)
    }

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data)
      }
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: mediaRecorder?.mimeType || PREFERRED_MIME_TYPE })
      log(`MediaRecorder.onstop — ${blob.size}바이트`)
      if (blob.size === 0) {
        finish(null)
        return
      }
      if (blob.size > AUDIO_MAX_BYTES) {
        // 서버 상한을 넘는 음성을 보내면 저장 자체가 400 으로 막혀 텍스트까지 잃는다.
        // 음성만 버리고 인식된 텍스트로 넘어간다.
        onError('녹음이 너무 길어 원본 음성은 저장하지 않았습니다. 인식된 내용은 그대로 남습니다.')
        finish(null)
        return
      }
      encoding = true
      const reader = new FileReader()
      reader.onloadend = () => {
        encoding = false
        finish(reader.result as string)
      }
      reader.onerror = () => {
        encoding = false
        finish(null)
      }
      reader.readAsDataURL(blob)
    }

    mediaRecorder.start()
    log(`MediaRecorder.start() — ${mediaRecorder.mimeType || '기본 형식'} · ${mediaRecorder.state}`)
  }

  /**
   * `web-audio` 진단 모드. 스트림을 Web Audio 로 소비하되 저장은 하지 않는다.
   *
   * `MediaRecorder` 대신 직접 캡처하는 우회가 살아남는지만 보는 것이라 `ScriptProcessorNode` 로
   * 충분하다. (실제 구현이라면 `AudioWorklet` 을 쓰겠지만 둘 다 같은 스트림을 소비한다.)
   */
  const startWebAudioTap = (granted: MediaStream) => {
    stream = granted
    audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(granted)
    const processor = audioContext.createScriptProcessor(4096, 1, 1)
    let frames = 0
    processor.onaudioprocess = () => {
      frames += 1
      // 매 프레임을 남기면 로그가 넘친다. 흐르고 있다는 것만 띄엄띄엄 확인한다.
      if (frames === 1 || frames % 40 === 0) {
        log(`WebAudio 프레임 ${frames}개 수신`)
      }
    }
    source.connect(processor)
    processor.connect(audioContext.destination)
    log(`WebAudio tap 시작 — ${audioContext.state} · ${audioContext.sampleRate}Hz`)
  }

  return {
    start: () => {
      log(`start() — mode=${mode}`)

      if (mode === 'recognition-only') {
        // 녹음을 아예 걸지 않는다. 마이크 경합 가설을 가른다.
        startRecognition()
        return
      }

      if (navigator.mediaDevices?.getUserMedia === undefined) {
        // 녹음을 지원하지 않는 환경. 인식은 그대로 하고 원본 음성만 없이 간다.
        log('getUserMedia 없음 — 인식만 시작한다')
        startRecognition()
        return
      }

      if (mode === 'recognition-first') {
        // 클릭 핸들러 안에서 동기로 먼저 시작한다. 제스처 컨텍스트 소실 가설을 가른다.
        startRecognition()
      }

      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((granted) => {
          log('getUserMedia 허용됨')
          if (stopped) {
            // 허용이 떨어지기 전에 화면을 벗어났다. 여기서 녹음을 시작하면 화면 밖에서
            // 마이크가 계속 켜져 있게 된다. (Manyfast F-YJJJUX rules — 상시 녹음 금지)
            granted.getTracks().forEach((track) => track.stop())
            finish(null)
            return
          }
          if (mode === 'stream-only') {
            // 스트림만 잡고 아무것도 하지 않는다. 경합의 주체가 마이크 세션 자체인지 본다.
            stream = granted
            log('MediaRecorder 를 만들지 않는다 — 스트림만 잡은 상태')
          } else if (mode === 'web-audio') {
            startWebAudioTap(granted)
          } else {
            startRecording(granted)
          }
          if (mode !== 'recognition-first') {
            startRecognition()
          }
        })
        .catch((error: unknown) => {
          log(`getUserMedia 거부/실패 — ${String(error)}`)
          onError(speechErrorMessage('not-allowed'))
          finish(null)
        })
    },
    stop: () => {
      log('stop() 호출됨')
      stopped = true
      recognition.stop()
      stopRecording()
    },
  }
}
