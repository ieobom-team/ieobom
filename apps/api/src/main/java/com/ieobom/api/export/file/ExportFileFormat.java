package com.ieobom.api.export.file;

import com.ieobom.api.common.RequestValidationException;
import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * 내려받을 수 있는 파일 형식. (Manyfast F-GUSOFG action)
 *
 * <p><b>같은 내용의 다른 렌더링이다.</b> 형식이 늘어도 담기는 사실은 늘지 않는다. 모델을 다시 부르지 않고, 화면에서 복사되는 것과 같은 글자를 다른 모양으로
 * 그릴 뿐이다.
 *
 * <p>다만 <b>{@code .xlsx} 만 단위가 다르다.</b> 나머지 셋은 문구 하나(또는 묶음 하나)를 그리지만, 표는 카드와 후속 업무를 행으로 늘어놓는다.
 * 시각·상태 변화·조치는 카드의 값이고 담당·기한·처리 상태는 업무의 값이라 문구 하나에서 나오지 않는다. 그래서 {@link Unit} 으로 갈라 두고, 문구를
 * 내려받는 자리에서 {@code xlsx} 를 고를 수 없게 한다 — 고를 수 있으면 렌더러가 없는 요청이 500 으로 떨어진다.
 */
public enum ExportFileFormat {

	/** 전산 입력창과 메신저에 그대로 붙여넣는 용도. 가장 가볍고 서식이 깨지지 않는다. */
	TXT("txt", "text/plain;charset=UTF-8", Unit.PHRASE),

	/** 제목과 구획을 가진 검토용 텍스트. */
	MD("md", "text/markdown;charset=UTF-8", Unit.PHRASE),

	/** 검토용 서술형 기록 초안. 기관 서식에 옮기기 전에 사람이 고쳐 쓰는 문서다. */
	DOCX(
			"docx",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			Unit.PHRASE),

	/** 어르신 당일 인계 항목을 행으로 둔 표. */
	XLSX(
			"xlsx",
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			Unit.SHEET);

	/** 이 형식이 무엇을 그리는가. */
	public enum Unit {
		/** 문구 하나 또는 묶음 하나. */
		PHRASE,
		/** 어르신 당일 표. */
		SHEET
	}

	private final String extension;
	private final String contentType;
	private final Unit unit;

	ExportFileFormat(String extension, String contentType, Unit unit) {
		this.extension = extension;
		this.contentType = contentType;
		this.unit = unit;
	}

	public String extension() {
		return extension;
	}

	public String contentType() {
		return contentType;
	}

	public Unit unit() {
		return unit;
	}

	/**
	 * 문구를 내려받는 요청의 {@code format} 값을 형식으로 바꾼다.
	 *
	 * <p><b>열거형을 컨트롤러 파라미터로 직접 받지 않는다.</b> 그러면 정의되지 않은 값이 {@code
	 * MethodArgumentTypeMismatchException} 으로 새어 나가 공통 오류 형태({@code ApiErrorResponse})를 벗어난다. 여기서
	 * 지원하는 목록을 문장에 담아 돌려주면 화면이 무엇을 고쳐야 하는지 그대로 보여 줄 수 있다.
	 *
	 * <p>표 형식은 이 목록에 없다. 단위가 달라 다른 엔드포인트로 받는다.
	 */
	public static ExportFileFormat fromPhraseFormat(String raw) {
		return Arrays.stream(values())
				.filter(format -> format.unit == Unit.PHRASE)
				.filter(format -> format.extension.equalsIgnoreCase(raw))
				.findFirst()
				.orElseThrow(
						() ->
								new RequestValidationException(
										"format", "지원하는 형식은 %s 입니다.".formatted(supportedPhraseFormats())));
	}

	private static String supportedPhraseFormats() {
		return Arrays.stream(values())
				.filter(format -> format.unit == Unit.PHRASE)
				.map(ExportFileFormat::extension)
				.collect(Collectors.joining(" · "));
	}
}
