package com.ieobom.api.recipient;

import com.ieobom.api.common.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
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

	/** 센터 내 식별번호. 동명이인을 구분한다. */
	@Column(nullable = false, length = 30)
	private String code;

	@Builder
	private CareRecipient(String name, String code) {
		this.name = name;
		this.code = code;
	}
}
