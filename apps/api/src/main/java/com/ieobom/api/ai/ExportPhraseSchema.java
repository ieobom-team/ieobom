package com.ieobom.api.ai;

import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 문구 생성 응답에 강제할 JSON 스키마와 프롬프트.
 *
 * <p>{@link HandoverStructuringSchema} 와 같은 방식이다. {@code strict} 와 {@code additionalProperties:
 * false} 를 함께 걸어 <b>두 문구 말고는 아무것도 만들 수 없게</b> 한다. 모델이 "참고 사항"이나 "권고"를 덧붙일 자리를 아예 두지 않는 것이 여기서는
 * 특히 중요하다. 그 자리가 있으면 의료적 판단이 그리로 들어온다.
 *
 * <p><b>말투와 길이 기준은 Manyfast 에 없다.</b> 아래 값은 구현이 정한 잠정 기준이고, 정책으로 굳으면 {@code propose-change} 로
 * Manyfast 에 올린 뒤 여기를 고친다. ({@code docs/contracts/export-api.md})
 */
final class ExportPhraseSchema {

	static final String FUNCTION_NAME = "save_export_phrases";
	static final String RECORD_PROPERTY = "recordPhrase";
	static final String GUARDIAN_PROPERTY = "guardianPhrase";

	/** 잠정 기준. 전산 기록은 경위가 남아야 해서 보호자 문구보다 길게 잡는다. */
	private static final int RECORD_LIMIT = 300;

	private static final int GUARDIAN_LIMIT = 200;

	private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

	private ExportPhraseSchema() {}

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
						"검토 완료된 인계 카드 한 장을 전산 기록 문구와 보호자 전달 문구로 정리해 넘긴다. 카드에 없는 내용은 넣지 않는다.",
						"strict",
						true,
						"parameters",
						parameters()));
	}

	private static Map<String, Object> parameters() {
		Map<String, Object> properties = new LinkedHashMap<>();
		properties.put(
				RECORD_PROPERTY,
				Map.of(
						"type", "string",
						"description",
								"장기요양 전산에 붙여넣을 서술형 기록. 담을 내용이 없으면 빈 문자열. %d자 이내".formatted(RECORD_LIMIT)));
		properties.put(
				GUARDIAN_PROPERTY,
				Map.of(
						"type", "string",
						"description",
								"보호자에게 전할 문구. 담을 내용이 없으면 빈 문자열. %d자 이내".formatted(GUARDIAN_LIMIT)));

		return Map.of(
				"type", "object",
				"properties", properties,
				"required", List.copyOf(properties.keySet()),
				"additionalProperties", false);
	}

	static String systemPrompt() {
		return """
				당신은 주간보호센터 직원이 검토를 마친 인계 카드 한 장을 두 가지 문구로 옮겨 적는 도구다.
				직원이 읽고 고친 뒤 직접 복사해서 쓴다. 당신이 보내는 것이 아니다.

				지켜야 할 규칙:
				1. 아래에 주어진 카드 내용에 있는 것만 쓴다. 카드에 없는 사실을 채우지 않는다.
				   카드에 없는 숫자, 체온, 횟수, 시각, 사람 이름을 새로 만들지 않는다.
				2. 의료적 판단·진단·투약 권고를 쓰지 않는다.
				   증상의 원인을 추정하거나, 약을 바꾸라거나, 병원에 가라고 쓰지 않는다.
				   카드에 적힌 상태와 이미 한 조치를 옮기는 데서 멈춘다.
				3. 두 문구는 같은 사실을 담되 읽는 사람이 다르다.
				   %s: 전산에 붙여넣을 기록이다. 기록체로 쓴다. ("~함", "~하심")
					 시각이 주어졌으면 함께 적는다. 상태 변화, 조치, 남은 다음 행동 순서로 적는다. %d자 이내.
				   %s: 보호자가 읽는 문구다. 존댓말로 짧고 담담하게 쓴다. ("~하셨습니다")
					 겁을 주거나 안심시키는 말을 덧붙이지 않는다. 센터가 이미 한 조치를 알려 주는 데서 멈춘다. %d자 이내.
				4. 카드에 담긴 내용이 없어 옮겨 적을 것이 없으면 빈 문자열을 넘긴다. 억지로 채우지 않는다.
				"""
				.formatted(RECORD_PROPERTY, RECORD_LIMIT, GUARDIAN_PROPERTY, GUARDIAN_LIMIT);
	}

	static String userPrompt(ExportInput input) {
		return """
				어르신: %s
				시각: %s
				상태 변화: %s
				이미 한 조치: %s
				남은 다음 행동: %s
				근거 원문: %s
				"""
				.formatted(
						blankToMark(input.careRecipientName()),
						input.observedAt() == null ? "기록 없음" : input.observedAt().format(TIME),
						blankToMark(input.statusChange()),
						blankToMark(input.actionTaken()),
						blankToMark(input.nextAction()),
						blankToMark(input.evidenceText()));
	}

	/** 빈 칸을 빈 줄로 두면 모델이 그 자리를 스스로 채우려 든다. "없음"이라고 못 박는다. */
	private static String blankToMark(String value) {
		return value == null || value.isBlank() ? "없음" : value;
	}
}
