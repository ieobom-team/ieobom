package com.ieobom.api.recipient;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class CareRecipientSeederTest {

	@Autowired private CareRecipientRepository careRecipientRepository;

	@Autowired private CareRecipientSeeder careRecipientSeeder;

	@Test
	void 기동하면_데모용_어르신_20명이_들어간다() {
		assertThat(careRecipientRepository.count()).isEqualTo(20);
		assertThat(careRecipientRepository.existsByCode("IB-001")).isTrue();
		assertThat(careRecipientRepository.existsByCode("IB-020")).isTrue();
	}

	@Test
	void 시드를_다시_돌려도_중복으로_쌓이지_않는다() {
		careRecipientSeeder.run(new DefaultApplicationArguments());

		assertThat(careRecipientRepository.count()).isEqualTo(20);
	}
}
