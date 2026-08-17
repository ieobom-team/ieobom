package com.ieobom.api.staff;

import com.ieobom.api.staff.dto.StaffListResponse;
import com.ieobom.api.staff.dto.StaffResponse;
import com.ieobom.api.staff.dto.UpdatePinRequest;
import com.ieobom.api.staff.dto.VerifyPinRequest;
import com.ieobom.api.staff.dto.VerifyPinResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 직원 명단 조회 및 선택형 PIN 검증/관리. 계약은 {@code docs/contracts/handover-api.md} 에 있다.
 *
 * <p>진입 화면이 본인 선택 목록을 그리려고 부른다. (Manyfast F-YJJJUX permissions — "본인 선택 목록은 센터가 사전 등록한 직원
 * 명단에서 온다")
 *
 * <p>직원 선택형 4~6자리 숫자 PIN 검증, 설정/변경, 관리자 초기화 API 를 제공한다. (#83)
 */
@RestController
@RequestMapping("/api/staff")
@RequiredArgsConstructor
public class StaffController {

	/** 한 센터 직원 수 기준이라 페이지를 나누지 않는다. */
	private static final Sort BY_NAME = Sort.by("name", "code");

	private final StaffRepository staffRepository;
	private final StaffService staffService;

	@GetMapping
	public StaffListResponse findAll() {
		return new StaffListResponse(
				staffRepository.findAll(BY_NAME).stream().map(StaffResponse::from).toList());
	}

	/** 직원 PIN 일치 여부 검증. 5회 연속 실패 시 1분간 잠금 (423 Locked). */
	@PostMapping("/{code}/verify-pin")
	public ResponseEntity<VerifyPinResponse> verifyPin(
			@PathVariable String code, @RequestBody @Valid VerifyPinRequest request) {
		VerifyPinResponse response = staffService.verifyPin(code, request.pin());
		if (response.locked()) {
			return ResponseEntity.status(HttpStatus.LOCKED).body(response);
		}
		return ResponseEntity.ok(response);
	}

	/** 직원 PIN 신규 등록, 변경 또는 해제. */
	@PutMapping("/{code}/pin")
	public StaffResponse updatePin(
			@PathVariable String code, @RequestBody @Valid UpdatePinRequest request) {
		return staffService.updatePin(code, request.currentPin(), request.newPin());
	}

	/** 관리자 1-Click PIN 즉시 초기화(해제). */
	@PostMapping("/{code}/reset-pin")
	public StaffResponse resetPin(@PathVariable String code) {
		return staffService.resetPin(code);
	}
}
