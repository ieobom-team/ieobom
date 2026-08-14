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

  /** 마이크를 놓는다. 이걸 빠뜨리면 화면을 떠난 뒤에도 브라우저 탭에 녹음 표시가 남는다. */
  const releaseMic = () => {
    if (limitTimer !== null) {
      clearTimeout(limitTimer)
      limitTimer = null
    }
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
      combined += event.results[i][0].transcript
    }
    onTranscript(combined)
  }

  recognition.onerror = (event) => {
    onError(speechErrorMessage(event.error))
    stopRecording()
  }

  recognition.onend = () => {
    stopRecording()
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
    // 상시 녹음이 되지 않게 길이에도 상한을 둔다. (Manyfast F-YJJJUX rules)
    limitTimer = setTimeout(() => recognition.stop(), MAX_RECORDING_MS)
    recognition.start()
  }

  return {
    start: () => {
      if (navigator.mediaDevices?.getUserMedia === undefined) {
        // 녹음을 지원하지 않는 환경. 인식은 그대로 하고 원본 음성만 없이 간다.
        recognition.start()
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
          onError(speechErrorMessage('not-allowed'))
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
