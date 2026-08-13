package com.ieobom.api.handovercard;

import com.ieobom.api.ai.StructuredCardDraft;
import com.ieobom.api.common.JobRole;
import com.ieobom.api.common.SafetyKeyword;
import com.ieobom.api.handovercard.CardVerification.DiscardReason;
import com.ieobom.api.handovercard.CardVerification.Discarded;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.RecipientAliases;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * AI 초안을 카드로 만들어도 되는지 판정한다. <b>제품에서 가장 위험한 지점이다.</b>
 *
 * <p>AI 가 지어낸 다음 행동이 어르신 투약에 반영되면 그건 사고다. 그래서 판정을 한 곳에 모아 두고, LLM 호출이나 DB 없이 단위 테스트로 규칙을 직접
 * 증명한다. 스키마 강제는 "정해진 필드 외의 값을 못 만들게" 할 뿐, "그 필드에 들어온 값이 원문에 근거하는지"까지 보장하지 않는다. 그 확인이 여기다.
 *
 * <p>판정 규칙은 Manyfast F-SNBVHR 의 exceptions · rules 슬롯에서 온다.
 */
@Slf4j
@Component
public class CardDraftVerifier {

	/** {@code HandoverCard} 의 컬럼 길이와 맞춘다. 넘치면 저장 시점에 터지는 대신 여기서 자른다. */
	private static final int TEXT_LIMIT = 500;

	private static final int EVIDENCE_LIMIT = 1000;

	/**
	 * 초안을 판정해 통과분과 폐기분으로 가른다.
	 *
	 * @param rawText 인계 원문. 근거가 실제로 이 안에 있는지 대조한다. <b>치환되지 않은 원본이고, 초안은 부르는 쪽에서 이미 실명으로
	 *     되돌아온 상태여야 한다</b>
	 * @param observedDate 관찰 시각에 붙일 날짜. 기한과 시각은 당일 단위로만 쓴다
	 * @param aliases 실명과 내부 ID의 대조표. 이 표에서 가리지 못하는 ID는 대상을 못 가린 것으로 본다
	 */
	public CardVerification verify(
			List<StructuredCardDraft> drafts,
			String rawText,
			LocalDate observedDate,
			RecipientAliases aliases) {

		List<CardBlueprint> accepted = new ArrayList<>();
		List<Discarded> discarded = new ArrayList<>();

		for (StructuredCardDraft draft : drafts) {
			DiscardReason reason = reasonToDiscard(draft, rawText);
			if (reason != null) {
				discarded.add(new Discarded(draft.evidenceText(), reason));
				log.warn("구조화 항목 폐기 — 사유={}, 근거={}", reason.label(), draft.evidenceText());
				continue;
			}
			accepted.add(toBlueprint(draft, observedDate, aliases));
		}

		log.info("구조화 검증 — 통과 {}개, 폐기 {}개", accepted.size(), discarded.size());
		return new CardVerification(List.copyOf(accepted), List.copyOf(discarded));
	}

	/**
	 * 버릴 이유. 없으면 {@code null}.
	 *
	 * <p>근거가 비면 버린다는 규칙이 첫 번째다. 두 번째는 근거라고 적은 구간이 원문에 실제로 있는지 보는 것이다. 근거 칸을 채우기만 하고 내용을 지어내면 첫
	 * 번째 규칙만으로는 걸리지 않는다.
	 */
	private DiscardReason reasonToDiscard(StructuredCardDraft draft, String rawText) {
		String evidence = trimToNull(draft.evidenceText());
		if (evidence == null) {
			return DiscardReason.NO_EVIDENCE;
		}
		if (!containsIgnoringWhitespace(rawText, evidence)) {
			return DiscardReason.EVIDENCE_NOT_IN_SOURCE;
		}
		if (trimToNull(draft.statusChange()) == null
				&& trimToNull(draft.actionTaken()) == null
				&& trimToNull(draft.nextAction()) == null) {
			return DiscardReason.NO_CONTENT;
		}
		return null;
	}

	private CardBlueprint toBlueprint(
			StructuredCardDraft draft, LocalDate observedDate, RecipientAliases aliases) {

		String nextAction = cut(trimToNull(draft.nextAction()), TEXT_LIMIT);
		boolean hasNextAction = nextAction != null;

		String evidence = cut(trimToNull(draft.evidenceText()), EVIDENCE_LIMIT);
		String statusChange = cut(trimToNull(draft.statusChange()), TEXT_LIMIT);
		String actionTaken = cut(trimToNull(draft.actionTaken()), TEXT_LIMIT);

		boolean safetyRelated =
				isSafetyRelated(draft, statusChange, actionTaken, nextAction, evidence);

		return new CardBlueprint(
				resolveRecipient(draft.recipientCode(), aliases),
				observedAt(draft.observedTime(), observedDate),
				statusChange,
				actionTaken,
				nextAction,
				evidence,
				safetyRelated,
				safetyRelated ? SafetyFlagSource.KEYWORD : null,
				hasNextAction ? jobRole(draft.suggestedJobRole()) : null,
				hasNextAction ? time(draft.suggestedDueTime()) : null);
	}

	/**
	 * 대상 어르신. 가릴 수 없으면 {@code null} 을 돌려주고 카드는 검토 대상으로 남는다.
	 *
	 * <p>대조하는 값은 <b>이름이 아니라 내부 ID</b>다. 모델은 치환된 원문을 받았으므로 어르신을 ID로 가리킨다.
	 *
	 * <p>후보 목록에 없는 ID이거나 같은 이름을 쓰는 어르신이 둘 이상이면 가리지 못한 것으로 본다. 동명이인을 임의로 한 명 고르면 다른 어르신의 기록이
	 * 된다. 판정은 {@link RecipientAliases#resolve} 한 곳에 있다. <b>로그에 남는 것도 ID뿐이다.</b>
	 */
	private CareRecipient resolveRecipient(String recipientCode, RecipientAliases aliases) {
		String code = trimToNull(recipientCode);
		if (code == null) {
			return null;
		}
		CareRecipient found = aliases.resolve(code);
		if (found == null) {
			log.warn("후보 목록에 없거나 가릴 수 없는 어르신 내부 ID — {}", code);
		}
		return found;
	}

	/**
	 * 지정 키워드에 걸리는지.
	 *
	 * <p>원문 표기를 그대로 찾는 쪽과 AI 가 같은 4개 범주로 분류한 쪽을 합집합으로 본다. 어느 쪽으로 걸렸든 저장하는 판정 출처는 {@code
	 * KEYWORD} 하나다. 직원이 직접 표시한 것({@code STAFF})은 카드 수정에서 붙으며 이 단계에서는 생기지 않는다.
	 */
	private boolean isSafetyRelated(
			StructuredCardDraft draft, String statusChange, String actionTaken, String nextAction,
			String evidence) {

		String joined = String.join(" ", nullToEmpty(statusChange), nullToEmpty(actionTaken),
				nullToEmpty(nextAction), nullToEmpty(evidence));

		return SafetyKeyword.findIn(joined).isPresent() || safetyCategory(draft).isPresent();
	}

	private Optional<SafetyKeyword> safetyCategory(StructuredCardDraft draft) {
		String category = trimToNull(draft.safetyCategory());
		if (category == null) {
			return Optional.empty();
		}
		try {
			return Optional.of(SafetyKeyword.valueOf(category));
		} catch (IllegalArgumentException e) {
			// NONE 이거나 목록 밖 값이다. 둘 다 "해당 없음"으로 본다.
			return Optional.empty();
		}
	}

	/** 제안 담당 직종. PRD 역할 목록 밖의 값이면 비운다. 억지로 채우지 않는다. */
	private JobRole jobRole(String suggested) {
		String name = trimToNull(suggested);
		if (name == null) {
			return null;
		}
		try {
			return JobRole.valueOf(name);
		} catch (IllegalArgumentException e) {
			log.debug("역할 목록 밖의 직종이라 비워 둔다 — {}", name);
			return null;
		}
	}

	private LocalDateTime observedAt(String observedTime, LocalDate observedDate) {
		LocalTime time = time(observedTime);
		return time == null ? null : LocalDateTime.of(observedDate, time);
	}

	/** 당일 {@code HH:MM}. 읽을 수 없으면 비운다. */
	private LocalTime time(String value) {
		String text = trimToNull(value);
		if (text == null) {
			return null;
		}
		try {
			return LocalTime.parse(text);
		} catch (RuntimeException e) {
			log.debug("시각을 읽지 못해 비워 둔다 — {}", text);
			return null;
		}
	}

	/** 띄어쓰기를 무시하고 포함 여부를 본다. 줄바꿈이나 공백 차이로 정상 근거가 버려지면 안 된다. */
	private boolean containsIgnoringWhitespace(String source, String fragment) {
		return source.replaceAll("\\s", "").contains(fragment.replaceAll("\\s", ""));
	}

	private String trimToNull(String value) {
		if (value == null) {
			return null;
		}
		String trimmed = value.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}

	private String cut(String value, int limit) {
		if (value == null || value.length() <= limit) {
			return value;
		}
		log.warn("길이 제한({})을 넘어 잘라 저장한다.", limit);
		return value.substring(0, limit);
	}

	private String nullToEmpty(String value) {
		return value == null ? "" : value;
	}
}
