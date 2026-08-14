package com.ieobom.api.staff;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class StaffSeederTest {

	@Autowired private StaffRepository staffRepository;

	@Autowired private StaffSeeder staffSeeder;

	@Test
	void 기동하면_데모용_직원_8명이_들어간다() {
		assertThat(staffRepository.count()).isEqualTo(8);
		assertThat(staffRepository.existsByCode("ST-001")).isTrue();
		assertThat(staffRepository.existsByCode("ST-008")).isTrue();
	}

	@Test
	void 시드를_다시_돌려도_중복으로_쌓이지_않는다() {
		staffSeeder.run(new DefaultApplicationArguments());

		assertThat(staffRepository.count()).isEqualTo(8);
	}
}
