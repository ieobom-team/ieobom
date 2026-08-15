package com.ieobom.api.notification;

import com.ieobom.api.common.RequestValidationException;
import com.ieobom.api.notification.dto.NotificationListResponse;
import com.ieobom.api.notification.dto.NotificationReadRequest;
import com.ieobom.api.notification.dto.NotificationResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 앱 안 알림함. 계약은 {@code docs/contracts/notification-api.md} 에 있다.
 *
 * <p><b>보내는 엔드포인트가 없다.</b> 알림은 업무가 배정되거나 대리 완료될 때 서버가 스스로 만든다. 화면이 "알림을 보내 줘"라고
 * 부를 수 있으면 배정과 알림이 갈라져, 배정은 됐는데 알림은 안 간 상태를 화면이 만들 수 있다.
 *
 * <p>웹 푸시 · 기기 구독은 여기 없다. 별도 Feature 다. (Manyfast F-QPWGNS)
 */
@RestController
@RequiredArgsConstructor
public class NotificationController {

	private final NotificationService notificationService;

	/**
	 * 그 직원의 알림함. (유저플로우 "새 플로우 5" 알림함 화면 · {@code 배정 알림 목록})
	 *
	 * <p><b>사번을 쿼리로 받는다.</b> 인증이 없으므로 (Manyfast F-JIEOJO permissions) 서버가 "너 누구냐"를 알 길이
	 * 화면이 보내는 값뿐이다. 계정 모델을 만들지 않는다는 원칙의 연장이고, 담당 확정이 사번을 받는 것과 같은 자리다.
	 *
	 * <p>여는 것만으로는 읽음이 되지 않는다. (F-JIEOJO rules) 읽음은 아래 {@code read} 뿐이다.
	 *
	 * <p>사번을 {@code required = false} 로 받고 직접 검사하는 이유는 <b>오류 응답 형태</b> 때문이다. Spring 이
	 * 빠진 파라미터를 스스로 막으면 {@link com.ieobom.api.common.ApiErrorResponse} 가 아닌 다른 모양이 나가고,
	 * 화면은 이 API 에서만 다른 오류 형식을 다뤄야 한다.
	 */
	@GetMapping("/api/notifications")
	public NotificationListResponse findForStaff(
			@RequestParam(required = false) String staffCode) {
		String normalized = staffCode == null ? null : staffCode.trim();
		if (normalized == null || normalized.isEmpty()) {
			throw new RequestValidationException("staffCode", "직원 사번을 함께 보내 주세요.");
		}
		return notificationService.findForStaff(normalized);
	}

	/**
	 * 알림 하나를 읽음으로 바꾼다. (유저플로우 "새 플로우 5" {@code 알림 항목 선택})
	 *
	 * <p>화면은 이 호출과 함께 업무 상세로 이동한다. 두 동작을 한 요청으로 묶지 않는 이유는, 이동은 화면이 이미 들고 있는
	 * {@code task.id} 로 하면 되고 서버가 관여할 일이 아니기 때문이다.
	 *
	 * <p>이미 읽은 알림이어도 {@code 200} 이다. 읽음 시각은 처음 값 그대로 두고 지금 상태를 돌려준다.
	 */
	@PatchMapping("/api/notifications/{notificationId}/read")
	public NotificationResponse read(
			@PathVariable Long notificationId, @Valid @RequestBody NotificationReadRequest request) {
		return notificationService.markRead(notificationId, request.normalizedStaffCode());
	}
}
