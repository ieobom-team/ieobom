package com.ieobom.api.handovercard;

import com.ieobom.api.ai.HandoverStructuringClient;
import com.ieobom.api.ai.StructuredCardDraft;
import com.ieobom.api.ai.StructuringInput;
import com.ieobom.api.ai.SuggestedActionDraft;
import com.ieobom.api.common.ConflictException;
import com.ieobom.api.common.NotFoundException;
import com.ieobom.api.common.RequestValidationException;
import com.ieobom.api.handover.Handover;
import com.ieobom.api.handover.HandoverRepository;
import com.ieobom.api.handovercard.dto.HandoverCardListResponse;
import com.ieobom.api.handovercard.dto.HandoverCardListResponse.RecipientCards;
import com.ieobom.api.handovercard.dto.HandoverCardResponse;
import com.ieobom.api.handovercard.dto.HandoverCardStructureResponse;
import com.ieobom.api.handovercard.dto.HandoverCardUpdateRequest;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.CareRecipientRepository;
import com.ieobom.api.recipient.RecipientAliases;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 인계 원문을 어르신별 카드로 구조화하고, 하루치 카드를 읽어 주고, 직원의 검토 결과를 반영한다. */
@Slf4j
@Service
@RequiredArgsConstructor
public class HandoverCardService {

	static final String HANDOVER_NOT_FOUND = "HANDOVER_NOT_FOUND";
	static final String ALREADY_STRUCTURED = "HANDOVER_ALREADY_STRUCTURED";
	static final String CARD_NOT_FOUND = "HANDOVER_CARD_NOT_FOUND";
	static final String CARE_RECIPIENT_NOT_FOUND = "CARE_RECIPIENT_NOT_FOUND";
	static final String RECIPIENT_NOT_RESOLVED = "CARE_RECIPIENT_NOT_RESOLVED";

	/** 안전 항목을 앞에 세우고, 같은 무게면 최신 생성 순서대로. (Manyfast F-SNBVHR rules) */
	private static final Comparator<HandoverCard> SAFETY_FIRST =
			Comparator.comparing(HandoverCard::isSafetyRelated).reversed()
					.thenComparing(HandoverCard::getId, Comparator.reverseOrder());

	private final HandoverRepository handoverRepository;
	private final HandoverCardRepository cardRepository;
	private final CareRecipientRepository careRecipientRepository;
	private final HandoverStructuringClient structuringClient;
	private final CardDraftVerifier verifier;

	/**
	 * 원문 하나를 어르신별 카드로 나눈다.
	 *
	 * <p><b>일부러 트랜잭션을 걸지 않았다.</b> LLM 응답을 기다리는 수 초 동안 DB 커넥션을 붙들고 있을 이유가 없다. 저장은 {@code
	 * saveAll} 한 번으로 끝나므로 그 안에서만 트랜잭션이 열린다.
	 *
	 * @throws NotFoundException 인계 원문이 없을 때
	 * @throws ConflictException 이미 구조화된 원문일 때
	 * @throws com.ieobom.api.ai.LlmUnavailableException 구조화를 수행할 수 없을 때
	 */
	public HandoverCardStructureResponse structure(Long handoverId) {
		Handover handover =
				handoverRepository
						.findWithCareRecipient(handoverId)
						.orElseThrow(
								() -> new NotFoundException(HANDOVER_NOT_FOUND, "인계 원문을 찾을 수 없습니다."));

		if (cardRepository.existsByHandoverId(handoverId)) {
			throw new ConflictException(ALREADY_STRUCTURED, "이미 구조화된 인계입니다. 카드 목록에서 확인해 주세요.");
		}

		// 이용 종료한 어르신도 담는다. 새 입력의 대상 목록에서만 빠질 뿐, 원문에 이름이 나오면 그것도 가려야 한다.
		// (Manyfast F-LUDCWW rules)
		RecipientAliases aliases = RecipientAliases.of(careRecipientRepository.findAll());

		List<StructuredCardDraft> drafts =
				restore(structuringClient.structure(inputOf(handover, aliases)), aliases);

		CardVerification verification =
				verifier.verify(
						drafts, handover.getRawText(), handover.getOccurredAt().toLocalDate(), aliases);

		List<HandoverCard> saved = cardRepository.saveAll(toCards(handover, verification.accepted()));
		logStructured(handover, verification, saved);

		return new HandoverCardStructureResponse(
				handoverId, saved.size(), verification.discarded().size(), toResponses(saved));
	}

	/** 그날 만들어진 카드를 어르신별로 묶어서 읽는다. */
	@Transactional(readOnly = true)
	public HandoverCardListResponse findByDate(LocalDate date) {
		List<HandoverCard> cards =
				cardRepository.findCreatedBetween(date.atStartOfDay(), date.plusDays(1).atStartOfDay())
						.stream()
						.sorted(SAFETY_FIRST)
						.toList();

		List<HandoverCardResponse> unresolved =
				cards.stream()
						.filter(card -> card.getCareRecipient() == null)
						.map(HandoverCardResponse::from)
						.toList();

		Map<Long, List<HandoverCard>> byRecipient =
				cards.stream()
						.filter(card -> card.getCareRecipient() != null)
						.collect(
								Collectors.groupingBy(
										card -> card.getCareRecipient().getId(),
										LinkedHashMap::new,
										Collectors.toList()));

		List<RecipientCards> recipients =
				byRecipient.values().stream()
						.map(
								group -> {
									CareRecipient recipient = group.get(0).getCareRecipient();
									return new RecipientCards(
											recipient.getId(),
											recipient.getName(),
											group.stream().map(HandoverCardResponse::from).toList());
								})
						.toList();

		return new HandoverCardListResponse(date, recipients, unresolved);
	}

	/**
	 * 직원이 검토하며 고친 내용을 반영한다. (Manyfast F-SNBVHR action)
	 *
	 * @throws NotFoundException 카드가 없거나, 지정한 어르신이 목록에 없을 때
	 * @throws RequestValidationException 담을 내용이 없거나, 다음 행동 없이 제안값만 지정했을 때
	 * @throws ConflictException 검토 완료 카드에서 대상 어르신을 비우려 할 때
	 */
	@Transactional
	public HandoverCardResponse update(Long cardId, HandoverCardUpdateRequest request) {
		HandoverCard card = findCard(cardId);
		verifyContent(request);
		verifySuggestion(request);

		CareRecipient careRecipient = findRecipient(request.careRecipientId());
		if (careRecipient == null && card.canGenerateExport()) {
			throw new ConflictException(
					RECIPIENT_NOT_RESOLVED, "검토 완료 카드에서는 대상 어르신을 비울 수 없습니다. 검토 상태를 되돌린 뒤 고쳐 주세요.");
		}

		List<String> changed = changedFields(card, request, careRecipient);
		card.edit(
				careRecipient,
				request.normalizedStatusChange(),
				request.normalizedActionTaken(),
				request.normalizedNextAction(),
				request.suggestedJobRole(),
				request.suggestedDueTime());

		logReviewed("카드 수정", card, "바뀐항목=" + changed);
		return HandoverCardResponse.from(card);
	}

	/**
	 * 검토 상태를 바꾼다. (Manyfast F-SNBVHR dataSpec)
	 *
	 * <p>대상 어르신을 가리지 못한 카드는 검토 완료로 올리지 않는다. Manyfast 는 어르신을 분리할 수 없는 원문을 "확정 카드로 만들지 않는다"고
	 * 한다. 어르신 없는 카드가 검토 완료가 되면 그 카드로 만든 문구가 누구의 기록인지 말할 수 없게 된다.
	 *
	 * @throws NotFoundException 카드가 없을 때
	 * @throws ConflictException 어르신을 가리지 못한 카드를 검토 완료로 올리려 할 때
	 */
	@Transactional
	public HandoverCardResponse changeReviewStatus(Long cardId, ReviewStatus reviewStatus) {
		HandoverCard card = findCard(cardId);
		if (reviewStatus == ReviewStatus.REVIEWED && !card.isRecipientResolved()) {
			throw new ConflictException(RECIPIENT_NOT_RESOLVED, "대상 어르신을 먼저 지정해 주세요.");
		}

		ReviewStatus before = card.getReviewStatus();
		card.changeReviewStatus(reviewStatus);

		logReviewed("카드 검토 상태 전환", card, "%s -> %s".formatted(before, reviewStatus));
		return HandoverCardResponse.from(card);
	}

	/**
	 * 직원이 안전 관련 표시를 켜거나 끈다. (Manyfast F-SNBVHR rules)
	 *
	 * @throws NotFoundException 카드가 없을 때
	 */
	@Transactional
	public HandoverCardResponse markSafety(Long cardId, boolean safetyRelated) {
		HandoverCard card = findCard(cardId);
		card.markSafety(safetyRelated);

		logReviewed(
				"카드 안전 표시", card, "safetyRelated=%s, 판정출처=%s".formatted(safetyRelated, card.getSafetyFlagSource()));
		return HandoverCardResponse.from(card);
	}

	private HandoverCard findCard(Long cardId) {
		return cardRepository
				.findById(cardId)
				.orElseThrow(() -> new NotFoundException(CARD_NOT_FOUND, "카드를 찾을 수 없습니다."));
	}

	/** 직원이 지정한 어르신. 아직 가리지 못했다는 뜻으로 비워 보낼 수 있다. */
	private CareRecipient findRecipient(Long careRecipientId) {
		if (careRecipientId == null) {
			return null;
		}
		return careRecipientRepository
				.findById(careRecipientId)
				.orElseThrow(
						() ->
								new NotFoundException(
										CARE_RECIPIENT_NOT_FOUND, "대상 어르신을 찾을 수 없습니다. 목록에서 다시 선택해 주세요."));
	}

	/**
	 * 담을 내용이 남아 있는지.
	 *
	 * <p>{@link CardDraftVerifier} 가 AI 초안을 버리는 기준과 같다. 세 칸이 모두 비면 근거만 있고 아무 말도 하지 않는 카드가 되는데,
	 * 카드 삭제가 없는 지금은 그 카드가 목록에 영원히 남는다.
	 */
	private void verifyContent(HandoverCardUpdateRequest request) {
		if (request.normalizedStatusChange() == null
				&& request.normalizedActionTaken() == null
				&& request.normalizedNextAction() == null) {
			throw new RequestValidationException(
					"상태 변화 · 조치 · 다음 행동 중 하나는 남겨 주세요.",
					List.of("statusChange", "actionTaken", "nextAction"));
		}
	}

	/**
	 * 제안 직종·기한은 다음 행동에 붙는 값이다. (Manyfast F-SNBVHR dataSpec)
	 *
	 * <p>다음 행동이 없는데 값만 남으면 후속 업무 배정 화면이 "무엇을 할지 없이 담당자와 기한만 있는" 항목을 받게 된다. 서버가 조용히 비우지 않고
	 * 되돌려 주는 이유는, 직원이 다음 행동을 지운 것과 제안값을 지우려 한 것이 다른 행동이기 때문이다.
	 */
	private void verifySuggestion(HandoverCardUpdateRequest request) {
		if (request.normalizedNextAction() == null
				&& (request.suggestedJobRole() != null || request.suggestedDueTime() != null)) {
			throw new RequestValidationException(
					"nextAction", "제안 직종과 기한은 다음 행동이 있을 때만 지정할 수 있습니다.");
		}
	}

	/** 무엇이 바뀌었는지. 반드시 {@code edit} 을 부르기 전에 계산한다. */
	private List<String> changedFields(
			HandoverCard card, HandoverCardUpdateRequest request, CareRecipient careRecipient) {

		List<String> changed = new ArrayList<>();
		addIfChanged(changed, "careRecipientId", idOf(card.getCareRecipient()), idOf(careRecipient));
		addIfChanged(changed, "statusChange", card.getStatusChange(), request.normalizedStatusChange());
		addIfChanged(changed, "actionTaken", card.getActionTaken(), request.normalizedActionTaken());
		addIfChanged(changed, "nextAction", card.getNextAction(), request.normalizedNextAction());
		addIfChanged(changed, "suggestedJobRole", card.getSuggestedJobRole(), request.suggestedJobRole());
		addIfChanged(changed, "suggestedDueTime", card.getSuggestedDueTime(), request.suggestedDueTime());
		return changed;
	}

	private void addIfChanged(List<String> changed, String field, Object before, Object after) {
		if (!Objects.equals(before, after)) {
			changed.add(field);
		}
	}

	private Long idOf(CareRecipient careRecipient) {
		return careRecipient == null ? null : careRecipient.getId();
	}

	/**
	 * 카드 검토 및 수정 이벤트. (Manyfast F-SNBVHR outcome)
	 *
	 * <p>구조화 이벤트와 같은 이유로 별도 테이블 없이 애플리케이션 로그로 남긴다. 수정 이력 열람과 되돌리기는 이번 범위 밖이라, 지금 이력 테이블을
	 * 만들면 화면 없이 스키마부터 추측하게 된다.
	 *
	 * <p><b>바뀐 내용 자체는 남기지 않고 항목 이름만 남긴다.</b> 어르신의 상태와 투약 이야기가 로그 파일로 새어 나갈 이유가 없다.
	 */
	private void logReviewed(String event, HandoverCard card, String detail) {
		log.info(
				"{} — cardId={}, careRecipientId={}, reviewStatus={}, {}",
				event,
				card.getId(),
				idOf(card.getCareRecipient()),
				card.getReviewStatus(),
				detail);
	}

	/**
	 * 모델에 넘길 것. <b>실명은 여기서 전부 내부 ID로 바뀐다.</b>
	 *
	 * <p>원문까지 치환하는 것이 핵심이다. 어르신 칸만 ID로 바꾸고 원문을 그대로 보내면 실명은 원문에 실려 그대로 나간다. 후보 목록도 명단 전체의 실명이
	 * 아니라 내부 ID 목록이다. (Manyfast F-LUDCWW rules · PRD success — "LLM 요청에 어르신 실명이 포함되지 않는 비율 100%")
	 */
	private StructuringInput inputOf(Handover handover, RecipientAliases aliases) {
		return new StructuringInput(
				aliases.mask(handover.getRawText()),
				handover.getOccurredAt(),
				handover.getCareRecipient().getCode(),
				aliases.codes(),
				handover.getInputMethod() != null ? handover.getInputMethod().name() : null);
	}

	/**
	 * 모델이 돌려준 초안의 실명을 되돌린다. <b>마스킹은 LLM 경계에서만 일어난다.</b>
	 *
	 * <p>검증보다 먼저 해야 한다. {@link CardDraftVerifier} 는 근거가 실제로 원문 안에 있는지 글자를 대조하는데, 그 상대는 치환되지 않은
	 * 인계 원문이다. 되돌리지 않고 대조하면 어르신 이름이 들어간 정상 근거가 전부 "원문에 없는 근거"로 폐기된다.
	 *
	 * <p><b>어르신 식별자({@code recipientCode})는 되돌리지 않는다.</b> 카드가 어르신을 가리키는 방식은 문자열이 아니라 내부 ID로 찾은
	 * 어르신 행이다.
	 */
	private List<StructuredCardDraft> restore(
			List<StructuredCardDraft> drafts, RecipientAliases aliases) {

		return drafts.stream()
				.map(
						draft ->
								new StructuredCardDraft(
										draft.recipientCode(),
										aliases.restore(draft.statusChange()),
										aliases.restore(draft.actionTaken()),
										aliases.restore(draft.nextAction()),
										aliases.restore(draft.evidenceText()),
										draft.suggestedJobRole(),
										draft.suggestedDueTime(),
										draft.observedTime(),
										draft.safetyCategory(),
										restoreSuggestedActions(draft.suggestedActions(), aliases)))
				.toList();
	}

	/** 추천 액션 칩의 문구·근거도 카드의 다른 항목과 같은 자리에서 실명으로 되돌린다. */
	private List<SuggestedActionDraft> restoreSuggestedActions(
			List<SuggestedActionDraft> drafts, RecipientAliases aliases) {
		return drafts.stream()
				.map(
						draft ->
								new SuggestedActionDraft(
										draft.targetField(),
										aliases.restore(draft.text()),
										aliases.restore(draft.evidenceText())))
				.toList();
	}

	/**
	 * 통과한 항목만 카드가 된다.
	 *
	 * <p>검토 상태는 전부 {@code NEEDS_REVIEW} 로 시작한다. AI 가 만든 것을 직원이 아직 보지 않았기 때문이다. 대상 어르신을 가리지 못한
	 * 카드도 같은 상태로 남아 검토 대상 목록에 뜬다.
	 */
	private List<HandoverCard> toCards(Handover handover, List<CardBlueprint> blueprints) {
		return blueprints.stream()
				.map(
						blueprint ->
								HandoverCard.builder()
										.handover(handover)
										.careRecipient(blueprint.careRecipient())
										.observedAt(blueprint.observedAt())
										.statusChange(blueprint.statusChange())
										.actionTaken(blueprint.actionTaken())
										.nextAction(blueprint.nextAction())
										.evidenceText(blueprint.evidenceText())
										.safetyRelated(blueprint.safetyRelated())
										.safetyFlagSource(blueprint.safetyFlagSource())
										.reviewStatus(ReviewStatus.NEEDS_REVIEW)
										.suggestedJobRole(blueprint.suggestedJobRole())
										.suggestedDueTime(blueprint.suggestedDueTime())
										.suggestedActions(blueprint.suggestedActions())
										.build())
				.toList();
	}

	private List<HandoverCardResponse> toResponses(List<HandoverCard> cards) {
		return cards.stream().sorted(SAFETY_FIRST).map(HandoverCardResponse::from).toList();
	}

	/**
	 * 구조화 이벤트. (Manyfast F-SNBVHR outcome)
	 *
	 * <p>{@code HandoverService} 와 같은 이유로 별도 테이블 없이 애플리케이션 로그로 남긴다. 폐기 수와 검토 대상 수를 함께 남기는 것이
	 * 중요하다. 나중에 "AI 가 만든 것 중 무엇이 왜 빠졌는지"를 물을 수 있는 유일한 흔적이다.
	 */
	private void logStructured(
			Handover handover, CardVerification verification, List<HandoverCard> saved) {
		long unresolved = verification.accepted().stream().filter(CardBlueprint::isUnresolved).count();
		long safety = saved.stream().filter(HandoverCard::isSafetyRelated).count();
		log.info(
				"인계 구조화 — handoverId={}, 생성={}, 폐기={}, 검토대상={}, 안전항목={}",
				handover.getId(),
				saved.size(),
				verification.discarded().size(),
				unresolved,
				safety);
	}
}
