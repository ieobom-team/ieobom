package com.ieobom.api.handover;

import com.ieobom.api.ai.LlmUnavailableException;
import com.ieobom.api.ai.TranscriptionClient;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/**
 * 실제 호출 없이 음성 인식 결과를 흉내 낸다.
 *
 * <p>API 테스트가 확인하려는 것은 "인식이 무엇을 주면 화면에 무엇이 나가는가"이지 "인식이 정확한가"가 아니다. 뒤쪽은 실기기 배포 뒤에만 확인할 수
 * 있다. (#147)
 */
public class StubTranscriptionClient implements TranscriptionClient {

	private String nextText = "";
	private RuntimeException nextFailure;
	private String lastMimeType;
	private byte[] lastData;

	public void willReturn(String text) {
		this.nextText = text;
		this.nextFailure = null;
	}

	/** 키가 없거나 제공자가 거부한 상황. 화면은 이때도 원본 음성을 잃지 않아야 한다. */
	public void willFail() {
		this.nextFailure = new LlmUnavailableException("음성을 글로 바꾸기 요청이 실패했습니다.", null);
	}

	public String lastMimeType() {
		return lastMimeType;
	}

	public byte[] lastData() {
		return lastData;
	}

	@Override
	public String transcribe(String mimeType, byte[] data) {
		this.lastMimeType = mimeType;
		this.lastData = data;
		if (nextFailure != null) {
			throw nextFailure;
		}
		return nextText;
	}

	@TestConfiguration
	public static class Config {

		/** 실제 구현도 빈으로 떠 있으므로 {@code @Primary} 로 이쪽을 고르게 한다. */
		@Bean
		@Primary
		public StubTranscriptionClient stubTranscriptionClient() {
			return new StubTranscriptionClient();
		}
	}
}
