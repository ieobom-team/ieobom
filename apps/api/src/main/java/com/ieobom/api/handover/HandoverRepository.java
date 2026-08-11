package com.ieobom.api.handover;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface HandoverRepository extends JpaRepository<Handover, Long> {

	/**
	 * 어르신까지 함께 읽는다.
	 *
	 * <p>구조화는 LLM 응답을 기다리는 동안 트랜잭션을 붙들지 않으려고 트랜잭션 밖에서 돈다. 그래서 어르신 이름을 나중에 꺼내면 지연 로딩이 실패한다.
	 * 필요한 것을 처음 조회에서 함께 가져온다.
	 */
	@Query("select h from Handover h join fetch h.careRecipient where h.id = :id")
	Optional<Handover> findWithCareRecipient(Long id);
}
