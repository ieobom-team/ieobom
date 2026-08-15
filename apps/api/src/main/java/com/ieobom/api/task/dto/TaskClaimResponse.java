package com.ieobom.api.task.dto;

import com.ieobom.api.task.Task;

/**
 * 담당 확정 결과. (Manyfast F-IVFNPC exceptions)
 *
 * <p><b>맡지 못한 것을 오류로 돌려주지 않는다.</b> {@link TaskCompleteResponse} 와 같은 이유다 — 화면이 보여 줘야 하는 것은
 * "실패했다"가 아니라 <b>지금 이 업무를 누가 맡고 있는지</b>다. "이미 이준호님이 맡았습니다"를 그리려면 이름과 시각이 필요한데, 오류
 * 응답({@code ApiErrorResponse})에는 그 값을 담을 자리가 없다.
 *
 * <p>세 결과를 각자의 불리언으로 나눈 이유는 화면이 띄우는 안내가 셋 다 다르기 때문이다. 하나의 {@code failed} 로 묶으면 화면이
 * {@code notice} 문장을 파싱해 무슨 일이 있었는지 되짚어야 한다.
 *
 * @param claimed 이번 요청으로 담당을 잡았는지. 참이면 {@code task} 의 담당자가 요청한 직원이다
 * @param alreadyClaimed 이미 다른 직원이 맡고 있었는지. 참이면 <b>아무것도 바뀌지 않았다</b>
 * @param alreadyCompleted 이미 완료된 업무였는지. 참이면 <b>아무것도 바뀌지 않았다</b>
 * @param notice 맡지 못했을 때 화면에 띄울 한 줄. 잡았으면 {@code null}
 * @param task 지금 상태. 맡지 못했으면 먼저 맡은 사람과 그 시각이 그대로 들어 있다
 */
public record TaskClaimResponse(
		boolean claimed,
		boolean alreadyClaimed,
		boolean alreadyCompleted,
		String notice,
		TaskResponse task) {

	private static final String COMPLETED_NOTICE = "이미 완료된 업무입니다. 완료 확인자와 시각을 확인해 주세요.";

	public static TaskClaimResponse claimed(Task task) {
		return new TaskClaimResponse(true, false, false, null, TaskResponse.from(task));
	}

	/** 이미 다른 직원이 맡은 업무. 누가 언제 맡았는지를 문장에 담는다. (Manyfast F-IVFNPC exceptions) */
	public static TaskClaimResponse alreadyClaimed(Task task) {
		String notice = "이미 %s님이 맡은 업무입니다.".formatted(task.getAssigneeName());
		return new TaskClaimResponse(false, true, false, notice, TaskResponse.from(task));
	}

	public static TaskClaimResponse alreadyCompleted(Task task) {
		return new TaskClaimResponse(false, false, true, COMPLETED_NOTICE, TaskResponse.from(task));
	}
}
