package com.ieobom.api.staff;

import com.ieobom.api.staff.dto.StaffListResponse;
import com.ieobom.api.staff.dto.StaffResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 직원 명단 조회. 계약은 {@code docs/contracts/handover-api.md} 에 있다.
 *
 * <p>진입 화면이 본인 선택 목록을 그리려고 부른다. (Manyfast F-YJJJUX permissions — "본인 선택 목록은 센터가 사전 등록한 직원
 * 명단에서 온다")
 *
 * <p>조회만 있다. 등록 · 수정 · 삭제 API 를 두지 않는다. 명단 관리 화면이 범위 밖이라 부를 화면이 없다. (#33)
 */
@RestController
@RequestMapping("/api/staff")
@RequiredArgsConstructor
public class StaffController {

	/** 한 센터 직원 수 기준이라 페이지를 나누지 않는다. */
	private static final Sort BY_NAME = Sort.by("name", "code");

	private final StaffRepository staffRepository;

	@GetMapping
	public StaffListResponse findAll() {
		return new StaffListResponse(
				staffRepository.findAll(BY_NAME).stream().map(StaffResponse::from).toList());
	}
}
