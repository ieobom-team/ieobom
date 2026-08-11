package com.ieobom.api.handovercard.dto;

import jakarta.validation.constraints.NotNull;

/**
 * 직원이 직접 하는 안전 관련 표시. (Manyfast F-SNBVHR rules)
 *
 * <p>판정 출처는 요청으로 받지 않는다. 직원이 켠 표시의 출처는 언제나 "직원 직접 표시"이므로, 클라이언트가 보낼 수 있게 두면 키워드 자동 판정을
 * 사람이 사칭할 수 있는 자리가 생긴다.
 */
public record SafetyFlagUpdateRequest(
		@NotNull(message = "안전 관련 여부를 선택해 주세요.") Boolean safetyRelated) {}
