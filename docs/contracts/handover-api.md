# handover API

현장 특이사항 입력 API.

- Manyfast: `R-LIEATL` 현장 인계 정보 수집 / `F-YJJJUX` 현장 특이사항 입력 / `F-LUDCWW` 어르신 명단 등록
- 기준 버전: `v0.4-recipient-directory`

> 제품이 **왜** 이렇게 동작하는지는 Manyfast가 기준이다. 여기에는 **JSON이 어떻게 생겼는지**만 적는다.

---

## `GET /api/staff`

진입 화면이 **본인을 고르기 위해**, 배정 화면이 **직종별 담당자를 고르기 위해** 부른다.
`F-YJJJUX` permissions("본인 선택 목록은 센터가 사전 등록한 직원 명단에서 온다")와 `F-IVFNPC` display를 채우는 조회다.

한 센터 직원 수 기준이라 페이지를 나누지 않고 전원을 내려준다.

### 응답 — `200 OK`

```json
{
  "staff": [
    { "name": "강태호", "code": "ST-006", "jobRole": "SOCIAL_WORKER", "jobRoleLabel": "사회복지사", "hasPin": false },
    { "name": "김하늘", "code": "ST-001", "jobRole": "CAREGIVER", "jobRoleLabel": "요양보호사", "hasPin": true }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `name` | string | 이름. `POST /api/handovers` 의 `reporterName`, `POST /api/.../tasks` 의 `assigneeName` 에 들어간다 |
| `code` | string | 사번. 명단 안에서 유일하다. 동명이인을 화면에서 구분하고, 브라우저에 저장한 선택값을 되살릴 때 쓴다 |
| `jobRole` | string | 담당 직종 코드 (`CAREGIVER`, `NURSE_AIDE`, `SOCIAL_WORKER`, `DRIVER`, `CENTER_HEAD`). 후속 업무 배정 시 직종별 직원 필터링에 쓴다 |
| `jobRoleLabel` | string | 담당 직종 한글 라벨 |
| `hasPin` | boolean | 선택형 4~6자리 숫자 PIN 설정 여부 (해시 및 평문 원문은 응답에서 은닉된다) |

**이름 가나다순이고, 이름이 같으면 사번순이다.**

**서버 id와 PIN 해시값을 내리지 않는다.** 인계와 후속 업무는 직원을 `reporterName` · `assigneeName` ·
`completedByName` 같은 **이름 문자열**로 가리키므로 화면이 직원 id를 넘길 곳이 없다. ([#33](https://github.com/ieobom-team/ieobom/issues/33))
PIN 해시값 역시 보안을 위해 외부에 노출하지 않고 `hasPin` 여부만 내려준다. ([#83](https://github.com/ieobom-team/ieobom/issues/83))

**직원 명단 추가·삭제 API가 없다.** 직원 명단 관리 화면을 만들지 않기로 했고(유저플로우 "AI 인계 도구 내비게이션 맵"에
직원 명단 화면이 없다), 명단 변경은 시드와 DB로 처리한다. 어르신 명단([#42](https://github.com/ieobom-team/ieobom/issues/42))과 다른 점이다.

**연결이 끊기면 화면은 마지막으로 받아 둔 명단을 쓴다.** 명단을 받지 못했다고 진입을 막으면
현장 근무자가 입력 자체를 못 한다. (`features/session/staffApi.ts`)

---

## `POST /api/staff/{code}/verify-pin`

선택한 직원의 4~6자리 숫자 PIN 일치 여부를 검증한다. (`F-YJJJUX` permissions, exceptions, [#83](https://github.com/ieobom-team/ieobom/issues/83))
5회 연속 실패 시 1분간 검증이 잠긴다.

### 요청

```json
{
  "pin": "1234"
}
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `pin` | string | ○ | 4~6자리 숫자 PIN (`^[0-9]{4,6}$`) |

### 응답 — `200 OK` (검증 성공 또는 잔여 횟수 남은 실패)

```json
{
  "valid": true,
  "locked": false,
  "remainingAttempts": 5
}
```

불일치 시:
```json
{
  "valid": false,
  "locked": false,
  "remainingAttempts": 4
}
```

### 응답 — `423 Locked` (5회 연속 실패 시 1분간 잠금)

```json
{
  "valid": false,
  "locked": true,
  "remainingAttempts": 0
}
```

---

## `PUT /api/staff/{code}/pin`

직원의 선택형 4~6자리 숫자 PIN을 신규 등록, 변경하거나 해제한다. (`F-YJJJUX` permissions, [#83](https://github.com/ieobom-team/ieobom/issues/83))
기존 PIN이 설정되어 있는 경우 `currentPin` 검증을 통과해야 변경할 수 있다.
`newPin`을 빈 문자열(`""`) 또는 생략/null로 전달하면 PIN을 해제(`hasPin: false`)한다.

### 요청

```json
{
  "currentPin": "1234",
  "newPin": "5678"
}
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `currentPin` | string | △ | 현재 PIN (기존에 PIN이 설정되어 있을 경우 필수) |
| `newPin` | string | ✕ | 새 4~6자리 숫자 PIN (`^[0-9]{4,6}$`). 빈 값이면 PIN 해제 |

### 응답 — `200 OK`

```json
{
  "name": "김하늘",
  "code": "ST-001",
  "jobRole": "CAREGIVER",
  "jobRoleLabel": "요양보호사",
  "hasPin": true
}
```

---

## `POST /api/staff/{code}/reset-pin`

관리자/사회복지사가 PIN을 분실하거나 잠긴 직원의 PIN을 즉시 해제(초기화)하는 1-Click API. (`F-YJJJUX` exceptions, [#83](https://github.com/ieobom-team/ieobom/issues/83))
호출 즉시 `pin_hash`가 `null`로 초기화되며 5회 실패 잠금 상태도 즉시 해제된다.

### 응답 — `200 OK`

```json
{
  "name": "김하늘",
  "code": "ST-001",
  "jobRole": "CAREGIVER",
  "jobRoleLabel": "요양보호사",
  "hasPin": false
}
```

---

## `GET /api/care-recipients`

입력 화면이 **대상 어르신을 고르기 위해**, 명단 화면이 **등록된 어르신을 보여주기 위해** 부른다.
`F-YJJJUX` preconditions("입력할 어르신이 목록에 존재해야 한다")와 `F-LUDCWW` display를 채우는 조회다.

한 센터 20명 남짓이라 페이지를 나누지 않는다.

### 요청

| 쿼리 | 타입 | 기본 | 설명 |
|---|---|---|---|
| `includeDischarged` | boolean | `false` | 이용 종료한 어르신까지 포함할지 |

**기본은 이용 중인 어르신만이다.** 부르는 쪽 대부분이 새 입력의 대상 목록을 그리는 화면이라,
빠뜨렸을 때 안전한 쪽을 기본값으로 둔다. `true`를 주는 곳은 명단 관리 화면과
**이미 남은 카드의 대상을 고치는 화면**뿐이다 — 그 카드가 이용 종료한 어르신을 가리키고 있으면
목록에서 빼는 순간 현재 대상이 선택지에서 사라진다.

### 응답 — `200 OK`

```json
{
  "careRecipients": [
    { "id": 6, "name": "강복순", "code": "IB-006", "dischargedAt": null },
    { "id": 1, "name": "김말순", "code": "IB-001", "dischargedAt": "2026-08-13T10:00:00" }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | number | `POST /api/handovers` 의 `careRecipientId` 에 **그대로** 넣는다 |
| `name` | string | 이름 |
| `code` | string | **내부 ID.** 동명이인을 화면에서 구분하고, LLM 요청에서 실명을 대신한다 |
| `dischargedAt` | string \| null | 이용 종료 시점. 이용 중이면 `null` |

**이름 가나다순이고, 이름이 같으면 내부 ID 순이다.** id 순이 아니다.
목록에서 사람을 눈으로 찾는 화면이므로 저장 순서를 그대로 보여줄 이유가 없다.

`id`를 클라이언트가 만들어 쓰지 않는다. 어르신 목록을 프론트 상수로 두면 시드 순서를 추측하게 되고,
그 추측이 틀리면 등록이 `404 CARE_RECIPIENT_NOT_FOUND` 로 끊긴다.

---

## `POST /api/care-recipients`

관리자가 어르신을 등록한다. (`F-LUDCWW` action, 유저플로우 "AI 인계 도구 내비게이션 맵" n51~n53)

### 요청

```json
{ "name": "홍길동", "confirmDuplicateName": false }
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `name` | string | ✅ | 어르신 이름. 50자까지. 앞뒤 공백은 저장하지 않는다 |
| `confirmDuplicateName` | boolean | | 동명이인 안내를 보고도 등록하겠다는 확인. 생략하면 `false` |

**이름만 받는다.** 생년·성별 같은 부가 정보는 받지 않는다. (`F-LUDCWW` dataSpec)

**`code`를 요청에 넣지 않는다.** 서버가 부여한다. 클라이언트가 정하게 두면 시드와 순번이 겹친다.

### 응답 — `201 Created`

```json
{ "id": 21, "name": "홍길동", "code": "IB-021", "dischargedAt": null }
```

내부 ID는 **접두어 `IB-` + 순번**이다. 순번은 이미 쓰인 최대 순번 + 1이므로,
시드가 채운 `IB-020` 다음인 `IB-021`부터 이어진다. (`RecipientCodeIssuer`)
개수 + 1이 아니다 — 개수로 세면 시드 20명과 겹칠 여지가 남는다.

### 동명이인 — `409 DUPLICATE_RECIPIENT_NAME`

같은 이름이 이미 있으면 `confirmDuplicateName` 없이 보낸 요청을 409로 되돌린다.

```json
{
  "code": "DUPLICATE_RECIPIENT_NAME",
  "message": "김말순(IB-001)이(가) 이미 등록되어 있습니다. 다른 분이 맞으면 확인 후 등록해 주세요.",
  "fields": []
}
```

**저장 실패가 아니라 확인 요청이다.** 같은 이름 그대로 `confirmDuplicateName: true`로 다시 보내면
`201`로 저장되고, 두 어르신은 서로 다른 내부 ID로 구분된다. (n52 → n53)

막지 않는 이유는 주간보호센터에 같은 이름이 실제로 있기 때문이다. 막으면 관리자가
"김말순2" 같은 가짜 이름을 만들어 넣게 되고, 그 이름이 그대로 기록에 남는다.

**이용 종료한 어르신도 이름을 차지한 것으로 센다.** 빼고 세면 관리자가 "이 이름은 처음 넣는 것"이라고
잘못 알게 된다.

---

## `PATCH /api/care-recipients/{id}`

어르신 이름을 고친다. (n54)

```json
{ "name": "홍길순" }
```

응답은 `200 OK` + 고쳐진 어르신 한 건이다. 형태는 목록의 한 원소와 같다.

**`code`는 바꾸지 않는다.** 기존 인계 기록과 카드가 그 값으로 어르신을 가리키고 있다.

---

## `POST /api/care-recipients/{id}/discharge`

이용 종료로 표시한다. 본문이 없다. (n55)

응답은 `200 OK` + `dischargedAt`이 채워진 어르신 한 건이다.

표시한 어르신은 **새 입력의 대상 목록에서 빠지고**, 기존 인계 기록과 카드는 그대로 남는다.
AI가 발화를 어르신별로 분리할 때 쓰는 이름 대조 후보에도 그대로 남는다 —
이용 종료 직전에 남긴 입력이 뒤늦게 구조화될 때 대상을 잃지 않아야 한다. (`CardDraftVerifier`)

**이미 종료한 어르신을 다시 불러도 오류가 아니다.** 시점을 덮어쓰지 않고 현재 상태를 그대로 돌려준다.
되돌릴 방법이 없는 동작이라 두 번 눌렀다고 실패로 만들 이유가 없다.

**이용 종료를 해제하는 API는 없다.** Manyfast에 복구 경로가 없어 추측해 만들지 않았다.
필요해지면 Issue로 올린다.

---

## 어르신 삭제 API가 없다

`DELETE /api/care-recipients/{id}`는 **의도적으로 두지 않는다.** 기존 인계 기록과 카드가 어르신을
가리키고 있어서, 지우면 이미 남긴 기록이 대상을 잃는다. 더 이상 오지 않는 어르신은 이용 종료로 표시한다.
([#42](https://github.com/ieobom-team/ieobom/issues/42))

직원 명단(`GET /api/staff`)과 반대다. 그쪽은 관리 화면이 없어 조회만 있고, 어르신 명단은
관리 화면이 있어 등록·수정이 있다.

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
| `audioData` | string | | 녹음한 원본 음성. Base64 Data URL(`data:audio/…;base64,…`). **`inputMethod: "VOICE"` 일 때만** 붙일 수 있고, 디코딩한 크기가 10MB를 넘으면 안 된다 |

날짜·시각은 오프셋 없는 ISO-8601 지역 시각이다. (`2026-08-11T09:20:00`)

> **모바일 웹은 `audioData` 를 보내지 않는다.** (#146) 모바일 브라우저는 페이지가 마이크 세션을
> 여는 순간 음성 인식 엔진의 오디오 입력이 끊겨서, 원본 녹음과 인식을 함께 할 수 없다. 계약은
> 그대로다 — `audioData` 는 원래 선택 필드이고 서버는 달라지지 않는다. 모바일에서도 원본 음성을
> 남기려면 서버 STT 가 필요하다(#147).

```json
{
  "careRecipientId": 1,
  "rawText": "등원 차량에서 보호자가 어르신이 밤사이 잠을 못 주무셨다고 전해 주셨어요.",
  "inputMethod": "TEXT",
  "occurredAt": "2026-08-11T09:20:00",
  "reporterName": "박데스크",
  "proxyInput": true,
  "infoSource": "GUARDIAN",
  "audioData": "data:audio/webm;base64,GkXf..."
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
| `inputMethod`가 `VOICE`가 아닌데 `audioData` 있음 | `400` — `fields[].field = "audioData"` |
| `audioData`가 Data URL이 아니거나 형식이 `audio/*`가 아님 | `400` — `fields[].field = "audioData"` |
| `audioData`가 10MB 초과 | `400` — `fields[].field = "audioData"` |

두 번째·세 번째 규칙은 `F-YJJJUX` action 슬롯("대리 입력할 수 있으며, 이때 정보 출처를 함께 선택한다")에서 온다.
대리 입력인데 출처가 비면 "누구에게서 나온 내용인지"가 사라지고,
직접 관찰인데 출처가 붙으면 둘 중 어느 쪽이 사실인지 알 수 없다.

`occurredAt`의 미래 시각은 막지 않는다. 기기 시계 오차로 정상 입력이 거부되는 편이 더 나쁘다.

---

## `GET /api/handovers/{id}/audio`

저장된 원본 음성을 재생하려고 부른다. (Manyfast `F-SNBVHR` — 요약이 담지 못한 뉘앙스를 원본 음성으로 받는다)

카드 상세의 `<audio>`가 직접 받아 간다. `apiFetch`가 아니라 브라우저가 부르므로
프론트는 `apiUrl()`로 주소를 만든다.

### 응답

| 상황 | 결과 |
|---|---|
| 음성이 있음 | `200` + 오디오 바이너리. `Content-Type`은 **저장할 때 받은 값 그대로**다 (`audio/webm;codecs=opus` 등) |
| 음성이 없거나 인계 기록 자체가 없음 | `404` — `code: "HANDOVER_AUDIO_NOT_FOUND"` |

**재생 단위는 입력 한 건 전체다.** Web Speech API는 인식 결과에 타임스탬프를 주지 않아
항목별 구간을 자르려면 STT를 갈아타야 한다. (Manyfast `F-SNBVHR` dataSpec 미결 질문 — #44)

**형식을 고정하지 않는다.** 브라우저마다 녹음 형식이 다르고(Chrome은 `audio/webm;codecs=opus`),
받은 값을 그대로 돌려줘야 재생된다.

### 저장 위치와 용량

- 데모 규모라 파일 스토리지를 두지 않고 **DB에 그대로** 넣는다. (`handover_audio.data`, `MEDIUMBLOB`)
- 한 건 상한은 **10MB**다. 화면은 그 앞에서 **5분**에 녹음을 스스로 멈춘다.
- 연결이 끊겨 대기열(`localStorage`)로 들어가는 입력에는 **음성을 담지 않는다.**
  한 건이 저장 한도를 채우면 대기열 전체가 조용히 저장되지 않는다. 텍스트만 재전송하고, 화면이 그 사실을 알린다.

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
| `CARE_RECIPIENT_NOT_FOUND` | `404` | `careRecipientId`(또는 경로의 `id`)에 해당하는 어르신이 없음 |
| `DUPLICATE_RECIPIENT_NAME` | `409` | 어르신 등록 시 같은 이름이 이미 있고 아직 확인하지 않음. **저장 실패가 아니다** |

`fields`는 `field` 이름의 사전순으로 정렬해 내려준다. 클라이언트가 순서에 의존하지 않게 하기 위함이다.

---

## 이 API가 하지 않는 것

| 항목 | 어디서 |
|---|---|
| AI 구조화 · 어르신별 카드 생성 | [`handover-card-schema.md`](handover-card-schema.md) — 저장이 끝난 뒤 `POST /api/handovers/{id}/cards` 로 따로 호출한다 |
| 인계 수정 · 삭제 | 미정 |
| 어르신 삭제 · 이용 종료 해제 | 위의 "어르신 삭제 API가 없다" 참고 |
| LLM 요청의 실명 → 내부 ID 치환 | 가명처리 Issue. 이 API는 대조표를 **만들어 두기만** 한다 |
| 오프라인 임시 저장 · 자동 재전송 | **프론트엔드 책임.** 서버는 재전송된 요청을 일반 요청과 똑같이 받는다 |

**특이사항 등록 이벤트**와 **명단 등록·변경 이벤트**는 별도 테이블 없이 애플리케이션 로그로 남긴다.
(`HandoverService`, `CareRecipientService`)
Manyfast에 이벤트의 dataSpec이 없고 조회 화면도 없어서, 저장할 필드를 지금 정하면 곧 틀린 스키마가 된다.
감사 로그가 필요해지면 그때 Issue로 올린다.
