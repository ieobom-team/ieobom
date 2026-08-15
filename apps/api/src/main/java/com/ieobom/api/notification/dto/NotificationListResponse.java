package com.ieobom.api.notification.dto;

import java.util.List;

/**
 * 한 직원의 알림함. (Manyfast F-JIEOJO display)
 *
 * <p><b>오늘과 지난 것을 서버가 갈라 준다.</b> 화면이 {@code createdAt} 을 보고 나누게 하지 않는 이유는, 하루의 경계가 이
 * 제품에서 그냥 자정이 아니기 때문이다 — 당일만 보는 것이 업무 목록 · 하원 브리핑과 공유하는 규칙이라, 그 경계를 서버 한 곳에서 정해야
 * 세 화면이 같은 하루를 본다.
 *
 * @param unreadCount 읽지 않은 개수. <b>{@code today} 안에서만 센다.</b> (Manyfast F-JIEOJO rules)
 *     누적으로 세면 하원 미처리 브리핑의 "오늘 미처리 건수"와 어긋나고, 어제 못 본 알림이 오늘 배지에 남는 것은 범위 밖인 "다음 교대
 *     자동 승계"와 구분되지 않는다
 * @param today 오늘 만들어진 알림. 안전 관련이 먼저, 그다음 최신순
 * @param past 지난 알림. 같은 순서다. 기간 제한 없이 누적 보관하므로 (F-JIEOJO rules) 여기는 계속 길어진다
 */
public record NotificationListResponse(
		String staffCode,
		int unreadCount,
		List<NotificationResponse> today,
		List<NotificationResponse> past) {}
