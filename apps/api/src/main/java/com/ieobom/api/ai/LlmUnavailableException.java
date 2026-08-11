package com.ieobom.api.ai;

import com.ieobom.api.common.ServiceUnavailableException;

/**
 * 구조화를 지금 수행할 수 없을 때. {@code 503} 으로 나간다.
 *
 * <p>키 미설정, 호출 실패, 스키마에 맞지 않는 응답이 모두 여기로 모인다. 셋 다 "직원이 입력을 고쳐서 해결할 수 없는 문제"라는 점이 같고, 어느 쪽이든
 * 카드를 만들지 않는 결과가 되어야 한다. 반쯤 만들어진 카드를 남기는 것이 가장 나쁘다.
 */
public class LlmUnavailableException extends ServiceUnavailableException {

	static final String CODE = "LLM_UNAVAILABLE";

	public LlmUnavailableException(String message, Throwable cause) {
		super(CODE, message, cause);
	}
}
