package com.ieobom.api.export;

import com.ieobom.api.export.ExportPhraseService.ExportGeneration;
import com.ieobom.api.export.dto.ExportGenerateResponse;
import com.ieobom.api.export.dto.ExportPhraseResponse;
import com.ieobom.api.export.dto.ExportPhraseUpdateRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * 전산 기록 문구 · 보호자 전달 문구. 계약은 {@code docs/contracts/export-api.md} 에 있다.
 *
 * <p>문구를 <b>보내는</b> 엔드포인트는 없다. 만들고, 고치고, 직원이 복사했다는 사실을 남기는 것이 전부다. (Manyfast F-GUSOFG rules)
 */
@RestController
@RequiredArgsConstructor
public class ExportPhraseController {

	private final ExportPhraseService exportPhraseService;

	/**
	 * 검토 완료 카드에서 두 문구를 만든다.
	 *
	 * <p>이미 만들어 둔 문구가 있으면 다시 만들지 않고 {@code 200} 으로 그대로 돌려준다. 화면을 다시 열거나 대시보드에서 곧장 들어와도 같은 요청 하나면
	 * 된다.
	 */
	@PostMapping("/api/handover-cards/{cardId}/exports")
	public ResponseEntity<ExportGenerateResponse> generate(@PathVariable Long cardId) {
		ExportGeneration generation = exportPhraseService.generate(cardId);
		return ResponseEntity.status(generation.created() ? 201 : 200).body(generation.response());
	}

	/** 직원이 검토하며 고친 문구를 저장한다. */
	@PutMapping("/api/exports/{phraseId}")
	public ExportPhraseResponse update(
			@PathVariable Long phraseId, @Valid @RequestBody ExportPhraseUpdateRequest request) {
		return exportPhraseService.update(phraseId, request.text());
	}

	/** 직원이 복사했다는 사실을 남긴다. 문구를 어디로도 보내지 않는다. */
	@PostMapping("/api/exports/{phraseId}/copy")
	public ExportPhraseResponse copy(@PathVariable Long phraseId) {
		return exportPhraseService.copy(phraseId);
	}
}
