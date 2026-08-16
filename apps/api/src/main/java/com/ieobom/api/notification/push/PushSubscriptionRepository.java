package com.ieobom.api.notification.push;

import com.ieobom.api.staff.Staff;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

	Optional<PushSubscription> findByEndpoint(String endpoint);

	List<PushSubscription> findAllByStaff(Staff staff);

	List<PushSubscription> findAllByStaffId(Long staffId);

	@Modifying
	@Query("delete from PushSubscription p where p.endpoint = :endpoint")
	void deleteByEndpoint(@Param("endpoint") String endpoint);

	@Modifying
	@Query("delete from PushSubscription p where p.staff = :staff")
	void deleteByStaff(@Param("staff") Staff staff);
}
