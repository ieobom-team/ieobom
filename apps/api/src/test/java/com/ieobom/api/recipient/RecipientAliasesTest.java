package com.ieobom.api.recipient;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * 실명이 LLM 으로 나가지 않는다는 약속이 실제로 지켜지는지 확인한다.
 *
 * <p>이 규칙은 제품의 KPI 중 하나다. (PRD success — "LLM 요청에 어르신 실명이 포함되지 않는 비율 100%") 두 호출 지점의 페이로드
 * 검증은 API 테스트가 하고, 여기서는 그 장치인 대조표 자체가 어떤 입력에서 어떻게 동작하는지를 본다.
 */
class RecipientAliasesTest {

	private final RecipientAliases 대조표 =
			RecipientAliases.of(List.of(어르신("김말순", "IB-001"), 어르신("박순자", "IB-002")));

	@Test
	void 원문에_섞인_실명을_내부_ID로_바꾼다() {
		String masked = 대조표.mask("김말순 어르신이 미끄러지실 뻔했어요. 박순자 어르신은 점심을 거의 안 드셨어요.");

		assertThat(masked).doesNotContain("김말순").doesNotContain("박순자");
		assertThat(masked).contains("IB-001").contains("IB-002");
	}

	@Test
	void 내부_ID를_실명으로_되돌린다() {
		String 원문 = "김말순 어르신이 미끄러지실 뻔했어요.";

		assertThat(대조표.restore(대조표.mask(원문))).isEqualTo(원문);
	}

	@Test
	void 후보_목록으로_나가는_것은_이름이_아니라_내부_ID다() {
		assertThat(대조표.codes()).containsExactly("IB-001", "IB-002");
	}

	@Test
	void 긴_이름을_먼저_바꾼다() {
		// 짧은 이름을 먼저 바꾸면 "김말순"이 "IB-009순"이 되어 긴 이름이 영영 걸리지 않는다.
		RecipientAliases 겹치는_이름 =
				RecipientAliases.of(List.of(어르신("김말", "IB-009"), 어르신("김말순", "IB-010")));

		String masked = 겹치는_이름.mask("김말순 어르신이 미끄러지실 뻔했어요.");

		assertThat(masked).startsWith("IB-010 ");
		assertThat(겹치는_이름.containsRealName(masked)).isFalse();
	}

	@Test
	void 이용_종료한_어르신의_이름도_가린다() {
		// 이용 종료는 새 입력의 대상 선택 목록에서만 빠진다. 이름 대조 후보에는 남는다.
		// (Manyfast F-LUDCWW rules)
		CareRecipient 종료한_어르신 = 어르신("이영순", "IB-003");
		종료한_어르신.discharge(LocalDateTime.of(2026, 8, 1, 9, 0));

		RecipientAliases 종료_포함 = RecipientAliases.of(List.of(어르신("김말순", "IB-001"), 종료한_어르신));

		assertThat(종료_포함.mask("이영순 어르신 이야기입니다.")).doesNotContain("이영순").contains("IB-003");
	}

	@Test
	void 등록되지_않은_이름은_그대로_남는다() {
		// 룰 기반 문자열 대조의 한계다. 명단에 없는 이름은 찾을 수 없다.
		// 이것을 잡으려면 이름을 알아보는 모델이 필요한데, 그건 "치환을 LLM 에 맡기지 않는다"와 어긋난다.
		String masked = 대조표.mask("최영자 어르신이 오셨어요.");

		assertThat(masked).isEqualTo("최영자 어르신이 오셨어요.");
	}

	@Test
	void 동명이인도_실명은_반드시_가리되_누구인지는_확정하지_않는다() {
		RecipientAliases 동명이인 =
				RecipientAliases.of(List.of(어르신("김말순", "IB-001"), 어르신("김말순", "IB-009")));

		String masked = 동명이인.mask("김말순 어르신이 미끄러지실 뻔했어요.");

		assertThat(masked).doesNotContain("김말순");
		assertThat(동명이인.resolve("IB-001")).isNull();
		assertThat(동명이인.resolve("IB-009")).isNull();
	}

	@Test
	void 내부_ID로_어르신을_되짚는다() {
		assertThat(대조표.resolve("IB-002")).extracting(CareRecipient::getName).isEqualTo("박순자");
		assertThat(대조표.resolve("IB-777")).isNull();
		assertThat(대조표.resolve(null)).isNull();
	}

	@Test
	void 빈_값은_그대로_둔다() {
		assertThat(대조표.mask(null)).isNull();
		assertThat(대조표.restore(null)).isNull();
		assertThat(대조표.mask("")).isEmpty();
	}

	private static CareRecipient 어르신(String name, String code) {
		return CareRecipient.builder().name(name).code(code).build();
	}
}
