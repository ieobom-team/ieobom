package com.ieobom.api.ai;

import java.time.Duration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * LLM 호출용 {@link RestClient}.
 *
 * <p>추상화 라이브러리를 쓰지 않고 직접 호출한다. 해커톤 기간에는 요청 본문과 응답을 눈으로 확인할 수 있는 쪽이 디버깅이 빠르다.
 * ({@code docs/architecture.md})
 *
 * <p>응답은 문자열로 받아 애플리케이션의 {@code ObjectMapper} 로 직접 읽는다. 이렇게 해 두면 이 클라이언트의 JSON 처리 방식이 웹 계층
 * 설정과 무관하게 고정된다. OpenAI 응답에는 우리가 쓰지 않는 필드가 계속 늘어나는데, 그때마다 파싱이 깨지면 안 된다.
 */
@Configuration
@EnableConfigurationProperties(LlmProperties.class)
class LlmClientConfig {

	/** 연결 자체가 안 되는 상황을 오래 붙들고 있을 이유가 없다. 응답 대기만 설정으로 늘린다. */
	private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);

	@Bean
	RestClient llmRestClient(LlmProperties properties) {
		SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
		requestFactory.setConnectTimeout(CONNECT_TIMEOUT);
		requestFactory.setReadTimeout(properties.timeout());

		return RestClient.builder()
				.baseUrl(properties.baseUrl())
				.requestFactory(requestFactory)
				.build();
	}
}
