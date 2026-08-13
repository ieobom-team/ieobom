package com.ieobom.api.export.file;

import com.ieobom.api.common.RequestValidationException;
import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * 내려받을 수 있는 파일 형식. (Manyfast F-GUSOFG action)
 *
 * <p><b>같은 내용의 다른 렌더링이다.</b> 형식이 늘어도 담기는 사실은 늘지 않는다. 모델을 다시 부르지 않고, 화면에서 복사되는 것과 같은 글자를 다른 모양으로
 * 그릴 뿐이다.
 */
public enum ExportFileFormat {

	/** 전산 입력창과 메신저에 그대로 붙여넣는 용도. 가장 가볍고 서식이 깨지지 않는다. */
	TXT("txt", "text/plain;charset=UTF-8"),

	/** 제목과 구획을 가진 검토용 텍스트. */
	MD("md", "text/markdown;charset=UTF-8");

	private final String extension;
	private final String contentType;

	ExportFileFormat(String extension, String contentType) {
		this.extension = extension;
		this.contentType = contentType;
	}

	public String extension() {
		return extension;
	}

	public String contentType() {
		return contentType;
	}

	/**
	 * 요청의 {@code format} 값을 형식으로 바꾼다.
	 *
	 * <p><b>열거형을 컨트롤러 파라미터로 직접 받지 않는다.</b> 그러면 정의되지 않은 값이 {@code
	 * MethodArgumentTypeMismatchException} 으로 새어 나가 공통 오류 형태({@code ApiErrorResponse})를 벗어난다. 여기서
	 * 지원하는 목록을 문장에 담아 돌려주면 화면이 무엇을 고쳐야 하는지 그대로 보여 줄 수 있다.
	 */
	public static ExportFileFormat from(String raw) {
		return Arrays.stream(values())
				.filter(format -> format.extension.equalsIgnoreCase(raw))
				.findFirst()
				.orElseThrow(
						() ->
								new RequestValidationException(
										"format", "지원하는 형식은 %s 입니다.".formatted(supported())));
	}

	private static String supported() {
		return Arrays.stream(values())
				.map(ExportFileFormat::extension)
				.collect(Collectors.joining(" · "));
	}
}
