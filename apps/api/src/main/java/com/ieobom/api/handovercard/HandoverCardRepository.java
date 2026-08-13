package com.ieobom.api.handovercard;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface HandoverCardRepository extends JpaRepository<HandoverCard, Long> {

	boolean existsByHandoverId(Long handoverId);

	List<HandoverCard> findByHandoverIdOrderByIdAsc(Long handoverId);

	/**
	 * 카드 하나를 어르신과 원문까지 함께 읽는다.
	 *
	 * <p>문구 생성은 LLM 응답을 기다리는 동안 트랜잭션을 열어 두지 않는다. 그래서 그때 쓸 카드는 지연 로딩에 기대지 않고 여기서 한 번에 읽어 둔다.
	 * ({@code open-in-view: false})
	 */
	@Query(
			"""
			select c from HandoverCard c
			left join fetch c.careRecipient
			join fetch c.handover
			where c.id = :id
			""")
	Optional<HandoverCard> findWithCareRecipientAndHandover(Long id);

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

	/**
	 * 어르신 한 명의 그날 카드. <b>검토 완료된 것만 읽는다.</b>
	 *
	 * <p>어르신 당일 표({@code ExportSheetService})가 쓴다. 거르는 기준을 묶음
	 * ({@code ExportPhraseRepository#findReviewedByRecipientAndCardCreatedBetween})과 똑같이 맞춘다 —
	 * 같은 화면에서 내려받는 두 파일이 서로 다른 카드를 담으면, 받은 사람은 어느 쪽이 맞는지 알 수 없다.
	 *
	 * <p>정렬은 여기서 하지 않는다. 안전 항목을 앞에 세우는 규칙을 {@code boolean} 컬럼 정렬로 DB 에 맡기면 H2 와 MySQL 에서 결과가 갈릴 수
	 * 있다.
	 */
	@Query(
			"""
			select c from HandoverCard c
			join fetch c.careRecipient r
			join fetch c.handover
			where r.id = :careRecipientId
				and c.reviewStatus = com.ieobom.api.handovercard.ReviewStatus.REVIEWED
				and c.createdAt >= :from and c.createdAt < :to
			""")
	List<HandoverCard> findReviewedByRecipientAndCreatedBetween(
			Long careRecipientId, LocalDateTime from, LocalDateTime to);
}
