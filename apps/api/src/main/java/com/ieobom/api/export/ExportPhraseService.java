package com.ieobom.api.export;

import com.ieobom.api.ai.ExportInput;
import com.ieobom.api.ai.ExportPhraseClient;
import com.ieobom.api.ai.ExportPhraseDraft;
import com.ieobom.api.common.ConflictException;
import com.ieobom.api.common.NotFoundException;
import com.ieobom.api.export.dto.ExportGenerateResponse;
import com.ieobom.api.export.dto.ExportPhraseResponse;
import com.ieobom.api.handovercard.HandoverCard;
import com.ieobom.api.handovercard.HandoverCardRepository;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.CareRecipientRepository;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 검토 완료 카드를 전산 기록 문구와 보호자 전달 문구로 정리하고, 직원의 수정과 복사를 기록한다. (Manyfast F-GUSOFG)
 *
 * <p><b>여기서 문구를 보내지 않는다.</b> 만들어 두면 직원이 화면에서 검토하고 직접 복사한다. 보호자 자동 발송과 ERP 연동은 MVP 범위 밖이고, 범위
 * 문제이기 이전에 검토를 거치지 않은 문구가 나가지 않게 하는 장치다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExportPhraseService {

	static final String CARD_NOT_FOUND = "HANDOVER_CARD_NOT_FOUND";
	static final String CARD_NOT_REVIEWED = "CARD_NOT_REVIEWED";
	static final String PHRASE_NOT_FOUND = "EXPORT_PHRASE_NOT_FOUND";
	static final String PHRASE_EMPTY = "EXPORT_PHRASE_EMPTY";

	private final HandoverCardRepository cardRepository;
	private final ExportPhraseRepository phraseRepository;
	private final CareRecipientRepository careRecipientRepository;
	private final ExportPhraseClient exportPhraseClient;
	private final ExportPhraseVerifier verifier;

	/**
	 * 카드 한 장을 두 문구로 정리한다.
	 *
	 * <p><b>이미 만들어 둔 문구가 있으면 다시 만들지 않고 그대로 돌려준다.</b> 직원이 고쳐 놓은 문구를 새 호출이 덮어쓰면, 화면을 다시 열었다는 이유만으로
	 * 검토 결과가 사라진다. 고칠 것은 {@link #update} 로 고친다.
	 *
	 * <p>{@code HandoverCardService#structure} 와 같은 이유로 <b>트랜잭션을 걸지 않았다.</b> LLM 응답을 기다리는 수 초 동안 DB
	 * 커넥션을 붙들고 있을 이유가 없다. 그래서 카드는 지연 로딩에 기대지 않고 한 번에 읽어 둔다.
	 *
	 * @throws NotFoundException 카드가 없을 때
	 * @throws ConflictException 아직 검토 완료가 아닌 카드일 때
	 * @throws com.ieobom.api.ai.LlmUnavailableException 문구를 만들 수 없을 때
	 */
	public ExportGeneration generate(Long cardId) {
		HandoverCard card =
				cardRepository
						.findWithCareRecipientAndHandover(cardId)
						.orElseThrow(() -> new NotFoundException(CARD_NOT_FOUND, "카드를 찾을 수 없습니다."));

		// 판정은 카드가 한다. 같은 조건을 여기 다시 적으면 한쪽만 고쳐진 채로
		// 검토되지 않은 내용이 보호자에게 나가는 일이 생긴다.
		if (!card.canGenerateExport()) {
			throw new ConflictException(CARD_NOT_REVIEWED, card.exportBlockedReason());
		}

		List<ExportPhrase> existing = phraseRepository.findByHandoverCardIdOrderByIdAsc(cardId);
		if (!existing.isEmpty()) {
			log.debug("이미 만들어 둔 문구를 그대로 돌려준다 — cardId={}", cardId);
			return new ExportGeneration(false, responseOf(card, existing));
		}

		ExportPhraseDraft draft = exportPhraseClient.generate(inputOf(card));
		List<String> otherNames = otherRecipientNames(card);

		List<ExportPhrase> saved =
				phraseRepository.saveAll(
						List.of(
								build(card, ExportPhraseType.RECORD, draft.recordPhrase(), otherNames),
								build(card, ExportPhraseType.GUARDIAN, draft.guardianPhrase(), otherNames)));

		logGenerated(card, saved);
		return new ExportGeneration(true, responseOf(card, saved));
	}

	/**
	 * 직원이 고친 문구를 저장한다. (Manyfast F-GUSOFG action)
	 *
	 * <p>고친 문구도 같은 기준으로 다시 본다. 직원이 카드에 없는 내용을 적어 넣을 수도 있고, 반대로 AI 문구에 붙어 있던 안내가 수정으로 해소될 수도 있다.
	 *
	 * @throws NotFoundException 문구가 없을 때
	 */
	@Transactional
	public ExportPhraseResponse update(Long phraseId, String text) {
		ExportPhrase phrase = findPhrase(phraseId);
		HandoverCard card = phrase.getHandoverCard();

		PhraseVerification verified = verifier.verify(text, card, otherRecipientNames(card));
		phrase.edit(verified.text(), verified.reviewNotice());

		log.info(
				"문구 수정 — phraseId={}, cardId={}, 유형={}, 검토안내={}",
				phrase.getId(),
				card.getId(),
				phrase.getPhraseType(),
				verified.needsReview());
		return ExportPhraseResponse.of(card, phrase);
	}

	/**
	 * 직원이 복사했다는 사실을 남긴다. (Manyfast F-GUSOFG outcome)
	 *
	 * <p>검토 안내가 붙어 있어도 복사를 막지 않는다. 안내는 "확인하고 쓰라"는 말이지 "쓰지 말라"는 말이 아니고, 최종 판단은 직원이 한다. 다만 <b>복사할
	 * 문구 자체가 없으면</b> 복사한 것으로 남길 수 없으므로 거절한다.
	 *
	 * @throws NotFoundException 문구가 없을 때
	 * @throws ConflictException 복사할 문구가 아직 없을 때
	 */
	@Transactional
	public ExportPhraseResponse copy(Long phraseId) {
		ExportPhrase phrase = findPhrase(phraseId);
		if (!phrase.isCopyable()) {
			throw new ConflictException(PHRASE_EMPTY, "복사할 문구가 없습니다. 문구를 직접 작성한 뒤 복사해 주세요.");
		}

		phrase.markCopied();

		// 복사한 문구 유형과 시점만 남긴다. 문구 내용은 남기지 않는다.
		log.info(
				"문구 복사 — phraseId={}, cardId={}, 유형={}, 복사시점={}",
				phrase.getId(),
				phrase.getHandoverCard().getId(),
				phrase.getPhraseType(),
				phrase.getCopiedAt());
		return ExportPhraseResponse.of(phrase.getHandoverCard(), phrase);
	}

	private ExportPhrase findPhrase(Long phraseId) {
		return phraseRepository
				.findWithCard(phraseId)
				.orElseThrow(() -> new NotFoundException(PHRASE_NOT_FOUND, "문구를 찾을 수 없습니다."));
	}

	/** 만들어진 문구를 판정까지 마쳐 저장할 모양으로 만든다. */
	private ExportPhrase build(
			HandoverCard card, ExportPhraseType type, String phrase, List<String> otherNames) {

		PhraseVerification verified = verifier.verify(phrase, card, otherNames);
		return ExportPhrase.builder()
				.handoverCard(card)
				.phraseType(type)
				.generatedText(verified.text())
				.reviewNotice(verified.reviewNotice())
				.build();
	}

	/**
	 * 모델에 넘길 것. <b>인계 원문을 넣지 않는다.</b>
	 *
	 * <p>원문에는 이 카드가 담기로 한 것 말고도 다른 어르신 이야기와 아직 검토되지 않은 내용이 섞여 있다. 주지 않은 사실은 문구에 들어갈 수 없다.
	 */
	private ExportInput inputOf(HandoverCard card) {
		return new ExportInput(
				card.getCareRecipient() == null ? null : card.getCareRecipient().getName(),
				card.getObservedAt(),
				card.getStatusChange(),
				card.getActionTaken(),
				card.getNextAction(),
				card.getEvidenceText());
	}

	/** 이 카드의 어르신을 뺀 나머지. 이 이름이 문구에 섞이면 다른 사람의 기록이 된다. */
	private List<String> otherRecipientNames(HandoverCard card) {
		String own = card.getCareRecipient() == null ? null : card.getCareRecipient().getName();
		return careRecipientRepository.findAll().stream()
				.map(CareRecipient::getName)
				.filter(name -> !Objects.equals(name, own))
				.toList();
	}

	private ExportGenerateResponse responseOf(HandoverCard card, List<ExportPhrase> phrases) {
		return ExportGenerateResponse.of(
				card.getId(), phrases.stream().map(phrase -> ExportPhraseResponse.of(card, phrase)).toList());
	}

	/**
	 * 문구 생성 이벤트.
	 *
	 * <p>카드 쪽과 같은 이유로 별도 테이블 없이 애플리케이션 로그로 남긴다. <b>문구 내용은 남기지 않는다.</b> 어르신의 상태 이야기가 로그 파일로 새어 나갈
	 * 이유가 없다. 대신 몇 개가 검토 안내를 달고 나갔는지를 남긴다. "AI 문구를 그대로 쓸 수 있었는지"를 나중에 물을 수 있는 흔적이다.
	 */
	private void logGenerated(HandoverCard card, List<ExportPhrase> phrases) {
		long needsReview = phrases.stream().filter(ExportPhrase::needsReview).count();
		log.info(
				"문구 생성 — cardId={}, careRecipientId={}, 생성={}, 검토안내={}",
				card.getId(),
				card.getCareRecipient() == null ? null : card.getCareRecipient().getId(),
				phrases.size(),
				needsReview);
	}

	/**
	 * 이번 호출에서 새로 만들었는지.
	 *
	 * <p>상태 코드를 가르는 값이다. 이미 있던 문구를 돌려준 것을 {@code 201} 로 말하면, 화면이 "방금 만들어졌다"고 안내하면서 실제로는 며칠 전 문구를
	 * 보여 주게 된다.
	 */
	public record ExportGeneration(boolean created, ExportGenerateResponse response) {}
}
