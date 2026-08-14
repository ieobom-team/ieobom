package com.ieobom.api.handovercard;

import static org.assertj.core.api.Assertions.assertThat;

import com.ieobom.api.ai.StructuredCardDraft;
import com.ieobom.api.ai.SuggestedActionDraft;
import com.ieobom.api.common.JobRole;
import com.ieobom.api.handovercard.CardVerification.DiscardReason;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.RecipientAliases;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * 카드가 되기 전에 무엇이 걸러지는지 확인한다.
 *
 * <p>LLM 도 DB 도 쓰지 않는다. 이 규칙들은 "AI 가 이상한 걸 주면 어떻게 되는가"에 대한 답이라서, 실제 AI 응답에 기대면 증명이 되지 않는다.
 * 이상한 응답을 직접 만들어 넣어야 확인할 수 있다.
 */
class CardDraftVerifierTest {

	private static final String 원문 =
			"김말순 어르신이 점심 드시고 화장실 앞에서 미끄러지실 뻔했어요. 부축해서 자리로 모셨습니다. 박순자 어르신은 점심을 거의 안 드셨어요.";

	private static final LocalDate 관찰일 = LocalDate.of(2026, 8, 11);

	private final CardDraftVerifier verifier = new CardDraftVerifier();

	/** 모델이 돌려주는 어르신 식별자는 이름이 아니라 내부 ID다. 대조도 ID로 한다. */
	private final RecipientAliases 대조표 =
			RecipientAliases.of(List.of(어르신("김말순", "IB-001"), 어르신("박순자", "IB-002")));

	@Test
	void 근거가_비면_그_항목은_목록에_나오지_않는다() {
		List<StructuredCardDraft> drafts =
				List.of(
						초안().recipientCode("IB-001").statusChange("낙상 위험").evidenceText(null).build(),
						초안().recipientCode("IB-001").statusChange("낙상 위험").evidenceText("   ").build());

		CardVerification result = verifier.verify(drafts, 원문, 관찰일, 대조표);

		assertThat(result.accepted()).isEmpty();
		assertThat(result.discarded())
				.hasSize(2)
				.allSatisfy(discarded -> assertThat(discarded.reason()).isEqualTo(DiscardReason.NO_EVIDENCE));
	}

	@Test
	void 원문에_없는_근거를_붙인_항목은_버린다() {
		List<StructuredCardDraft> drafts =
				List.of(
						초안()
								.recipientCode("IB-001")
								.nextAction("혈압약 용량을 줄이세요")
								.evidenceText("혈압약 용량을 줄이라고 하셨어요")
								.build());

		CardVerification result = verifier.verify(drafts, 원문, 관찰일, 대조표);

		assertThat(result.accepted()).isEmpty();
		assertThat(result.discarded()).singleElement().satisfies(discarded ->
				assertThat(discarded.reason()).isEqualTo(DiscardReason.EVIDENCE_NOT_IN_SOURCE));
	}

	@Test
	void 근거만_있고_담을_내용이_없으면_버린다() {
		List<StructuredCardDraft> drafts =
				List.of(초안().recipientCode("IB-001").evidenceText("부축해서 자리로 모셨습니다").build());

		CardVerification result = verifier.verify(drafts, 원문, 관찰일, 대조표);

		assertThat(result.accepted()).isEmpty();
		assertThat(result.discarded()).singleElement().satisfies(discarded ->
				assertThat(discarded.reason()).isEqualTo(DiscardReason.NO_CONTENT));
	}

	@Test
	void 띄어쓰기가_달라도_원문에_있는_근거로_인정한다() {
		List<StructuredCardDraft> drafts =
				List.of(
						초안()
								.recipientCode("IB-001")
								.statusChange("낙상 위험")
								.evidenceText("화장실앞에서  미끄러지실 뻔했어요")
								.build());

		CardVerification result = verifier.verify(drafts, 원문, 관찰일, 대조표);

		assertThat(result.accepted()).hasSize(1);
		assertThat(result.discarded()).isEmpty();
	}

	@Test
	void 체크_입력_원문에서_상태_변화로_분류된_항목은_카드로_통과한다() {
		String 체크_원문 = "체크 항목: 식사 거부 또는 소량 섭취";
		List<StructuredCardDraft> drafts =
				List.of(
						초안()
								.recipientCode("IB-001")
								.statusChange("식사 거부 또는 소량 섭취")
								.evidenceText("체크 항목: 식사 거부 또는 소량 섭취")
								.safetyCategory("POOR_INTAKE")
								.build());

		CardVerification result = verifier.verify(drafts, 체크_원문, 관찰일, 대조표);

		assertThat(result.accepted()).singleElement().satisfies(card -> {
			assertThat(card.careRecipient()).isNotNull();
			assertThat(card.careRecipient().getName()).isEqualTo("김말순");
			assertThat(card.statusChange()).isEqualTo("식사 거부 또는 소량 섭취");
			assertThat(card.actionTaken()).isNull();
			assertThat(card.nextAction()).isNull();
			assertThat(card.evidenceText()).isEqualTo("체크 항목: 식사 거부 또는 소량 섭취");
			assertThat(card.safetyRelated()).isTrue();
		});
		assertThat(result.discarded()).isEmpty();
	}

	@Test
	void 역할_목록_밖의_직종은_비워_둔다() {
		List<StructuredCardDraft> drafts =
				List.of(
						초안()
								.recipientCode("IB-001")
								.nextAction("보행 상태 확인")
								.evidenceText("미끄러지실 뻔했어요")
								.suggestedJobRole("PHYSICAL_THERAPIST")
								.build());

		CardVerification result = verifier.verify(drafts, 원문, 관찰일, 대조표);

		assertThat(result.accepted()).singleElement().satisfies(card ->
				assertThat(card.suggestedJobRole()).isNull());
	}

	@Test
	void 판단_근거가_부족하면_직종을_비운다() {
		List<StructuredCardDraft> drafts =
				List.of(
						초안()
								.recipientCode("IB-001")
								.nextAction("보행 상태 확인")
								.evidenceText("미끄러지실 뻔했어요")
								.suggestedJobRole("UNKNOWN")
								.build());

		CardVerification result = verifier.verify(drafts, 원문, 관찰일, 대조표);

		assertThat(result.accepted()).singleElement().satisfies(card ->
				assertThat(card.suggestedJobRole()).isNull());
	}

	@Test
	void 목록_안의_직종은_그대로_제안값이_된다() {
		List<StructuredCardDraft> drafts =
				List.of(
						초안()
								.recipientCode("IB-001")
								.nextAction("혈압 확인")
								.evidenceText("미끄러지실 뻔했어요")
								.suggestedJobRole("NURSE_AIDE")
								.suggestedDueTime("14:30")
								.build());

		CardVerification result = verifier.verify(drafts, 원문, 관찰일, 대조표);

		assertThat(result.accepted()).singleElement().satisfies(card -> {
			assertThat(card.suggestedJobRole()).isEqualTo(JobRole.NURSE_AIDE);
			assertThat(card.suggestedDueTime()).isEqualTo(LocalTime.of(14, 30));
		});
	}

	@Test
	void 다음_행동이_없으면_직종과_기한을_붙이지_않는다() {
		List<StructuredCardDraft> drafts =
				List.of(
						초안()
								.recipientCode("IB-001")
								.statusChange("낙상 위험")
								.evidenceText("미끄러지실 뻔했어요")
								.suggestedJobRole("NURSE_AIDE")
								.suggestedDueTime("14:30")
								.build());

		CardVerification result = verifier.verify(drafts, 원문, 관찰일, 대조표);

		assertThat(result.accepted()).singleElement().satisfies(card -> {
			assertThat(card.suggestedJobRole()).isNull();
			assertThat(card.suggestedDueTime()).isNull();
		});
	}

	@Test
	void 후보_목록에_없는_내부_ID는_어르신을_가리지_못한_것으로_남는다() {
		List<StructuredCardDraft> drafts =
				List.of(
						초안()
								.recipientCode("IB-777")
								.statusChange("낙상 위험")
								.evidenceText("미끄러지실 뻔했어요")
								.build());

		CardVerification result = verifier.verify(drafts, 원문, 관찰일, 대조표);

		assertThat(result.accepted()).singleElement().satisfies(card -> {
			assertThat(card.careRecipient()).isNull();
			assertThat(card.isUnresolved()).isTrue();
		});
	}

	@Test
	void 내부_ID를_비워_보내면_검토_대상으로_남는다() {
		List<StructuredCardDraft> drafts =
				List.of(초안().statusChange("점심 식사량 저하").evidenceText("점심을 거의 안 드셨어요").build());

		CardVerification result = verifier.verify(drafts, 원문, 관찰일, 대조표);

		assertThat(result.accepted()).singleElement().satisfies(card ->
				assertThat(card.isUnresolved()).isTrue());
	}

	@Test
	void 동명이인은_가리지_못한_것으로_본다() {
		// 이름이 겹치면 치환은 ID 하나로 모이지만, 되돌릴 때 그 ID가 누구인지는 확정하지 않는다.
		RecipientAliases 동명이인 =
				RecipientAliases.of(List.of(어르신("김말순", "IB-001"), 어르신("김말순", "IB-009")));
		List<StructuredCardDraft> drafts =
				List.of(초안().recipientCode("IB-001").statusChange("낙상 위험").evidenceText("미끄러지실 뻔했어요").build());

		CardVerification result = verifier.verify(drafts, 원문, 관찰일, 동명이인);

		assertThat(result.accepted()).singleElement().satisfies(card ->
				assertThat(card.isUnresolved()).isTrue());
	}

	@Test
	void 원문에_적힌_키워드로_안전_항목을_잡는다() {
		String 낙상_원문 = "오후에 낙상 위험이 있어 보였어요.";
		List<StructuredCardDraft> drafts =
				List.of(
						초안()
								.recipientCode("IB-001")
								.statusChange("낙상 위험")
								.evidenceText("오후에 낙상 위험이 있어 보였어요")
								.safetyCategory("NONE")
								.build());

		CardVerification result = verifier.verify(drafts, 낙상_원문, 관찰일, 대조표);

		assertThat(result.accepted()).singleElement().satisfies(card -> {
			assertThat(card.safetyRelated()).isTrue();
			assertThat(card.safetyFlagSource()).isEqualTo(SafetyFlagSource.KEYWORD);
		});
	}

	@Test
	void 표기가_달라도_AI_범주로_잡히면_안전_항목이_된다() {
		List<StructuredCardDraft> drafts =
				List.of(
						초안()
								.recipientCode("IB-002")
								.statusChange("점심을 거의 안 드심")
								.evidenceText("점심을 거의 안 드셨어요")
								.safetyCategory("POOR_INTAKE")
								.build());

		CardVerification result = verifier.verify(drafts, 원문, 관찰일, 대조표);

		assertThat(result.accepted()).singleElement().satisfies(card -> {
			assertThat(card.safetyRelated()).isTrue();
			assertThat(card.safetyFlagSource()).isEqualTo(SafetyFlagSource.KEYWORD);
		});
	}

	@Test
	void 안전_항목이_아니면_판정_출처가_비어_있다() {
		List<StructuredCardDraft> drafts =
				List.of(
						초안()
								.recipientCode("IB-001")
								.actionTaken("부축해서 자리로 모심")
								.evidenceText("부축해서 자리로 모셨습니다")
								.safetyCategory("NONE")
								.build());

		CardVerification result = verifier.verify(drafts, 원문, 관찰일, 대조표);

		assertThat(result.accepted()).singleElement().satisfies(card -> {
			assertThat(card.safetyRelated()).isFalse();
			assertThat(card.safetyFlagSource()).isNull();
		});
	}

	@Test
	void 관찰_시각은_입력일에_붙고_읽을_수_없으면_비운다() {
		List<StructuredCardDraft> drafts =
				List.of(
						초안()
								.recipientCode("IB-001")
								.statusChange("낙상 위험")
								.evidenceText("미끄러지실 뻔했어요")
								.observedTime("13:20")
								.build(),
						초안()
								.recipientCode("IB-002")
								.statusChange("점심 식사량 저하")
								.evidenceText("점심을 거의 안 드셨어요")
								.observedTime("점심때쯤")
								.build());

		CardVerification result = verifier.verify(drafts, 원문, 관찰일, 대조표);

		assertThat(result.accepted().get(0).observedAt())
				.isEqualTo(LocalDateTime.of(2026, 8, 11, 13, 20));
		assertThat(result.accepted().get(1).observedAt()).isNull();
	}

	@Test
	void 근거가_원문에_있는_추천_칩은_통과한다() {
		List<StructuredCardDraft> drafts =
				List.of(
						초안()
								.recipientCode("IB-001")
								.statusChange("낙상 위험")
								.evidenceText("미끄러지실 뻔했어요")
								.suggestedActions(
										List.of(
												new SuggestedActionDraft(
														"NEXT_ACTION", "보행 상태 확인", "미끄러지실 뻔했어요")))
								.build());

		CardVerification result = verifier.verify(drafts, 원문, 관찰일, 대조표);

		assertThat(result.accepted()).singleElement().satisfies(card ->
				assertThat(card.suggestedActions()).singleElement().satisfies(action -> {
					assertThat(action.getTargetField()).isEqualTo(CardField.NEXT_ACTION);
					assertThat(action.getText()).isEqualTo("보행 상태 확인");
				}));
	}

	@Test
	void 근거가_원문에_없는_추천_칩은_그_칩만_버리고_카드는_남는다() {
		List<StructuredCardDraft> drafts =
				List.of(
						초안()
								.recipientCode("IB-001")
								.statusChange("낙상 위험")
								.evidenceText("미끄러지실 뻔했어요")
								.suggestedActions(
										List.of(
												new SuggestedActionDraft(
														"NEXT_ACTION", "혈압약 용량 줄이기", "혈압약을 줄이라고 하셨어요")))
								.build());

		CardVerification result = verifier.verify(drafts, 원문, 관찰일, 대조표);

		assertThat(result.accepted()).singleElement().satisfies(card ->
				assertThat(card.suggestedActions()).isEmpty());
		assertThat(result.discarded()).isEmpty();
	}

	@Test
	void 대상_칸을_알_수_없는_추천_칩은_버린다() {
		List<StructuredCardDraft> drafts =
				List.of(
						초안()
								.recipientCode("IB-001")
								.statusChange("낙상 위험")
								.evidenceText("미끄러지실 뻔했어요")
								.suggestedActions(
										List.of(
												new SuggestedActionDraft(
														"STATUS_CHANGE", "낙상 위험", "미끄러지실 뻔했어요")))
								.build());

		CardVerification result = verifier.verify(drafts, 원문, 관찰일, 대조표);

		assertThat(result.accepted()).singleElement().satisfies(card ->
				assertThat(card.suggestedActions()).isEmpty());
	}

	@Test
	void 추천_칩은_최대_3개까지만_남는다() {
		List<SuggestedActionDraft> 네개 =
				List.of(
						new SuggestedActionDraft("NEXT_ACTION", "제안1", "미끄러지실 뻔했어요"),
						new SuggestedActionDraft("NEXT_ACTION", "제안2", "미끄러지실 뻔했어요"),
						new SuggestedActionDraft("NEXT_ACTION", "제안3", "미끄러지실 뻔했어요"),
						new SuggestedActionDraft("NEXT_ACTION", "제안4", "미끄러지실 뻔했어요"));
		List<StructuredCardDraft> drafts =
				List.of(
						초안()
								.recipientCode("IB-001")
								.statusChange("낙상 위험")
								.evidenceText("미끄러지실 뻔했어요")
								.suggestedActions(네개)
								.build());

		CardVerification result = verifier.verify(drafts, 원문, 관찰일, 대조표);

		assertThat(result.accepted()).singleElement().satisfies(card ->
				assertThat(card.suggestedActions()).hasSize(3));
	}

	private static CareRecipient 어르신(String name, String code) {
		return CareRecipient.builder().name(name).code(code).build();
	}

	private static DraftBuilder 초안() {
		return new DraftBuilder();
	}

	/** 초안은 필드가 9개라 테스트마다 전부 적으면 무엇을 보는 테스트인지 가려진다. */
	private static final class DraftBuilder {
		private String recipientCode;
		private String statusChange;
		private String actionTaken;
		private String nextAction;
		private String evidenceText;
		private String suggestedJobRole;
		private String suggestedDueTime;
		private String observedTime;
		private String safetyCategory = "NONE";
		private List<SuggestedActionDraft> suggestedActions = List.of();

		DraftBuilder recipientCode(String value) {
			this.recipientCode = value;
			return this;
		}

		DraftBuilder statusChange(String value) {
			this.statusChange = value;
			return this;
		}

		DraftBuilder actionTaken(String value) {
			this.actionTaken = value;
			return this;
		}

		DraftBuilder nextAction(String value) {
			this.nextAction = value;
			return this;
		}

		DraftBuilder evidenceText(String value) {
			this.evidenceText = value;
			return this;
		}

		DraftBuilder suggestedJobRole(String value) {
			this.suggestedJobRole = value;
			return this;
		}

		DraftBuilder suggestedDueTime(String value) {
			this.suggestedDueTime = value;
			return this;
		}

		DraftBuilder observedTime(String value) {
			this.observedTime = value;
			return this;
		}

		DraftBuilder safetyCategory(String value) {
			this.safetyCategory = value;
			return this;
		}

		DraftBuilder suggestedActions(List<SuggestedActionDraft> value) {
			this.suggestedActions = value;
			return this;
		}

		StructuredCardDraft build() {
			return new StructuredCardDraft(
					recipientCode,
					statusChange,
					actionTaken,
					nextAction,
					evidenceText,
					suggestedJobRole,
					suggestedDueTime,
					observedTime,
					safetyCategory,
					suggestedActions);
		}
	}
}
