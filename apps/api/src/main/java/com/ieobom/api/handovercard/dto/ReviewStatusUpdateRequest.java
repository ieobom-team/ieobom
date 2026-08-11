package com.ieobom.api.handovercard.dto;

import com.ieobom.api.handovercard.ReviewStatus;
import jakarta.validation.constraints.NotNull;

/**
 * 검토 상태 전환 요청.
 *
 * <p>값은 {@code NEEDS_REVIEW} 와 {@code REVIEWED} 둘뿐이다. (Manyfast F-SNBVHR dataSpec) 되돌리는 방향도
 * 막지 않는다. 잘못 눌러 검토 완료가 된 카드에서 빠져나올 길이 없으면 그 카드로 문구가 나가 버린다.
 */
public record ReviewStatusUpdateRequest(
		@NotNull(message = "검토 상태를 선택해 주세요.") ReviewStatus reviewStatus) {}
