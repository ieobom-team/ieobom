package com.ieobom.api.task.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * 하루치 업무. 대시보드가 미처리와 완료를 구분해 그린다. (Manyfast F-HQTFLK display)
 *
 * <p>미처리와 완료를 한 배열에 담고 화면이 나누게 하지 않는다. 나누는 규칙이 화면마다 조금씩 달라지면 "아직 안 닫힌 것"의 경계가 흐려지는데, 그
 * 경계를 세는 것이 이 화면이 하는 일의 전부다.
 *
 * <p>상태 필터 파라미터를 두지 않고 둘 다 내려준다. 하루치가 어르신 20~30명 규모라 응답이 작고, 대시보드는 두 영역을 동시에 그린다. 미처리만
 * 필요한 하원 브리핑은 {@link TaskBriefingResponse} 로 따로 간다.
 *
 * @param date 조회 기준일. 업무가 만들어진 날이다
 * @param pending 미처리. 기한 순
 * @param done 완료. 완료 시각 역순
 * @param pendingCount 미처리 건수
 * @param doneCount 완료 건수
 */
public record TaskListResponse(
		LocalDate date,
		List<TaskResponse> pending,
		List<TaskResponse> done,
		int pendingCount,
		int doneCount) {

	/**
	 * 건수를 배열 길이와 따로 담는 이유.
	 *
	 * <p>"오늘 몇 건이 확인되지 않은 채 넘어갔는가"는 목록을 그리기 위한 값이 아니라 <b>그 자체가 답인 값</b>이다. 화면이 배열 길이를 세게 하면
	 * 목록을 잘라 보여 주는 순간 숫자도 같이 줄어든다.
	 *
	 * <p><b>화면이 이 숫자를 그대로 그린다.</b> 하원 미처리 브리핑은 목록과 별도로 건수를 세워 보여 주고(Manyfast R-MFISQE 수락기준,
	 * 유저플로우 "AI 인계 도구 내비게이션 맵" n45 미처리 건수·목록), 대시보드 미처리 영역에도 같은 숫자를 붙인다.
	 */
	public static TaskListResponse of(
			LocalDate date, List<TaskResponse> pending, List<TaskResponse> done) {
		return new TaskListResponse(date, pending, done, pending.size(), done.size());
	}
}
