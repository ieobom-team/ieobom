package com.ieobom.api.task.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * 하원 미처리 브리핑. 그날 아직 닫히지 않은 업무만 담는다. (Manyfast F-HQTFLK display, 유저플로우 "AI 인계 도구 내비게이션 맵" n44 하원 미처리
 * 브리핑 · n45 미처리 건수·목록, "새 플로우 5" n58 하원 미처리 브리핑 · n59 담당자 확정·미확정 건수)
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
 * @param claimedCount 그중 <b>맡은 사람이 있는</b> 건수
 * @param unclaimedCount 그중 <b>아직 아무도 맡지 않은</b> 건수. 직종에만 배정된 채 남아 있는 업무다
 */
public record TaskBriefingResponse(
		LocalDate date,
		List<TaskResponse> pending,
		int pendingCount,
		int claimedCount,
		int unclaimedCount) {

	/**
	 * 미처리 건수를 담당 확정 여부로 나눈다. (Manyfast F-IVFNPC display)
	 *
	 * <p><b>이 둘을 나누는 것이 이 응답이 새로 답하는 질문이다.</b> 합계만 주면 관리자는 남은 업무가 "아무도 손대지 않은 것"인지 "누군가
	 * 맡아 처리 중인 것"인지 구분할 수 없고, 하원 전에 사람을 붙여야 할 대상이 어느 쪽인지도 알 수 없다.
	 *
	 * <p>기준은 담당자 이름 하나다. 직접 배정이든 직종에서 맡은 것이든 <b>사람이 정해졌으면 확정</b>으로 센다. 관리자가 여기서 묻는 것은 어떻게
	 * 정해졌는가가 아니라 정해졌는가이다.
	 *
	 * <p>{@code claimedCount + unclaimedCount == pendingCount} 가 언제나 성립한다. 완료된 업무는 애초에
	 * {@code pending} 에 없으므로 어느 쪽에도 세지 않는다.
	 */
	public static TaskBriefingResponse of(LocalDate date, List<TaskResponse> pending) {
		int claimed = (int) pending.stream().filter(task -> task.assigneeName() != null).count();
		return new TaskBriefingResponse(
				date, pending, pending.size(), claimed, pending.size() - claimed);
	}
}
