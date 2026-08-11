package com.ieobom.api.export;

import com.ieobom.api.export.dto.ExportBundleCopyRequest;
import com.ieobom.api.export.dto.ExportBundleListResponse;
import com.ieobom.api.export.dto.ExportBundleResponse;
import jakarta.validation.Valid;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 어르신 당일 문구 묶음. 계약은 {@code docs/contracts/export-api.md} 에 있다.
 *
 * <p>문구를 <b>만드는</b> 엔드포인트는 여기 없다. 생성 단위는 그대로 카드 한 장이고({@link ExportPhraseController}), 여기서는
 * 이미 만들어진 문구를 읽을 때 이어 붙이기만 한다. (Manyfast F-GUSOFG dataSpec)
 */
@RestController
@RequiredArgsConstructor
public class ExportBundleController {

	private final ExportBundleService exportBundleService;

	/**
	 * 어르신 한 명의 당일 묶음을 유형별로 읽는다. {@code date} 를 생략하면 오늘이다.
	 *
	 * <p>두 유형을 한 번에 내린다. 화면이 전산 기록 묶음과 보호자 전달 묶음을 나란히 보여 주므로 호출을 둘로 쪼갤 이유가 없다.
	 */
	@GetMapping("/api/care-recipients/{careRecipientId}/export-bundles")
	public ExportBundleListResponse findByDate(
			@PathVariable Long careRecipientId,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
					LocalDate date) {

		return exportBundleService.findByRecipientAndDate(
				careRecipientId, date == null ? LocalDate.now() : date);
	}

	/** 직원이 묶음을 복사했다는 사실을 남긴다. 기록은 묶음에 들어간 문구 하나하나에 남는다. */
	@PostMapping("/api/care-recipients/{careRecipientId}/export-bundles/copy")
	public ExportBundleResponse copy(
			@PathVariable Long careRecipientId, @Valid @RequestBody ExportBundleCopyRequest request) {

		return exportBundleService.copy(
				careRecipientId,
				request.phraseType(),
				request.date() == null ? LocalDate.now() : request.date());
	}
}
