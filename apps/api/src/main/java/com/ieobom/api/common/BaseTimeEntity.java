package com.ieobom.api.common;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import java.time.LocalDateTime;
import lombok.Getter;

/**
 * 생성·수정 시각을 공통으로 갖는 엔티티의 상위 타입.
 *
 * <p>JPA 라이프사이클 콜백으로 채우므로 {@code @EnableJpaAuditing} 설정이 필요 없다.
 */
@Getter
@MappedSuperclass
public abstract class BaseTimeEntity {

	@Column(nullable = false, updatable = false)
	private LocalDateTime createdAt;

	@Column(nullable = false)
	private LocalDateTime updatedAt;

	@PrePersist
	void onCreate() {
		LocalDateTime now = LocalDateTime.now();
		this.createdAt = now;
		this.updatedAt = now;
	}

	@PreUpdate
	void onUpdate() {
		this.updatedAt = LocalDateTime.now();
	}
}
