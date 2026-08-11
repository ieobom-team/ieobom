package com.ieobom.api.ai;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * LLM 호출 설정.
 *
 * <p>{@code apiKey} 는 코드와 yml 에 적지 않고 환경변수 {@code LLM_API_KEY} 로만 들어온다. 값이 비어 있어도 애플리케이션은 기동된다.
 * 키 없이 뜨지 못하면 CI 와 다른 개발자 로컬에서 테스트가 전부 막힌다. 대신 실제 호출 시점에 {@link LlmUnavailableException} 을 던진다.
 *
 * @param baseUrl OpenAI 호환 엔드포인트의 루트
 * @param model 사용할 모델 이름
 * @param apiKey 비밀값. 로그나 응답에 절대 싣지 않는다
 * @param timeout 응답 대기 한도
 */
@ConfigurationProperties(prefix = "ieobom.llm")
public record LlmProperties(
		@DefaultValue("https://api.openai.com/v1") String baseUrl,
		@DefaultValue("gpt-4.1-mini") String model,
		@DefaultValue("") String apiKey,
		@DefaultValue("60s") Duration timeout) {

	public boolean hasApiKey() {
		return apiKey != null && !apiKey.isBlank();
	}
}
