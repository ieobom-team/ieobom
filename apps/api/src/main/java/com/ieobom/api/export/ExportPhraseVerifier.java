package com.ieobom.api.export;

import com.ieobom.api.handovercard.HandoverCard;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 만들어진 문구를 복사해도 되는지 판정한다. <b>이 제품에서 문구는 보호자에게 나가는 유일한 출력이다.</b>
 *
 * <p>구조화의 {@code CardDraftVerifier} 처럼 근거 원문과 글자를 대조할 수는 없다. 문구는 다듬어진 서술형이라 원문에 그대로 존재하지 않는다.
 * 대신 "근거 없는 내용을 넣지 않는다"를 세 겹으로 지킨다. (Manyfast F-GUSOFG exceptions · rules)
 *
 * <ol>
 *   <li><b>입력 차단</b> — 모델에 인계 원문 전체를 주지 않고 검토 완료 카드 한 장의 내용만 준다. ({@code ExportInput})
 *   <li><b>스키마 강제</b> — 두 문구 말고 다른 것을 만들 자리를 두지 않는다. ({@code ExportPhraseSchema})
 *   <li><b>여기</b> — 그럼에도 카드에 없는 값이 문구에 나타났는지 본다.
 * </ol>
 *
 * <p>걸렸다고 문구를 버리지 않는다. <b>안내를 붙여 직원에게 넘긴다.</b> 이 제품의 출력은 직원 검토와 직접 복사를 전제로 하므로, 서버가 조용히 지우면
 * 직원은 무엇을 확인해야 하는지 모른 채 문구만 사라진 화면을 본다.
 */
@Slf4j
@Component
public class ExportPhraseVerifier {

	/** {@code ExportPhrase} 의 컬럼 길이와 맞춘다. 넘치면 저장 시점에 터지는 대신 여기서 자른다. */
	static final int TEXT_LIMIT = 1000;

	private static final String EMPTY_NOTICE = "문구가 만들어지지 않았습니다. 직접 작성한 뒤 복사해 주세요.";
	private static final String CUT_NOTICE = "문구가 길어 뒷부분이 잘렸습니다. 확인한 뒤 복사해 주세요.";
	private static final String UNKNOWN_NUMBER_NOTICE = "카드에 없는 숫자(%s)가 있습니다. 근거를 확인한 뒤 복사해 주세요.";
	private static final String OTHER_RECIPIENT_NOTICE = "다른 어르신 이름(%s)이 있습니다. 근거를 확인한 뒤 복사해 주세요.";

	private static final Pattern NUMBER = Pattern.compile("\\d+");
	private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

	/**
	 * 문구를 판정한다.
	 *
	 * @param phrase AI 가 만들었거나 직원이 고친 문구
	 * @param card 이 문구가 나온 검토 완료 카드. 여기 없는 값이 문구에 있으면 근거가 없는 것이다
	 * @param otherRecipientNames 이 카드의 어르신을 뺀 나머지 어르신 이름. 여기 있는 이름이 문구에 섞이면 다른 사람의 기록이 된다
	 */
	public PhraseVerification verify(
			String phrase, HandoverCard card, List<String> otherRecipientNames) {

		String text = trimToNull(phrase);
		if (text == null) {
			return new PhraseVerification(null, EMPTY_NOTICE);
		}

		List<String> notices = new ArrayList<>();
		if (text.length() > TEXT_LIMIT) {
			text = text.substring(0, TEXT_LIMIT);
			notices.add(CUT_NOTICE);
		}

		String source = sourceOf(card);
		Set<String> unknownNumbers = unknownNumbers(text, source);
		if (!unknownNumbers.isEmpty()) {
			notices.add(UNKNOWN_NUMBER_NOTICE.formatted(String.join(", ", unknownNumbers)));
		}

		List<String> others = otherRecipientNames.stream().filter(text::contains).toList();
		if (!others.isEmpty()) {
			notices.add(OTHER_RECIPIENT_NOTICE.formatted(String.join(", ", others)));
		}

		if (!notices.isEmpty()) {
			// 문구 자체는 남기지 않는다. 무엇이 걸렸는지만 남긴다.
			log.warn("문구 검토 안내 — cardId={}, 사유 {}개", card.getId(), notices.size());
		}
		return new PhraseVerification(text, notices.isEmpty() ? null : String.join(" ", notices));
	}

	/**
	 * 문구에 있는데 카드에는 없는 숫자.
	 *
	 * <p><b>지어낸 사실은 대개 숫자로 나타난다.</b> 체온, 횟수, 시각, 복용량이 그렇고, 그중 무엇이든 원문에 없는 값이 보호자에게 나가면 그게 사고다.
	 * 문장이 다듬어져도 숫자는 다듬어지지 않으므로 이 대조는 서술형 문구에도 그대로 걸린다.
	 */
	private Set<String> unknownNumbers(String phrase, String source) {
		Set<String> unknown = new LinkedHashSet<>();
		Matcher matcher = NUMBER.matcher(phrase);
		while (matcher.find()) {
			String number = matcher.group();
			if (!source.contains(number)) {
				unknown.add(number);
			}
		}
		return unknown;
	}

	/** 카드가 말하고 있는 것 전부. 문구는 이 안에서만 나올 수 있다. */
	private String sourceOf(HandoverCard card) {
		return String.join(
				" ",
				nullToEmpty(card.getCareRecipient() == null ? null : card.getCareRecipient().getName()),
				card.getObservedAt() == null ? "" : card.getObservedAt().format(TIME),
				nullToEmpty(card.getStatusChange()),
				nullToEmpty(card.getActionTaken()),
				nullToEmpty(card.getNextAction()),
				nullToEmpty(card.getEvidenceText()));
	}

	private String trimToNull(String value) {
		if (value == null) {
			return null;
		}
		String trimmed = value.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}

	private String nullToEmpty(String value) {
		return value == null ? "" : value;
	}
}
