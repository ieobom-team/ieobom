package com.ieobom.api.handovercard;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 카드 검토 상태. 두 값만 쓴다.
 *
 * <p>출력 문구 생성은 {@link #REVIEWED} 카드에서만 가능하다.
 */
@Getter
@RequiredArgsConstructor
public enum ReviewStatus {
	NEEDS_REVIEW("검토 필요"),
	REVIEWED("검토 완료");

	private final String label;
}
