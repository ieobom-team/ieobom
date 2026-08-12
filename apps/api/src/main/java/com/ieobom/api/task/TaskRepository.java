package com.ieobom.api.task;

import java.time.LocalDateTime;
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
	 * <p>기준이 기한이 아니라 <b>생성 시점</b>이다. (Manyfast F-HQTFLK dataSpec) 기한으로 자르면 어제 만든 업무가 오늘 기한이라는
	 * 이유로 오늘 목록에 섞이는데, 이 제품의 기한은 날짜가 없는 당일 시각이라 그런 비교 자체가 성립하지 않는다.
	 *
	 * <p>정렬은 여기서 하지 않고 조회한 뒤 자바에서 한다. 미처리는 기한 순, 완료는 완료 시각 역순으로 서로 다른 기준을 쓰고, 같은 값일 때의 순서까지
	 * 고정해야 화면이 흔들리지 않는다. (카드 목록과 같은 방침)
	 */
	@Query(
			"""
			select t from Task t
			join fetch t.handoverCard c
			left join fetch c.careRecipient
			where t.createdAt >= :from and t.createdAt < :to
			""")
	List<Task> findCreatedBetween(LocalDateTime from, LocalDateTime to);
}
