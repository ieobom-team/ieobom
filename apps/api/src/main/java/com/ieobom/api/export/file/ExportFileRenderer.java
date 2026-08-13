package com.ieobom.api.export.file;

/**
 * {@link ExportDocument} 하나를 한 가지 형식으로 그린다.
 *
 * <p>구현체는 <b>그리기만 한다.</b> 무엇을 담을지 고르거나 문구를 다듬지 않는다. 형식이 늘어날 때 이 인터페이스의 구현을 하나 더 등록하면 되고, 그때
 * 담기는 사실은 늘지 않는다.
 */
public interface ExportFileRenderer {

	ExportFileFormat format();

	byte[] render(ExportDocument document);
}
