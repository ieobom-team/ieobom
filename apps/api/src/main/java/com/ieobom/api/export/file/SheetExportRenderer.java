package com.ieobom.api.export.file;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

/**
 * 어르신 당일 인계 항목을 행으로 둔 표. (Manyfast F-GUSOFG action)
 *
 * <p><b>{@link ExportFileRenderer} 를 구현하지 않는다.</b> 그 인터페이스는 {@link ExportDocument} 하나를 그리는 약속인데
 * 표는 {@link ExportSheet} 를 그린다. 억지로 같은 인터페이스에 넣으면 문구를 내려받는 자리에서 표를 고를 수 있게 되고, 그때 무엇이 나가는지 아무도
 * 설명할 수 없다.
 *
 * <p>고지를 맨 윗줄에 둔다. 아래에 두면 행이 늘어날수록 화면 밖으로 밀려나 사실상 없는 문장이 된다. 이 파일은 담당자가 열어서 확인하는 용도라 첫 줄이 가장
 * 확실하게 읽힌다.
 */
@Component
public class SheetExportRenderer {

	/** 시트 이름. 파일이 무엇인지 탭에서도 보인다. */
	private static final String SHEET_NAME = "인계 항목";

	private static final String FONT = "맑은 고딕";

	/** 고지 한 줄, 열 이름 한 줄. 데이터는 그다음부터다. */
	private static final int NOTICE_ROW = 0;
	private static final int HEADER_ROW = 1;
	private static final int FIRST_DATA_ROW = 2;

	/** 열 너비. 근거 원문이 가장 길고 시각이 가장 짧다. 단위는 1/256 글자다. */
	private static final int[] COLUMN_WIDTHS = {12, 10, 30, 30, 14, 10, 12, 46};

	public byte[] render(ExportSheet sheet) {
		try (Workbook workbook = new XSSFWorkbook();
				ByteArrayOutputStream out = new ByteArrayOutputStream()) {

			Sheet table = workbook.createSheet(SHEET_NAME);
			notice(workbook, table);
			header(workbook, table);

			CellStyle bodyStyle = wrapped(workbook, false, null);
			int rowIndex = FIRST_DATA_ROW;
			for (ExportSheet.Row row : sheet.rows()) {
				write(table.createRow(rowIndex++), row.values(), bodyStyle);
			}

			for (int column = 0; column < COLUMN_WIDTHS.length; column++) {
				table.setColumnWidth(column, COLUMN_WIDTHS[column] * 256);
			}
			// 행이 늘어나도 열 이름이 따라 내려온다. 아래로 스크롤하며 담당·기한을 읽는 표다.
			table.createFreezePane(0, FIRST_DATA_ROW);

			workbook.write(out);
			return out.toByteArray();
		} catch (IOException e) {
			// 메모리에 쓰는 중이라 실제로는 나지 않는다. 삼켜서 빈 파일을 내려보내지는 않는다.
			throw new UncheckedIOException("엑셀 파일을 만들지 못했습니다.", e);
		}
	}

	/** 맨 윗줄의 고지. 열 전체에 걸쳐 놓아 잘리지 않게 한다. (Manyfast F-GUSOFG display) */
	private void notice(Workbook workbook, Sheet table) {
		Row row = table.createRow(NOTICE_ROW);
		Cell cell = row.createCell(0);
		cell.setCellValue(ExportDocument.DISCLAIMER);
		cell.setCellStyle(wrapped(workbook, false, null));

		table.addMergedRegion(
				new CellRangeAddress(
						NOTICE_ROW, NOTICE_ROW, 0, ExportSheet.COLUMNS.size() - 1));
	}

	private void header(Workbook workbook, Sheet table) {
		write(
				table.createRow(HEADER_ROW),
				ExportSheet.COLUMNS,
				wrapped(workbook, true, IndexedColors.GREY_25_PERCENT));
	}

	private void write(Row row, List<String> values, CellStyle style) {
		for (int column = 0; column < values.size(); column++) {
			Cell cell = row.createCell(column);
			cell.setCellValue(values.get(column));
			cell.setCellStyle(style);
		}
	}

	/**
	 * 줄바꿈해서 보여 주는 칸.
	 *
	 * <p>근거 원문과 조치는 한 줄에 들어가지 않는다. 접어 두지 않으면 옆 칸을 덮어 가려서, 표를 훑는 사람이 담당·기한을 못 본다.
	 */
	private CellStyle wrapped(Workbook workbook, boolean bold, IndexedColors background) {
		Font font = workbook.createFont();
		font.setFontName(FONT);
		font.setBold(bold);

		CellStyle style = workbook.createCellStyle();
		style.setFont(font);
		style.setWrapText(true);
		style.setVerticalAlignment(VerticalAlignment.TOP);
		style.setBorderBottom(BorderStyle.THIN);
		style.setBorderTop(BorderStyle.THIN);
		style.setBorderLeft(BorderStyle.THIN);
		style.setBorderRight(BorderStyle.THIN);

		if (background != null) {
			style.setAlignment(HorizontalAlignment.CENTER);
			style.setFillForegroundColor(background.getIndex());
			style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
		}
		return style;
	}
}
