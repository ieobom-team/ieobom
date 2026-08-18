/**
 * Web Speech API 위의 얇은 래퍼. **PC 에서는** 인식된 텍스트와 함께 원본 녹음도 같이 받는다. (#44)
 *
 * 데모 환경은 Chrome 기준으로 고정한다(이슈 #8) — `webkitSpeechRecognition`만 있으면
 * 충분하고, 다른 브라우저의 지원 편차까지 흡수하려 하지 않는다.
 *
 * **세션 단위만 허용한다.** (Manyfast F-YJJJUX rules) 시작은 사용자가 마이크를 눌러야만
 * 일어나고, 화면을 벗어나면 호출한 쪽이 반드시 `stop()`을 불러야 한다 — 상시 녹음 금지는
 * 화면(`HandoverCreatePage`)의 책임이다. 다만 마이크 허용이 화면을 벗어난 뒤에 떨어지는
 * 경우까지 화면이 막을 수는 없어서, 그 한 경우만 이 파일이 함께 막는다.
 *
 * ---
 *
 * ## 모바일에서는 원본 녹음을 걸지 않는다 (#146)
 *
 * 모바일은 **페이지가 마이크 세션을 여는 순간 인식 엔진의 오디오 입력이 끊긴다.** 실기기
 * (삼성인터넷 30 · Chrome 151 / Android 10)에서 다섯 조합을 돌려 확인했다.
 *
 * | 조합 | 결과 |
 * |---|---|
 * | 녹음 → 인식 | 실패 — `onaudiostart` 뒤로 소리 이벤트 0건 |
 * | 인식만 | **성공** |
 * | 인식을 동기로 먼저 → 녹음 | 실패 — `MediaRecorder.start()` 직후부터 끊김 |
 * | `getUserMedia` 만, `MediaRecorder` 없음 | 실패 |
 * | `getUserMedia` + Web Audio 소비 | 실패 (오디오 프레임 자체는 정상 수신) |
 *
 * 경합의 주체는 `MediaRecorder` 가 아니라 `getUserMedia` 다. 그래서 캡처 방식을 바꾸는 우회가
 * 없고, 모바일에서는 원본 음성을 포기하고 인식만 한다. 원본 음성까지 지키려면 서버 STT 가
 * 필요하다 — #147 로 분리했다.
 *
 * 사용자 제스처 컨텍스트 소실 가설은 기각됐다. 인식을 클릭 핸들러에서 동기로 먼저 시작해도
 * 똑같이 실패했다.
 *
 * Web Speech API 는 인식 결과에 타임스탬프를 주지 않으므로 **입력 한 건 전체가 한 덩어리**다 —
 * 항목별 구간 재생은 STT 를 바꿔야 한다. (Manyfast F-SNBVHR dataSpec 미결 질문)
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

/**
 * 모바일 브라우저인지. `userAgentData` 가 있으면 그것을 믿고, 없으면 UA 문자열로 본다.
 *
 * UA 판정은 원래 깨지기 쉬운 방법이지만, 여기서 가르려는 것이 **기기 종류 자체**라 달리 볼
 * 근거가 없다. 마이크 경합은 `getUserMedia` 를 실제로 열어 봐야만 드러나고, 그때는 이미
 * 인식이 굶은 뒤라 되돌릴 수 없다.
 */
function isMobileBrowser(): boolean {
  const hinted = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
  if (typeof hinted?.mobile === 'boolean') {
    return hinted.mobile
  }
  return (
    typeof navigator.userAgent === 'string' &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  )
}

/**
 * 이 기기에서 원본 음성을 함께 저장할 수 있는지. 모바일이면 못 한다(위 파일 주석 · #146).
 *
 * 화면도 이 값을 봐야 한다 — 저장되지도 않을 원본 음성을 안내하면 안 된다.
 */
export function canRecordOriginalAudio(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }
  if (navigator.mediaDevices?.getUserMedia === undefined) {
    return false
  }
  return !isMobileBrowser()
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
 * 인식 결과 조각 하나를 지금까지의 문장에 합친다.
 *
 * **브라우저마다 결과를 쌓는 방식이 다르다.** (#146)
 *
 * - 데스크톱 Chrome — 인덱스마다 **서로 다른 발화 조각**을 준다. 이어 붙이는 것이 맞다.
 *   `'식사를 '` + `'거의 안 하셨어요'` → `'식사를 거의 안 하셨어요'`
 * - Android (삼성인터넷 · Chrome) — 수정본을 **새 인덱스에 누적 스냅샷으로** 낸다. 각 결과가
 *   델타가 아니라 "지금까지의 전체 문장"이라, 그냥 이어 붙이면 같은 말이 수십 번 겹친다.
 *   `'안녕하세요'` → `'안녕하세요'` → `'안녕하세요 테스트입니다'` (전부 `isFinal`)
 *
 * 그래서 **뒤 조각이 지금까지의 문장으로 시작하면 이어 붙이지 않고 교체한다.** 두 방식이 모두
 * 맞게 나온다.
 *
 * 데스크톱에서 같은 말을 정말로 두 번 연달아 하면 한 번으로 합쳐지지만, 겹쳐 쌓인 문장을
 * 사용자가 지우게 하는 쪽이 훨씬 나쁘다.
 */
export function mergeTranscript(combined: string, next: string): string {
  if (next === '') {
    return combined
  }
  if (combined === '') {
    return next
  }
  if (next.startsWith(combined)) {
    // 앞 내용을 그대로 포함한 수정본이다. 새 것으로 갈아 끼운다.
    return next
  }
  if (combined.endsWith(next)) {
    // 방금 받은 것을 그대로 다시 준 경우. 무시한다.
    return combined
  }
  return combined + next
}

/**
 * 인식기를 하나 만든다. 지원하지 않는 브라우저면 `null`을 돌려준다.
 *
 * `onTranscript`는 지금까지 인식된 전체 문장을 매번 통째로 준다 — 조각을 이어 붙이는 계산을
 * 화면 쪽이 다시 하지 않게 하기 위해서다.
 */
export function createSpeechRecognizer(
  onTranscript: (transcript: string) => void,
  onEnd: (audioBase64: string | null) => void,
  onError: (message: string) => void,
): SpeechRecognizer | null {
  const Ctor = speechRecognitionConstructor()
  if (Ctor === null) {
    return null
  }

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
  /** 이번 세션에서 한 글자라도 인식됐는지. 조용히 끝났을 때 안내를 낼지 가른다. */
  let heardAnything = false
  /** 이미 안내를 낸 뒤인지. 같은 실패를 두 번 알리지 않는다. */
  let notified = false

  /** 마이크를 놓는다. 이걸 빠뜨리면 화면을 떠난 뒤에도 브라우저 탭에 녹음 표시가 남는다. */
  const releaseMic = () => {
    if (limitTimer !== null) {
      clearTimeout(limitTimer)
      limitTimer = null
    }
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
  }

  /** 안내는 한 세션에 한 번만 낸다. */
  const notify = (message: string) => {
    notified = true
    onError(message)
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

  recognition.onresult = (event) => {
    let combined = ''
    for (let i = 0; i < event.results.length; i += 1) {
      combined = mergeTranscript(combined, event.results[i][0].transcript)
    }
    if (combined !== '') {
      heardAnything = true
    }
    onTranscript(combined)
  }

  recognition.onerror = (event) => {
    notify(speechErrorMessage(event.error))
    stopRecording()
  }

  recognition.onend = () => {
    // 아무것도 못 알아들은 채 끝났는데 아직 아무 말도 안 했다면 여기서 알린다.
    //
    // 데스크톱은 `no-speech` **에러**를 내주지만, 모바일은 `nomatch` **이벤트**만 내고 조용히
    // 끝난다(#146). 그래서 에러만 보고 있으면 모바일에서는 버튼이 아무 설명 없이 원래대로
    // 돌아가 버린다 — 사용자는 무엇이 잘못됐는지 알 방법이 없다.
    if (!heardAnything && !notified) {
      notify(speechErrorMessage('no-speech'))
    }
    stopRecording()
  }

  /**
   * 인식을 시작한다. 길이 상한도 여기서 건다 — 녹음 없이 인식만 도는 모바일에서도 상시 녹음
   * 금지는 지켜야 한다. (Manyfast F-YJJJUX rules)
   */
  const startRecognition = () => {
    limitTimer = setTimeout(() => recognition.stop(), MAX_RECORDING_MS)
    try {
      recognition.start()
    } catch {
      // 이미 시작됐거나 브라우저가 거절한 경우. 마이크를 놓고 안내한다.
      notify(speechErrorMessage('not-allowed'))
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
      if (blob.size === 0) {
        finish(null)
        return
      }
      if (blob.size > AUDIO_MAX_BYTES) {
        // 서버 상한을 넘는 음성을 보내면 저장 자체가 400 으로 막혀 텍스트까지 잃는다.
        // 음성만 버리고 인식된 텍스트로 넘어간다.
        notify('녹음이 너무 길어 원본 음성은 저장하지 않았습니다. 인식된 내용은 그대로 남습니다.')
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
    startRecognition()
  }

  return {
    start: () => {
      if (!canRecordOriginalAudio()) {
        // 모바일이거나 녹음을 지원하지 않는 환경. 인식만 하고 원본 음성 없이 간다. (#146)
        startRecognition()
        return
      }

      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((granted) => {
          if (stopped) {
            // 허용이 떨어지기 전에 화면을 벗어났다. 여기서 녹음을 시작하면 화면 밖에서
            // 마이크가 계속 켜져 있게 된다. (Manyfast F-YJJJUX rules — 상시 녹음 금지)
            granted.getTracks().forEach((track) => track.stop())
            finish(null)
            return
          }
          startRecording(granted)
        })
        .catch(() => {
          notify(speechErrorMessage('not-allowed'))
          finish(null)
        })
    },
    stop: () => {
      stopped = true
      recognition.stop()
      stopRecording()
    },
  }
}
