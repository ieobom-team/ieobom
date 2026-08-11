package com.ieobom.api.handovercard;

import com.ieobom.api.ai.HandoverStructuringClient;
import com.ieobom.api.ai.StructuredCardDraft;
import com.ieobom.api.ai.StructuringInput;
import com.ieobom.api.common.ConflictException;
import com.ieobom.api.common.NotFoundException;
import com.ieobom.api.handover.Handover;
import com.ieobom.api.handover.HandoverRepository;
import com.ieobom.api.handovercard.dto.HandoverCardListResponse;
import com.ieobom.api.handovercard.dto.HandoverCardListResponse.RecipientCards;
import com.ieobom.api.handovercard.dto.HandoverCardResponse;
import com.ieobom.api.handovercard.dto.HandoverCardStructureResponse;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.CareRecipientRepository;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 인계 원문을 어르신별 카드로 구조화하고, 하루치 카드를 읽어 준다. */
@Slf4j
@Service
@RequiredArgsConstructor
public class HandoverCardService {

	static final String HANDOVER_NOT_FOUND = "HANDOVER_NOT_FOUND";
	static final String ALREADY_STRUCTURED = "HANDOVER_ALREADY_STRUCTURED";

	/** 안전 항목을 앞에 세우고, 같은 무게면 만들어진 순서대로. (Manyfast F-SNBVHR rules) */
	private static final Comparator<HandoverCard> SAFETY_FIRST =
			Comparator.comparing(HandoverCard::isSafetyRelated).reversed().thenComparing(HandoverCard::getId);

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

		List<CareRecipient> candidates = careRecipientRepository.findAll();
		List<StructuredCardDraft> drafts = structuringClient.structure(inputOf(handover, candidates));

		CardVerification verification =
				verifier.verify(
						drafts, handover.getRawText(), handover.getOccurredAt().toLocalDate(), candidates);

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

	private StructuringInput inputOf(Handover handover, List<CareRecipient> candidates) {
		return new StructuringInput(
				handover.getRawText(),
				handover.getOccurredAt(),
				handover.getCareRecipient().getName(),
				candidates.stream().map(CareRecipient::getName).toList());
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
