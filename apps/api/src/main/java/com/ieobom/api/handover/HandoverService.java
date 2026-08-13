package com.ieobom.api.handover;

import com.ieobom.api.common.NotFoundException;
import com.ieobom.api.common.RequestValidationException;
import com.ieobom.api.handover.dto.HandoverCreateRequest;
import com.ieobom.api.handover.dto.HandoverResponse;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.CareRecipientRepository;
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

	private final HandoverRepository handoverRepository;
	private final CareRecipientRepository careRecipientRepository;

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

		byte[] decodedAudio = null;
		if (request.audioData() != null && !request.audioData().isBlank()) {
			String base64 = request.audioData();
			if (base64.contains(",")) {
				base64 = base64.split(",")[1];
			}
			decodedAudio = java.util.Base64.getDecoder().decode(base64);
		}

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
								.audioData(decodedAudio)
								.build());

		logRegistered(saved);
		return HandoverResponse.from(saved);
	}

	@Transactional(readOnly = true)
	public Handover getById(Long id) {
		return handoverRepository.findById(id)
				.orElseThrow(() -> new NotFoundException("HANDOVER_NOT_FOUND", "인계 기록을 찾을 수 없습니다."));
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
