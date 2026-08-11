package com.ieobom.api.task;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 기한이 당일 안에 닫히는 값인지 보는 규칙. (Manyfast F-IVFNPC rules)
 *
 * <p>주야간보호는 어르신이 당일 귀가한다. 그래서 기한은 날짜가 아니라 <b>당일 시각</b>이고, 기본 상한은 <b>당일 하원 시각</b>이다. 하원 뒤의
 * 시각을 기한으로 받으면 그 업무는 어르신이 이미 집에 간 뒤에 열려 있게 되고, 자동 승계가 없는 이 제품에서는 그대로 사라진다.
 *
 * <p>날짜 단위 기한과 익일 기한은 여기서 막지 않는다. 기한을 {@link LocalTime} 으로만 받으므로 날짜가 섞인 값은 요청 본문을 읽는 단계에서
 * 이미 걸러진다. 형태로 막을 수 있는 것을 규칙으로 다시 막으면 두 곳이 갈라진다.
 *
 * <p><b>하원 시각은 시설마다 다르다.</b> 지금은 설정값 하나로 두고 시설별 설정이 필요해지면 별도 Issue 로 뗀다. (#13)
 */
@Component
public class DueTimePolicy {

	private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

	private final LocalTime dismissalTime;

	DueTimePolicy(@Value("${ieobom.facility.dismissal-time:18:00}") LocalTime dismissalTime) {
		this.dismissalTime = dismissalTime;
	}

	public LocalTime dismissalTime() {
		return dismissalTime;
	}

	/** 하원 시각을 넘긴 기한인지. 하원 시각 정각은 넘긴 것이 아니다. */
	public boolean isAfterDismissal(LocalTime dueTime) {
		return dueTime.isAfter(dismissalTime);
	}

	/** 직원이 화면에서 그대로 볼 문장이다. 상한이 몇 시인지 말해 주지 않으면 무엇으로 고쳐야 할지 알 수 없다. */
	public String limitMessage() {
		return "기한은 당일 하원 시각(%s)까지만 지정할 수 있습니다.".formatted(HH_MM.format(dismissalTime));
	}
}
