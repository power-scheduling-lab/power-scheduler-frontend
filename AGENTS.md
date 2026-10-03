# Power Scheduler frontend 작업 규칙

- 이 저장소는 React + TypeScript 화면을 담당한다. 작업 전에 변경사항, README, 실제 프로젝트 설정과 적용되는 지침을 확인하고 기존 변경사항을 보존한다.
- 모델/최적화 로직의 Single Source of Truth는 별도 power-scheduler-model 저장소다. 가격 예측, 일정 계산, 비용 평가를 TypeScript로 복사하거나 재구현하지 않는다.
- 모델 연동 전 모델의 docs/DEVELOPER_QUICKSTART.md, docs/SERVICE_HANDOFF.md, docs/SERVICE_CONTRACT.md, docs/INPUT_OUTPUT_SCHEMA.md와 examples/service/를 확인한다. 사용한 모델 commit과 검증 결과는 README에 기록한다.
- 브라우저는 Spring Boot의 POST /api/v1/schedules/known-price를 호출한다. 요청은 company와 price_date를 담고 응답은 decision, prices, baseline을 담는다. 모델의 power_scheduler.service_api는 Python 함수 인터페이스이며 모델 저장소에 HTTP 서버는 없다.
- V1 화면은 CompanyScenario의 작업 제약을 입력하고 알려진 가격 데이터의 출처·시간축·단위를 확인할 수 있게 한다. 현재 날짜 선택은 모델 checkout의 2025-01-15 fixture만 지원한다. 새 날짜를 추가할 때는 실제 가격 공급 경로와 검증 결과를 먼저 확인한다.
- 모델의 slot 0은 첫 UTC 가격 timestamp다. release, deadline, duration, start, end는 slot 단위이고 end는 exclusive다. interval_hours, MW, €/MWh, EUR 및 사업장 IANA timezone을 혼동하지 않는다. 일정 표시는 UTC 기준이다.
- DecisionResult.status를 보존한다. optimal과 feasible을 구별하고 infeasible/timeout의 빈 일정과 null 비용을 0이나 성공으로 바꾸지 않는다. 모델 error 객체와 통신·서버 오류도 구별해 표시한다.
- V1 비용은 실제 전기요금이 아닌 Wholesale Cost Proxy다. baseline은 같은 company와 prices로 모델 공개 함수의 earliest 방식을 호출한 결과이며 실행 가능한 일정일 때만 표시한다. 차이는 두 proxy 비용의 차이로만 설명한다. Oracle Regret, 실제 절감률, V2/V3 성과를 계산 결과인 것처럼 표시하지 않는다.
- API 호출과 화면 컴포넌트를 분리한다. TypeScript 요청·응답 타입은 실제 Spring Boot JSON과 맞추고, 개발용 mock은 명시적으로 표시하며 모델 실패 시 자동 대체하지 않는다.
- 입력 변경 후 오래된 결과를 현재 결과처럼 보여주지 않고 늦은 응답이 최신 요청을 덮지 않게 한다. 입력 label·단위·오류·로딩 상태를 제공한다.
- 검증 명령은 실제 package.json과 lockfile을 확인한 뒤 실행한다. 없는 스크립트를 실행한 것처럼 보고하지 않는다. 최초 연동은 실제 모델의 정상·입력 오류·실행 불가능 결과를 화면까지 확인한다.
- 상세 설치·실행 명령, 계약 검증 결과, 미확인 사항과 V1 완료 기준은 README에 기록한다. 비밀정보를 브라우저 설정이나 로그에 남기지 않는다.
