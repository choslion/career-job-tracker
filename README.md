# Career Job Tracker

개인 지원 자료를 건드리지 않고 한눈에 살펴보기 위한 로컬 채용공고 대시보드입니다.

이 저장소는 앱 코드만 관리합니다. 실제 자소서와 경력 자료는 별도 비공개 저장소인 `career-workbench`에 남겨 두고, 실행할 때만 Docker의 읽기 전용 볼륨으로 연결합니다.

```text
career-workbench/applications/**/*.md
                 │
                 │ read-only bind mount
                 ▼
        Next.js server data layer
                 │
                 ▼
       dashboard / list / detail UI
```

## 계획한 구성

- Next.js App Router + TypeScript
- Markdown과 YAML front matter 기반 데이터
- Docker multi-stage build + Docker Compose
- 지원 현황 요약, 검색·상태 필터, 공고 상세 화면
- 실제 지원 자료를 쓰거나 수정하지 않는 읽기 전용 구조

현재는 설계와 가상 샘플만 들어 있습니다. 구현 범위와 완료 조건은 [MVP 작업 명세](docs/mvp-issue.md)에 정리했습니다.

## 로컬 데이터 연결

구현이 완료되면 다음과 같이 실행하는 것을 기준으로 합니다.

```bash
cp .env.example .env
docker compose up --build
```

기본값은 이 저장소와 `career-workbench`가 같은 상위 폴더에 있는 구조입니다. 다른 위치에 있다면 `.env`의 `CAREER_DATA_PATH`만 바꿉니다.

```dotenv
CAREER_DATA_PATH=../career-workbench
```

Windows의 Docker Desktop에서 상대 경로가 정상적으로 마운트되지 않으면 공유가 허용된 절대 경로를 슬래시(`/`) 형식으로 지정합니다. `.env`는 Git에 포함하지 않습니다.

## 예정 화면

- `/`: 상태별 지원 수와 가까운 마감일 요약
- `/jobs`: 채용공고 검색 및 상태 필터
- `/jobs/[slug]`: 공고 본문과 관련 문서 존재 여부

데이터 형식은 [데이터 계약](docs/data-contract.md), 설계 판단은 [아키텍처](docs/architecture.md)를 참고합니다.
