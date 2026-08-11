package com.ieobom.api.export;

import com.ieobom.api.ai.ExportInput;
import com.ieobom.api.ai.ExportPhraseClient;
import com.ieobom.api.ai.ExportPhraseDraft;
import com.ieobom.api.ai.LlmUnavailableException;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/**
 * 실제 호출 없이 문구 응답을 흉내 낸다.
 *
 * <p>API 테스트가 확인하려는 것은 "AI 가 무엇을 주면 무엇이 저장되고 무엇이 안내되는가"이지 "AI 가 문장을 잘 쓰는가"가 아니다. 뒤쪽은 {@code
 * OpenAiExportPhraseLiveTest} 가 실호출로 확인한다.
 *
 * <p>호출 횟수를 세는 이유는 <b>이미 만들어 둔 문구가 있으면 모델을 다시 부르지 않는다</b>를 확인해야 하기 때문이다. 이 규칙이 깨지면 직원이 고쳐 둔
 * 문구가 화면을 다시 여는 것만으로 덮어써진다.
 */
public class StubExportPhraseClient implements ExportPhraseClient {

	private ExportPhraseDraft nextDraft = new ExportPhraseDraft("", "");
	private boolean unavailable;
	private int callCount;
	private ExportInput lastInput;

	public void willReturn(String recordPhrase, String guardianPhrase) {
		this.nextDraft = new ExportPhraseDraft(recordPhrase, guardianPhrase);
		this.unavailable = false;
	}

	public void willFail() {
		this.unavailable = true;
	}

	public void reset() {
		this.nextDraft = new ExportPhraseDraft("", "");
		this.unavailable = false;
		this.callCount = 0;
		this.lastInput = null;
	}

	public int callCount() {
		return callCount;
	}

	public ExportInput lastInput() {
		return lastInput;
	}

	@Override
	public ExportPhraseDraft generate(ExportInput input) {
		callCount++;
		lastInput = input;
		if (unavailable) {
			throw new LlmUnavailableException("문구 생성 요청이 실패했습니다. 잠시 후 다시 시도해 주세요.", null);
		}
		return nextDraft;
	}

	@TestConfiguration
	public static class Config {

		/** 실제 구현도 빈으로 떠 있으므로 {@code @Primary} 로 이쪽을 고르게 한다. */
		@Bean
		@Primary
		public StubExportPhraseClient stubExportPhraseClient() {
			return new StubExportPhraseClient();
		}
	}
}
