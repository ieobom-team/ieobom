package com.ieobom.api.handover.dto;

/**
 * 음성을 글로 바꾼 결과.
 *
 * <p>다듬지 않은 인식 결과 그대로다. 틀린 곳은 직원이 화면에서 고친다 — 원문을 서버가 손대지 않는 것이 이 서비스의 원칙이다. (Manyfast
 * F-YJJJUX)
 *
 * @param text 인식된 글. 아무 말도 담기지 않았으면 빈 문자열이다
 */
public record HandoverTranscribeResponse(String text) {}
