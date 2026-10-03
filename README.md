# Power Scheduler V1 웹 데모

React + TypeScript의 한 페이지 데모다. 브라우저는 Spring Boot API를 호출하고, Spring Boot는 Python HTTP 어댑터를 통해 [power-scheduler-model](../power-scheduler-model/README.md)의 공개 optimize_known_prices 함수를 호출한다. 모델/최적화 계산을 프론트에서 재구현하지 않는다.

## 첫 로컬 실행

세 저장소를 같은 상위 폴더에 둔다. 먼저 [backend README](../power-scheduler-backend/README.md#첫-로컬-실행)의 Python 3.12 설치와 모델 package 설치를 마치고, 별도 터미널에서 Python 어댑터(기본 127.0.0.1:8765)와 Spring Boot(기본 127.0.0.1:8080)를 실행한다.

~~~sh
cd power-scheduler-frontend
npm ci
npm run dev -- --port 5174 --strictPort
~~~

http://127.0.0.1:5174/ 를 연다. 이 작업에서 5173 포트를 다른 프로세스가 사용 중이어서 5174로 검증했다. 포트를 바꾸면 backend/scripts/smoke_http.py의 SCHEDULE_URL도 바꾼다. Vite는 /api 요청을 Spring Boot로 프록시한다. 다른 Spring 주소를 쓸 때는 프론트 터미널에서 SPRING_API_URL 환경변수를 설정한다. 이 주소는 개발 서버 전용이고 브라우저에 비밀정보를 넣지 않는다.

~~~sh
SPRING_API_URL=http://127.0.0.1:8080 npm run dev -- --port 5174 --strictPort
npm run typecheck
npm run build
~~~

검증 환경은 Node v25.2.1, npm 11.6.2, React 19.3.0, Vite 8.3.2, TypeScript 7.0.2였다. 모델 checkout은 08d9db5b40e0caa0e869659986c544959046ebc9, package 0.3.0rc2다. Node·Vite 요구사항의 변경 가능성은 [Vite 공식 안내](https://vite.dev/guide/)를 확인한다.

## 화면 사용 방법

1. 가상 사업장 A 또는 B를 선택한다. A는 모델 공식 synthetic 3작업 예제와 1 MW 상한이고, B는 같은 작업에 2 MW 상한을 적용한다. 이름·상한·작업을 직접 수정할 수 있다.
2. 가격 날짜는 현재 committed SMARD 2025-01-15 UTC 한 날만 제공한다. 다른 날짜는 가격 누락 오류를 보여준다. 가격 파일은 모델 저장소에서 읽으며 자동으로 가상 가격으로 대체하지 않는다.
3. 작업 ID, 시작 가능 UTC 슬롯, 완료 마감 UTC 슬롯, 연속 가동시간, 고정 MW를 입력한다. slot 0은 가격의 첫 UTC timestamp(이 fixture에서는 00:00 UTC)이고 종료 시각은 exclusive다. 24는 다음 날 00:00 UTC를 뜻한다.
4. 일정 계산을 누르면 상태, 작업 시간표, 시간별 도매가격(€/MWh)과 전력 사용량(MW), Wholesale Cost Proxy(EUR), 모델의 동일 조건 earliest 기준이 가능한 경우의 비용 차이를 보여준다.

입력 수정 즉시 이전 결과를 숨기고 진행 중 요청을 취소한다. 늦게 도착한 이전 응답이 새 결과를 덮지 않는다. optimal과 feasible, 입력 오류, 가격 누락, infeasible, 연결 오류를 구분한다. infeasible의 null 비용을 0으로 표시하지 않고, 일정이 없으면 사용량 차트를 0 MW라고 그리지 않는다.

모든 회사 작업은 가상이며 비용은 실제 기업 청구요금이 아닌 도매비용 대리값이다. 기준 일정은 모델의 공개 earliest 방식으로 같은 company와 prices를 다시 호출한 결과다. 기준이 실행 가능한 일정을 반환하지 않으면 비교를 숨긴다. Oracle Regret, 실제 절감률, V2/V3 성과는 표시하지 않는다.

## API 계약

브라우저는 POST /api/v1/schedules/known-price에 company와 price_date를 보낸다. 첫 실행에서는 price_date=2025-01-15이며 company는 site_limit_mw, timezone, interval_hours=1, jobs 배열을 포함한다. 응답은 decision(모델 DecisionResult 전체), prices(실제 사용한 가격), baseline(같은 입력의 공개 earliest 결과 또는 null)이다. 모델 V1 결과 자체에는 입력 가격 배열이 없기 때문에 prices를 별도 받는다.

HTTP 매핑과 예제 JSON은 [backend README](../power-scheduler-backend/README.md#실제-요청응답-계약)를 따른다. 가격 timestamp는 UTC이고 회사 timezone은 모델 입력 정보다. Frontend는 일정 slot을 첫 timestamp와 interval_hours로 UTC 시각으로 표시한다. 모델의 시간·단위 검증을 브라우저 검사로 대체하지 않는다.

## 확인한 결과

~~~sh
npm run build
~~~

타입 검사와 Vite 프로덕션 빌드가 통과했다. 브라우저에서 다음을 직접 확인했다.

- A: optimal, 2,198.80 EUR. earliest 기준 2,732.57 EUR, 동일 조건의 proxy 비용차 533.77 EUR. 3작업 시간표와 24시간 차트 표시.
- B: optimal, 1,506.64 EUR. earliest 기준 2,046.10 EUR. 2 MW 한도 표시.
- 중복 작업 ID: INVALID_INPUT 화면. 제공되지 않은 날짜: MISSING_PRICE_DATA 화면.
- 2 MW 작업을 1 MW 한도에 입력: infeasible, 비용 없음, 추천 사용량 없음.
- Python 어댑터 중지: Spring을 통한 MODEL_UNAVAILABLE 연결 오류 화면.
- 사업장 이름 또는 가격 날짜를 수정하면 이전 결과가 즉시 사라짐.

실제 웹 프록시부터 모델까지의 HTTP 검증 명령은 backend 폴더의 python3 scripts/smoke_http.py다. 모델 공식 V1 예제 및 Python/Spring 테스트 명령은 backend README에 있다.

## 범위

가격 날짜는 현재 한 날뿐이며, 사업장 작업은 가상이다. 15분 간격 입력, 실제 기업 요금, 실시간 가격, 인증, 저장, V2/V3, 배포는 이 데모에서 구현하거나 검증하지 않았다.
