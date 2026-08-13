package com.ieobom.api.export.file;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.springframework.stereotype.Component;

/**
 * 검토용 서술형 기록 초안. (Manyfast F-GUSOFG action · display)
 *
 * <p><b>"일지"라고 부르지 않는다.</b> 사무 담당자가 워드로 받는 문서에 "일지"라는 이름이 붙으면, 그대로 기관에 제출해도 되는 문서로 읽힌다. 이 파일이
 * 하는 일은 담당자가 문장을 고쳐 기관 서식이나 전산에 옮기기 좋게 미리 늘어놓는 것까지다. 그래서 제목이 문서의 첫 줄에서 그렇게 말하고, 마지막 줄의 고지가 같은
 * 말을 다시 한다.
 *
 * <p>담기는 사실은 텍스트·마크다운과 같다. 다른 것은 모양뿐이다.
 */
@Component
public class WordExportRenderer implements ExportFileRenderer {

	/** 문서의 첫 줄. 파일을 연 사람이 무엇을 받았는지 여기서 안다. */
	private static final String HEADING = "검토용 서술형 기록 초안";

	/**
	 * 한글 글꼴을 지정한다.
	 *
	 * <p>워드의 기본 글꼴은 한글 자소를 갖고 있지 않아 뷰어에 따라 대체 글꼴로 떨어진다. 그러면 줄 높이가 들쭉날쭉해지고, 고친 뒤 출력하는 문서라 그 상태로
	 * 기관에 나갈 수 있다. 윈도우·맥 한글 환경에 모두 있는 이름을 쓴다.
	 */
	private static final String FONT = "맑은 고딕";

	@Override
	public ExportFileFormat format() {
		return ExportFileFormat.DOCX;
	}

	@Override
	public byte[] render(ExportDocument document) {
		try (XWPFDocument word = new XWPFDocument();
				ByteArrayOutputStream out = new ByteArrayOutputStream()) {

			text(word, HEADING, 16, true);
			text(
					word,
					"%s — %s (%s)".formatted(document.title(), document.careRecipientName(), document.date()),
					11,
					false);

			text(word, "", 11, false);
			// 묶음 본문은 줄바꿈으로 이어 붙여져 온다. 문단으로 나눠야 워드에서 한 덩어리로 뭉치지 않는다.
			for (String line : document.body().split("\\R")) {
				text(word, line, 12, false);
			}

			text(word, "", 11, false);
			text(word, "근거 원문", 13, true);
			int index = 1;
			for (ExportDocument.Evidence evidence : document.evidences()) {
				text(word, "%d. %s".formatted(index++, evidence.phraseText()), 11, false);
				text(word, "    “%s”".formatted(evidence.sourceText()), 11, false);
			}

			if (document.notice() != null) {
				text(word, "", 11, false);
				text(word, "확인이 필요합니다 — %s".formatted(document.notice()), 11, true);
			}

			text(word, "", 11, false);
			text(word, ExportDocument.DISCLAIMER, 10, false);

			word.write(out);
			return out.toByteArray();
		} catch (IOException e) {
			// 메모리에 쓰는 중이라 실제로는 나지 않는다. 삼켜서 빈 파일을 내려보내지는 않는다.
			throw new UncheckedIOException("워드 파일을 만들지 못했습니다.", e);
		}
	}

	private void text(XWPFDocument word, String value, int size, boolean bold) {
		XWPFParagraph paragraph = word.createParagraph();
		XWPFRun run = paragraph.createRun();
		run.setFontFamily(FONT);
		run.setFontFamily(FONT, XWPFRun.FontCharRange.eastAsia);
		run.setFontSize(size);
		run.setBold(bold);
		run.setText(value);
	}
}
