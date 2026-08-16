package com.ieobom.api.notification.push;

import com.ieobom.api.common.BaseTimeEntity;
import com.ieobom.api.staff.Staff;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 개인 기기 브라우저의 웹 푸시 구독 정보. (Manyfast F-QPWGNS, #72)
 *
 * <p>구독 식별값({@code endpoint})은 기기·브라우저 단위로 유일하며({@code uk_push_subscription_endpoint}),
 * 같은 기기에서 다시 등록하면 연결 직원({@code staff})만 덮어쓴다. (기기 단위 upsert)
 */
@Entity
@Getter
@Table(
		name = "push_subscription",
		uniqueConstraints = {
			@UniqueConstraint(
					name = "uk_push_subscription_endpoint",
					columnNames = {"endpoint"})
		})
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PushSubscription extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "staff_id", nullable = false)
	private Staff staff;

	@Column(name = "endpoint", nullable = false, length = 1000)
	private String endpoint;

	@Column(name = "p256dh", nullable = false, length = 255)
	private String p256dh;

	@Column(name = "auth", nullable = false, length = 255)
	private String auth;

	@Column(name = "last_status", length = 30)
	private String lastStatus;

	@Column(name = "last_sent_at")
	private LocalDateTime lastSentAt;

	public PushSubscription(Staff staff, String endpoint, String p256dh, String auth) {
		this.staff = staff;
		this.endpoint = endpoint;
		this.p256dh = p256dh;
		this.auth = auth;
	}

	public void updateStaff(Staff newStaff) {
		this.staff = newStaff;
	}

	public void updateKeys(String p256dh, String auth) {
		this.p256dh = p256dh;
		this.auth = auth;
	}

	public void recordSuccess(LocalDateTime sentAt) {
		this.lastStatus = "SUCCESS";
		this.lastSentAt = sentAt;
	}

	public void recordFailure(String status, LocalDateTime sentAt) {
		this.lastStatus = status;
		this.lastSentAt = sentAt;
	}
}
