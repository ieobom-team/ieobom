package com.ieobom.api.task.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * 하루치 업무 목록.
 *
 * <p>현장 근무자 업무 목록 화면(Manyfast F-IVFNPC display)과 관리자 대시보드(Manyfast F-HQTFLK display)가
 * 함께 사용한다.
 *
 * <ul>
 *   <li>{@code tasks}: 전체 업무 목록 (미처리 우선, 기한 순 정렬)
 *   <li>{@code pending}: 미처리 업무 (기한 빠른 순)
 *   <li>{@code done}: 완료된 업무 (완료 시각 역순)
 *   <li>{@code pendingCount}: 미처리 건수
 *   <li>{@code doneCount}: 완료 건수
 * </ul>
 *
 * @param date 조회 기준일. 업무가 만들어진 날이다
 * @param tasks 전체 업무. 미처리 우선, 기한 순
 * @param pending 미처리. 기한 순
 * @param done 완료. 완료 시각 역순
 * @param pendingCount 미처리 건수
 * @param doneCount 완료 건수
 */
public record TaskListResponse(
		LocalDate date,
		List<TaskResponse> tasks,
		List<TaskResponse> pending,
		List<TaskResponse> done,
		int pendingCount,
		int doneCount) {

	public static TaskListResponse of(
			LocalDate date,
			List<TaskResponse> tasks,
			List<TaskResponse> pending,
			List<TaskResponse> done) {
		return new TaskListResponse(date, tasks, pending, done, pending.size(), done.size());
	}
}
