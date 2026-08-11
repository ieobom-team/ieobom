package com.ieobom.api.recipient;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CareRecipientRepository extends JpaRepository<CareRecipient, Long> {

	/** 시드가 이미 들어간 식별번호인지 확인한다. */
	boolean existsByCode(String code);
}
