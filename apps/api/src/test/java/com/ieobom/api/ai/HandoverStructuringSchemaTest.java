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
		assertThat(prompt).contains("후보 목록에 있는 이름만 쓴다");
	}

	@Test
	void 사용자_프롬프트에_원문과_후보_목록이_들어간다() {
		StructuringInput input =
				new StructuringInput(
						"점심을 거의 안 드셨어요.",
						java.time.LocalDateTime.of(2026, 8, 11, 13, 10),
						"김말순",
						List.of("김말순", "박순자"));

		String prompt = HandoverStructuringSchema.userPrompt(input);

		assertThat(prompt).contains("점심을 거의 안 드셨어요.");
		assertThat(prompt).contains("김말순, 박순자");
		assertThat(prompt).contains("13:10");
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
