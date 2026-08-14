package com.ieobom.api.handover.dto;

/**
 * 재생할 원본 음성 한 건.
 *
 * @param mimeType 녹음한 브라우저가 알려 준 형식. 그대로 돌려줘야 재생된다
 * @param data 음성 바이트
 */
public record HandoverAudioContent(String mimeType, byte[] data) {}
