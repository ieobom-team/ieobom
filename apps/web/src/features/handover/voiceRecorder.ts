/**
 * 마이크 녹음 한 겹. **글로 바꾸는 일은 여기서 하지 않는다** — 서버가 한다.
 * (Manyfast F-YJJJUX rules — "기기가 녹음만 하고 서버가 그 음성을 글로 바꿔 돌려준다")
 *
 * ---
 *
 * ## 브라우저 내장 음성 인식을 쓰지 않는 이유 (#146 · #147)
 *
 * 예전에는 Web Speech API 로 기기에서 인식했다. 두 가지가 그것을 접게 만들었다.
 *
 * **하나. 모바일에서는 녹음과 인식을 함께 할 수 없다.** 페이지가 마이크 세션을 여는 순간 인식
 * 엔진의 오디오 입력이 끊긴다. 실기기(삼성인터넷 30 · Chrome 151 / Android 10)에서 다섯 조합을
 * 돌려 확인했다.
 *
 * | 조합 | 결과 |
 * |---|---|
 * | 녹음 → 인식 | 실패 — `onaudiostart` 뒤로 소리 이벤트 0건 |
 * | 인식만 | 성공 |
 * | 인식을 동기로 먼저 → 녹음 | 실패 — `MediaRecorder.start()` 직후부터 끊김 |
 * | `getUserMedia` 만, `MediaRecorder` 없음 | 실패 |
 * | `getUserMedia` + Web Audio 소비 | 실패 (오디오 프레임 자체는 정상 수신) |
 *
 * 경합의 주체는 `MediaRecorder` 가 아니라 `getUserMedia` 로 마이크를 여는 것 자체다. 캡처 방식을
 * 바꾸는 우회가 없다. **다시 시도하지 말 것.** 그래서 #146 은 모바일에서 원본 음성을 포기했는데,
 * 원본 음성 재생은 MVP 에서 어투·감정 기반 긴급도 판정 대신 넣기로 한 기능이라 포기할 수 없다.
 *
 * **둘. 기기마다 결과를 쌓는 방식이 다르고 정확도도 낮다.** Android 는 `continuous` 를 지키지 않고
 * 누적 스냅샷을 새 인덱스에 쌓아, 합치는 규칙을 따로 두지 않으면 같은 말이 겹쳐 쌓였다(#149 · #151).
 * 이름 인식도 흔들려서("태호" → "태우 / 태오 / 대우") `recipientMatch` 자동 매칭이 어긋났다.
 *
 * 그래서 **모든 기기에서 서버 인식으로 통일한다.** 기기별 분기를 두지 않는다. 이 파일은 이제
 * 녹음만 알고, 인식은 `handoverApi.transcribeAudio()` 가 부른다.
 *
 * ---
 *
 * **세션 단위만 허용한다.** (Manyfast F-YJJJUX rules) 시작은 사용자가 마이크를 눌러야만 일어나고,
 * 화면을 벗어나면 호출한 쪽이 반드시 `stop()` 을 불러야 한다 — 상시 녹음 금지는 화면
 * (`HandoverCreatePage`)의 책임이다. 다만 마이크 허용이 화면을 벗어난 뒤에 떨어지는 경우까지
 * 화면이 막을 수는 없어서, 그 한 경우만 이 파일이 함께 막는다.
 */

export type VoiceRecorder = {
  start: () => void
  stop: () => void
}

/** Chrome 이 실제로 녹음하는 형식. 지원하지 않으면 브라우저 기본값으로 떨어진다. */
const PREFERRED_MIME_TYPE = 'audio/webm'

/** 한 번에 녹음할 수 있는 길이. (Manyfast F-YJJJUX rules — 5분이 지나면 스스로 멈춘다) */
export const MAX_RECORDING_MS = 5 * 60 * 1000

/** 서버가 받아 주는 원본 음성의 상한. `HandoverService.AUDIO_MAX_BYTES` 와 같은 값이다. */
const AUDIO_MAX_BYTES = 10 * 1024 * 1024

/**
 * 이 기기에서 녹음할 수 있는지.
 *
 * 음성 방식을 고를 수 있는지가 이 값으로 갈린다. **브라우저 내장 인식 지원 여부는 더 이상 보지
 * 않는다** — 인식은 서버가 하므로 Web Speech 가 없는 브라우저에서도 음성 입력이 된다. (#147)
 */
export function canRecordVoice(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }
  return navigator.mediaDevices?.getUserMedia !== undefined
}

/** 녹음 안내 문구. 마이크 권한 거부가 가장 흔한 실패라 그것만 따로 짚는다. */
export function recorderErrorMessage(error: string): string {
  if (error === 'not-allowed' || error === 'permission-denied') {
    return '마이크 권한이 없어 녹음할 수 없습니다. 브라우저 설정에서 허용해 주세요.'
  }
  if (error === 'no-audio') {
    return '아무 소리도 녹음되지 않았습니다. 다시 눌러 말씀해 주세요.'
  }
  if (error === 'too-large') {
    return '녹음이 너무 길어 글로 바꿀 수 없습니다. 조금 짧게 나눠 다시 남겨 주세요.'
  }
  return '녹음 중 문제가 생겼습니다. 다시 시도하거나 텍스트로 남겨 주세요.'
}

/**
 * 녹음기를 하나 만든다.
 *
 * `onEnd` 는 녹음이 끝날 때 딱 한 번 불린다. 음성을 얻지 못했으면 `null` 이고, 그때는 `onError` 로
 * 이유가 먼저 나가 있다. 얻었으면 Base64 Data URL 이며, 그대로 서버 인식과 저장에 함께 쓴다 —
 * 두 요청이 같은 형식을 써야 인식은 통과했는데 저장에서 막히는 음성이 생기지 않는다.
 */
export function createVoiceRecorder(
  onEnd: (audioBase64: string | null) => void,
  onError: (message: string) => void,
): VoiceRecorder {
  let mediaRecorder: MediaRecorder | null = null
  const audioChunks: Blob[] = []
  let stream: MediaStream | null = null
  let ended = false
  /** `stop()` 이 이미 불렸는지. 마이크 허용이 늦게 떨어져도 녹음을 시작하지 않기 위해 본다. */
  let stopped = false
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

  /** 한 번의 녹음이 끝났다. 두 번 부르지 않는다. */
  const finish = (audio: string | null) => {
    if (ended) {
      return
    }
    ended = true
    releaseMic()
    onEnd(audio)
  }

  const fail = (error: string) => {
    onError(recorderErrorMessage(error))
    finish(null)
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
        fail('no-audio')
        return
      }
      if (blob.size > AUDIO_MAX_BYTES) {
        // 서버가 받지 않는 크기다. 예전에는 음성만 버리고 기기에서 인식한 글로 넘어갈 수
        // 있었지만, 이제는 글도 이 음성에서 나오므로 버리면 남는 것이 없다. 다시 남기게 한다.
        fail('too-large')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => finish(reader.result as string)
      reader.onerror = () => fail('unknown')
      reader.readAsDataURL(blob)
    }

    mediaRecorder.start()
    // 상한은 여기서 한 번만 건다. (Manyfast F-YJJJUX rules — 상시 녹음 금지)
    limitTimer = setTimeout(() => stopRecording(), MAX_RECORDING_MS)
  }

  /** 녹음기가 살아 있으면 그쪽 `onstop` 이 마무리하고, 아니면 여기서 끝낸다. */
  const stopRecording = () => {
    if (mediaRecorder !== null && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      return
    }
    finish(null)
  }

  return {
    start: () => {
      if (!canRecordVoice()) {
        fail('not-allowed')
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
        .catch(() => fail('not-allowed'))
    },
    stop: () => {
      stopped = true
      stopRecording()
    },
  }
}
