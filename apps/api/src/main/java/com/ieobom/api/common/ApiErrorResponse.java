package com.ieobom.api.common;

import java.util.List;

/**
 * 모든 API 가 공유하는 오류 응답 형태.
 *
 * <p>{@code fields} 는 사용자가 무엇을 보완해야 하는지 항목 단위로 알려 준다. 돌봄 중인 근무자에게 "저장에 실패했습니다" 한 줄만 주면 무엇을 고쳐야
 * 할지 알 수 없으므로, 누락된 항목을 전부 모아 한 번에 내려준다.
 *
 * @param code 기계가 분기할 수 있는 오류 코드
 * @param message 사람이 읽는 한 줄 안내
 * @param fields 보완해야 할 항목. 항목을 특정할 수 없는 오류면 빈 목록이다
 */
public record ApiErrorResponse(String code, String message, List<FieldError> fields) {

	/**
	 * 보완해야 할 항목 하나.
	 *
	 * @param field 요청 필드 이름
	 * @param reason 그 필드를 어떻게 고쳐야 하는지
	 */
	public record FieldError(String field, String reason) {}

	public static ApiErrorResponse of(String code, String message) {
		return new ApiErrorResponse(code, message, List.of());
	}
}
