package com.ieobom.api.ai;

import com.ieobom.api.common.JobRole;
import com.ieobom.api.common.SafetyKeyword;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

/**
 * 구조화 응답에 강제할 JSON 스키마와 프롬프트.
 *
 * <p>Function Calling 으로 스키마를 강제한다. {@code strict} 와 {@code additionalProperties: false} 가 함께
 * 걸려야 "정해진 필드 외의 값을 애초에 만들 수 없다"가 성립한다. 자유 텍스트를 받아 파싱하지 않는다.
 *
 * <p>담당 직종과 안전 범주의 선택지는 {@link JobRole} · {@link SafetyKeyword} 에서 직접 뽑는다. 스키마에 목록을 손으로 다시 적으면
 * 도메인이 바뀔 때 조용히 어긋난다.
 */
final class HandoverStructuringSchema {

	static final String FUNCTION_NAME = "save_handover_cards";
	static final String CARDS_PROPERTY = "cards";
	static final String EVIDENCE_PROPERTY = "evidenceText";
	static final String SUGGESTED_ACTIONS_PROPERTY = "suggestedActions";

	/** 추천 액션 칩 최대 개수. (Manyfast F-SNBVHR display — "칩은 최대 3개까지 표시") */
	static final int SUGGESTED_ACTIONS_LIMIT = 3;

	/** 추천 액션 칩이 채울 칸. {@link com.ieobom.api.handovercard.CardField} 와 이름을 맞춘다. */
	static final List<String> TARGET_FIELDS = List.of("ACTION_TAKEN", "NEXT_ACTION");

	/**
	 * 어르신을 가리키는 자리. <b>이름이 아니라 내부 ID다.</b>
	 *
	 * <p>필드 이름을 {@code recipientName} 으로 두면 프롬프트가 ID를 요구해도 모델이 이름 자리로 읽는다. 실명이 나가지 않게 하는 장치를 필드
	 * 이름 하나로 무르지 않는다. (Manyfast F-LUDCWW rules)
	 */
	static final String RECIPIENT_PROPERTY = "recipientCode";

	/** 직종을 고를 근거가 부족할 때 쓰는 값. 목록 밖 직종을 지어내는 대신 이걸 내게 한다. */
	static final String UNKNOWN_JOB_ROLE = "UNKNOWN";

	/** 지정 키워드 어디에도 해당하지 않을 때. */
	static final String NO_SAFETY_CATEGORY = "NONE";

	private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

	private HandoverStructuringSchema() {}

	/** OpenAI Chat Completions 의 {@code tools} 항목 하나. */
	static Map<String, Object> tool() {
		return Map.of(
				"type",
				"function",
				"function",
				Map.of(
						"name",
						FUNCTION_NAME,
						"description",
						"인계 원문에서 확인한 어르신별 카드 항목을 넘긴다. 원문에서 근거를 그대로 뽑을 수 없는 항목은 넘기지 않는다.",
						"strict",
						true,
						"parameters",
						parameters()));
	}

	private static Map<String, Object> parameters() {
		return object(
				Map.of(
						CARDS_PROPERTY,
						Map.of(
								"type", "array",
								"description", "확인한 카드 항목. 남길 것이 없으면 빈 배열",
								"items", card())),
				List.of(CARDS_PROPERTY));
	}

	private static Map<String, Object> card() {
		Map<String, Object> properties = new LinkedHashMap<>();
		properties.put(
				RECIPIENT_PROPERTY,
				nullableString("대상 어르신의 내부 ID. 후보 목록에 있는 ID만 쓴다. 누구인지 가릴 수 없으면 null"));
		properties.put("statusChange", nullableString("어르신 상태가 어떻게 달라졌는지. 없으면 null"));
		properties.put("actionTaken", nullableString("현장에서 이미 한 조치. 없으면 null"));
		properties.put("nextAction", nullableString("아직 남아 있는 다음 행동. 없으면 null"));
		properties.put(
				EVIDENCE_PROPERTY,
				Map.of(
						"type", "string",
						"description", "이 항목의 근거가 된 원문 구간. 원문에 있는 글자를 그대로 옮긴다. 요약하거나 다듬지 않는다"));
		properties.put(
				"suggestedJobRole",
				Map.of(
						"type", "string",
						"description", "다음 행동의 제안 담당 직종. 판단할 근거가 부족하면 " + UNKNOWN_JOB_ROLE,
						"enum", jobRoleNames()));
		properties.put("suggestedDueTime", nullableString("다음 행동의 제안 기한. 당일 HH:MM. 다음 행동이 없으면 null"));
		properties.put("observedTime", nullableString("상황이 있었던 시각. 당일 HH:MM. 원문에서 알 수 없으면 null"));
		properties.put(
				"safetyCategory",
				Map.of(
						"type", "string",
						"description", "지정 안전 키워드 중 해당하는 것. 없으면 " + NO_SAFETY_CATEGORY,
						"enum", safetyCategoryNames()));
		properties.put(
				SUGGESTED_ACTIONS_PROPERTY,
				Map.of(
						"type", "array",
						"description",
								"조치·다음 행동 칸에 원클릭으로 채울 짧은 추천 문구. 최대 " + SUGGESTED_ACTIONS_LIMIT
										+ "개. 근거를 원문에서 그대로 옮길 수 없으면 만들지 않는다. 제안할 것이 없으면 빈 배열",
						"maxItems", SUGGESTED_ACTIONS_LIMIT,
						"items", suggestedAction()));

		return object(properties, List.copyOf(properties.keySet()));
	}

	private static Map<String, Object> suggestedAction() {
		Map<String, Object> properties = new LinkedHashMap<>();
		properties.put(
				"targetField",
				Map.of(
						"type", "string",
						"description", "이 문구를 채울 칸. 조치면 ACTION_TAKEN, 다음 행동이면 NEXT_ACTION",
						"enum", TARGET_FIELDS));
		properties.put(
				"text",
				Map.of(
						"type", "string",
						"description", "탭하면 해당 칸에 그대로 채워질 짧은 문장. 요약하지 않고 실행할 수 있는 말로 적는다"));
		properties.put(
				EVIDENCE_PROPERTY,
				Map.of(
						"type", "string",
						"description", "이 추천의 근거가 된 원문 구간. 원문에 있는 글자를 그대로 옮긴다"));

		return object(properties, List.copyOf(properties.keySet()));
	}

	/**
	 * {@code strict} 모드는 모든 속성이 {@code required} 에 있어야 한다.
	 *
	 * <p>그래서 "값이 없을 수 있음"은 필드를 빼는 방식이 아니라 {@code null} 을 허용하는 타입으로 표현한다.
	 */
	private static Map<String, Object> object(Map<String, Object> properties, List<String> required) {
		return Map.of(
				"type", "object",
				"properties", properties,
				"required", required,
				"additionalProperties", false);
	}

	private static Map<String, Object> nullableString(String description) {
		return Map.of("type", List.of("string", "null"), "description", description);
	}

	static List<String> jobRoleNames() {
		return Stream.concat(Arrays.stream(JobRole.values()).map(Enum::name), Stream.of(UNKNOWN_JOB_ROLE))
				.toList();
	}

	static List<String> safetyCategoryNames() {
		return Stream.concat(
						Arrays.stream(SafetyKeyword.values()).map(Enum::name), Stream.of(NO_SAFETY_CATEGORY))
				.toList();
	}

	static String systemPrompt() {
		return """
				당신은 주간보호센터의 인계 원문을 정리하는 도구다. 원문에 적힌 것만 옮기고, 판단을 보태지 않는다.

				지켜야 할 규칙:
				1. 원문에 없는 사실을 만들지 않는다. 짐작해서 채우지 않는다.
				2. 의료적 판단·진단·투약 권고를 만들지 않는다. 증상의 원인을 추정하거나 약을 바꾸라고 쓰지 않는다.
				   원문에 적힌 상태와 이미 한 조치를 그대로 옮기는 데서 멈춘다.
				3. 모든 항목은 evidenceText 를 가진다. 원문에 있는 글자를 그대로 옮겨 적는다.
				   요약하거나 말을 다듬으면 안 된다. 그대로 옮길 구간을 찾을 수 없으면 그 항목을 아예 만들지 않는다.
				4. 원문에서 어르신은 이름이 아니라 내부 ID로 적혀 있다. 그 ID를 사람 이름처럼 다룬다.
				   어르신이 여러 명 섞여 있으면 사람 수만큼 항목을 나눈다.
				   %s 는 후보 목록에 있는 ID만 쓴다. 목록에 없는 ID를 새로 만들지 않는다.
				   내부 ID를 사람 이름으로 바꿔 적지 않는다. 원문에 적힌 ID 표기를 그대로 옮긴다.
				   누구 이야기인지 원문으로 가릴 수 없으면 %s 를 null 로 둔다. 아무나 골라 넣지 않는다.
				5. 하나의 항목은 한 가지 일을 담는다. 서로 다른 일은 항목을 나눈다.
				6. 다음 행동이 있으면 담당 직종과 기한을 제안한다.
				   투약·바이탈 확인은 NURSE_AIDE, 보호자 연락·상담은 SOCIAL_WORKER, 등하원·송영은 DRIVER,
				   그 외 일상 돌봄은 CAREGIVER 로 본다.
				   어느 쪽인지 판단할 근거가 원문에 없으면 %s 로 둔다. 억지로 고르지 않는다.
				7. 다음 행동이 없으면 suggestedJobRole 은 %s, suggestedDueTime 은 null 이다.
				8. 낙상·발열·식사 저하·투약 변경에 해당하는 내용이면 safetyCategory 를 그 범주로 표시한다.
				   표현이 달라도 뜻이 같으면 해당한다. 예를 들어 "미끄러지실 뻔했다"는 FALL,
				   "점심을 거의 안 드셨다"는 POOR_INTAKE 다. 어디에도 해당하지 않으면 %s 다.
				9. 남길 것이 없으면 빈 배열을 넘긴다. 억지로 채우지 않는다.
				10. 원문이 "체크 항목: ..." 형태일 수 있다. 이는 직원이 사전 정의된 관찰 항목을 선택한 것이다.
				    체크 항목은 그 자체가 관찰된 상태 변화(statusChange)다. evidenceText 에는 원문을 그대로 옮기고,
				    statusChange 에 해당 항목을 적는다. actionTaken 과 nextAction 은 원문에 없으면 null 로 둔다.
				11. suggestedActions 는 조치·다음 행동 칸에 직원이 한 번 탭해서 채울 수 있는 짧은 문구를 최대 %d개까지 제안한다.
				    상태 변화만 말하고 조치나 다음 행동을 말하지 않은 발화에서 특히 도움이 된다.
				    각 제안은 targetField 로 채울 칸(ACTION_TAKEN 또는 NEXT_ACTION)을 정하고, evidenceText 로 원문 근거를
				    반드시 남긴다. 근거가 되는 구간을 원문에서 그대로 옮길 수 없으면 그 제안을 만들지 않는다.
				    이미 만든 statusChange·actionTaken·nextAction 을 요약하거나 반복하지 않는다. 원문에 없는 조치나 일정을
				    지어내지 않는다. 제안할 것이 없으면 빈 배열을 넘긴다.
				"""
				.formatted(
						RECIPIENT_PROPERTY,
						RECIPIENT_PROPERTY,
						UNKNOWN_JOB_ROLE,
						UNKNOWN_JOB_ROLE,
						NO_SAFETY_CATEGORY,
						SUGGESTED_ACTIONS_LIMIT);
	}

	/**
	 * 나가는 값은 전부 내부 ID다. <b>실명은 이 문자열 어디에도 없다.</b>
	 *
	 * <p>후보 목록이 특히 중요하다. 예전에는 매 호출마다 명단 전체의 실명이 여기 실려 나갔다. 지금은 같은 자리에 내부 ID 목록이 들어간다. 원문도
	 * 치환이 끝난 것을 받는다. ({@link StructuringInput#maskedRawText()})
	 */
	static String userPrompt(StructuringInput input) {
		String methodLine = (input.inputMethod() != null && !input.inputMethod().isBlank())
				? "\n입력 방식: " + input.inputMethod()
				: "";

		return """
				어르신 후보 목록(내부 ID): %s
				입력할 때 직원이 고른 어르신(내부 ID): %s
				입력 시각: %s%s

				원문:
				%s
				"""
				.formatted(
						String.join(", ", input.candidateRecipientCodes()),
						input.selectedRecipientCode(),
						input.occurredAt().format(TIME),
						methodLine,
						input.maskedRawText());
	}
}

