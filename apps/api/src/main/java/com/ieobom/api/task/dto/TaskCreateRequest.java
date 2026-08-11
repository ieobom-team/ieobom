package com.ieobom.api.task.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.ieobom.api.common.JobRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalTime;

/**
 * 후속 업무 배정 요청. (Manyfast F-IVFNPC action)
 *
 * <p>세 칸 모두 화면이 <b>카드의 제안값으로 미리 채운 뒤</b> 직원이 확정하거나 고쳐 보낸다. 서버가 카드에서 값을 다시 끌어와 빈 칸을 메우지 않는
 * 이유는, 그러면 "직원이 그대로 확정한 것"과 "화면이 프리필에 실패해 빈 채로 보낸 것"이 요청에서 똑같이 보이기 때문이다.
 *
 * @param content 업무 내용. 카드의 다음 행동에서 나온다
 * @param assigneeJobRole 담당 직종. PRD 5개 역할로 한정한다 ({@link JobRole})
 * @param assigneeName 담당자 이름. 직종만 정하고 사람을 특정하지 않을 수 있다
 * @param dueTime 기한. <b>당일 {@code HH:MM} 만 받는다.</b> 형태를 고정해 두면 날짜 단위 기한과 익일 기한이 여기서 걸러진다
 */
public record TaskCreateRequest(
		@NotBlank(message = "업무 내용을 입력해 주세요.")
				@Size(max = 500, message = "업무 내용은 500자까지 넣을 수 있습니다.")
				String content,
		JobRole assigneeJobRole,
		@Size(max = 50, message = "담당자 이름은 50자까지 넣을 수 있습니다.") String assigneeName,
		@NotNull(message = "기한을 당일 HH:MM 으로 지정해 주세요.") @JsonFormat(pattern = "HH:mm")
				LocalTime dueTime) {

	public String normalizedContent() {
		return trimToNull(content);
	}

	public String normalizedAssigneeName() {
		return trimToNull(assigneeName);
	}

	/** 담당자를 정했는지. 직종과 이름 중 하나만 있어도 된다. (Manyfast F-IVFNPC exceptions) */
	public boolean hasAssignee() {
		return assigneeJobRole != null || normalizedAssigneeName() != null;
	}

	/** 공백만 남은 칸은 지운 것으로 본다. 화면에서 지우다 만 공백이 담당자로 저장되면 안 된다. */
	private static String trimToNull(String value) {
		if (value == null) {
			return null;
		}
		String trimmed = value.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}
}
