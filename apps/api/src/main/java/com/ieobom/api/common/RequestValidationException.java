package com.ieobom.api.common;

import com.ieobom.api.common.ApiErrorResponse.FieldError;
import java.util.List;

/**
 * 애너테이션 하나로 표현할 수 없는 입력 규칙을 어겼을 때. {@code 400 Bad Request} 로 바뀐다.
 *
 * <p>필드 사이의 관계를 보는 규칙(예: 대리 입력이면 정보 출처가 있어야 한다)이 여기 해당한다. 어느 항목을 보완해야 하는지 그대로 담아 던진다.
 */
public class RequestValidationException extends RuntimeException {

	private final transient List<FieldError> fields;

	public RequestValidationException(String field, String reason) {
		super("%s: %s".formatted(field, reason));
		this.fields = List.of(new FieldError(field, reason));
	}

	public List<FieldError> getFields() {
		return fields;
	}
}
