package com.ieobom.api.recipient;

import com.ieobom.api.recipient.dto.CareRecipientCreateRequest;
import com.ieobom.api.recipient.dto.CareRecipientListResponse;
import com.ieobom.api.recipient.dto.CareRecipientRenameRequest;
import com.ieobom.api.recipient.dto.CareRecipientResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 어르신 명단 조회 · 등록 · 수정. 계약은 {@code docs/contracts/handover-api.md} 에 있다.
 *
 * <p>입력 화면은 대상 어르신을 서버가 발급한 id 로 지목해야 한다. (Manyfast F-YJJJUX preconditions — "입력할 어르신이 목록에
 * 존재해야 한다") 목록을 프론트 상수로 두면 id 를 추측하게 되어 저장이 404 로 끊긴다.
 *
 * <p><b>삭제 API 를 두지 않는다.</b> 기존 인계 기록과 카드가 어르신을 가리키고 있어서, 지우면 이미 남긴 기록이 대상을 잃는다. 더 이상 오지 않는
 * 어르신은 이용 종료로 표시한다. (Manyfast F-LUDCWW action, [#42](https://github.com/ieobom-team/ieobom/issues/42))
 */
@RestController
@RequestMapping("/api/care-recipients")
@RequiredArgsConstructor
public class CareRecipientController {

	private final CareRecipientService careRecipientService;

	/**
	 * @param includeDischarged 이용 종료한 어르신까지 포함할지. 기본은 이용 중인 어르신만이다 — 부르는 쪽 대부분이 새 입력의 대상 목록을
	 *     그리는 화면이라, 빠뜨렸을 때 안전한 쪽을 기본값으로 둔다
	 */
	@GetMapping
	public CareRecipientListResponse findAll(
			@RequestParam(defaultValue = "false") boolean includeDischarged) {
		return careRecipientService.findAll(includeDischarged);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public CareRecipientResponse register(@Valid @RequestBody CareRecipientCreateRequest request) {
		return careRecipientService.register(request);
	}

	@PatchMapping("/{id}")
	public CareRecipientResponse rename(
			@PathVariable Long id, @Valid @RequestBody CareRecipientRenameRequest request) {
		return careRecipientService.rename(id, request);
	}

	@PostMapping("/{id}/discharge")
	public CareRecipientResponse discharge(@PathVariable Long id) {
		return careRecipientService.discharge(id);
	}
}
