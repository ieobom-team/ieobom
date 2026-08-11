# handover API

현장 특이사항 입력 API.

- Manyfast: `R-LIEATL` 현장 인계 정보 수집 / `F-YJJJUX` 현장 특이사항 입력
- 기준 버전: `v0.1-core-flow`

> 제품이 **왜** 이렇게 동작하는지는 Manyfast가 기준이다. 여기에는 **JSON이 어떻게 생겼는지**만 적는다.

---

## `POST /api/handovers`

현장 입력을 **원문 그대로** 저장한다. 요약·정제하지 않는다.
AI 구조화는 이 API가 하지 않는다. (별도 Issue)

### 요청

`Content-Type: application/json`

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `careRecipientId` | number | ✅ | 대상 어르신 id |
| `rawText` | string | ✅ | 입력 원문. 1~2000자 |
| `inputMethod` | enum | ✅ | `VOICE` `TEXT` `CHECK` |
| `occurredAt` | date-time | ✅ | 특이사항이 있었던 시점. 저장 시각과 다를 수 있다 |
| `reporterName` | string | ✅ | 입력자 이름. 1~50자 |
| `proxyInput` | boolean | | 대리 입력 여부. 생략하면 `false` |
| `infoSource` | enum | | `GUARDIAN` `DRIVER` `COLLEAGUE` `OTHER` |

날짜·시각은 오프셋 없는 ISO-8601 지역 시각이다. (`2026-08-11T09:20:00`)

```json
{
  "careRecipientId": 1,
  "rawText": "등원 차량에서 보호자가 어르신이 밤사이 잠을 못 주무셨다고 전해 주셨어요.",
  "inputMethod": "TEXT",
  "occurredAt": "2026-08-11T09:20:00",
  "reporterName": "박데스크",
  "proxyInput": true,
  "infoSource": "GUARDIAN"
}
```

**입력자와 정보 출처는 다른 값이다.** `reporterName`은 앱에서 남긴 사람이고,
`infoSource`는 그 내용이 실제로 나온 곳이다. 위 예시는 보호자 → 운전원 → 데스크 근무자 경로이며,
운전원에게 앱 설치를 요구하지 않기 위해 두 값이 갈라져 있어야 한다.

### 응답 — `201 Created`

`Location: /api/handovers/{id}`

```json
{
  "id": 12,
  "careRecipientId": 1,
  "careRecipientName": "김말순",
  "rawText": "등원 차량에서 보호자가 어르신이 밤사이 잠을 못 주무셨다고 전해 주셨어요.",
  "inputMethod": "TEXT",
  "occurredAt": "2026-08-11T09:20:00",
  "reporterName": "박데스크",
  "proxyInput": true,
  "infoSource": "GUARDIAN",
  "createdAt": "2026-08-11T09:21:04.512"
}
```

직접 입력이면 `proxyInput`은 `false`, `infoSource`는 `null`이다.

### 입력 규칙

| 규칙 | 결과 |
|---|---|
| 필수 필드 누락 | `400` — 누락된 항목을 **모두** `fields`에 담아 돌려준다 |
| `proxyInput: true` 인데 `infoSource` 없음 | `400` — `fields[].field = "infoSource"` |
| `proxyInput`이 `false`/생략인데 `infoSource` 있음 | `400` — `fields[].field = "proxyInput"` |
| `careRecipientId`가 없는 어르신 | `404` |

두 번째·세 번째 규칙은 `F-YJJJUX` action 슬롯("대리 입력할 수 있으며, 이때 정보 출처를 함께 선택한다")에서 온다.
대리 입력인데 출처가 비면 "누구에게서 나온 내용인지"가 사라지고,
직접 관찰인데 출처가 붙으면 둘 중 어느 쪽이 사실인지 알 수 없다.

`occurredAt`의 미래 시각은 막지 않는다. 기기 시계 오차로 정상 입력이 거부되는 편이 더 나쁘다.

---

## 오류 응답

**모든 API가 이 형태를 공유한다.** (`com.ieobom.api.common.ApiErrorResponse`)

```json
{
  "code": "VALIDATION_FAILED",
  "message": "보완할 항목이 있습니다.",
  "fields": [
    { "field": "careRecipientId", "reason": "대상 어르신을 선택해 주세요." },
    { "field": "rawText", "reason": "입력 내용을 남겨 주세요." }
  ]
}
```

`fields`는 **보완해야 할 항목의 목록**이다. 항목을 특정할 수 없는 오류면 빈 배열이다.
저장 실패를 한 줄로만 알리면 돌봄 중인 근무자가 무엇을 고쳐야 할지 알 수 없으므로,
누락된 항목을 하나씩이 아니라 **한 번에 모아** 내려준다.

| `code` | 상태 | 언제 |
|---|---|---|
| `VALIDATION_FAILED` | `400` | 필수값 누락, 길이 초과, 필드 간 규칙 위반, 정의되지 않은 열거값 |
| `INVALID_REQUEST_BODY` | `400` | JSON 자체를 읽지 못함. 항목을 특정할 수 없다 |
| `CARE_RECIPIENT_NOT_FOUND` | `404` | `careRecipientId`에 해당하는 어르신이 없음 |

`fields`는 `field` 이름의 사전순으로 정렬해 내려준다. 클라이언트가 순서에 의존하지 않게 하기 위함이다.

---

## 이 API가 하지 않는 것

| 항목 | 어디서 |
|---|---|
| AI 구조화 · 어르신별 카드 생성 | [`handover-card-schema.md`](handover-card-schema.md) — 저장이 끝난 뒤 `POST /api/handovers/{id}/cards` 로 따로 호출한다 |
| 음성 파일 업로드 | 별도 Issue. 지금은 `inputMethod: "VOICE"` + 전사된 `rawText`만 받는다 |
| 인계 수정 · 삭제 | 미정 |
| 오프라인 임시 저장 · 자동 재전송 | **프론트엔드 책임.** 서버는 재전송된 요청을 일반 요청과 똑같이 받는다 |

**특이사항 등록 이벤트**는 별도 테이블 없이 애플리케이션 로그로 남긴다. (`HandoverService`)
Manyfast에 이벤트의 dataSpec이 없고 조회 화면도 없어서, 저장할 필드를 지금 정하면 곧 틀린 스키마가 된다.
감사 로그가 필요해지면 그때 Issue로 올린다.
