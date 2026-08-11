package com.ieobom.api.export.dto;

import com.ieobom.api.export.ExportPhrase;
import com.ieobom.api.export.ExportPhraseType;
import com.ieobom.api.handovercard.HandoverCard;
import java.time.LocalDateTime;

/**
 * 출력 문구 하나.
 *
 * <p><b>어느 카드에서 나왔는지와 근거 원문을 언제나 함께 싣는다.</b> (Manyfast R-TUBGKD 수락기준 3) 문구만 돌려주면 화면이 근거를 보여
 * 주려고 카드를 따로 불러야 하고, 그 호출을 빠뜨린 화면에서는 직원이 근거 없이 문구만 보고 복사하게 된다.
 *
 * @param text 지금 복사될 문구. 직원이 고쳤으면 고친 것이다. 아직 만들어지지 못했으면 {@code null}
 * @param generatedText AI 가 만든 원래 문구. 직원이 무엇을 고쳤는지 화면이 견줄 수 있다
 * @param needsReview 복사 전에 확인할 것이 있는지. 화면은 이 값으로 안내를 띄운다
 * @param reviewNotice 확인할 내용. 없으면 {@code null}
 * @param copiedAt 직원이 복사한 시점. 복사한 적이 없으면 {@code null}
 */
public record ExportPhraseResponse(
		Long id,
		Long cardId,
		Long handoverId,
		Long careRecipientId,
		String careRecipientName,
		ExportPhraseType phraseType,
		String phraseTypeLabel,
		String text,
		String generatedText,
		boolean edited,
		boolean needsReview,
		String reviewNotice,
		String evidenceText,
		LocalDateTime copiedAt,
		LocalDateTime createdAt) {

	/**
	 * 카드를 함께 받는 이유는 지연 로딩 때문이다.
	 *
	 * <p>문구 생성은 트랜잭션 밖에서 끝나므로 {@code phrase.getHandoverCard()} 가 프록시일 수 있다. 부르는 쪽이 이미 들고 있는 카드를
	 * 그대로 넘기게 해서 여기서 지연 로딩을 건드리지 않는다.
	 */
	public static ExportPhraseResponse of(HandoverCard card, ExportPhrase phrase) {
		return new ExportPhraseResponse(
				phrase.getId(),
				card.getId(),
				card.getHandover().getId(),
				card.getCareRecipient() == null ? null : card.getCareRecipient().getId(),
				card.getCareRecipient() == null ? null : card.getCareRecipient().getName(),
				phrase.getPhraseType(),
				phrase.getPhraseType().label(),
				phrase.text(),
				phrase.getGeneratedText(),
				phrase.isEdited(),
				phrase.needsReview(),
				phrase.getReviewNotice(),
				card.getEvidenceText(),
				phrase.getCopiedAt(),
				phrase.getCreatedAt());
	}
}
