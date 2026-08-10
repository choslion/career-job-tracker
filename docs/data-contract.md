# 채용공고 데이터 계약

## 위치

기본 탐색 경로는 다음과 같다.

```text
${CAREER_DATA_DIR}/applications/<slug>/job-posting.md
```

`<slug>`는 내부 식별자에 사용한다. 실제 호스트 경로는 브라우저에 노출하지 않는다.

## 권장 front matter

```yaml
---
company: Example Mobility
position: Frontend Developer
status: preparing
source_url: https://example.com/jobs/123
deadline: 2026-08-31
updated_at: 2026-08-07
location: 서울 강남구
tags:
  - Next.js
  - TypeScript
origin: application
---
```

본문은 일반 Markdown으로 작성한다. 다만 앱은 본문을 화면에 렌더링하지 않는다. 공고 내용은 `source_url`의 원문에서 확인하고, 본문은 `location`이 없을 때 근무 지역을 추론하는 용도로만 읽는다.

## 필드

| 필드 | 형식 | 필수 | 기본값 |
| --- | --- | --- | --- |
| `company` | string | 권장 필수 | 첫 번째 H1 또는 폴더명에서 추론 |
| `position` | string | 권장 필수 | 첫 번째 H1 또는 `미지정 포지션` |
| `status` | enum | 선택 | `preparing` |
| `source_url` | URL string | 선택 | 없음 |
| `deadline` | `YYYY-MM-DD` | 선택 | 없음 |
| `updated_at` | `YYYY-MM-DD` | 선택 | 파일 수정일 |
| `location` | string (60자 이하) | 선택 | 본문에서 찾은 지역 표기, 없으면 없음 |
| `tags` | string array | 선택 | 빈 배열 |
| `origin` | `application` 또는 `discovered` | 선택 | `application` |
| `source_name` | string | 수집 공고만 선택 | 없음 |
| `match_score` | non-negative integer | 수집 공고만 선택 | 없음 |
| `match_reasons` | string array | 수집 공고만 선택 | 빈 배열 |
| `match_cautions` | string array | 수집 공고만 선택 | 빈 배열 |

`application`은 사용자가 관리하는 지원 공고, `discovered`는 자동으로 찾은 새 공고다. 새 공고는 지원 상태 집계에 포함하지 않는다.

지원 상태는 다음 값만 사용한다.

- `interested`: 관심
- `preparing`: 준비 중
- `applied`: 지원 완료
- `document_pass`: 서류 합격
- `interview`: 면접 진행
- `offer`: 제안 수락 검토
- `rejected`: 종료/불합격
- `hold`: 보류
- `closed`: 공고 마감

알 수 없는 값은 `preparing`으로 정규화하고 경고를 남긴다.

## 기존 문서 호환

현재 자료처럼 front matter가 없는 `job-posting.md`도 읽어야 한다.

1. 첫 번째 H1을 제목 후보로 사용한다.
2. 부모 폴더명을 slug로 사용한다.
3. 회사명과 포지션을 분리할 수 없으면 안전한 기본값을 사용한다.
4. 누락 필드는 기본값으로 채우고 경고를 남긴다.
5. 한 문서의 형식 오류로 전체 목록을 실패시키지 않는다.

원본 문서를 자동으로 고치거나 front matter를 써 넣지는 않는다.

## 관련 문서

같은 지원 폴더에서 다음 파일의 존재 여부만 수집한다.

| 파일 | 화면 표시 |
| --- | --- |
| `analysis.md` | 공고 분석 |
| `cover-letter.md` | 자기소개서 |
| `career-description.md` | 경력기술서 |
| `interview.md` | 면접 준비 |

MVP에서는 관련 문서를 수정하지 않는다. 관련 문서의 본문은 읽지 않고 존재 여부만 목록 카드에 표시한다.

## 브라우저로 내려보내는 값

목록 화면은 `JobListItem`을 받는다. 위 필드에서 공고 본문(`body`)을 뺀 값에 서버가 계산한 `role`(퍼블리싱·프론트엔드 분류)과 `locationClass`(선호 지역 여부)를 더한 형태다. 본문과 호스트 절대 경로는 어떤 경우에도 클라이언트로 보내지 않는다.
