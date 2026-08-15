package com.ieobom.api.task;

/**
 * 후속 업무가 배정됐다. 알림은 이 사건을 듣고 만들어진다. (Manyfast F-JIEOJO trigger)
 *
 * <p><b>업무 패키지가 알림 패키지를 부르지 않게 하려고 사건으로 끊는다.</b> 업무 생성은 알림이 있든 없든 성립하는 동작이고, 반대로 알림은
 * 업무 없이는 뜻이 없다. 의존은 그 방향으로만 흘러야 한다.
 *
 * <p>업무의 나머지 값(담당 직종 · 담당자 사번 · 어르신 · 기한)을 싣지 않는 이유는 받는 쪽이 어차피 업무를 다시 읽기 때문이다. 사건에
 * 복사해 두면 두 값이 갈라질 자리가 생긴다. 배정한 사람만은 업무에 남지 않아 여기서만 전달된다.
 *
 * @param assignedByStaffCode 배정한 직원의 사번. 화면이 보내지 않았으면 {@code null}
 */
public record TaskAssignedEvent(Long taskId, String assignedByStaffCode) {}
