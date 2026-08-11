package com.ieobom.api.handovercard;

import com.ieobom.api.handovercard.dto.HandoverCardListResponse;
import com.ieobom.api.handovercard.dto.HandoverCardStructureResponse;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI 구조화와 카드 조회. 계약은 {@code docs/contracts/handover-card-schema.md} 에 있다.
 *
 * <p>구조화를 {@code POST /api/handovers} 안에서 하지 않고 따로 뗀 이유는, 현장 입력 저장이 LLM 응답 시간과 실패에 묶이면 안 되기
 * 때문이다. 돌봄 중인 근무자에게는 저장이 먼저 끝나야 한다.
 */
@RestController
@RequiredArgsConstructor
public class HandoverCardController {

	private final HandoverCardService handoverCardService;

	@PostMapping("/api/handovers/{handoverId}/cards")
	public ResponseEntity<HandoverCardStructureResponse> structure(@PathVariable Long handoverId) {
		return ResponseEntity.status(201).body(handoverCardService.structure(handoverId));
	}

	/** {@code date} 를 생략하면 오늘이다. */
	@GetMapping("/api/handover-cards")
	public HandoverCardListResponse findByDate(
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
					LocalDate date) {
		return handoverCardService.findByDate(date == null ? LocalDate.now() : date);
	}
}
