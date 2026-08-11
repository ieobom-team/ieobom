# handover card schema

AI 구조화 결과의 JSON 스키마와 카드 API.

- Manyfast: `R-ONESTC` 어르신별 인계 정보 정리 / `F-SNBVHR` 어르신별 인계 카드 정리
- 기준 버전: `v0.1-core-flow`

> 제품이 **왜** 이렇게 동작하는지는 Manyfast가 기준이다. 여기에는 **JSON이 어떻게 생겼는지**만 적는다.

---

## 흐름

```
POST /api/handovers            원문 저장 (handover-api.md)
      ↓                        저장은 즉시 끝난다. LLM을 기다리지 않는다
POST /api/handovers/{id}/cards AI 구조화 → 검증 → 카드 저장
      ↓
GET  /api/handover-cards?date= 어르신별 카드 목록
```

구조화를 `POST /api/handovers` 안에서 하지 않는다. 현장 입력 저장이 LLM 응답 시간과 실패에 묶이면
돌봄 중인 근무자가 저장 성공을 확인하기까지 수 초를 기다리게 되고, LLM이 죽으면 입력 자체가 막힌다.
프론트는 저장이 `201`로 끝난 뒤 이어서 구조화를 호출한다.

---

## LLM에 강제하는 스키마

Function Calling으로 강제한다. `tool_choice`로 함수 호출을 고정하므로 모델이 자유 텍스트로 답할 수 없다.
`strict: true`와 `additionalProperties: false`가 함께 걸려 있어 **정해진 필드 외의 값은 만들어질 수 없다.**

정의는 `com.ieobom.api.ai.HandoverStructuringSchema`에 있고, 아래는 그 함수 인자의 모양이다.

```json
{
  "cards": [
    {
      "recipientName": "김말순",
      "statusChange": "점심 식사량 저하",
      "actionTaken": null,
      "nextAction": "저녁 식사량 확인",
      "evidenceText": "점심을 거의 안 드셨어요",
      "suggestedJobRole": "CAREGIVER",
      "suggestedDueTime": "17:00",
      "observedTime": "12:40",
      "safetyCategory": "POOR_INTAKE"
    }
  ]
}
```

| 필드 | 타입 | 비고 |
|---|---|---|
| `recipientName` | string \| null | **후보 목록에 있는 이름만.** 대상을 가릴 수 없으면 `null` |
| `statusChange` | string \| null | 상태 변화 |
| `actionTaken` | string \| null | 현장에서 이미 한 조치 |
| `nextAction` | string \| null | 남아 있는 다음 행동 |
| `evidenceText` | **string** | 근거 원문 구간. **이 필드만 `null`을 허용하지 않는다** |
| `suggestedJobRole` | enum | `CAREGIVER` `NURSE_AIDE` `SOCIAL_WORKER` `DRIVER` `CENTER_HEAD` `UNKNOWN` |
| `suggestedDueTime` | string \| null | 당일 `HH:MM` |
| `observedTime` | string \| null | 당일 `HH:MM` |
| `safetyCategory` | enum | `FALL` `FEVER` `POOR_INTAKE` `MEDICATION_CHANGE` `NONE` |

`strict` 모드는 모든 속성이 `required`에 있어야 한다. 그래서 "값이 없을 수 있음"을 필드 생략이 아니라
`["string", "null"]` 타입으로 표현한다. `suggestedJobRole`에 `UNKNOWN`, `safetyCategory`에 `NONE`이
있는 이유도 같다. **비어 있음을 표현할 자리를 열거값 안에 만들어 두지 않으면 모델이 목록 밖 값을 지어낸다.**

`suggestedJobRole`의 선택지는 `JobRole` enum에서, `safetyCategory`는 `SafetyKeyword` enum에서 직접 뽑는다.
스키마에 목록을 손으로 다시 적지 않는다.

---

## 서버 검증 — 무엇이 카드가 되지 못하는가

**스키마 강제만으로는 부족하다.** 스키마는 "정해진 필드 외의 값을 못 만들게" 할 뿐,
그 필드에 들어온 값이 원문에 근거하는지는 보장하지 않는다. 그 확인이 `CardDraftVerifier`다.

| 판정 | 결과 |
|---|---|
| `evidenceText`가 비었다 | **항목 폐기.** 카드가 되지 않고 목록에 나가지 않는다 |
| `evidenceText`가 원문에 없다 | **항목 폐기.** 근거를 지어낸 것으로 본다 |
| 변화·조치·다음 행동이 모두 비었다 | 항목 폐기. 담을 내용이 없다 |
| `recipientName`이 `null`이거나 후보 목록에 없다 | 카드는 만들되 **어르신 없이 `NEEDS_REVIEW`** |
| 같은 이름의 어르신이 둘 이상이다 | 위와 같다. 임의로 한 명 고르지 않는다 |
| `suggestedJobRole`이 `UNKNOWN`이거나 목록 밖 값이다 | **직종을 비운다.** 직원이 지정한다 |
| `nextAction`이 없다 | 제안 직종·제안 기한을 붙이지 않는다 |
| 시각을 `HH:MM`으로 읽을 수 없다 | 그 시각만 비운다 |

근거 대조는 **띄어쓰기를 무시하고** 한다. 줄바꿈이나 공백 차이로 정상 근거가 버려지면 안 된다.

안전 판정은 두 갈래의 **합집합**이다. 서버가 지정 키워드 표기(`낙상` `발열` `식사 저하` `투약 변경`)를
원문에서 직접 찾는 쪽과, AI가 같은 4개 범주로 분류한 쪽 중 **하나에만 걸려도** 우선 표시 대상이 된다.
어느 쪽으로 걸렸든 저장되는 판정 출처는 `KEYWORD`다.
`STAFF`는 직원이 직접 표시할 때 붙으며 구조화 단계에서는 생기지 않는다. (카드 수정 API, 별도 Issue)

모든 카드는 `reviewStatus: "NEEDS_REVIEW"`로 시작한다. 직원이 아직 보지 않았기 때문이다.

---

## `POST /api/handovers/{handoverId}/cards`

### 응답 — `201 Created`

```json
{
  "handoverId": 12,
  "createdCount": 2,
  "discardedCount": 1,
  "cards": [
    {
      "id": 31,
      "handoverId": 12,
      "careRecipientId": 1,
      "careRecipientName": "김말순",
      "observedAt": "2026-08-11T12:40:00",
      "statusChange": "점심 식사량 저하",
      "actionTaken": null,
      "nextAction": "저녁 식사량 확인",
      "evidenceText": "점심을 거의 안 드셨어요",
      "safetyRelated": true,
      "safetyFlagSource": "KEYWORD",
      "reviewStatus": "NEEDS_REVIEW",
      "suggestedJobRole": "CAREGIVER",
      "suggestedDueTime": "17:00",
      "createdAt": "2026-08-11T13:11:02.401"
    }
  ]
}
```

`discardedCount`는 **정상 동작의 결과**다. 근거가 없어 사라진 항목 수이고, 이 값이 0이 아닌 것은 오류가 아니다.
0인 것과 구분되어야 "AI가 아무것도 못 만든 것"과 "만든 것이 전부 걸러진 것"을 나눠 볼 수 있다.

`cards`는 **안전 항목이 앞에 온다.** 같은 무게면 만들어진 순서다.

### 규칙

| 규칙 | 결과 |
|---|---|
| `handoverId`에 해당하는 인계가 없음 | `404` — `HANDOVER_NOT_FOUND` |
| 이미 구조화된 인계 | `409` — `HANDOVER_ALREADY_STRUCTURED` |
| `LLM_API_KEY` 미설정 · 호출 실패 · 스키마에 맞지 않는 응답 | `503` — `LLM_UNAVAILABLE`. **카드를 하나도 만들지 않는다** |

**재구조화는 제공하지 않는다.** 다시 부르면 `409`다. 결과가 마음에 들지 않아 다시 돌리는 경로를 열면
직원이 이미 검토·수정한 카드를 덮어쓸 수 있다. 카드 수정 API가 들어온 뒤 별도 Issue로 다룬다.

`503`은 부분 실패를 남기지 않는다. 반쯤 만들어진 카드가 남는 것이 가장 나쁘다.

---

## `GET /api/handover-cards?date=2026-08-11`

`date`를 생략하면 오늘이다. 기준은 **카드가 만들어진 날**이다. (`createdAt`)

```json
{
  "date": "2026-08-11",
  "recipients": [
    {
      "careRecipientId": 1,
      "careRecipientName": "김말순",
      "cards": [ ... ]
    }
  ],
  "unresolved": [ ... ]
}
```

`unresolved`는 **대상 어르신을 가리지 못해 확정 카드가 되지 못한 항목**이다.
`recipients` 안에 섞지 않는다. 섞으면 화면이 "누구의 것인지 모르는 카드"를 어르신 목록 안에 그려야 한다.
각 항목의 모양은 `recipients[].cards[]`와 같고 `careRecipientId`와 `careRecipientName`이 `null`이다.

`recipients[].cards[]`와 `unresolved[]` 모두 안전 항목이 앞에 온다.

---

## 오류 응답

형태는 [`handover-api.md`](handover-api.md#오류-응답)와 같다.

| `code` | 상태 |
|---|---|
| `HANDOVER_NOT_FOUND` | `404` |
| `HANDOVER_ALREADY_STRUCTURED` | `409` |
| `LLM_UNAVAILABLE` | `503` |

`LLM_UNAVAILABLE`의 원인은 서버 로그에만 남긴다. 예외 메시지에 요청 본문이나 키가 섞여 나갈 수 있다.

---

## 이 API가 하지 않는 것

| 항목 | 어디서 |
|---|---|
| 카드 수정 · 검토 완료 처리 · 직원의 안전 표시 | 별도 Issue |
| 다음 행동 → 후속 업무(`Task`) 생성 | 별도 Issue. 여기서는 **제안값 부착까지만** 한다 |
| 전산 기록 문구 · 보호자 전달 문구 생성 | 별도 Issue |
| 재구조화 | 위 `409` 참고 |

**구조화 이벤트**는 별도 테이블 없이 애플리케이션 로그로 남긴다. (`HandoverCardService`)
생성 수와 함께 폐기 수·검토 대상 수를 남긴다. 나중에 "AI가 만든 것 중 무엇이 왜 빠졌는지" 물을 수 있는
유일한 흔적이다.

---

## 실호출 확인

스키마가 실제로 걸리는지, 근거가 정말 원문에서 나오는지는 stub으로 확인할 수 없다.

```bash
cd apps/api
LLM_API_KEY=... ./gradlew llmLiveTest     # 호출 2회
```

`./gradlew build`에는 포함되지 않는다. 붙여 두면 push마다 크레딧이 나가고, 키가 없는 CI와
다른 개발자 로컬에서 빌드가 깨진다. CI에서는 `ai` 라벨이 붙은 PR과 수동 실행에서만 돈다.
자세한 건 [`docs/development.md`](../development.md#llm-실호출-확인)에 있다.
