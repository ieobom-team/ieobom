package com.ieobom.api.export;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ExportPhraseRepository extends JpaRepository<ExportPhrase, Long> {

	/** 카드 한 장의 문구. 유형별로 하나씩이므로 최대 두 개다. */
	List<ExportPhrase> findByHandoverCardIdOrderByIdAsc(Long handoverCardId);

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
