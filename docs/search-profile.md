# 개인 검색 프로필

자동 수집기는 이력서 전체 대신 공고 검색에 필요한 최소 조건만 YAML 파일에서 읽는다. 이름, 이메일, 전화번호, 주소, 이력서 및 자기소개서 본문은 검색 프로필에 넣지 않는다.

## 기본 위치

`web/`에서 `npm run dev`를 실행할 때 다음 순서로 검색 프로필을 찾는다.

```text
1. web/.local/search-profile.yaml
2. ../../career-workbench/job-search.yaml
```

`.local` 프로필은 Git에서 제외되며 현재 기기에서만 사용한다.

저장소가 같은 상위 폴더에 있는 일반적인 구성에서는 실제 위치가 다음과 같다.

```text
Desktop/
├─ career-job-tracker/
│  └─ web/
└─ career-workbench/
   └─ job-search.yaml
```

다른 위치를 사용하려면 `CAREER_PROFILE_PATH`에 파일 경로를 지정한다.

## 형식

```yaml
roles:
  - 프론트엔드 개발자
  - Frontend Engineer

skills:
  - React
  - TypeScript
  - Next.js

discovery_skills:
  - Vue 3
  - React
  - TypeScript

locations:
  - 서울
  - 경기
  - 원격

experience:
  min_years: 2
  max_years: 5

# 직무별 경력이 다르면 experience 대신 사용한다.
experience_by_role:
  - role: 퍼블리셔
    min_years: 3
    max_years: 4
  - role: 프론트엔드
    min_years: 1
    max_years: 2

exclude_keywords:
  - 파견
  - 프리랜서
```

- `roles`: 목표 직무. 공고 발견과 우선순위에 가장 큰 비중으로 사용한다.
- `skills`: 기술 키워드. 공고 발견과 동점 우선순위에 사용한다.
- `discovery_skills`: 목록에서 공고를 처음 발견할 때 사용할 핵심 기술. 설정하면 나머지 `skills`는 상세 일치도 계산에만 사용한다.
- `locations`: 선호 지역. 공고 내용에서 확인할 수 있을 때 우선순위에 반영한다.
- `experience`: 희망 경력 범위. 공고에 경력 숫자가 명시된 경우 일치 점수와 주의 표시에 사용한다.
- `experience_by_role`: 퍼블리싱과 프론트엔드처럼 직무마다 경력이 다를 때 각각의 범위를 적용한다. 범위가 다르더라도 공고를 숨기지 않고 주의 표시와 점수 감점으로 처리한다.
- `exclude_keywords`: 회사명, 공고명 또는 본문에 포함되면 제외한다.

모든 필드는 선택이다. 알 수 없는 필드와 과도하게 긴 값은 거부해 연락처 같은 불필요한 정보가 실수로 사용되는 것을 막는다.

## 개인정보 경계

- 프로필 파일은 읽기만 하며 수정하지 않는다.
- 프로필 원문은 `.scraped-data`나 공고 Markdown에 복사하지 않는다.
- 프로필 값은 외부 사이트의 요청 파라미터로 직접 전송하지 않는다. 공개 목록을 로컬에서 선별하는 데만 사용한다.
- 캐시에는 프로필 변경 여부를 판단하기 위한 SHA-256 해시만 저장한다.
- 프로필을 변경하면 6시간 캐시가 남아 있어도 다음 `npm run dev`에서 다시 수집한다.
