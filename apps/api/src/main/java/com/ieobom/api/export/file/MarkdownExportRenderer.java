package com.ieobom.api.export.file;

import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Component;

/**
 * 제목과 구획을 가진 검토용 텍스트.
 *
 * <p>텍스트와 담는 사실은 같고 <b>근거를 문구 옆에 붙여 놓는 것</b>만 다르다. 묶음처럼 문장이 여러 개일 때, 어느 문장이 어느 원문에서 나왔는지 텍스트
 * 형식에서는 순서로만 짐작해야 한다. 검토하며 읽는 형식이라 여기서는 짝을 지어 그린다.
 */
@Component
public class MarkdownExportRenderer implements ExportFileRenderer {

	@Override
	public ExportFileFormat format() {
		return ExportFileFormat.MD;
	}

	@Override
	public byte[] render(ExportDocument document) {
		StringBuilder out = new StringBuilder();

		out.append("# %s — %s%n%n".formatted(document.title(), document.careRecipientName()));
		out.append("%s%n%n".formatted(document.date()));
		out.append("%s%n%n".formatted(document.body()));

		out.append("## 근거 원문%n%n".formatted());
		int index = 1;
		for (ExportDocument.Evidence evidence : document.evidences()) {
			out.append("%d. %s%n%n".formatted(index++, evidence.phraseText()));
			out.append("   > \"%s\"%n%n".formatted(evidence.sourceText()));
		}

		if (document.notice() != null) {
			out.append("> **확인이 필요합니다** — %s%n%n".formatted(document.notice()));
		}

		out.append("---%n%n".formatted());
		out.append("> %s%n".formatted(ExportDocument.DISCLAIMER));

		return out.toString().getBytes(StandardCharsets.UTF_8);
	}
}
