package com.ieobom.api.staff.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * PIN 일치 여부 검증 요청.
 *
 * @param pin 4~6자리 숫자 PIN
 */
public record VerifyPinRequest(
		@NotBlank(message = "PIN을 입력해 주세요.")
		@Pattern(regexp = "^[0-9]{4,6}$", message = "PIN은 4~6자리 숫자여야 합니다.")
		String pin) {}
