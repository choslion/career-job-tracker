# 아키텍처

## 목표

`career-workbench`의 Markdown 지원 자료를 브라우저에서 빠르게 탐색하되 원본은 수정하지 않는다. 앱 저장소와 개인 데이터 저장소를 분리해 코드 공개나 재사용 과정에서 개인정보가 섞일 가능성도 줄인다.

## 경계

```text
[career-workbench]
  applications/<slug>/*.md
           │
           │ `${CAREER_DATA_PATH}:/data/career:ro`
           ▼
[Docker container]
  server-only file reader
    ├─ front matter parser
    ├─ legacy document fallback
    └─ validation warnings
           │
           ▼
  Next.js App Router
    ├─ dashboard
    └─ job list (클라이언트 필터)
           │
           ▼
     원문 채용공고 링크
```

브라우저는 정규화된 공고 요약(`JobListItem`)만 받는다. 공고 본문과 호스트의 절대 경로, 원본 파일 접근 권한은 받지 않는다.

공개 채용공고 확장 경로는 다음과 같다.

```text
[공개 채용 목록·Job Board API]
  robots 확인 → 잡코리아·원티드·점핏·사람인
              → Greeting·Lever·Ashby 회사 채용 보드
              → 소스별 페이지 상한 안에서 후보 최대 120개 탐색
              → 프로필 일치 공고가 30개 찰 때까지 상세 요청
              → 개인 프로필 일치 이유·주의 조건 계산
              → 메타 정보만 web/.scraped-data 에 기록 (Git 제외)
              → 새 공고함
```

공고 본문은 일치도 계산에만 쓰고 저장하지 않는다. 캐시에는 회사·포지션·마감일·근무지·태그와 원문 URL만 남는다.

수집 캐시는 `career-workbench`와 겹치지 않는 앱 내부 디렉터리에만 쓴다. 프로필 원문은 캐시에 복사하지 않으며 실제 지원 자료와 수집 공고는 `origin`으로 분리한다. 동일 호스트 요청은 600ms 이상 간격을 두고, 서로 다른 호스트만 병렬 처리한다. 회사·유사 직무 중복은 공식 채용 원문을 우선한다.

## 주요 결정

### Next.js

서버 컴포넌트와 서버 전용 모듈에서 마운트된 파일을 읽을 수 있고, 화면과 데이터 계층을 하나의 TypeScript 프로젝트로 구성하기 쉽다. 앱 코드는 `web/` 아래에 둔다.

### 파일 기반 원본

MVP에서는 데이터베이스를 두지 않는다. `career-workbench/applications/<slug>/job-posting.md`를 원본으로 사용하고, 관련 문서의 존재 여부만 같은 폴더에서 확인한다.

### 읽기 전용 마운트

Compose 볼륨에는 반드시 `:ro`를 붙인다. 앱에는 파일 생성·수정·삭제 기능을 만들지 않는다. 쓰기 기능이 필요해지면 별도 설계와 권한 검토 후 확장한다.

### 상세 화면 대신 원문 링크

공고 본문은 원본 사이트가 항상 더 정확하고 최신이다. 본문을 복사해 두면 목록을 그릴 때마다 모든 문서의 본문을 읽고 파싱해야 해서 클릭 한 번의 비용이 코퍼스 전체 크기에 비례한다. 그래서 앱은 본문을 저장하지도 렌더링하지도 않고, 공고 제목을 원문 URL로 연결한다(`target="_blank"` + `rel="noopener noreferrer"`). 파싱 오류가 있는 파일 하나 때문에 전체 화면이 중단되지 않도록 경고와 함께 해당 항목을 제한적으로 표시한다.

### 클라이언트 필터

서버는 본문을 뺀 공고 요약 배열을 한 번만 내려보내고, 탭·검색·정렬·지역 필터는 브라우저에서 처리한다. 필터를 누를 때마다 서버로 왕복하지 않으므로 조작이 즉시 반영된다. 직무·지역 분류는 서버에서 한 번 계산해 `role`, `locationClass`로 실어 보내 클라이언트 정렬이 문자열을 다시 훑지 않게 한다.

## 모듈 구상

```text
web/
  src/
    app/
      page.tsx
      jobs/page.tsx
    components/
      jobs-browser.tsx
    lib/jobs/
      types.ts
      classify.ts
      parser.ts
      query.ts
      repository.ts
  Dockerfile
compose.yaml
```

- `types.ts`: 정규화 타입과 브라우저 전송용 `JobListItem` 변환
- `classify.ts`: 서버·클라이언트가 함께 쓰는 직무·지역 분류
- `parser.ts`: Markdown 한 건의 파싱과 legacy fallback
- `query.ts`: 순수 함수 필터·정렬 (클라이언트에서 실행)
- `repository.ts`: 폴더 탐색, 중복 제거, 화면용 목록 제공
- 페이지와 컴포넌트: 파일 시스템에 직접 접근하지 않고 repository 결과만 사용

## 오류 처리

- 데이터 디렉터리가 없으면 설정 방법을 알려 주는 오류 화면을 표시한다.
- 비어 있으면 가상 fixture 사용법을 포함한 빈 상태를 표시한다.
- 잘못된 문서는 서버 로그와 화면의 비식별 경고로 알리되, 읽을 수 있는 다른 문서는 계속 보여 준다.
- 파일 경로나 원문 오류의 민감한 내용은 클라이언트에 전달하지 않는다.

## Docker 원칙

- multi-stage build와 non-root runtime 사용
- `CAREER_DATA_DIR=/data/career`를 컨테이너 기본값으로 사용
- 원본 볼륨은 read-only로 마운트
- HTTP health check 제공
- 이미지에는 실제 지원 자료나 로컬 `.env`를 복사하지 않음

## MVP 이후 후보

인증이 필요한 배포, GitHub API 기반 데이터 동기화, 공고 수집, 편집 UI, 데이터베이스는 모두 별도 과제로 다룬다. 개인 자료를 외부 서비스로 보내는 변경은 명시적인 동의와 보안 검토 없이는 진행하지 않는다.
