package com.ieobom.api.task;

/**
 * 후속 업무가 완료로 닫혔다. (Manyfast F-JIEOJO trigger)
 *
 * <p>대리 완료인지는 여기서 판정하지 않고 받는 쪽이 업무를 읽어 가린다. ({@code Task#isDelegated}) 판정 규칙이 두 곳에 생기면
 * 한쪽만 고쳐지는 날이 온다.
 *
 * <p><b>중복 완료 요청에서는 발행하지 않는다.</b> 이미 완료된 업무를 다시 닫으면 아무것도 바뀌지 않으므로 (Manyfast F-IVFNPC
 * exceptions), 알릴 사건도 없다.
 */
public record TaskCompletedEvent(Long taskId) {}
