package com.ieobom.api.handovercard.dto;

import java.util.List;

/**
 * 구조화 실행 결과.
 *
 * @param createdCount 만들어진 카드 수
 * @param discardedCount 검증에서 버린 항목 수. 근거가 없거나 원문에 없는 근거를 붙인 항목이 여기 잡힌다
 * @param cards 만들어진 카드. 안전 항목이 앞에 온다
 */
public record HandoverCardStructureResponse(
		Long handoverId, int createdCount, int discardedCount, List<HandoverCardResponse> cards) {}
