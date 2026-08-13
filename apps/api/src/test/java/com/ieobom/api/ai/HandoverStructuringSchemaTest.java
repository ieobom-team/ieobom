package com.ieobom.api.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.ieobom.api.common.JobRole;
import com.ieobom.api.common.SafetyKeyword;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * 스키마가 실제로 값을 강제하는 모양인지 확인한다.
 *
 * <p>{@code strict} 나 {@code additionalProperties} 가 빠지면 모델이 정의되지 않은 필드를 만들어 낼 수 있고, 그때는 호출이
 * 성공하는 것처럼 보이면서 조용히 규칙만 사라진다. 실호출 없이 확인할 수 있는 부분은 여기서 잡는다.
 */
class HandoverStructuringSchemaTest {

	@Test
	void 정해진_필드_외의_값을_만들_수_없게_강제한다() {
		Map<String, Object> function = function();

		assertThat(function.get("strict")).isEqualTo(true);
		assertThat(card().get("additionalProperties")).isEqualTo(false);
		assertThat(parameters().get("additionalProperties")).isEqualTo(false);
	}

	@Test
	void 근거_원문은_필수_필드다() {
		assertThat(required()).contains(HandoverStructuringSchema.EVIDENCE_PROPERTY);

		@SuppressWarnings("unchecked")
		Map<String, Object> evidence =
				(Map<String, Object>) properties().get(HandoverStructuringSchema.EVIDENCE_PROPERTY);

		// 값이 없을 수 있는 필드는 ["string","null"] 로 두었다. 근거만 그냥 "string" 이어야 한다.
		assertThat(evidence.get("type")).isEqualTo("string");
	}

	@Test
	void strict_모드라서_모든_속성이_required_에_들어간다() {
		assertThat(required()).containsExactlyInAnyOrderElementsOf(properties().keySet());
	}

	@Test
	void 담당_직종_선택지는_PRD_역할_목록과_UNKNOWN_뿐이다() {
		assertThat(HandoverStructuringSchema.jobRoleNames())
				.containsExactlyInAnyOrderElementsOf(
						concat(Arrays.stream(JobRole.values()).map(Enum::name).toList(), "UNKNOWN"));
	}

	@Test
	void 안전_범주_선택지는_지정_키워드와_NONE_뿐이다() {
		assertThat(HandoverStructuringSchema.safetyCategoryNames())
				.containsExactlyInAnyOrderElementsOf(
						concat(Arrays.stream(SafetyKeyword.values()).map(Enum::name).toList(), "NONE"));
	}

	@Test
	void 프롬프트는_지어내기와_의료_판단을_막는다() {
		String prompt = HandoverStructuringSchema.systemPrompt();

		assertThat(prompt).contains("원문에 없는 사실을 만들지 않는다");
		assertThat(prompt).contains("의료적 판단·진단·투약 권고를 만들지 않는다");
		assertThat(prompt).contains("후보 목록에 있는 ID만 쓴다");
	}

	@Test
	void 어르신을_가리키는_자리는_이름이_아니라_내부_ID다() {
		assertThat(properties()).containsKey(HandoverStructuringSchema.RECIPIENT_PROPERTY);
		assertThat(properties()).doesNotContainKey("recipientName");

		// 필드 이름이 name 이면 프롬프트가 ID 를 요구해도 모델이 이름 자리로 읽는다.
		assertThat(HandoverStructuringSchema.RECIPIENT_PROPERTY).doesNotContain("Name");
		assertThat(HandoverStructuringSchema.systemPrompt())
				.contains("내부 ID를 사람 이름으로 바꿔 적지 않는다");
	}

	@Test
	void 사용자_프롬프트에_원문과_후보_목록이_들어간다() {
		String prompt = HandoverStructuringSchema.userPrompt(입력());

		assertThat(prompt).contains("IB-001 어르신은 점심을 거의 안 드셨어요.");
		assertThat(prompt).contains("IB-001, IB-002");
		assertThat(prompt).contains("13:10");
	}

	@Test
	void 프롬프트는_체크_입력_방식의_상태변화_분류를_안내한다() {
		String prompt = HandoverStructuringSchema.systemPrompt();

		assertThat(prompt).contains("체크 항목: ...");
		assertThat(prompt).contains("체크 항목은 그 자체가 관찰된 상태 변화(statusChange)다");
	}

	@Test
	void 체크_입력_방식이면_사용자_프롬프트에_입력_방식이_들어간다() {
		StructuringInput input = new StructuringInput(
				"체크 항목: 식사 거부 또는 소량 섭취",
				java.time.LocalDateTime.of(2026, 8, 11, 13, 10),
				"IB-001",
				List.of("IB-001", "IB-002"),
				"CHECK");

		String prompt = HandoverStructuringSchema.userPrompt(input);

		assertThat(prompt).contains("입력 방식: CHECK");
		assertThat(prompt).contains("체크 항목: 식사 거부 또는 소량 섭취");
	}

	/**
	 * 이 호출 지점의 요청 페이로드에 어르신 실명이 없다는 것을 프롬프트 문자열에서 직접 확인한다.
	 *
	 * <p>PRD success 의 KPI 가 100% 라서 "대체로 안 나간다"로는 부족하다. 나가는 문자열 자체를 본다. 예전에는 이 자리에 <b>명단 전체의
	 * 실명</b>이 후보 목록으로 실려 나갔다. 서비스 단에서 치환이 실제로 걸리는지는 {@code HandoverCardApiTest} 가 본다.
	 */
	@Test
	void 요청_페이로드에_어르신_실명이_없다() {
		String prompt = HandoverStructuringSchema.userPrompt(입력());

		assertThat(prompt).doesNotContain("김말순").doesNotContain("박순자");
	}

	/** 치환이 끝난 뒤의 입력. 서비스가 {@code RecipientAliases} 로 만들어 넘기는 모양 그대로다. */
	private static StructuringInput 입력() {
		return new StructuringInput(
				"IB-001 어르신은 점심을 거의 안 드셨어요.",
				java.time.LocalDateTime.of(2026, 8, 11, 13, 10),
				"IB-001",
				List.of("IB-001", "IB-002"));
	}

	private static List<String> concat(List<String> values, String extra) {
		return java.util.stream.Stream.concat(values.stream(), java.util.stream.Stream.of(extra))
				.toList();
	}

	@SuppressWarnings("unchecked")
	private static Map<String, Object> function() {
		return (Map<String, Object>) HandoverStructuringSchema.tool().get("function");
	}

	@SuppressWarnings("unchecked")
	private static Map<String, Object> parameters() {
		return (Map<String, Object>) function().get("parameters");
	}

	@SuppressWarnings("unchecked")
	private static Map<String, Object> card() {
		Map<String, Object> properties = (Map<String, Object>) parameters().get("properties");
		Map<String, Object> cards =
				(Map<String, Object>) properties.get(HandoverStructuringSchema.CARDS_PROPERTY);
		return (Map<String, Object>) cards.get("items");
	}

	@SuppressWarnings("unchecked")
	private static Map<String, Object> properties() {
		return (Map<String, Object>) card().get("properties");
	}

	@SuppressWarnings("unchecked")
	private static List<String> required() {
		return (List<String>) card().get("required");
	}
}
