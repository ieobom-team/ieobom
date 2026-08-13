package com.ieobom.api.task.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * 그날의 업무 목록. (유저플로우 "새 플로우 3" n31 · n32)
 *
 * <p>어르신별로 묶지 않는다. 카드 목록과 달리 업무는 담당자·기한이 이미 붙어 있어 "누구 일인지"보다
 * "누가 언제까지 무엇을 해야 하는지"가 화면이 먼저 보여줘야 하는 값이다. (Manyfast F-IVFNPC display)
 *
 * @param date 조회 기준일. 업무가 만들어진 날이다
 */
public record TaskListResponse(LocalDate date, List<TaskResponse> tasks) {}
