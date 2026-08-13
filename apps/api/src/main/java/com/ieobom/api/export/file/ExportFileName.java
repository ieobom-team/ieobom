package com.ieobom.api.export.file;

import java.time.LocalDate;

/**
 * 내려받은 파일의 이름.
 *
 * <p>{@code 이어봄_전산기록_김말순_2026-08-14.txt} 처럼 만든다. <b>어르신을 내부 ID 로 적지 않는다.</b> 가명처리는 LLM 경계에서만
 * 일어나고([{@code handover-card-schema.md}] 가명처리), 이 파일은 직원이 자기 PC 에서 찾아 쓰는 것이다. {@code IB-009} 로
 * 적으면 여러 개를 받아 둔 직원이 어느 것이 누구 것인지 알 수 없다.
 *
 * <p>파일 안에는 어차피 실명과 상태 이야기가 들어 있으므로, 이름에 실명을 쓴다고 새로 드러나는 것은 없다.
 */
public final class ExportFileName {

	private static final String PREFIX = "이어봄";

	/** 파일 이름에 쓸 수 없거나 경로로 읽힐 수 있는 글자. 어르신 이름에 섞여 들어올 자리를 막는다. */
	private static final String UNSAFE = "[\\\\/:*?\"<>|\\s]";

	private ExportFileName() {}

	public static String of(
			String typeLabel, String recipientName, LocalDate date, ExportFileFormat format) {
		return "%s_%s_%s_%s.%s"
				.formatted(PREFIX, safe(typeLabel), safe(recipientName), date, format.extension());
	}

	private static String safe(String part) {
		String cleaned = part == null ? "" : part.replaceAll(UNSAFE, "");
		return cleaned.isEmpty() ? "미지정" : cleaned;
	}
}
