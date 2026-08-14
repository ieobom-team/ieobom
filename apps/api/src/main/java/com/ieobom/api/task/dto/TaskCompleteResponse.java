package com.ieobom.api.task.dto;

import com.ieobom.api.task.Task;

/**
 * 완료 처리 결과. (Manyfast F-IVFNPC exceptions — 이미 완료된 업무를 다시 완료 처리할 때)
 *
 * <p><b>중복 완료를 오류로 돌려주지 않는다.</b> 화면이 보여 줘야 하는 것은 "실패했다"가 아니라 <b>지금 이 업무가 어떤 상태인지</b>다. 누가
 * 언제 확인했는지를 보여 줘야 직원이 다시 물어보지 않고 넘어갈 수 있는데, 오류 응답에는 그 값을 담을 자리가 없다. (유저플로우 "새 플로우 3" n36 → n37)
 *
 * @param alreadyCompleted 이번 요청 전에 이미 완료였는지. 참이면 <b>아무것도 바뀌지 않았다</b>
 * @param notice 중복일 때 화면에 띄울 한 줄. 새로 닫았으면 {@code null}
 * @param task 지금 상태. 중복이면 먼저 완료한 사람과 그 시각이 그대로 들어 있다
 */
public record TaskCompleteResponse(boolean alreadyCompleted, String notice, TaskResponse task) {

	private static final String DUPLICATE_NOTICE = "이미 완료 처리된 업무입니다. 완료 확인자와 시각을 확인해 주세요.";

	public static TaskCompleteResponse completed(Task task) {
		return new TaskCompleteResponse(false, null, TaskResponse.from(task));
	}

	public static TaskCompleteResponse duplicate(Task task) {
		return new TaskCompleteResponse(true, DUPLICATE_NOTICE, TaskResponse.from(task));
	}
}
