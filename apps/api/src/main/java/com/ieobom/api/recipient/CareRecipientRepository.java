package com.ieobom.api.recipient;

import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CareRecipientRepository extends JpaRepository<CareRecipient, Long> {

	/** 시드가 이미 들어간 식별번호인지 확인한다. */
	boolean existsByCode(String code);

	/** 이용 중인 어르신만. 이용 종료한 어르신은 새 입력의 대상이 아니다. (Manyfast F-LUDCWW rules) */
	List<CareRecipient> findByDischargedAtIsNull(Sort sort);

	/** 동명이인 확인용. 이용 종료한 어르신도 이름을 차지하고 있으므로 함께 본다. */
	List<CareRecipient> findByName(String name);

	/**
	 * 다음 순번을 계산하려고 접두어가 같은 식별번호를 모은다.
	 *
	 * <p>최대값을 SQL 로 뽑지 않는다. 순번을 숫자로 비교하려면 문자열을 잘라 형변환해야 하는데, 그 표현이 H2(테스트)와 MySQL(운영)에서 같게
	 * 동작한다는 보장이 없다. 한 센터 20명 남짓이라 코드만 받아 와 자바에서 고르는 편이 안전하다.
	 */
	List<CareRecipient> findByCodeStartingWith(String prefix);
}
