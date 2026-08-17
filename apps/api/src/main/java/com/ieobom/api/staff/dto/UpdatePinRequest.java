package com.ieobom.api.staff.dto;

import jakarta.validation.constraints.Pattern;

/**
 * PIN 신규 등록, 변경 또는 해제 요청.
 *
 * <p>기존에 PIN 이 설정되어 있는 경우 {@code currentPin} 검증을 거친다.
 *
 * <p>{@code newPin} 에 null 또는 빈 문자열을 전달하면 PIN 을 해제한다.
 *
 * @param currentPin 현재 PIN (기존 PIN 이 설정되어 있는 경우 필수)
 * @param newPin 새 4~6자리 숫자 PIN (해제 시 null 또는 빈 문자열)
 */
public record UpdatePinRequest(
		String currentPin,
		@Pattern(regexp = "^$|^[0-9]{4,6}$", message = "PIN은 4~6자리 숫자여야 합니다.")
		String newPin) {}
