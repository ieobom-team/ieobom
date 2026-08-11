package com.ieobom.api.common;

/** 지금 상태에서는 할 수 없는 요청일 때. {@code 409 Conflict} 로 바뀐다. */
public class ConflictException extends RuntimeException {

	private final String code;

	public ConflictException(String code, String message) {
		super(message);
		this.code = code;
	}

	public String getCode() {
		return code;
	}
}
