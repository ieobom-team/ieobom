package com.ieobom.api.ai;

import java.time.LocalDateTime;

/**
 * 문구 생성 요청 한 건. <b>검토 완료된 카드 한 장의 내용이 전부다.</b>
 *
 * <p>인계 원문을 통째로 넣지 않는다. 원문에는 그 카드가 담기로 한 것 말고도 다른 어르신 이야기와 검토되지 않은 내용이 섞여 있다. 모델에 주지 않은 사실은
 * 문구에 들어갈 수 없으므로, <b>입력을 좁히는 것이 "근거 없는 내용을 넣지 않는다"를 지키는 첫 번째 방법</b>이다. (Manyfast F-GUSOFG
 * exceptions · rules)
 *
 * @param careRecipientName 대상 어르신 이름. 문구가 누구의 기록인지 말할 수 있어야 한다
 * @param observedAt 상황이 있었던 시각. 원문에서 읽지 못했으면 비어 있다
 * @param evidenceText 근거가 된 원문 구간. 카드에 있는 값 그대로다
 */
public record ExportInput(
		String careRecipientName,
		LocalDateTime observedAt,
		String statusChange,
		String actionTaken,
		String nextAction,
		String evidenceText) {}
