package com.ieobom.api.task;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TaskRepository extends JpaRepository<Task, Long> {

	/** 카드 한 장에서 업무를 두 번 만들지 않기 위해 본다. */
	boolean existsByHandoverCardId(Long handoverCardId);

	/**
	 * 업무 하나를 연결 카드와 어르신까지 함께 읽는다.
	 *
	 * <p>업무는 그 자체로 "누구의 무슨 일인지"를 말해야 한다. 어르신을 지연 로딩에 맡기면 응답을 만드는 자리마다 트랜잭션 경계를 신경 써야 한다.
	 * ({@code open-in-view: false})
	 */
	@Query(
			"""
			select t from Task t
			join fetch t.handoverCard c
			left join fetch c.careRecipient
			where t.id = :id
			""")
	Optional<Task> findWithCard(Long id);

	/**
	 * 그날 만들어진 업무. 연결 카드와 어르신까지 함께 읽는다.
	 *
	 * <p>업무의 {@code createdAt} 으로 하루를 가른다({@code HandoverCardRepository.findCreatedBetween} 과 같은
	 * 방식). 기한이 항상 당일 시각이므로, 업무를 배정한 날이 곧 그 업무가 속한 날이다.
	 */
	@Query(
			"""
			select t from Task t
			join fetch t.handoverCard c
			left join fetch c.careRecipient
			where t.createdAt >= :from and t.createdAt < :to
			""")
	List<Task> findCreatedBetween(LocalDateTime from, LocalDateTime to);

	/**
	 * 카드 여러 장에 붙은 업무를 한 번에 읽는다.
	 *
	 * <p>어르신 당일 표({@code ExportSheetService})가 쓴다. 카드마다 따로 물으면 그날 카드 수만큼 질의가 나가고, 표는 카드가 많을수록
	 * 자주 열리는 화면이다.
	 *
	 * <p>연결 카드를 함께 읽지 않는다. 부르는 쪽이 이미 카드를 손에 들고 있고, 여기서는 어느 카드의 업무인지만 알면 된다.
	 *
	 * <p><b>빈 목록으로 부르지 않는다.</b> {@code in ()} 는 DB 마다 다르게 취급된다. 카드가 없으면 물을 이유도 없다.
	 */
	@Query("select t from Task t where t.handoverCard.id in :cardIds")
	List<Task> findByCardIds(Collection<Long> cardIds);
}
