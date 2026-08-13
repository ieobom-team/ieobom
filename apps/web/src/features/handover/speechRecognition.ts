/**
 * Web Speech API 위의 얇은 래퍼.
 *
 * 데모 환경은 Chrome 기준으로 고정한다(이슈 #8) — `webkitSpeechRecognition`만 있으면
 * 충분하고, 다른 브라우저의 지원 편차까지 흡수하려 하지 않는다.
 *
 * **세션 단위만 허용한다.** (Manyfast F-YJJJUX rules) 시작은 사용자가 마이크를 눌러야만
 * 일어나고, 화면을 벗어나면 호출한 쪽이 반드시 `stop()`을 불러야 한다 — 이 파일은 그
 * 규칙을 강제하지 않는다. 상시 녹음 금지는 화면(`HandoverCreatePage`)의 책임이다.
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
  let audioChunks: Blob[] = []
  let stream: MediaStream | null = null
  let ended = false

  const finish = (audio: string | null) => {
    if (ended) return
    ended = true
    onEnd(audio)
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
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    } else {
      finish(null)
    }
  }

  recognition.onend = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    } else {
      finish(null)
    }
  }

  return {
    start: () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        recognition.start()
        return
      }

      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((s) => {
          stream = s
          try {
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
          } catch (e) {
            mediaRecorder = new MediaRecorder(stream)
          }

          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data)
          }

          mediaRecorder.onstop = () => {
            const type = mediaRecorder?.mimeType || 'audio/webm'
            const blob = new Blob(audioChunks, { type })
            const reader = new FileReader()
            reader.onloadend = () => {
              finish(reader.result as string)
            }
            reader.readAsDataURL(blob)
            stream?.getTracks().forEach((track) => track.stop())
          }

          mediaRecorder.start()
          recognition.start()
        })
        .catch(() => {
          onError(speechErrorMessage('not-allowed'))
        })
    },
    stop: () => {
      recognition.stop()
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop()
      }
    },
  }
}
