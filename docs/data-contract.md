# 채용공고 데이터 계약

## 위치

기본 탐색 경로는 다음과 같다.

```text
${CAREER_DATA_DIR}/applications/<slug>/job-posting.md
```

`<slug>`는 URL과 내부 식별자에 사용한다. 실제 호스트 경로는 브라우저에 노출하지 않는다.

## 권장 front matter

```yaml
---
company: Example Mobility
position: Frontend Developer
status: preparing
source_url: https://example.com/jobs/123
deadline: 2026-08-31
updated_at: 2026-08-07
tags:
  - Next.js
  - TypeScript
---
```

본문은 일반 Markdown으로 작성한다.

## 필드

| 필드 | 형식 | 필수 | 기본값 |
| --- | --- | --- | --- |
| `company` | string | 권장 필수 | 첫 번째 H1 또는 폴더명에서 추론 |
| `position` | string | 권장 필수 | 첫 번째 H1 또는 `미지정 포지션` |
| `status` | enum | 선택 | `preparing` |
| `source_url` | URL string | 선택 | 없음 |
| `deadline` | `YYYY-MM-DD` | 선택 | 없음 |
| `updated_at` | `YYYY-MM-DD` | 선택 | 파일 수정일 |
| `tags` | string array | 선택 | 빈 배열 |

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

MVP에서는 관련 문서를 수정하지 않는다. 상세 본문 공개 범위는 서버 렌더링 경계를 유지하고, API를 추가할 경우 필요한 내용만 반환한다.
