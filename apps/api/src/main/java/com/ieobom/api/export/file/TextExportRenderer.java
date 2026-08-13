package com.ieobom.api.export.file;

import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Component;

/**
 * 순수 텍스트. 전산 입력창과 메신저에 그대로 붙여넣는 형식이다.
 *
 * <p><b>본문을 맨 위에 두고 나머지는 구분선 아래로 내린다.</b> 이 파일을 여는 목적은 위쪽을 긁어 붙여넣는 것이라, 근거와 고지가 본문 사이에 끼면 붙여넣을
 * 때마다 지워야 한다. 그렇다고 근거를 빼지는 않는다 — 파일만 받은 사람도 근거를 볼 수 있어야 한다. (Manyfast R-TUBGKD 수락기준 4)
 */
@Component
public class TextExportRenderer implements ExportFileRenderer {

	/**
	 * 줄바꿈을 {@code \r\n} 으로 쓴다.
	 *
	 * <p>이 파일이 열리는 곳은 대부분 윈도우의 메모장과 전산 입력창이다. 옛 편집기에서 {@code \n} 만 쓰면 줄이 나뉘지 않고 한 줄로 뭉쳐 보이는데,
	 * 그렇게 되면 붙여넣기용이라는 이 형식의 존재 이유가 사라진다. 반대 방향(리눅스·맥에서 {@code \r\n} 을 읽는 것)은 깨지지 않는다.
	 */
	private static final String NEW_LINE = "\r\n";

	private static final String DIVIDER = "-".repeat(40);

	@Override
	public ExportFileFormat format() {
		return ExportFileFormat.TXT;
	}

	@Override
	public byte[] render(ExportDocument document) {
		StringBuilder out = new StringBuilder();

		line(out, "%s — %s (%s)".formatted(document.title(), document.careRecipientName(), document.date()));
		line(out, "");
		line(out, document.body());

		line(out, "");
		line(out, DIVIDER);
		line(out, "근거 원문");
		for (ExportDocument.Evidence evidence : document.evidences()) {
			line(out, "- \"%s\"".formatted(evidence.sourceText()));
		}

		if (document.notice() != null) {
			line(out, "");
			line(out, "확인이 필요합니다 — %s".formatted(document.notice()));
		}

		line(out, "");
		line(out, ExportDocument.DISCLAIMER);

		return out.toString().getBytes(StandardCharsets.UTF_8);
	}

	/** 본문 안의 줄바꿈도 이 형식의 줄바꿈으로 맞춘다. 묶음 본문은 {@code \n} 으로 이어 붙여져 온다. */
	private void line(StringBuilder out, String text) {
		out.append(text.replace("\r\n", "\n").replace("\n", NEW_LINE)).append(NEW_LINE);
	}
}
