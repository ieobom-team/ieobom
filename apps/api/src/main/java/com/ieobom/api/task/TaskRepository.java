package com.ieobom.api.task;

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
}
