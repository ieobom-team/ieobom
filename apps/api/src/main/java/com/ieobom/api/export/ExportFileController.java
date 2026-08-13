package com.ieobom.api.export;

import com.ieobom.api.common.RequestValidationException;
import com.ieobom.api.export.file.ExportFile;
import com.ieobom.api.export.file.ExportFileFormat;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 문구를 파일로 내려받는다. 계약은 {@code docs/contracts/export-api.md} 에 있다.
 *
 * <p><b>내려받는 단위는 복사와 같다.</b> 카드 한 장의 문구 하나이거나 어르신 당일 묶음 하나다. (Manyfast F-GUSOFG action) 화면에서
 * 복사할 수 있는 것과 내려받을 수 있는 것이 갈리면, 직원은 같은 자리에서 두 가지 다른 결과를 얻는다.
 *
 * <p>{@code GET} 인 이유는 <b>아무것도 저장하지 않기 때문이다.</b> 내려받은 형식과 시점은 로그로만 남고 복사 기록은 움직이지 않는다.
 */
@RestController
@RequiredArgsConstructor
public class ExportFileController {

	private final ExportFileService exportFileService;
	private final ExportSheetService exportSheetService;

	/** 카드 한 장의 문구 하나. */
	@GetMapping("/api/exports/{phraseId}/file")
	public ResponseEntity<byte[]> phraseFile(
			@PathVariable Long phraseId, @RequestParam String format) {

		return attachment(
				exportFileService.ofPhrase(phraseId, ExportFileFormat.fromPhraseFormat(format)));
	}

	/** 어르신 당일 묶음 하나. {@code date} 를 생략하면 오늘이다. */
	@GetMapping("/api/care-recipients/{careRecipientId}/export-bundles/file")
	public ResponseEntity<byte[]> bundleFile(
			@PathVariable Long careRecipientId,
			@RequestParam String phraseType,
			@RequestParam String format,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
					LocalDate date) {

		return attachment(
				exportFileService.ofBundle(
						careRecipientId,
						phraseTypeOf(phraseType),
						date == null ? LocalDate.now() : date,
						ExportFileFormat.fromPhraseFormat(format)));
	}

	/**
	 * 어르신 당일 인계 항목 표. {@code date} 를 생략하면 오늘이다.
	 *
	 * <p><b>형식을 고르지 않는다.</b> 표는 {@code .xlsx} 하나뿐이라 고를 것이 없고, 문구 형식과 섞이면 "표를 텍스트로" 같은 요청이 만들어진다.
	 * 담기는 것이 문구가 아니라 카드와 후속 업무라 경로도 문구 쪽과 나눠 둔다.
	 */
	@GetMapping("/api/care-recipients/{careRecipientId}/export-sheet")
	public ResponseEntity<byte[]> sheetFile(
			@PathVariable Long careRecipientId,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
					LocalDate date) {

		return attachment(
				exportSheetService.ofRecipient(careRecipientId, date == null ? LocalDate.now() : date));
	}

	/**
	 * 파일 이름을 응답 헤더에 담는다.
	 *
	 * <p>{@link ContentDisposition} 이 한글 이름을 RFC 5987 {@code filename*} 로 인코딩한다. 손으로 만들면 브라우저마다
	 * 다르게 읽어 이름이 깨지고, 이름이 깨지면 직원이 받아 둔 파일에서 누구 것인지 알 수 없게 된다.
	 *
	 * <p>프론트와 API 는 같은 출처라({@code docs/architecture.md}) 화면이 이 헤더를 그대로 읽을 수 있다. CORS 설정은 없다.
	 */
	private ResponseEntity<byte[]> attachment(ExportFile file) {
		ContentDisposition disposition =
				ContentDisposition.attachment()
						.filename(file.fileName(), StandardCharsets.UTF_8)
						.build();

		return ResponseEntity.ok()
				.header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
				.header(HttpHeaders.CONTENT_TYPE, file.contentType())
				.body(file.content());
	}

	/**
	 * 열거형을 파라미터로 직접 받지 않는 이유는 {@link ExportFileFormat#from} 과 같다.
	 *
	 * <p>정의되지 않은 값이 공통 오류 형태를 벗어나면, 화면은 무엇을 고쳐야 하는지 모르는 오류를 받는다.
	 */
	private ExportPhraseType phraseTypeOf(String raw) {
		return Arrays.stream(ExportPhraseType.values())
				.filter(type -> type.name().equalsIgnoreCase(raw))
				.findFirst()
				.orElseThrow(
						() ->
								new RequestValidationException(
										"phraseType",
										"지원하는 문구 유형은 %s 입니다."
												.formatted(
														Arrays.stream(ExportPhraseType.values())
																.map(Enum::name)
																.collect(Collectors.joining(" · ")))));
	}
}
