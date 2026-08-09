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

앱은 `web/` 아래에 있으며, 실제 지원 자료가 없어도 저장소의 가상 fixture로 실행할 수 있습니다. 구현 범위와 완료 조건은 [MVP 작업 명세](docs/mvp-issue.md)에 정리했습니다.

## 로컬 데이터 연결

Docker가 설치되어 있으면 다음과 같이 실행합니다.

```bash
cp .env.example .env
docker compose up --build
```

기본값은 이 저장소와 `career-workbench`가 같은 상위 폴더에 있는 구조입니다. 다른 위치에 있다면 `.env`의 `CAREER_DATA_PATH`만 바꿉니다.

```dotenv
CAREER_DATA_PATH=../career-workbench
```

Windows의 Docker Desktop에서 상대 경로가 정상적으로 마운트되지 않으면 공유가 허용된 절대 경로를 슬래시(`/`) 형식으로 지정합니다. `.env`는 Git에 포함하지 않습니다.

예를 들어 Windows 경로는 다음처럼 적습니다.

```dotenv
CAREER_DATA_PATH=C:/Users/me/Documents/career-workbench
```

마운트 오류가 계속되면 Docker Desktop의 파일 공유 설정에서 해당 드라이브 또는 폴더가 허용되어 있는지 확인합니다. Compose 볼륨은 컨테이너 안에서 `/data/career`에 읽기 전용으로 연결됩니다.

실제 자료 없이 확인하려면 `.env`를 만들지 않고 실행합니다. Compose가 기본값으로 `./fixtures`를 연결합니다.

## Node.js로 개발

Node.js 22 이상을 사용합니다.

```bash
cd web
npm ci
```

`web/.env.local`을 만들고 데이터 경로를 지정합니다. `web/`을 기준으로 한 상대 경로도 사용할 수 있습니다.

```dotenv
CAREER_DATA_DIR=../fixtures
```

```bash
npm run dev
```

`npm run dev`를 실행하면 개발 서버를 켜기 전에 `scrape.config.json`에 설정된 공개 채용공고를 먼저 수집합니다. 결과는 Git에서 제외된 `web/.scraped-data/`에만 저장하며 `career-workbench`에는 쓰지 않습니다. 6시간 이내에 완료한 캐시가 있으면 네트워크 요청을 생략합니다.

앱은 `http://localhost:3000`에서 열립니다. 마감일이 없는 공고는 `마감일 미정`으로 유지되며, 마감일순 목록의 마지막에 표시됩니다.

## 채용공고 자동 수집

기본 설정은 잡코리아 카테고리, 원티드 검색·직군 태그, 점핏 공개 API, 사람인 검색 API를 함께 확인합니다. Greeting, Lever, Ashby 기반 회사 공개 채용 보드도 수집합니다. 사이트·검색 직무별 후보를 최대 120개까지 탐색하고, 프로필에 맞는 공고가 30개 찰 때까지 상세 공고를 보충 확인합니다. 로그인, 지원서, 이력서, 회원 정보 API에는 접근하지 않습니다. 각 사이트의 `robots.txt`를 확인하고 같은 호스트 요청 사이에 최소 600ms 간격을 둡니다. 서로 다른 호스트는 병렬로 처리하고 같은 상세 URL은 실행 중 한 번만 요청합니다.

최초 수집은 네트워크 상태에 따라 1~2분 정도 걸릴 수 있습니다. 같은 회사의 유사한 직무명은 하나로 합치며, 플랫폼 공고보다 회사의 공식 공개 채용 원문을 우선합니다.

자동 수집 공고는 실제 지원 자료와 분리된 `새 공고함`에 표시합니다. 사용자가 관리하는 공고만 대시보드의 준비·지원·면접 상태 집계에 포함됩니다. 카드에는 직무, 기술, 지역, 요구 경력 중 어떤 조건이 프로필과 일치했는지 표시합니다.

### 개인 검색 조건 연결

기본 저장소 구조에서는 `career-workbench/job-search.yaml`이 있으면 `npm run dev`가 자동으로 읽습니다. 이력서 전체가 아니라 목표 직무, 기술, 지역, 경력 범위, 제외 키워드만 사용합니다. 시작 형식은 [`web/search-profile.example.yaml`](web/search-profile.example.yaml), 전체 규칙은 [개인 검색 프로필 문서](docs/search-profile.md)를 참고합니다.

프로필이 다른 위치에 있으면 PowerShell에서 명시적으로 지정합니다.

```powershell
$env:CAREER_PROFILE_PATH="C:\Users\USER\Desktop\career-workbench\job-search.yaml"
npm run dev
```

프로필 원문은 수집 캐시에 복사하거나 외부 사이트로 전송하지 않습니다. 프로필이 변경되면 기존 6시간 캐시와 관계없이 다음 실행에서 새 조건으로 수집합니다.

수집 키워드, 요청 간격, 사이트별 최대 건수는 [`web/scrape.config.json`](web/scrape.config.json)에서 바꿀 수 있습니다. 일반 회사 채용 페이지가 Schema.org `JobPosting` JSON-LD를 제공한다면 `companyPages`에 추가할 수 있습니다.

```json
{
  "companyPages": [
    {
      "name": "Example Careers",
      "url": "https://careers.example.com/jobs",
      "mode": "listing"
    }
  ]
}
```

자동 수집만 다시 실행하거나, 캐시 유효시간을 무시하려면 다음 명령을 사용합니다.

```bash
cd web
npm run scrape
npm run scrape -- --force
```

인터넷이 없거나 자동 수집을 잠시 끄려면 PowerShell에서 다음과 같이 실행합니다. 수집 실패 자체는 개발 서버 실행을 중단시키지 않습니다.

```powershell
$env:JOB_SCRAPE_DISABLED="1"
npm run dev
```

## 품질 검사

```bash
cd web
npm run lint
npm test
npm run build
cd ..
docker compose config
```

파서와 앱은 원본 디렉터리에 파일을 생성하거나 수정하지 않습니다. 관련 지원 문서는 정해진 파일의 존재 여부만 확인하고 본문을 목록 데이터로 전달하지 않습니다.

## 예정 화면

- `/`: 상태별 지원 수와 가까운 마감일 요약
- `/jobs`: 채용공고 검색 및 상태 필터
- `/jobs/[slug]`: 공고 본문과 관련 문서 존재 여부

데이터 형식은 [데이터 계약](docs/data-contract.md), 설계 판단은 [아키텍처](docs/architecture.md)를 참고합니다.
