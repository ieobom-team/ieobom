package com.ieobom.api.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.ieobom.api.common.SafetyKeyword;
import com.ieobom.api.handovercard.CardDraftVerifier;
import com.ieobom.api.handovercard.CardVerification;
import com.ieobom.api.recipient.CareRecipient;
import com.ieobom.api.recipient.RecipientAliases;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * 진짜 LLM 을 불러서 계약이 살아 있는지 확인한다.
 *
 * <p>기본 빌드에서 제외돼 있다. 실행은 명시적으로 한다.
 *
 * <pre>
 *   ./gradlew llmLiveTest          (LLM_API_KEY 가 잡혀 있어야 한다)
 * </pre>
 *
 * <p>실행당 호출은 2회다. 모델이 만드는 문장은 매번 다르므로 <b>문구를 단정하지 않는다.</b> 대신 깨지면 안 되는 계약만 본다. 스키마가 실제로 걸리는지,
 * 근거가 원문에서 나오는지, 목록 밖 직종이 튀어나오지 않는지, <b>실명 없이 내부 ID만으로 어르신을 나눌 수 있는지</b> 네 가지다. 이건 stub 으로는
 * 확인할 수 없다.
 *
 * <p>마지막 항목이 특히 stub 으로 확인되지 않는다. "이름을 지우면 발화를 어르신별로 나눌 단서가 사라진다"는 걱정에 대한 답이 내부 ID 치환인데, 그게
 * 실제로 되는지는 진짜 모델에 물어봐야 안다. (Manyfast F-LUDCWW rationale)
 */
@Tag("llm-live")
@EnabledIfEnvironmentVariable(
		named = "LLM_API_KEY",
		matches = ".+",
		disabledReason = "LLM_API_KEY 가 없어 실호출 확인을 건너뛴다.")
@SpringBootTest
class OpenAiStructuringLiveTest {

	private static final RecipientAliases 대조표 = RecipientAliases.of(어르신들());

	@Autowired private HandoverStructuringClient client;

	private final CardDraftVerifier verifier = new CardDraftVerifier();

	@Test
	void 실명_없이_내부_ID만으로_어르신별로_나누고_근거를_원문에서_가져온다() {
		String 원문 =
				"오늘 오후에 김말순 어르신이 화장실 앞에서 미끄러지실 뻔해서 부축해 드렸어요. 보호자께 알려 드려야 할 것 같아요."
						+ " 박순자 어르신은 점심을 거의 안 드셨습니다.";
		String 치환된_원문 = 대조표.mask(원문);

		assertThat(대조표.containsRealName(치환된_원문)).as("실명이 나가면 안 된다").isFalse();

		List<StructuredCardDraft> drafts =
				client.structure(
						new StructuringInput(
								치환된_원문, LocalDateTime.of(2026, 8, 11, 14, 0), "IB-001", 대조표.codes()));

		assertThat(drafts).as("두 어르신이 섞인 원문이므로 항목이 하나로 뭉치면 안 된다").hasSizeGreaterThanOrEqualTo(2);

		assertThat(drafts)
				.allSatisfy(
						draft -> {
							assertThat(draft.evidenceText()).as("근거는 필수 필드다").isNotBlank();
							assertThat(공백을_지운(치환된_원문))
									.as("근거는 원문에서 그대로 가져와야 한다 — %s", draft.evidenceText())
									.contains(공백을_지운(draft.evidenceText()));
							assertThat(HandoverStructuringSchema.jobRoleNames())
									.as("PRD 역할 목록 밖의 직종을 만들면 안 된다")
									.contains(draft.suggestedJobRole());
							assertThat(HandoverStructuringSchema.safetyCategoryNames())
									.contains(draft.safetyCategory());
							if (draft.recipientCode() != null) {
								assertThat(대조표.codes())
										.as("후보 목록 밖의 내부 ID를 만들면 안 된다")
										.contains(draft.recipientCode());
							}
						});

		assertThat(drafts)
				.as("이름을 지워도 내부 ID로 두 사람을 나눌 수 있어야 한다")
				.extracting(StructuredCardDraft::recipientCode)
				.contains("IB-001", "IB-002");

		// 서비스가 하는 것과 같은 순서다. 되돌린 뒤에 치환되지 않은 원문과 대조한다.
		CardVerification verification =
				verifier.verify(복원한(drafts), 원문, LocalDate.of(2026, 8, 11), 대조표);
		assertThat(verification.discarded())
				.as("정상 원문에서는 폐기되는 항목이 없어야 한다 — 폐기되면 근거를 지어냈다는 뜻이다")
				.isEmpty();
		assertThat(verification.accepted())
				.as("낙상과 식사 저하가 섞여 있으므로 안전 항목이 잡혀야 한다")
				.anySatisfy(card -> assertThat(card.safetyRelated()).isTrue());
		assertThat(verification.accepted())
				.as("내부 ID로 돌아온 식별자가 실제 어르신으로 이어져야 한다")
				.anySatisfy(card -> assertThat(card.careRecipient()).isNotNull());
	}

	@Test
	void 발열_원문에서_의료_판단을_만들지_않는다() {
		String 원문 = "어제 저녁부터 열이 나신다고 보호자가 전해 주셨어요. 오전에 체온 재어 보니 미열이 있었습니다.";

		List<StructuredCardDraft> drafts =
				client.structure(
						new StructuringInput(
								대조표.mask(원문), LocalDateTime.of(2026, 8, 11, 10, 0), "IB-001", 대조표.codes()));

		assertThat(drafts).isNotEmpty();
		assertThat(drafts)
				.allSatisfy(
						draft -> {
							String 내용 =
									String.join(
											" ",
											nullToEmpty(draft.statusChange()),
											nullToEmpty(draft.actionTaken()),
											nullToEmpty(draft.nextAction()));
							assertThat(내용).as("진단이나 처방을 만들면 안 된다").doesNotContain("처방", "진단");
						});

		assertThat(drafts)
				.as("발열은 지정 키워드다")
				.anySatisfy(draft -> assertThat(draft.safetyCategory()).isEqualTo(SafetyKeyword.FEVER.name()));
	}

	private static List<CareRecipient> 어르신들() {
		return List.of(
				CareRecipient.builder().name("김말순").code("IB-001").build(),
				CareRecipient.builder().name("박순자").code("IB-002").build(),
				CareRecipient.builder().name("이영순").code("IB-003").build());
	}

	/** {@code HandoverCardService} 가 응답을 받자마자 하는 것과 같다. 식별자는 그대로 두고 텍스트만 되돌린다. */
	private static List<StructuredCardDraft> 복원한(List<StructuredCardDraft> drafts) {
		return drafts.stream()
				.map(
						draft ->
								new StructuredCardDraft(
										draft.recipientCode(),
										대조표.restore(draft.statusChange()),
										대조표.restore(draft.actionTaken()),
										대조표.restore(draft.nextAction()),
										대조표.restore(draft.evidenceText()),
										draft.suggestedJobRole(),
										draft.suggestedDueTime(),
										draft.observedTime(),
										draft.safetyCategory()))
				.toList();
	}

	private static String 공백을_지운(String text) {
		return text.replaceAll("\\s", "");
	}

	private static String nullToEmpty(String value) {
		return value == null ? "" : value;
	}
}
