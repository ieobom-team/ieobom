package com.ieobom.api.task.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * 하원 미처리 브리핑. 그날 아직 닫히지 않은 업무만 담는다. (Manyfast F-HQTFLK display, 유저플로우 "AI 인계 도구 내비게이션 맵" n44 하원 미처리
 * 브리핑 · n45 미처리 건수·목록)
 *
 * <p><b>대시보드 응답을 재사용하지 않는다.</b> {@link TaskListResponse} 를 쓰면서 완료를 비우면 그날 완료된 업무가 실제로 있어도
 * {@code doneCount} 가 0 으로 나가 응답이 거짓말을 한다. 브리핑이 답하는 질문은 "완료가 몇 건인가"가 아니라 "아직 안 닫힌 것이
 * 무엇인가" 하나뿐이므로, 담을 자리를 두지 않는 편이 맞다.
 *
 * <p>이 화면은 지연 재알림이나 다음 교대 자동 승계를 대신하지 않는다. (Manyfast F-HQTFLK rules) 여기 뜬 업무를 닫는 것은 사람이다.
 *
 * @param date 조회 기준일. 업무가 만들어진 날이다
 * @param pending 미처리. 기한 순
 * @param pendingCount 미처리 건수. 브리핑 화면이 목록과 별도로 숫자로 그린다. 배열과 따로 담는 이유는 {@link TaskListResponse#of} 에 있다
 */
public record TaskBriefingResponse(LocalDate date, List<TaskResponse> pending, int pendingCount) {

	public static TaskBriefingResponse of(LocalDate date, List<TaskResponse> pending) {
		return new TaskBriefingResponse(date, pending, pending.size());
	}
}
