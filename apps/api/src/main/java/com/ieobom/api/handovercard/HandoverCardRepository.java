package com.ieobom.api.handovercard;

import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface HandoverCardRepository extends JpaRepository<HandoverCard, Long> {

	boolean existsByHandoverId(Long handoverId);

	List<HandoverCard> findByHandoverIdOrderByIdAsc(Long handoverId);

	/**
	 * 그날 만들어진 카드. 어르신과 원문까지 함께 읽는다.
	 *
	 * <p>정렬은 여기서 하지 않고 조회한 뒤 자바에서 한다. 안전 항목을 앞에 세우는 규칙을 {@code boolean} 컬럼 정렬로 DB 에 맡기면 H2 와
	 * MySQL 에서 결과가 갈릴 수 있다.
	 */
	@Query(
			"""
			select c from HandoverCard c
			left join fetch c.careRecipient
			join fetch c.handover
			where c.createdAt >= :from and c.createdAt < :to
			""")
	List<HandoverCard> findCreatedBetween(LocalDateTime from, LocalDateTime to);
}
