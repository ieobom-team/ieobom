package com.ieobom.api.export.file;

import java.time.LocalDate;
import java.util.List;

/**
 * 표 하나로 나갈 내용. <b>{@link ExportDocument} 와 단위가 다르다.</b>
 *
 * <p>문구 파일은 문구 하나를 그리지만 표는 <b>어르신 한 명의 그날 인계 항목을 행으로 늘어놓는다.</b> 시각·상태 변화·조치는 카드의 값이고 담당·기한·처리
 * 상태는 후속 업무의 값이라 문구 하나에서 나오지 않는다. 같은 모델에 억지로 담으면 어느 쪽이든 빈 자리가 생기고, 빈 자리는 읽는 사람이 사실로 착각한다.
 *
 * <p>표를 쓰는 이유는 붙여넣기가 아니라 확인이다. 어르신 한 명의 하루가 몇 줄인지, 아직 닫히지 않은 업무가 무엇인지를 한 화면에서 본다.
 *
 * @param careRecipientName 어르신 실명. 파일은 직원이 보는 것이라 화면과 같이 실명으로 그린다
 * @param date 이 표가 담는 날
 * @param rows 카드 한 장이 한 행이다. 순서는 안전 항목이 먼저, 그다음 관찰 시각 순
 */
public record ExportSheet(String careRecipientName, LocalDate date, List<Row> rows) {

	/**
	 * 표의 열. <b>여기 있는 순서가 파일의 열 순서다.</b>
	 *
	 * <p>"상태"를 하나로 두지 않고 <b>상태 변화</b>와 <b>처리 상태</b>로 나눈다. 앞은 어르신의 몸 이야기이고 뒤는 업무가 닫혔는지다. 한 열에 섞으면
	 * 표를 정렬했을 때 서로 다른 두 가지가 같은 기준으로 줄을 선다.
	 */
	public static final List<String> COLUMNS =
			List.of("어르신", "시각", "상태 변화", "조치", "담당", "기한", "처리 상태", "근거 원문");

	/**
	 * 인계 항목 한 줄.
	 *
	 * <p>모든 값이 이미 저장된 사실이다. <b>담당·기한·처리 상태는 후속 업무가 있는 항목에만 채운다.</b> 카드에 담당 직종 제안값({@code
	 * suggestedJobRole})이 있어도 쓰지 않는다 — 그것은 AI 가 제안했을 뿐 사람이 배정한 적이 없는 값이고, 표에 적히는 순간 배정된 것처럼 읽힌다.
	 *
	 * @param careRecipientName 어르신. 여러 어르신의 표를 한 파일에 모아 붙일 때를 위해 행마다 둔다
	 * @param observedAt 관찰 시각. 원문에서 뽑지 못했으면 빈 칸
	 * @param statusChange 어르신 상태가 어떻게 달라졌는지
	 * @param actionTaken 현장에서 이미 무엇을 했는지
	 * @param assignee 담당자 이름이나 직종. 배정되지 않았으면 {@code 미배정}
	 * @param dueTime 기한. 후속 업무가 없으면 빈 칸
	 * @param taskStatus 처리 상태. 후속 업무가 없으면 빈 칸
	 * @param evidenceText 근거 원문. <b>비지 않는다.</b> (Manyfast R-TUBGKD 수락기준 4)
	 */
	public record Row(
			String careRecipientName,
			String observedAt,
			String statusChange,
			String actionTaken,
			String assignee,
			String dueTime,
			String taskStatus,
			String evidenceText) {

		/** 열 순서대로 한 줄을 늘어놓는다. 렌더러가 열 이름을 다시 알 필요가 없다. */
		public List<String> values() {
			return List.of(
					careRecipientName,
					observedAt,
					statusChange,
					actionTaken,
					assignee,
					dueTime,
					taskStatus,
					evidenceText);
		}
	}
}
