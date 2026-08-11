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
		this(reason, List.of(field));
	}

	/**
	 * 여러 항목이 함께 걸리는 규칙일 때. (예: 셋 중 하나는 남겨야 한다)
	 *
	 * <p>어느 한 항목만 지목하면 화면이 엉뚱한 칸에 안내를 붙인다. 규칙에 걸린 항목을 모두 담아 같은 이유를 붙인다.
	 */
	public RequestValidationException(String reason, List<String> fields) {
		super("%s: %s".formatted(String.join(", ", fields), reason));
		this.fields = fields.stream().map(field -> new FieldError(field, reason)).toList();
	}

	public List<FieldError> getFields() {
		return fields;
	}
}
