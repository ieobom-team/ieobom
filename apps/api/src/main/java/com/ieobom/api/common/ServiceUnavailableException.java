package com.ieobom.api.common;

/**
 * 바깥 의존성이 지금 응답하지 못할 때. {@code 503 Service Unavailable} 로 바뀐다.
 *
 * <p>사용자가 입력을 고쳐서 해결할 수 있는 문제가 아니므로 보완 항목({@code fields})을 만들지 않는다.
 */
public class ServiceUnavailableException extends RuntimeException {

	private final String code;

	public ServiceUnavailableException(String code, String message, Throwable cause) {
		super(message, cause);
		this.code = code;
	}

	public String getCode() {
		return code;
	}
}
