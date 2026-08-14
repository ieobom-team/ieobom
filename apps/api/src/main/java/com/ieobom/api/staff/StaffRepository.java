package com.ieobom.api.staff;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StaffRepository extends JpaRepository<Staff, Long> {

	/** 사번으로 직원을 찾는다. */
	Optional<Staff> findByCode(String code);

	/** 시드가 이미 들어간 사번인지 확인한다. */
	boolean existsByCode(String code);
}
