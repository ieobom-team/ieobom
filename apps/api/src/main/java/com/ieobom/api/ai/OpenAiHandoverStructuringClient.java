package com.ieobom.api.ai;

import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.ObjectMapper;

/**
 * OpenAI Chat Completions 로 구조화한다.
 *
 * <p>{@code tool_choice} 로 함수 호출을 강제하므로 모델이 자유 텍스트로 답할 수 없다. 응답은 함수 인자 JSON 하나뿐이고, 그 모양은
 * {@link HandoverStructuringSchema} 가 정한다.
 *
 * <p>여기서는 <b>버리는 판단을 하지 않는다.</b> 받은 항목을 그대로 초안으로 옮기고, 무엇을 폐기할지는 {@code CardDraftVerifier} 가 정한다.
 * 판정이 두 곳에 흩어지면 "근거 없는 항목은 나가지 않는다"를 한 곳에서 증명할 수 없게 된다.
 */
@Slf4j
@Component
class OpenAiHandoverStructuringClient implements HandoverStructuringClient {

	private static final String COMPLETIONS_PATH = "/chat/completions";

	private final RestClient restClient;
	private final LlmProperties properties;
	private final ObjectMapper objectMapper;

	OpenAiHandoverStructuringClient(
			RestClient llmRestClient, LlmProperties properties, ObjectMapper objectMapper) {
		this.restClient = llmRestClient;
		this.properties = properties;
		this.objectMapper = objectMapper;
	}

	@Override
	public List<StructuredCardDraft> structure(StructuringInput input) {
		if (!properties.hasApiKey()) {
			throw new LlmUnavailableException("LLM_API_KEY 가 설정되지 않아 구조화를 수행할 수 없습니다.", null);
		}

		String arguments = callFunction(input);
		CardsEnvelope envelope = parse(arguments);

		List<StructuredCardDraft> cards = envelope.cards() == null ? List.of() : envelope.cards();
		log.debug("구조화 응답 — 항목 {}개", cards.size());
		return cards;
	}

	/** 함수 호출 인자 JSON 문자열을 받아 온다. */
	private String callFunction(StructuringInput input) {
		Map<String, Object> body =
				Map.of(
						"model",
						properties.model(),
						"messages",
						List.of(
								Map.of("role", "system", "content", HandoverStructuringSchema.systemPrompt()),
								Map.of("role", "user", "content", HandoverStructuringSchema.userPrompt(input))),
						"tools",
						List.of(HandoverStructuringSchema.tool()),
						"tool_choice",
						Map.of(
								"type",
								"function",
								"function",
								Map.of("name", HandoverStructuringSchema.FUNCTION_NAME)),
						// 같은 원문이 매번 다르게 갈리면 직원이 결과를 믿기 어렵다.
						"temperature",
						0);

		String raw;
		try {
			raw =
					restClient
							.post()
							.uri(COMPLETIONS_PATH)
							.header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.apiKey())
							.contentType(MediaType.APPLICATION_JSON)
							.body(body)
							.retrieve()
							.body(String.class);
		} catch (Exception e) {
			throw new LlmUnavailableException("구조화 요청이 실패했습니다. 잠시 후 다시 시도해 주세요.", e);
		}

		return functionArguments(read(raw, ChatResponse.class, "구조화 응답을 읽지 못했습니다."));
	}

	private String functionArguments(ChatResponse response) {
		if (response == null || response.choices() == null || response.choices().isEmpty()) {
			throw new LlmUnavailableException("구조화 응답이 비어 있습니다.", null);
		}
		ChatMessage message = response.choices().get(0).message();
		if (message == null || message.tool_calls() == null || message.tool_calls().isEmpty()) {
			throw new LlmUnavailableException("구조화 응답에 함수 호출이 없습니다.", null);
		}
		ToolCallFunction function = message.tool_calls().get(0).function();
		if (function == null || function.arguments() == null || function.arguments().isBlank()) {
			throw new LlmUnavailableException("구조화 응답의 함수 인자가 비어 있습니다.", null);
		}
		return function.arguments();
	}

	private CardsEnvelope parse(String arguments) {
		return read(arguments, CardsEnvelope.class, "구조화 응답을 스키마대로 읽지 못했습니다.");
	}

	/** 실패해도 본문을 예외 메시지에 싣지 않는다. 응답에는 어르신 정보가 들어 있다. */
	private <T> T read(String json, Class<T> type, String message) {
		if (json == null || json.isBlank()) {
			throw new LlmUnavailableException(message, null);
		}
		try {
			return objectMapper.readValue(json, type);
		} catch (Exception e) {
			log.error("{}", message, e);
			throw new LlmUnavailableException(message, e);
		}
	}

	/** 함수 인자의 최상위 모양. {@link HandoverStructuringSchema#CARDS_PROPERTY} 와 이름이 같아야 한다. */
	record CardsEnvelope(List<StructuredCardDraft> cards) {}

	// 아래 네 개는 OpenAI 응답 본문을 그대로 옮긴 것이다.
	// 필드 이름을 JSON 키와 똑같이 두어 이름 매핑 설정 없이 읽는다.

	record ChatResponse(List<ChatChoice> choices) {}

	record ChatChoice(ChatMessage message) {}

	record ChatMessage(List<ToolCall> tool_calls) {}

	record ToolCall(ToolCallFunction function) {}

	record ToolCallFunction(String name, String arguments) {}
}
