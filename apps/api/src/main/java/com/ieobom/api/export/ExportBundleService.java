package com.ieobom.api.export;

import com.ieobom.api.common.ConflictException;
import com.ieobom.api.common.NotFoundException;
import com.ieobom.api.export.dto.ExportBundleListResponse;
import com.ieobom.api.export.dto.ExportBundleResponse;
import com.ieobom.api.export.dto.ExportPhraseResponse;
import com.ieobom.api.handovercard.HandoverCard;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.CareRecipientRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 어르신 한 명의 당일 문구를 유형별로 이어 붙여 준다. (Manyfast F-GUSOFG action · dataSpec)
 *
 * <p><b>묶음은 저장하지 않는다.</b> 읽을 때 만든다. 생성 단위는 그대로 카드 한 장이고, 여기서는 이미 만들어져 있는 문구를 순서대로 잇기만 한다.
 * 묶음을 저장하면 문구 하나가 여러 카드를 가리키게 되어 "이 문장이 원문 어디서 나왔는지"를 더 이상 말할 수 없다.
 *
 * <p>묶는 이유는 복사 횟수 때문이다. 카드 단위로만 복사하면 어르신 1명에 카드가 4장일 때 복사도 붙여넣기도 4번이고, 직원이 전산 안에서 문장을 다시 합치게
 * 된다. 보호자 전달 문구는 더 나쁘다. 4번 보내지 않으므로 직원이 손으로 합치는데 그 편집은 검토를 거치지 않는다.
 *
 * <p><b>이어 붙일 때 모델을 부르지 않는다.</b> 다시 다듬으면 근거 연결이 1:N 이 되고 호출 비용도 두 배가 된다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExportBundleService {

	static final String CARE_RECIPIENT_NOT_FOUND = "CARE_RECIPIENT_NOT_FOUND";
	static final String BUNDLE_EMPTY = "EXPORT_BUNDLE_EMPTY";

	/**
	 * 문구 사이에 넣는 구분자.
	 *
	 * <p>Manyfast 에 없는 표시 수준의 값이라 구현에서 정한다. 줄바꿈 하나인 이유는 전산 입력창과 보호자 메시지 양쪽에서 문장이 서로 붙어 버리지 않는 가장
	 * 약한 구분이기 때문이다. 화면에서 문제가 되면 {@code propose-change} 로 올린다.
	 */
	static final String SEPARATOR = "\n";

	private static final String NO_PHRASE_NOTICE = "오늘 검토 완료된 문구가 없습니다. 카드를 검토 완료로 올린 뒤 다시 확인해 주세요.";
	private static final String SKIPPED_NOTICE = "문구가 만들어지지 않은 카드 %d장이 묶음에서 빠졌습니다. 카드별 문구에서 직접 작성해 주세요.";
	private static final String REVIEW_NOTICE = "확인이 필요한 문구가 %d개 있습니다. 각 문구의 안내를 확인한 뒤 복사해 주세요.";

	/**
	 * 안전 관련 항목의 문구를 먼저 두고, 그다음 관찰 시각 순. (Manyfast F-GUSOFG action)
	 *
	 * <p>안전 판정은 카드의 {@code safetyRelated} 를 그대로 쓴다. 문구에는 안전 여부가 없다. 관찰 시각은 원문에서 뽑지 못하면 비어 있으므로
	 * 뒤로 보내고, 같은 시각이면 카드가 만들어진 순서를 따른다.
	 */
	private static final Comparator<ExportPhrase> SAFETY_FIRST_THEN_OBSERVED =
			Comparator.comparing((ExportPhrase phrase) -> phrase.getHandoverCard().isSafetyRelated())
					.reversed()
					.thenComparing(
							phrase -> phrase.getHandoverCard().getObservedAt(),
							Comparator.nullsLast(Comparator.naturalOrder()))
					.thenComparing(phrase -> phrase.getHandoverCard().getId());

	private final ExportPhraseRepository phraseRepository;
	private final CareRecipientRepository careRecipientRepository;

	/**
	 * 어르신 한 명의 그날 묶음 두 개를 만든다.
	 *
	 * <p><b>아무것도 저장하지 않는다.</b>
	 *
	 * @throws NotFoundException 어르신이 목록에 없을 때
	 */
	@Transactional(readOnly = true)
	public ExportBundleListResponse findByRecipientAndDate(Long careRecipientId, LocalDate date) {
		CareRecipient recipient = findRecipient(careRecipientId);
		List<ExportPhrase> phrases = orderedPhrases(careRecipientId, date);

		return new ExportBundleListResponse(
				recipient.getId(),
				recipient.getName(),
				date,
				List.of(
						assemble(ExportPhraseType.RECORD, phrases).response(),
						assemble(ExportPhraseType.GUARDIAN, phrases).response()));
	}

	/**
	 * 직원이 묶음을 복사했다는 사실을 남긴다. (Manyfast F-GUSOFG outcome)
	 *
	 * <p><b>기록은 묶음에 들어간 문구 하나하나에 남는다.</b> 묶음 자체가 저장 대상이 아니기 때문이다. 그래서 묶음에서 빠진 문구에는 아무것도 남지
	 * 않는다. 복사되지 않은 문구를 복사한 것으로 남길 수는 없다.
	 *
	 * <p>단건 복사와 같은 이유로 검토 안내가 붙어 있어도 막지 않는다. 막는 것은 복사할 문구 자체가 없을 때뿐이다.
	 *
	 * @throws NotFoundException 어르신이 목록에 없을 때
	 * @throws ConflictException 묶음에 담을 문구가 없을 때
	 */
	@Transactional
	public ExportBundleResponse copy(
			Long careRecipientId, ExportPhraseType phraseType, LocalDate date) {

		CareRecipient recipient = findRecipient(careRecipientId);
		List<ExportPhrase> ordered = orderedPhrases(careRecipientId, date);
		Bundle bundle = assemble(phraseType, ordered);

		if (bundle.included().isEmpty()) {
			throw new ConflictException(BUNDLE_EMPTY, "복사할 문구가 없습니다. 카드를 검토 완료로 올린 뒤 다시 확인해 주세요.");
		}

		bundle.included().forEach(ExportPhrase::markCopied);

		// 복사한 유형과 시점만 남긴다. 문구 내용은 남기지 않는다.
		log.info(
				"묶음 복사 — careRecipientId={}, date={}, 유형={}, 문구={}개, 검토안내={}",
				recipient.getId(),
				date,
				phraseType,
				bundle.included().size(),
				bundle.response().needsReview());

		// 복사 시점이 채워진 뒤의 모양을 돌려준다.
		return assemble(phraseType, ordered).response();
	}

	private CareRecipient findRecipient(Long careRecipientId) {
		return careRecipientRepository
				.findById(careRecipientId)
				.orElseThrow(
						() ->
								new NotFoundException(
										CARE_RECIPIENT_NOT_FOUND, "대상 어르신을 찾을 수 없습니다. 목록에서 다시 선택해 주세요."));
	}

	private List<ExportPhrase> orderedPhrases(Long careRecipientId, LocalDate date) {
		return phraseRepository
				.findReviewedByRecipientAndCardCreatedBetween(
						careRecipientId, date.atStartOfDay(), date.plusDays(1).atStartOfDay())
				.stream()
				.sorted(SAFETY_FIRST_THEN_OBSERVED)
				.toList();
	}

	/**
	 * 한 유형의 문구를 이어 붙인다.
	 *
	 * <p><b>담을 글자가 없는 문구는 묶음에서 뺀다.</b> 대신 몇 장이 빠졌는지 안내한다. 이어 붙일 수 없는 문구를 항목에 넣어 두면 묶음을 복사했을 때
	 * 실제로 복사되지 않은 문구에 복사 기록이 남는다.
	 */
	private Bundle assemble(ExportPhraseType phraseType, List<ExportPhrase> ordered) {
		List<ExportPhrase> ofType =
				ordered.stream().filter(phrase -> phrase.getPhraseType() == phraseType).toList();
		List<ExportPhrase> included = ofType.stream().filter(ExportPhrase::isCopyable).toList();

		int skipped = ofType.size() - included.size();
		long needsReview = included.stream().filter(ExportPhrase::needsReview).count();

		List<String> notices = new ArrayList<>();
		if (ofType.isEmpty()) {
			notices.add(NO_PHRASE_NOTICE);
		}
		if (skipped > 0) {
			notices.add(SKIPPED_NOTICE.formatted(skipped));
		}
		if (needsReview > 0) {
			notices.add(REVIEW_NOTICE.formatted(needsReview));
		}

		String text =
				included.isEmpty()
						? null
						: included.stream().map(ExportPhrase::text).collect(Collectors.joining(SEPARATOR));

		ExportBundleResponse response =
				ExportBundleResponse.of(
						phraseType,
						text,
						skipped > 0 || needsReview > 0,
						notices.isEmpty() ? null : String.join(" ", notices),
						included.stream().map(this::responseOf).toList());

		return new Bundle(included, response);
	}

	/** 카드는 조회에서 함께 읽어 두었다. 문구마다 자기 카드와 근거를 싣는다. */
	private ExportPhraseResponse responseOf(ExportPhrase phrase) {
		HandoverCard card = phrase.getHandoverCard();
		return ExportPhraseResponse.of(card, phrase);
	}

	/**
	 * 이어 붙인 결과와 그 재료.
	 *
	 * @param included 묶음에 실제로 들어간 문구. <b>복사 기록이 남는 대상</b>이다
	 */
	private record Bundle(List<ExportPhrase> included, ExportBundleResponse response) {}
}
