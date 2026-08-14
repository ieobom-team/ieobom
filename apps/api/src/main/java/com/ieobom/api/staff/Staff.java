package com.ieobom.api.staff;

import com.ieobom.api.common.BaseTimeEntity;
import com.ieobom.api.common.JobRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 직원. 진입 화면의 본인 선택 목록 및 업무 배정 담당자 목록이 여기서 온다. (Manyfast F-YJJJUX permissions, F-IVFNPC display)
 *
 * <p>계정이 아니다. 비밀번호도 권한도 없고, 센터가 미리 등록해 둔 명단일 뿐이다.
 */
@Getter
@Entity
@Table(
		name = "staff",
		uniqueConstraints = @UniqueConstraint(name = "uk_staff_code", columnNames = "code"))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Staff extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 50)
	private String name;

	/** 사번. 명단 안에서 유일하며 화면이 저장된 선택값을 되살릴 때 이 값을 쓴다. */
	@Column(nullable = false, length = 30)
	private String code;

	/** 담당 직종. 후속 업무 배정 시 직종별 직원 필터링에 쓴다. */
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 30)
	private JobRole jobRole;

	@Builder
	private Staff(String name, String code, JobRole jobRole) {
		this.name = name;
		this.code = code;
		this.jobRole = jobRole;
	}

	public void assignJobRole(JobRole jobRole) {
		this.jobRole = jobRole;
	}
}
