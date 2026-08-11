package com.ieobom.api.handovercard;

import com.ieobom.api.ai.HandoverStructuringClient;
import com.ieobom.api.ai.StructuredCardDraft;
import com.ieobom.api.ai.StructuringInput;
import java.util.List;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/**
 * 실제 호출 없이 AI 응답을 흉내 낸다.
 *
 * <p>API 테스트가 확인하려는 것은 "AI 가 무엇을 주면 무엇이 저장되는가"이지 "AI 가 잘 정리하는가"가 아니다. 뒤쪽은 {@code
 * OpenAiStructuringLiveTest} 가 실호출로 확인한다.
 */
public class StubStructuringClient implements HandoverStructuringClient {

	private List<StructuredCardDraft> nextDrafts = List.of();
	private StructuringInput lastInput;

	public void willReturn(List<StructuredCardDraft> drafts) {
		this.nextDrafts = drafts;
	}

	public StructuringInput lastInput() {
		return lastInput;
	}

	@Override
	public List<StructuredCardDraft> structure(StructuringInput input) {
		this.lastInput = input;
		return nextDrafts;
	}

	@TestConfiguration
	public static class Config {

		/** 실제 구현도 빈으로 떠 있으므로 {@code @Primary} 로 이쪽을 고르게 한다. */
		@Bean
		@Primary
		public StubStructuringClient stubStructuringClient() {
			return new StubStructuringClient();
		}
	}
}
