package com.ieobom.api.recipient;

import com.ieobom.api.recipient.dto.CareRecipientListResponse;
import com.ieobom.api.recipient.dto.CareRecipientResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 어르신 목록 조회. 계약은 {@code docs/contracts/handover-api.md} 에 있다.
 *
 * <p>입력 화면은 대상 어르신을 서버가 발급한 id 로 지목해야 한다. (Manyfast F-YJJJUX preconditions — "입력할 어르신이 목록에
 * 존재해야 한다") 목록을 프론트 상수로 두면 id 를 추측하게 되어 저장이 404 로 끊긴다.
 */
@RestController
@RequestMapping("/api/care-recipients")
@RequiredArgsConstructor
public class CareRecipientController {

	/** 20명 남짓한 한 센터 기준이라 페이지를 나누지 않는다. */
	private static final Sort BY_NAME = Sort.by("name", "code");

	private final CareRecipientRepository careRecipientRepository;

	@GetMapping
	public CareRecipientListResponse findAll() {
		return new CareRecipientListResponse(
				careRecipientRepository.findAll(BY_NAME).stream().map(CareRecipientResponse::from).toList());
	}
}
