package com.ieobom.api.ai;

import java.time.LocalDateTime;

/**
 * 문구 생성 요청 한 건. <b>검토 완료된 카드 한 장의 내용이 전부다.</b>
 *
 * <p>인계 원문을 통째로 넣지 않는다. 원문에는 그 카드가 담기로 한 것 말고도 다른 어르신 이야기와 검토되지 않은 내용이 섞여 있다. 모델에 주지 않은 사실은
 * 문구에 들어갈 수 없으므로, <b>입력을 좁히는 것이 "근거 없는 내용을 넣지 않는다"를 지키는 첫 번째 방법</b>이다. (Manyfast F-GUSOFG
 * exceptions · rules)
 *
 * <p>{@link StructuringInput} 과 같은 이유로 <b>여기 담긴 값도 그대로 LLM 으로 나간다.</b> 어르신은 내부 ID로만 담고, 나머지 칸도
 * 등록된 실명을 내부 ID로 바꾼 뒤의 문자열이다. 근거 원문은 인계 원문에서 잘라 온 구간이고 상태·조치 칸은 직원이 고칠 수 있어서, 어느 칸에나 다른 어르신
 * 이름이 섞일 수 있다. 이름 칸만 가리는 것으로는 부족하다. (Manyfast F-LUDCWW rules)
 *
 * @param careRecipientCode 대상 어르신의 내부 ID. 문구가 누구의 기록인지 말할 수 있어야 한다
 * @param observedAt 상황이 있었던 시각. 원문에서 읽지 못했으면 비어 있다
 * @param evidenceText 근거가 된 원문 구간. 카드에 있는 값을 치환한 것이다
 */
public record ExportInput(
		String careRecipientCode,
		LocalDateTime observedAt,
		String statusChange,
		String actionTaken,
		String nextAction,
		String evidenceText) {}
