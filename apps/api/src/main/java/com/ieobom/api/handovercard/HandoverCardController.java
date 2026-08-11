package com.ieobom.api.handovercard;

import com.ieobom.api.handovercard.dto.HandoverCardListResponse;
import com.ieobom.api.handovercard.dto.HandoverCardResponse;
import com.ieobom.api.handovercard.dto.HandoverCardStructureResponse;
import com.ieobom.api.handovercard.dto.HandoverCardUpdateRequest;
import com.ieobom.api.handovercard.dto.ReviewStatusUpdateRequest;
import com.ieobom.api.handovercard.dto.SafetyFlagUpdateRequest;
import jakarta.validation.Valid;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI 구조화와 카드 조회 · 검토. 계약은 {@code docs/contracts/handover-card-schema.md} 에 있다.
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

	/**
	 * 직원이 검토하며 고친 내용을 저장한다.
	 *
	 * <p>고칠 수 있는 항목을 통째로 받는다. 근거 원문과 관찰 시각은 대상이 아니다. 이유는 {@link
	 * HandoverCardUpdateRequest} 에 적혀 있다.
	 */
	@PutMapping("/api/handover-cards/{cardId}")
	public HandoverCardResponse update(
			@PathVariable Long cardId, @Valid @RequestBody HandoverCardUpdateRequest request) {
		return handoverCardService.update(cardId, request);
	}

	/** 검토 필요 ↔ 검토 완료. */
	@PatchMapping("/api/handover-cards/{cardId}/review-status")
	public HandoverCardResponse changeReviewStatus(
			@PathVariable Long cardId, @Valid @RequestBody ReviewStatusUpdateRequest request) {
		return handoverCardService.changeReviewStatus(cardId, request.reviewStatus());
	}

	/** 직원이 직접 하는 안전 관련 표시. 켜면 판정 출처가 {@code STAFF} 가 된다. */
	@PatchMapping("/api/handover-cards/{cardId}/safety")
	public HandoverCardResponse markSafety(
			@PathVariable Long cardId, @Valid @RequestBody SafetyFlagUpdateRequest request) {
		return handoverCardService.markSafety(cardId, request.safetyRelated());
	}
}
