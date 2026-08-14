package com.ieobom.api.handover;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HandoverAudioRepository extends JpaRepository<HandoverAudio, Long> {

	Optional<HandoverAudio> findByHandoverId(Long handoverId);
}
