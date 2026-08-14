package com.ieobom.api.staff;

import com.ieobom.api.common.JobRole;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 데모용 직원 명단을 채운다.
 *
 * <p>명단이 비어 있으면 진입 화면에서 본인을 고를 수 없어 앱 전체가 시작되지 않으므로 기동 시 한 번 확인한다. 사번 단위로 확인해서 넣기 때문에 여러 번
 * 기동해도 중복이 쌓이지 않는다.
 *
 * <p>입·퇴사 반영은 이 시드를 고치거나 DB 를 직접 손보는 것으로 한다. **명단 관리 화면은 만들지 않는다.** (#33 — 유저플로우 "AI 인계 도구
 * 내비게이션 맵" 에 직원 명단 화면이 없다. 어르신 명단과 다른 점이다)
 *
 * <p>이름은 모두 가상 인물이다. 실제 직원 정보를 넣지 않는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StaffSeeder implements ApplicationRunner {

	private record DemoStaff(String name, JobRole jobRole) {}

	private static final List<DemoStaff> DEMO_STAFF =
			List.of(
					new DemoStaff("김하늘", JobRole.CAREGIVER),
					new DemoStaff("이도윤", JobRole.CAREGIVER),
					new DemoStaff("박서연", JobRole.CAREGIVER),
					new DemoStaff("최민재", JobRole.NURSE_AIDE),
					new DemoStaff("정유진", JobRole.NURSE_AIDE),
					new DemoStaff("강태호", JobRole.SOCIAL_WORKER),
					new DemoStaff("윤소라", JobRole.DRIVER),
					new DemoStaff("임현우", JobRole.CENTER_HEAD));

	private final StaffRepository staffRepository;

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		int inserted = 0;
		for (int i = 0; i < DEMO_STAFF.size(); i++) {
			String code = "ST-%03d".formatted(i + 1);
			DemoStaff demo = DEMO_STAFF.get(i);
			Staff existing = staffRepository.findByCode(code).orElse(null);
			if (existing != null) {
				if (existing.getJobRole() != demo.jobRole()) {
					existing.assignJobRole(demo.jobRole());
				}
				continue;
			}
			staffRepository.save(
					Staff.builder()
							.name(demo.name())
							.code(code)
							.jobRole(demo.jobRole())
							.build());
			inserted++;
		}
		log.info("직원 시드 확인 — 새로 넣은 인원 {}명, 전체 {}명", inserted, staffRepository.count());
	}
}
