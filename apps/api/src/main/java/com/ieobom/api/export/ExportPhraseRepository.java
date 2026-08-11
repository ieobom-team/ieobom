package com.ieobom.api.export;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ExportPhraseRepository extends JpaRepository<ExportPhrase, Long> {

	/** 카드 한 장의 문구. 유형별로 하나씩이므로 최대 두 개다. */
	List<ExportPhrase> findByHandoverCardIdOrderByIdAsc(Long handoverCardId);

	/**
	 * 어르신 한 명의 그날 문구. <b>검토 완료 카드의 것만 읽는다.</b> (Manyfast F-GUSOFG dataSpec)
	 *
	 * <p>거르는 일을 조회에서 하는 이유는, 문구를 만든 뒤에도 카드를 검토 필요로 되돌릴 수 있기 때문이다. 그때 이미 만들어진 문구는 남아 있으므로 묶는
	 * 시점에 다시 보지 않으면 검토가 취소된 내용이 묶음에 섞인다.
	 *
	 * <p>날짜 기준은 카드의 생성 시각이다. 카드 목록({@code HandoverCardRepository#findCreatedBetween})과 같은 기준이라야
	 * 화면에서 본 카드와 묶음의 구성이 어긋나지 않는다. 관찰 시각은 비어 있을 수 있어 기준으로 쓸 수 없다.
	 *
	 * <p>정렬은 여기서 하지 않는다. 안전 항목을 앞에 세우는 규칙을 {@code boolean} 컬럼 정렬로 DB 에 맡기면 H2 와 MySQL 에서 결과가 갈릴 수
	 * 있다.
	 */
	@Query(
			"""
			select p from ExportPhrase p
			join fetch p.handoverCard c
			join fetch c.careRecipient r
			join fetch c.handover
			where r.id = :careRecipientId
				and c.reviewStatus = com.ieobom.api.handovercard.ReviewStatus.REVIEWED
				and c.createdAt >= :from and c.createdAt < :to
			""")
	List<ExportPhrase> findReviewedByRecipientAndCardCreatedBetween(
			Long careRecipientId, LocalDateTime from, LocalDateTime to);

	/**
	 * 문구 하나를 카드까지 함께 읽는다.
	 *
	 * <p>응답에는 언제나 어느 카드에서 나온 문구인지가 함께 나간다. 문구만 있고 근거로 돌아갈 길이 없으면 직원이 확인할 수 없다. (Manyfast
	 * R-TUBGKD 수락기준)
	 */
	@Query(
			"""
			select p from ExportPhrase p
			join fetch p.handoverCard c
			left join fetch c.careRecipient
			join fetch c.handover
			where p.id = :id
			""")
	Optional<ExportPhrase> findWithCard(Long id);
}
