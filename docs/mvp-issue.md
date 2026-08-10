# [MVP] Docker + Next.js 기반 채용공고 관리 사이트 구축

## 목표

별도 저장소인 `career-workbench`의 Markdown 지원 자료를 읽기 전용으로 불러와, 로컬 브라우저에서 지원 현황과 공고 내용을 탐색할 수 있는 MVP를 구현한다.

앱 코드는 이 저장소의 `web/` 아래에 둔다. 실제 개인정보나 지원 문서를 이 저장소로 복사하지 않는다.

## 구현 범위

### 1. 프로젝트 구성

- Next.js App Router, TypeScript, Tailwind CSS 기반 프로젝트를 `web/`에 구성
- 패키지 스크립트에 lint, test, build 포함
- UI 문구는 한국어로 작성

### 2. 데이터 계층

- `CAREER_DATA_DIR` 아래의 `applications/*/job-posting.md` 탐색
- YAML front matter와 Markdown 본문 파싱
- [데이터 계약](data-contract.md)의 필드 검증과 상태 정규화
- front matter가 없는 기존 문서도 H1과 폴더명을 이용해 표시하는 fallback 구현
- 같은 폴더의 `analysis.md`, `cover-letter.md`, `career-description.md`, `interview.md` 존재 여부 수집
- 모든 파일 읽기는 server-only 모듈에서 처리하고 쓰기 작업은 금지

### 3. 화면

- `/`: 상태별 건수, 전체 건수, 가까운 마감일 요약
- `/jobs`: 회사·포지션·태그 통합 검색, 상태 필터, 마감일/수정일 정렬
- 공고 카드에서 원문 채용공고로 바로 이동 (새 탭), 관련 문서 존재 배지
- 모바일과 데스크톱에서 사용할 수 있는 반응형 레이아웃
- 데이터 없음, 잘못된 설정, 일부 문서 파싱 실패에 대한 안내 상태

과한 그래프나 관리 기능보다는 공고를 찾고 원문으로 넘어가는 흐름을 우선한다.

> 초기 명세에는 `/jobs/[slug]` 상세 화면이 있었으나, 공고 본문을 저장·렌더링하지 않기로 하면서 제거했다. 배경은 [아키텍처](architecture.md)의 "상세 화면 대신 원문 링크"를 참고한다.

### 4. Docker

- `web/Dockerfile`에 multi-stage build와 non-root runtime 적용
- 저장소 루트에 `compose.yaml` 작성
- `${CAREER_DATA_PATH}:/data/career:ro` 형태의 읽기 전용 bind mount 사용
- 앱 health check 추가
- 실제 지원 자료, `.env`, 개발 캐시가 이미지에 포함되지 않도록 `.dockerignore` 구성

### 5. 품질과 문서

- front matter 정상/누락/오류, legacy fallback, 관련 파일 탐지를 다루는 parser 단위 테스트
- 검색과 상태 필터의 핵심 동작 테스트
- 호스트 절대 경로를 코드에 하드코딩하거나 클라이언트에 노출하지 않음
- README에 설치, 환경 변수, Docker 실행, 테스트 방법 반영
- Windows Docker Desktop에서 경로 마운트가 실패할 때의 절대 경로 표기와 파일 공유 확인 방법 문서화

## 제외 범위

- 로그인·회원 정보·지원서 영역을 포함한 비공개 페이지 수집
- 사이트 전체를 순회하는 무제한 크롤링
- 데이터베이스
- 로그인과 다중 사용자
- 공고 및 지원 문서 편집/삭제
- 운영 환경 배포
- `career-workbench` 파일 변경
- 실제 개인정보나 지원 자료의 fixture 사용

## 로컬 수집 확장

초기 MVP 이후 사용자 요청으로 잡코리아, 원티드, 점핏, 사람인의 공개 채용공고와 Greeting·Lever·Ashby·Schema.org `JobPosting` 기반 회사 채용 페이지의 제한 수집을 추가했다. robots 정책, 호스트별 요청 간격, 사이트별 상한을 지키며 결과는 Git에서 제외된 로컬 캐시에만 저장한다. 자동 수집 공고는 실제 지원 공고와 별도 유형으로 관리한다.

## 완료 조건

- [ ] `.env.example`을 `.env`로 복사하고 데이터 경로만 설정할 수 있다.
- [ ] `docker compose up --build` 후 `http://localhost:3000`에서 앱이 열린다.
- [ ] 실제 `career-workbench`가 read-only로 마운트되고 공고 목록이 표시된다.
- [ ] 실제 자료가 없어도 저장소의 가상 fixture를 지정해 기능을 확인할 수 있다.
- [ ] 검색, 상태 필터, 정렬, 원문 링크 이동이 동작한다.
- [ ] front matter가 없는 기존 문서와 잘못된 문서를 만나도 전체 앱이 중단되지 않는다.
- [ ] 컨테이너 실행 전후에 마운트된 원본 파일이 변경되지 않는다.
- [ ] lint, test, production build가 통과한다.
- [ ] `docker compose config`가 오류 없이 통과한다.
- [ ] README가 실제 실행 절차와 일치한다.

## 구현 시 참고

- 설계 의도는 [아키텍처](architecture.md), 파일 형식은 [데이터 계약](data-contract.md)을 따른다.
- 결정이 필요한 경우 개인정보 보호와 원본 불변성을 우선한다.
- 범위를 넓히는 대신 작은 단위로 동작하는 MVP를 완성한다.
