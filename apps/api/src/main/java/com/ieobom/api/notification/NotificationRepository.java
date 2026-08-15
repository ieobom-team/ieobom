package com.ieobom.api.notification;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

	/**
	 * 같은 업무 · 같은 수신 직원 · 같은 유형의 알림이 이미 있는지. (Manyfast F-JIEOJO dataSpec)
	 *
	 * <p><b>이 검사가 중복을 막는 것이 아니다.</b> 막는 것은 {@code uk_notification_task_recipient_type} 유일 제약이고,
	 * 여기서는 흔한 경우를 미리 걸러 제약 위반 예외를 로그에 쌓지 않으려는 것뿐이다. 담당 확정에서 조건부 UPDATE 와 앞단 검사를 나눈 것과
	 * 같은 구조다.
	 */
	boolean existsByTaskIdAndRecipientStaffIdAndType(
			Long taskId, Long recipientStaffId, NotificationType type);

	/**
	 * 한 직원의 알림 전부. <b>누적이다.</b> (Manyfast F-JIEOJO rules — "알림은 기간 제한 없이 보관한다")
	 *
	 * <p>업무 · 카드 · 어르신까지 함께 읽는다. 알림 한 줄이 어르신 이름과 업무 내용과 기한을 모두 보여 주므로 ({@code
	 * F-JIEOJO} display), 지연 로딩에 맡기면 알림 수만큼 질의가 나간다. ({@code open-in-view: false})
	 *
	 * <p>정렬은 자바에서 한다. 오늘 / 지난 구분과 <b>안전 관련 우선</b>이 겹쳐 있고, 안전 여부는 알림이 아니라 두 단계 건너 카드에 있는
	 * 값이라 {@code order by} 로 쓰면 조건이 조회 질의에 눌러 붙는다.
	 */
	@Query(
			"""
			select n from Notification n
			join fetch n.task t
			join fetch t.handoverCard c
			left join fetch c.careRecipient
			where n.recipientStaff.id = :staffId
			""")
	List<Notification> findAllForStaff(Long staffId);

	/**
	 * 그 직원의 알림 하나. <b>사번까지 함께 건다.</b> (Manyfast F-JIEOJO permissions — "자신에게 온 알림만 조회한다")
	 *
	 * <p>id 로만 찾은 뒤 자바에서 수신자를 비교하지 않는 이유는, 그 비교를 빠뜨린 경로가 생기면 남의 알림이 읽음으로 바뀌기 때문이다.
	 * 조건을 질의에 두면 빠뜨릴 자리가 없다.
	 */
	@Query(
			"""
			select n from Notification n
			join fetch n.task t
			join fetch t.handoverCard c
			left join fetch c.careRecipient
			where n.id = :id and n.recipientStaff.code = :staffCode
			""")
	Optional<Notification> findForStaff(Long id, String staffCode);
}
