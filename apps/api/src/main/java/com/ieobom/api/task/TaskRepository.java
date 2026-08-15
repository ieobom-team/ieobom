package com.ieobom.api.task;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

	/**
	 * 담당자가 비어 있는 미처리 업무에만 담당을 확정한다. (Manyfast F-IVFNPC action)
	 *
	 * <p><b>경합을 자바가 아니라 {@code where} 절이 가른다.</b> 먼저 읽고 자바에서 비었는지 검사한 뒤 저장하면, 두 요청이 같은 "비어
	 * 있음"을 보고 둘 다 저장해 나중 사람이 담당자가 된다. 조건을 UPDATE 안에 두면 DB 가 행을 잠근 채 조건을 다시 보므로 성공은 한 번뿐이고,
	 * 진 쪽은 <b>영향 행 수 0</b> 으로 그 사실을 알게 된다.
	 *
	 * <p>돌려주는 값이 곧 판정이다 — {@code 1} 이면 이 요청이 담당을 잡았고, {@code 0} 이면 그사이 다른 직원이 맡았거나 업무가 완료됐다.
	 * 부르는 쪽은 0 일 때 <b>다시 읽어</b> 둘 중 무엇인지 가린다.
	 *
	 * <p>{@code clearAutomatically} 로 영속성 컨텍스트를 비운다. 이 UPDATE 는 엔티티를 거치지 않고 나가므로, 비우지 않으면 같은
	 * 트랜잭션에서 다시 읽은 업무가 담당자 없는 옛 상태로 보인다.
	 */
	@Modifying(clearAutomatically = true, flushAutomatically = true)
	@Query(
			"""
			update Task t
			set t.assigneeName = :assigneeName, t.claimedAt = :claimedAt, t.claimMethod = :claimMethod
			where t.id = :id and t.assigneeName is null and t.status = :pending
			""")
	int claimIfUnclaimed(
			Long id,
			String assigneeName,
			LocalDateTime claimedAt,
			ClaimMethod claimMethod,
			TaskStatus pending);
}
