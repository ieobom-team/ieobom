package com.ieobom.api.export.file;

import java.time.LocalDate;
import java.util.List;

/**
 * 파일 하나로 나갈 내용. <b>형식마다 다시 읽지 않고 이것 하나를 본다.</b>
 *
 * <p>형식별로 원본 엔티티를 제각기 읽으면 같은 문구가 형식에 따라 다르게 나온다. 어느 형식에서만 근거가 빠지거나 순서가 달라지는 사고는 파일을 받은 사람이
 * 알아차릴 수 없다. 그래서 조립은 {@link ExportFileService} 한 곳에서 하고, 렌더러는 이 모양을 그리기만 한다.
 *
 * @param title 문서 제목. 문구 유형 그대로이거나 묶음이면 "… 묶음"
 * @param careRecipientName 어르신 실명. 파일은 직원이 보는 것이라 화면과 같이 실명으로 그린다
 * @param date 이 내용이 속한 날. 카드가 만들어진 날 기준이다
 * @param body 파일의 본문. <b>화면에서 복사되는 것과 같은 글자다.</b> 여기서 다시 다듬지 않는다
 * @param notice 복사 전에 확인할 것. 없으면 {@code null}
 * @param evidences 본문의 근거 원문. 항목 순서는 본문에 붙은 순서와 같다
 */
public record ExportDocument(
		String title,
		String careRecipientName,
		LocalDate date,
		String body,
		String notice,
		List<Evidence> evidences) {

	/**
	 * 모든 파일에 들어가는 고지. (Manyfast F-GUSOFG display)
	 *
	 * <p><b>법률 표현을 쓰지 않는다.</b> 우리는 법률 자문을 받은 적이 없으므로 "법정 서식을 대체하지 않는다" 같은 단정 대신 "옮기기 전에 확인해
	 * 달라"까지만 말한다. 같은 이유로 어느 기관의 어떤 양식에 맞는다고도 말하지 않는다. 그 양식을 한 번도 본 적이 없다. (Manyfast F-GUSOFG
	 * rules)
	 */
	public static final String DISCLAIMER =
			"이 파일은 담당자 검토를 전제로 만든 기록·전달 초안입니다. 기관 서식이나 전산에 옮기기 전에 사실관계를 확인해 주세요.";

	/**
	 * 본문 한 조각과 그 근거.
	 *
	 * <p>묶음 파일에서는 여러 개가 된다. <b>파일에도 근거가 함께 나가야 한다.</b> (Manyfast R-TUBGKD 수락기준 4) 파일만 건네받은
	 * 사람이 근거를 볼 수 없으면, 그 사람에게는 검토할 방법이 없다.
	 *
	 * @param phraseText 이 근거에서 나온 문구
	 * @param sourceText 인계 원문에서 잘라 온 근거 구간
	 */
	public record Evidence(String phraseText, String sourceText) {}
}
