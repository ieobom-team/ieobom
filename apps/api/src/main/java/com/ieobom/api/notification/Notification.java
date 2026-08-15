package com.ieobom.api.notification;

import com.ieobom.api.common.BaseTimeEntity;
import com.ieobom.api.staff.Staff;
import com.ieobom.api.task.Task;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 배정 사실을 담당 직원에게 닿게 하는 앱 안 알림. (Manyfast F-JIEOJO)
 *
 * <p><b>알림은 업무 하나만 가리킨다.</b> (Manyfast F-JIEOJO dataSpec) 여러 업무를 한 줄로 묶으면 "3건이 배정됐습니다"가 되는데,
 * 그 줄을 눌러 갈 곳이 없다. 알림함이 하는 일은 업무 상세로 데려다주는 것이다.
 *
 * <p><b>알림 본문 문자열을 저장하지 않는다.</b> 어르신 이름 · 업무 내용 · 기한은 모두 업무에서 그때그때 읽는다. 문장을 만들어 두면
 * 업무가 바뀌었을 때 (누군가 맡거나 완료하거나) 알림함이 옛말을 하게 된다. Manyfast 가 "직종 배정 알림은 다른 직원이 그 업무를 맡으면
 * 누가 맡았는지 보여 주는 내용으로 갱신된다"고 하는 것을, 저장된 문구를 UPDATE 하는 대신 <b>업무를 다시 읽는 것</b>으로 지킨다.
 *
 * <p>다만 {@code actorName} 만은 저장한다. 알림을 일으킨 사람은 그 시점의 사실이라 업무에서 되짚을 수 없다 — 배정한 사람은 업무에
 * 남지 않고, 완료 확인자는 나중에 덮일 수 있는 값이 아니지만 배정 알림에는 애초에 없다.
 */
@Getter
@Entity
@Table(
		name = "notification",
		uniqueConstraints =
				@UniqueConstraint(
						name = "uk_notification_task_recipient_type",
						columnNames = {"task_id", "recipient_staff_id", "type"}))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Notification extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/**
	 * 이 알림을 받는 직원. (Manyfast F-JIEOJO dataSpec)
	 *
	 * <p>업무의 담당자가 이름 문자열인 것과 갈리는 지점이다. 업무는 앱을 쓰지 않는 직종에도 배정되므로 가리킬 직원 행이 없을 수 있지만,
	 * 알림은 <b>받을 사람이 명단에 있어야만</b> 만들어진다. (Manyfast F-JIEOJO preconditions) 받는 사람이 없는 알림은
	 * 조회될 길이 없다.
	 */
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(
			name = "recipient_staff_id",
			nullable = false,
			foreignKey = @ForeignKey(name = "fk_notification_recipient_staff"))
	private Staff recipientStaff;

	/** 알림이 가리키는 후속 업무. 언제나 하나다. (Manyfast F-JIEOJO dataSpec) */
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(
			name = "task_id",
			nullable = false,
			foreignKey = @ForeignKey(name = "fk_notification_task"))
	private Task task;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 30)
	private NotificationType type;

	/**
	 * 이 알림을 일으킨 사람의 이름. 배정 알림이면 배정한 사람, 대리 완료 알림이면 완료를 확인한 사람이다.
	 *
	 * <p>배정 알림에서는 비어 있을 수 있다. 배정자 사번을 보내지 않은 요청이거나 명단에 없는 사번이었을 때다. 그때도 알림은 만든다 —
	 * 배정한 사람을 모르는 것보다 배정 사실이 닿지 않는 것이 더 나쁘다.
	 */
	@Column(length = 50)
	private String actorName;

	/** 읽은 시각. 읽기 전까지 비어 있다. (Manyfast F-JIEOJO dataSpec) */
	private LocalDateTime readAt;

	@Builder
	private Notification(
			Staff recipientStaff, Task task, NotificationType type, String actorName) {
		this.recipientStaff = recipientStaff;
		this.task = task;
		this.type = type;
		this.actorName = actorName;
	}

	public boolean isRead() {
		return readAt != null;
	}

	/**
	 * 읽음으로 바꾼다. (Manyfast F-JIEOJO action)
	 *
	 * <p><b>이미 읽은 알림은 시각을 덮지 않는다.</b> 읽음 시각이 답하는 질문은 "언제 알아챘는가"이고, 다시 눌렀다고 그 시점이 지금으로
	 * 옮겨 가면 배정에서 확인까지 걸린 시간을 물을 수 없게 된다. 그 값이 이 기능이 실제로 효과가 있었는지를 재는 유일한 숫자다.
	 */
	public void markRead() {
		if (readAt == null) {
			this.readAt = LocalDateTime.now();
		}
	}
}
