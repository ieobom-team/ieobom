package com.ieobom.api.common;

import com.ieobom.api.common.ApiErrorResponse.FieldError;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import tools.jackson.core.JacksonException;

/**
 * API 오류를 {@link ApiErrorResponse} 한 가지 형태로 모은다.
 *
 * <p>입력이 잘못됐을 때 저장하지 않는 것으로 끝내지 않고, 보완할 항목을 전부 모아 함께 내려주는 것이 목적이다. 돌봄 중인 근무자가 무엇을 고쳐야 하는지 한
 * 번에 알 수 있어야 재입력이 한 번으로 끝난다.
 */
@Slf4j
@RestControllerAdvice
public class ApiExceptionHandler {

	static final String VALIDATION_FAILED = "VALIDATION_FAILED";
	static final String INVALID_REQUEST_BODY = "INVALID_REQUEST_BODY";
	private static final String VALIDATION_MESSAGE = "보완할 항목이 있습니다.";

	/** 애너테이션 검증 실패. 누락·형식 오류를 항목별로 모두 담는다. */
	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ApiErrorResponse> handleMethodArgumentNotValid(
			MethodArgumentNotValidException e) {
		List<FieldError> fields =
				e.getBindingResult().getFieldErrors().stream()
						.map(error -> new FieldError(error.getField(), error.getDefaultMessage()))
						.distinct()
						.sorted(Comparator.comparing(FieldError::field))
						.toList();

		log.debug("입력 검증 실패 — 보완할 항목 {}개 {}", fields.size(), fields);
		return ResponseEntity.badRequest()
				.body(new ApiErrorResponse(VALIDATION_FAILED, VALIDATION_MESSAGE, fields));
	}

	/** 필드 사이의 관계를 보는 규칙 위반. */
	@ExceptionHandler(RequestValidationException.class)
	public ResponseEntity<ApiErrorResponse> handleRequestValidation(RequestValidationException e) {
		log.debug("입력 규칙 위반 — {}", e.getMessage());
		return ResponseEntity.badRequest()
				.body(new ApiErrorResponse(VALIDATION_FAILED, VALIDATION_MESSAGE, e.getFields()));
	}

	/**
	 * 본문 자체를 읽지 못한 경우. 정의되지 않은 열거값이나 깨진 날짜 형식이 여기로 온다.
	 *
	 * <p>Jackson 이 어느 필드에서 막혔는지 알려 주면 그 이름을 그대로 항목으로 돌려준다.
	 */
	@ExceptionHandler(HttpMessageNotReadableException.class)
	public ResponseEntity<ApiErrorResponse> handleNotReadable(HttpMessageNotReadableException e) {
		log.debug("요청 본문을 읽지 못함 — {}", e.getMessage());

		String field = rejectedField(e);
		ApiErrorResponse body =
				field == null
						? ApiErrorResponse.of(INVALID_REQUEST_BODY, "요청 형식을 읽을 수 없습니다.")
						: new ApiErrorResponse(
								VALIDATION_FAILED,
								VALIDATION_MESSAGE,
								List.of(new FieldError(field, "값의 형식이 올바르지 않습니다.")));
		return ResponseEntity.badRequest().body(body);
	}

	@ExceptionHandler(NotFoundException.class)
	public ResponseEntity<ApiErrorResponse> handleNotFound(NotFoundException e) {
		log.debug("대상을 찾지 못함 — {}", e.getMessage());
		return ResponseEntity.status(HttpStatus.NOT_FOUND)
				.body(ApiErrorResponse.of(e.getCode(), e.getMessage()));
	}

	@ExceptionHandler(ConflictException.class)
	public ResponseEntity<ApiErrorResponse> handleConflict(ConflictException e) {
		log.debug("지금 상태에서 할 수 없는 요청 — {}", e.getMessage());
		return ResponseEntity.status(HttpStatus.CONFLICT)
				.body(ApiErrorResponse.of(e.getCode(), e.getMessage()));
	}

	/**
	 * 바깥 의존성이 응답하지 못한 경우.
	 *
	 * <p>원인은 로그로 남기고 응답에는 내보내지 않는다. 예외 메시지에 요청 본문이나 키가 섞여 나갈 수 있기 때문이다.
	 */
	@ExceptionHandler(ServiceUnavailableException.class)
	public ResponseEntity<ApiErrorResponse> handleServiceUnavailable(ServiceUnavailableException e) {
		log.error("바깥 의존성 호출 실패 — {}", e.getMessage(), e);
		return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
				.body(ApiErrorResponse.of(e.getCode(), e.getMessage()));
	}

	/**
	 * Jackson 이 막힌 지점의 필드 이름. 알 수 없으면 {@code null}.
	 *
	 * <p>Jackson 3 기준이다. 경로 참조는 {@code tools.jackson.core.JacksonException.Reference} 이고 이름은
	 * {@code getPropertyName()} 으로 꺼낸다.
	 */
	private String rejectedField(HttpMessageNotReadableException e) {
		if (!(e.getCause() instanceof JacksonException cause)) {
			return null;
		}
		String path =
				cause.getPath().stream()
						.map(JacksonException.Reference::getPropertyName)
						.filter(Objects::nonNull)
						.collect(Collectors.joining("."));
		return path.isEmpty() ? null : path;
	}
}
