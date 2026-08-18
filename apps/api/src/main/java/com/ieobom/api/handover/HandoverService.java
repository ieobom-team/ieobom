package com.ieobom.api.handover;

import com.ieobom.api.ai.TranscriptionClient;
import com.ieobom.api.common.NotFoundException;
import com.ieobom.api.common.RequestValidationException;
import com.ieobom.api.handover.dto.HandoverAudioContent;
import com.ieobom.api.handover.dto.HandoverCreateRequest;
import com.ieobom.api.handover.dto.HandoverResponse;
import com.ieobom.api.handover.dto.HandoverTranscribeRequest;
import com.ieobom.api.handover.dto.HandoverTranscribeResponse;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.CareRecipientRepository;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 현장에서 들어온 특이사항을 원문 그대로 저장한다. */
@Slf4j
@Service
@RequiredArgsConstructor
public class HandoverService {

	static final String CARE_RECIPIENT_NOT_FOUND = "CARE_RECIPIENT_NOT_FOUND";
	static final String AUDIO_NOT_FOUND = "HANDOVER_AUDIO_NOT_FOUND";

	/**
	 * 원본 음성 한 건의 상한. 데모 규모라 DB 에 그대로 넣으므로 상한을 정해 두지 않으면 한 건이 테이블을 밀어 낸다.
	 *
	 * <p>화면도 같은 상한을 갖는다 — 브라우저가 {@code AUDIO_MAX_MINUTES} 분에서 녹음을 스스로 멈춘다
	 * ({@code apps/web/src/features/handover/voiceRecorder.ts}). 이 값은 그 뒤를 받치는 마지막 방어선이다.
	 */
	static final int AUDIO_MAX_MINUTES = 5;

	static final int AUDIO_MAX_BYTES = 10 * 1024 * 1024;

	private static final int AUDIO_MIME_TYPE_MAX_LENGTH = 100;

	/** {@code data:audio/webm;codecs=opus;base64,GkXf...} 를 형식과 본문으로 가른다. */
	private static final Pattern AUDIO_DATA_URL =
			Pattern.compile("^data:(audio/[^,;]+(?:;[^,;]+)*);base64,([A-Za-z0-9+/=]+)$");

	private final HandoverRepository handoverRepository;
	private final HandoverAudioRepository audioRepository;
	private final CareRecipientRepository careRecipientRepository;
	private final TranscriptionClient transcriptionClient;

	/**
	 * 특이사항을 저장하고 등록 이벤트를 남긴다.
	 *
	 * @throws RequestValidationException 대리 입력 여부와 정보 출처가 서로 맞지 않을 때
	 * @throws NotFoundException 대상 어르신이 없을 때
	 */
	@Transactional
	public HandoverResponse register(HandoverCreateRequest request) {
		verifyInfoSource(request);

		CareRecipient careRecipient =
				careRecipientRepository
						.findById(request.careRecipientId())
						.orElseThrow(
								() ->
										new NotFoundException(
												CARE_RECIPIENT_NOT_FOUND, "대상 어르신을 찾을 수 없습니다. 목록에서 다시 선택해 주세요."));

		HandoverAudioContent audio = decodeAudio(request);

		Handover saved =
				handoverRepository.save(
						Handover.builder()
								.careRecipient(careRecipient)
								.rawText(request.rawText())
								.inputMethod(request.inputMethod())
								.occurredAt(request.occurredAt())
								.reporterName(request.reporterName())
								.proxyInput(request.isProxyInput())
								.infoSource(request.infoSource())
								.audioMimeType(audio == null ? null : audio.mimeType())
								.build());
		if (audio != null) {
			audioRepository.save(HandoverAudio.of(saved, audio.data()));
		}

		logRegistered(saved);
		return HandoverResponse.from(saved);
	}

	/**
	 * 저장된 원본 음성. 없으면 비어 있다. (Manyfast F-SNBVHR — 입력 한 건 전체를 그대로 들려준다)
	 *
	 * @throws NotFoundException 인계 기록이 없거나 그 기록에 음성이 없을 때
	 */
	@Transactional(readOnly = true)
	public HandoverAudioContent findAudio(Long handoverId) {
		Handover handover =
				handoverRepository
						.findById(handoverId)
						.orElseThrow(
								() -> new NotFoundException(AUDIO_NOT_FOUND, "저장된 원본 음성이 없습니다."));

		return audioRepository
				.findByHandoverId(handoverId)
				.map(audio -> new HandoverAudioContent(handover.getAudioMimeType(), audio.getData()))
				.orElseThrow(() -> new NotFoundException(AUDIO_NOT_FOUND, "저장된 원본 음성이 없습니다."));
	}

	/**
	 * 녹음한 음성을 글로 바꿔 돌려준다. (Manyfast F-YJJJUX rules — 기기가 녹음만 하고 서버가 글로 바꾼다)
	 *
	 * <p><b>아무것도 저장하지 않는다.</b> 이 시점에는 인계 기록이 아직 없다 — 직원이 글을 확인하고 어르신을 고른 다음에야 저장이 일어난다. 음성은
	 * 그때 {@link #register} 로 다시 올라와 저장된다.
	 *
	 * <p>실명이 담긴 오디오가 외부 인식 서비스로 나간다. 브라우저 내장 인식도 오디오를 제조사 서버로 보냈으므로 새로 생긴 성격은 아니다. 실명을 내부 ID
	 * 로 바꾸는 치환은 <b>글이 된 뒤 LLM 을 부르기 전에</b> 일어난다. (Manyfast F-LUDCWW rules)
	 *
	 * @throws RequestValidationException 음성 형식이 깨졌거나 상한을 넘을 때
	 * @throws com.ieobom.api.ai.LlmUnavailableException 키가 없거나 인식 호출이 실패했을 때
	 */
	public HandoverTranscribeResponse transcribe(HandoverTranscribeRequest request) {
		HandoverAudioContent audio = parseAudioDataUrl(request.audioData());
		String text = transcriptionClient.transcribe(audio.mimeType(), audio.data());
		log.debug("음성 변환 완료 — bytes={}, 글자수={}", audio.data().length, text.length());
		return new HandoverTranscribeResponse(text);
	}

	/**
	 * 저장 요청에 붙은 음성을 바이트로 되돌린다. 음성을 붙이지 않았으면 {@code null} 이다.
	 *
	 * @throws RequestValidationException 음성 입력이 아닌데 음성이 붙었거나, 형식이 깨졌거나, 상한을 넘을 때
	 */
	private HandoverAudioContent decodeAudio(HandoverCreateRequest request) {
		String dataUrl = request.audioData();
		if (dataUrl == null || dataUrl.isBlank()) {
			return null;
		}
		if (request.inputMethod() != InputMethod.VOICE) {
			throw new RequestValidationException("audioData", "원본 음성은 음성으로 남긴 입력에만 붙일 수 있습니다.");
		}
		return parseAudioDataUrl(dataUrl);
	}

	/**
	 * 브라우저가 보낸 Base64 Data URL 을 바이트로 되돌린다.
	 *
	 * <p>형식은 {@code data:audio/webm;codecs=opus;base64,...} 다. 녹음 형식은 브라우저마다 다르므로 고정하지 않고 앞부분에
	 * 적힌 값을 그대로 받아 두고, 재생할 때 그대로 돌려준다.
	 *
	 * <p><b>저장과 전사가 같은 파서와 같은 상한을 쓴다.</b> 갈라 두면 전사는 통과했는데 저장에서 막히는 음성이 생기고, 그때는 이미 마이크를 놓은
	 * 뒤라 직원이 되돌릴 방법이 없다. (#147)
	 *
	 * @throws RequestValidationException 형식이 깨졌거나 상한을 넘을 때
	 */
	private HandoverAudioContent parseAudioDataUrl(String dataUrl) {
		Matcher matcher = AUDIO_DATA_URL.matcher(dataUrl);
		if (!matcher.matches()) {
			throw new RequestValidationException("audioData", "원본 음성 형식을 읽을 수 없습니다.");
		}

		String mimeType = matcher.group(1);
		if (mimeType.length() > AUDIO_MIME_TYPE_MAX_LENGTH) {
			throw new RequestValidationException("audioData", "원본 음성 형식을 읽을 수 없습니다.");
		}

		byte[] data;
		try {
			data = Base64.getDecoder().decode(matcher.group(2));
		} catch (IllegalArgumentException e) {
			log.debug("원본 음성 Base64 해독 실패 — {}", e.getMessage());
			throw new RequestValidationException("audioData", "원본 음성 형식을 읽을 수 없습니다.");
		}

		if (data.length == 0) {
			throw new RequestValidationException("audioData", "원본 음성 형식을 읽을 수 없습니다.");
		}
		if (data.length > AUDIO_MAX_BYTES) {
			throw new RequestValidationException(
					"audioData", "원본 음성이 너무 큽니다. 한 번에 %d분까지 남길 수 있습니다.".formatted(AUDIO_MAX_MINUTES));
		}
		return new HandoverAudioContent(mimeType, data);
	}

	/**
	 * 대리 입력이면 정보 출처를 함께 받는다. (Manyfast F-YJJJUX action)
	 *
	 * <p>대리 입력인데 출처가 비면 "누구에게서 나온 내용인지"가 사라져 입력자와 정보 출처를 분리한 의미가 없어진다. 반대로 직접 관찰인데 출처가 붙으면 둘 중
	 * 어느 쪽이 사실인지 알 수 없으므로 저장하지 않는다.
	 */
	private void verifyInfoSource(HandoverCreateRequest request) {
		if (request.isProxyInput() && request.infoSource() == null) {
			throw new RequestValidationException("infoSource", "대리 입력은 정보 출처를 함께 선택해 주세요.");
		}
		if (!request.isProxyInput() && request.infoSource() != null) {
			throw new RequestValidationException(
					"proxyInput", "정보 출처를 고르셨다면 대리 입력으로 표시해 주세요.");
		}
	}

	/**
	 * 특이사항 등록 이벤트. (Manyfast F-YJJJUX outcome)
	 *
	 * <p>별도 이벤트 테이블을 두지 않고 애플리케이션 로그로 남긴다. Manyfast 에 이벤트의 dataSpec 이 없고 조회 화면도 없어서, 저장할 필드를
	 * 지금 추측하면 곧 틀린 스키마가 된다. 감사 로그가 필요해지면 그때 별도 Issue 로 올린다.
	 */
	private void logRegistered(Handover handover) {
		log.info(
				"특이사항 등록 — handoverId={}, careRecipientId={}, inputMethod={}, proxyInput={}, infoSource={}, reporterName={}, occurredAt={}",
				handover.getId(),
				handover.getCareRecipient().getId(),
				handover.getInputMethod(),
				handover.isProxyInput(),
				handover.getInfoSource(),
				handover.getReporterName(),
				handover.getOccurredAt());
	}
}
