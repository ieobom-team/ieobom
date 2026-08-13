package com.ieobom.api.staff;

import org.springframework.data.jpa.repository.JpaRepository;

public interface StaffRepository extends JpaRepository<Staff, Long> {

	/** 시드가 이미 들어간 사번인지 확인한다. */
	boolean existsByCode(String code);
}
