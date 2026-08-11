package com.ieobom.api.common;

/** 요청이 가리킨 대상이 없을 때. {@code 404 Not Found} 로 바뀐다. */
public class NotFoundException extends RuntimeException {

	private final String code;

	public NotFoundException(String code, String message) {
		super(message);
		this.code = code;
	}

	public String getCode() {
		return code;
	}
}
