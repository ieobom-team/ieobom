package com.ieobom.api.staff;

import com.ieobom.api.common.JobRole;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StaffRepository extends JpaRepository<Staff, Long> {

	/** 사번으로 직원을 찾는다. */
	Optional<Staff> findByCode(String code);

	/** 시드가 이미 들어간 사번인지 확인한다. */
	boolean existsByCode(String code);

	/**
	 * 그 직종에 등록된 직원 전원. 직종에만 배정된 업무의 알림 수신자다. (Manyfast F-JIEOJO action)
	 *
	 * <p>비어 있을 수 있다. 그때는 알림 없이 업무만 만들어진다. (F-JIEOJO exceptions) 직종에 사람이 없는 것은 오류가 아니라
	 * 그 시설의 명단 상태다.
	 *
	 * <p><b>직원 수만큼 알림 행이 생긴다.</b> 파일럿 규모(직종당 한 자릿수)를 전제한 구조이고 상한을 두지 않았다. 근거 있는 상한이
	 * 없어 지금 정하면 추측이 되고, 규모가 문제가 되면 그때가 {@code propose-change} 지점이다.
	 */
	List<Staff> findByJobRole(JobRole jobRole);
}
