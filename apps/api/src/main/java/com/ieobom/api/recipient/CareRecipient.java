package com.ieobom.api.recipient;

import com.ieobom.api.common.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 어르신. 인계 입력과 카드가 붙는 기준 대상이다. */
@Getter
@Entity
@Table(
		name = "care_recipient",
		uniqueConstraints = @UniqueConstraint(name = "uk_care_recipient_code", columnNames = "code"))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CareRecipient extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 50)
	private String name;

	/**
	 * 센터 내 식별번호이자 <b>내부 ID</b>. 동명이인을 구분하고, LLM 요청에서 실명을 대신한다.
	 *
	 * <p>새 필드를 만들지 않고 이 필드가 그 역할을 겸한다. (Manyfast F-LUDCWW dataSpec — "어르신은 이름, 내부 ID, 등록 시점을
	 * 가진다") 형식은 접두어 + 순번이다. ({@link RecipientCodeIssuer})
	 */
	@Column(nullable = false, length = 30)
	private String code;

	/**
	 * 이용 종료 시점. {@code null} 이면 이용 중이다. (Manyfast F-LUDCWW dataSpec)
	 *
	 * <p>불리언 대신 시점을 담는다. 언제 종료했는지가 남아야 이벤트 로그와 대조할 수 있고, 값 하나로 상태와 시점을 함께 표현한다.
	 */
	private LocalDateTime dischargedAt;

	@Builder
	private CareRecipient(String name, String code) {
		this.name = name;
		this.code = code;
	}

	public boolean isDischarged() {
		return dischargedAt != null;
	}

	/** 이름을 고친다. 내부 ID는 그대로 둔다 — 기존 인계 기록이 이 어르신을 가리키고 있다. */
	public void rename(String name) {
		this.name = name;
	}

	/**
	 * 이용 종료로 표시한다. 이미 종료한 어르신이면 시점을 덮어쓰지 않는다.
	 *
	 * @return 이번 호출로 상태가 바뀌었으면 {@code true}
	 */
	public boolean discharge(LocalDateTime at) {
		if (isDischarged()) {
			return false;
		}
		this.dischargedAt = at;
		return true;
	}
}
