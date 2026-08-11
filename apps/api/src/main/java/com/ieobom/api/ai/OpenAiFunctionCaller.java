package com.ieobom.api.ai;

import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.ObjectMapper;

/**
 * OpenAI Chat Completions 의 Function Calling 호출부.
 *
 * <p>구조화와 문구 생성이 같은 방식으로 모델을 부른다. {@code tool_choice} 로 함수 호출을 고정해 모델이 자유 텍스트로 답할 수 없게 하고, 응답은
 * 함수 인자 JSON 하나만 읽는다. <b>무엇을 요청하고 무엇을 받을지는 각 스키마가 정하고, 여기서는 부르는 방법만 정한다.</b>
 *
 * <p>여기서 <b>버리는 판단을 하지 않는다.</b> 받은 것을 그대로 옮기고, 무엇을 폐기할지는 각 검증기가 정한다. 판정이 여러 곳에 흩어지면 "근거 없는 것은
 * 나가지 않는다"를 한 곳에서 증명할 수 없게 된다.
 */
@Slf4j
@Component
class OpenAiFunctionCaller {

	private static final String COMPLETIONS_PATH = "/chat/completions";

	private final RestClient restClient;
	private final LlmProperties properties;
	private final ObjectMapper objectMapper;

	OpenAiFunctionCaller(
			RestClient llmRestClient, LlmProperties properties, ObjectMapper objectMapper) {
		this.restClient = llmRestClient;
		this.properties = properties;
		this.objectMapper = objectMapper;
	}

	/**
	 * 함수 호출 인자를 {@code type} 으로 읽어 돌려준다.
	 *
	 * @throws LlmUnavailableException 키가 없거나, 호출이 실패했거나, 응답이 스키마에 맞지 않을 때
	 */
	<T> T call(FunctionCall request, Class<T> type) {
		if (!properties.hasApiKey()) {
			throw new LlmUnavailableException(
					"LLM_API_KEY 가 설정되지 않아 %s 을(를) 수행할 수 없습니다.".formatted(request.purpose()), null);
		}

		String raw = post(request);
		ChatResponse response =
				read(raw, ChatResponse.class, "%s 응답을 읽지 못했습니다.".formatted(request.purpose()));

		String arguments = functionArguments(response, request.purpose());
		return read(
				arguments, type, "%s 응답을 스키마대로 읽지 못했습니다.".formatted(request.purpose()));
	}

	private String post(FunctionCall request) {
		Map<String, Object> body =
				Map.of(
						"model",
						properties.model(),
						"messages",
						List.of(
								Map.of("role", "system", "content", request.systemPrompt()),
								Map.of("role", "user", "content", request.userPrompt())),
						"tools",
						List.of(request.tool()),
						"tool_choice",
						Map.of(
								"type", "function",
								"function", Map.of("name", request.functionName())),
						// 같은 입력이 매번 다르게 갈리면 직원이 결과를 믿기 어렵다.
						"temperature",
						0);

		try {
			return restClient
					.post()
					.uri(COMPLETIONS_PATH)
					.header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.bearerToken())
					.contentType(MediaType.APPLICATION_JSON)
					.body(body)
					.retrieve()
					.body(String.class);
		} catch (RestClientResponseException e) {
			// 거부 이유는 응답 본문에 있다. 이게 없으면 키 문제인지 모델 이름 문제인지 구분할 수 없다.
			// 본문에는 우리가 보낸 원문이 들어가지 않는다. 키는 제공자가 가려서 돌려준다.
			log.error(
					"{} 요청이 거부되었습니다 — status={}, model={}, body={}",
					request.purpose(),
					e.getStatusCode(),
					properties.model(),
					e.getResponseBodyAsString());
			throw new LlmUnavailableException(
					"%s 요청이 거부되었습니다. 설정을 확인해 주세요.".formatted(request.purpose()), e);
		} catch (Exception e) {
			throw new LlmUnavailableException(
					"%s 요청이 실패했습니다. 잠시 후 다시 시도해 주세요.".formatted(request.purpose()), e);
		}
	}

	private String functionArguments(ChatResponse response, String purpose) {
		if (response == null || response.choices() == null || response.choices().isEmpty()) {
			throw new LlmUnavailableException("%s 응답이 비어 있습니다.".formatted(purpose), null);
		}
		ChatMessage message = response.choices().get(0).message();
		if (message == null || message.tool_calls() == null || message.tool_calls().isEmpty()) {
			throw new LlmUnavailableException("%s 응답에 함수 호출이 없습니다.".formatted(purpose), null);
		}
		ToolCallFunction function = message.tool_calls().get(0).function();
		if (function == null || function.arguments() == null || function.arguments().isBlank()) {
			throw new LlmUnavailableException("%s 응답의 함수 인자가 비어 있습니다.".formatted(purpose), null);
		}
		return function.arguments();
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

	/**
	 * 호출 한 번에 필요한 것.
	 *
	 * @param purpose 실패 메시지와 로그에 쓸 이름. 직원에게 "무엇이" 안 됐는지 말해 주는 값이다
	 * @param functionName {@code tool_choice} 로 고정할 함수 이름. {@code tool} 안의 이름과 같아야 한다
	 */
	record FunctionCall(
			String purpose,
			String functionName,
			Map<String, Object> tool,
			String systemPrompt,
			String userPrompt) {}

	// 아래 네 개는 OpenAI 응답 본문을 그대로 옮긴 것이다.
	// 필드 이름을 JSON 키와 똑같이 두어 이름 매핑 설정 없이 읽는다.

	record ChatResponse(List<ChatChoice> choices) {}

	record ChatChoice(ChatMessage message) {}

	record ChatMessage(List<ToolCall> tool_calls) {}

	record ToolCall(ToolCallFunction function) {}

	record ToolCallFunction(String name, String arguments) {}
}
