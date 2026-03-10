# XS-Leak Hands-on Code

이 디렉터리는 다음 2개 실험의 프로토타입 코드를 제공합니다.

1. `Performance API` 기반 다운로드 탐지 XS-Leak
2. `WebSocket pool` 기반 상태 추정 XS-Leak

## 1) 구성

- `index.js`: 실행 진입점 (`all | download | websocket`)
- `labs/download-detection/app.js`: 실험 1 Express 서버(Banned/Attacker)
- `labs/download-detection/templates/*.html`: 실험 1 HTML 템플릿
- `labs/websocket-detection/app.js`: 실험 2 Express 서버(회사 3개 + Attacker)
- `labs/websocket-detection/templates/*.html`: 실험 2 HTML 템플릿
- `package.json`: 의존성(`ws`) 및 실행 스크립트

## 2) 사전 준비

### Node.js

- Node.js `>=16`

### hosts 설정

로컬에서 다중 도메인을 흉내 내기 위해 `/etc/hosts`에 아래를 추가합니다.

```txt
127.0.0.1 banned.download-lab.test
127.0.0.1 attacker.download-lab.test

127.0.0.1 company1.toy-slack.com
127.0.0.1 company2.toy-slack.com
127.0.0.1 company3.toy-slack.com
127.0.0.1 attacker.com
```

## 3) 설치/실행

```bash
cd ./src
npm install
```

주요 의존성은 `express`, `ws` 입니다.

Playwright 시나리오를 실행하려면 브라우저 바이너리 설치가 필요합니다.

```bash
npm run playwright:install
```

### 실험 1만 실행

```bash
npm run start:download
```

### 실험 2만 실행

```bash
npm run start:websocket
```

### 둘 다 실행

```bash
npm start
```

## 4) 실험 1: 다운로드 탐지(Performance API)

### 서버 주소

- Banned: `http://banned.download-lab.test:9100`
- Attacker: `http://attacker.download-lab.test:9101`
- Attacker (Stealthier): `http://attacker.download-lab.test:9101/?stealthier=1`

### 절차

1. Banned 서비스는 `/` 라우트만 사용합니다.
2. 방문 쿠키가 없는 상태에서 Banned `/`에 접근하면 메인 HTML 없이 `위험한-메뉴얼.pdf`가 즉시 다운로드되고 방문 쿠키가 설정됩니다.
3. 방문 쿠키가 있는 상태에서 Banned `/`에 재접근하면 메인 HTML을 반환하고 파일은 내려주지 않습니다.
4. Attacker 페이지에서 `탐지 실행` 버튼을 눌러 Banned `/` 요청의 `performance entry` 존재 여부를 비교합니다.
5. `/?stealthier=1` 모드에서는 sandbox 이중 iframe으로 실제 다운로드를 막은 상태에서 navigation 여부로 다운로드 시도를 추정합니다.

### 관찰 포인트

- 미방문 그룹에서 `entry 없음`(다운로드 실행 O), 방문 그룹에서 `entry 존재`(다운로드 실행 X) 패턴이 관측되면 의도한 동작입니다.
- 브라우저 버전에 따라 차단/완화되어 결과가 달라질 수 있습니다.

## 5) 실험 2: WebSocket 풀 포화 기반 상태 추정

### 서버 주소

- Company1: `http://company1.toy-slack.com:9001/`
- Company2: `http://company2.toy-slack.com:9002/`
- Company3: `http://company3.toy-slack.com:9003/`
- Attacker: `http://attacker.com:9004`

### 절차

1. 회사 페이지 3개 중 일부만 로그인합니다.
2. Attacker 페이지에서 타깃 회사를 선택합니다.
3. `탐지 실행` 버튼을 눌러 `diff`와 `probe` 결과를 확인합니다.
4. 필요하면 `연결 정리` 버튼으로 소켓/iframe 상태를 초기화합니다.

### 해석 가이드

- `diff > 0`, `probe=MISSING`: 타깃이 WS를 사용 중일 가능성(로그인 추정)
- `diff <= 0`, `probe=OPEN`: 타깃 WS 사용 신호가 약함(로그아웃 추정)

### 튜닝 팁

- payload 기본값은 `waitTime=3000`, `max=200`, `kill/re-fill=10` 입니다.
- 포화용 WebSocket은 Attacker origin(`attacker.com`)의 `/attack-ws`에만 연결합니다.
- 브라우저별 한도 차이가 크므로 필요하면 코드 상수값을 조정해 재시도하세요.

## 6) 제한사항

1. 이 코드는 교육용 프로토타입입니다.
2. 브라우저 내부 정책(연결 한도, 프로세스 분리, 완화 패치)에 따라 재현성 차이가 큽니다.
3. 실전 서비스는 헤더 정책/리버스 프록시/CDN 동작까지 반영되어 결과가 달라질 수 있습니다.

## 7) 빠른 점검

```bash
npm run check
```

`npm run check`는 정적 문법 검사만 수행합니다. 브라우저 기반 검증은 아래 Playwright 시나리오를 사용하세요.

## 8) Playwright 시나리오

### 파일 위치

- `e2e/download-detection.spec.js`
- `e2e/websocket-detection.spec.js`
- `playwright.config.js` (프로젝트: `firefox`, `chrome`, `safari`)

### 실행

전체(`*`에 해당):

```bash
npm run test:e2e:all
```

브라우저별:

```bash
npm run test:e2e:firefox
npm run test:e2e:chrome
npm run test:e2e:safari
```

다운로드 탐지 시나리오:

```bash
npm run test:e2e:download:all
npm run test:e2e:download:firefox
npm run test:e2e:download:chrome
npm run test:e2e:download:safari
```

`download-detection.spec.js`는 기본(performance entry) 버전과 `/?stealthier=1`(이중 iframe) 버전을 모두 실행합니다.

웹소켓 탐지 시나리오:

```bash
npm run test:e2e:websocket:all
npm run test:e2e:websocket:firefox
npm run test:e2e:websocket:chrome
npm run test:e2e:websocket:safari
```

- `test:e2e:websocket:all`은 현재 payload 특성상 `firefox`, `safari`만 실행합니다(Chrome 제외).
- `test:e2e:websocket:chrome`은 참고/관찰용으로 남겨두었고, 현 구현에서는 실패가 정상 동작입니다.

### 옵션

- `PW_HEADED=1`: headed 모드 실행
- 기본 설정은 성공/실패 모두 `test-results`에 trace/screenshot/video를 저장합니다(용량 증가 주의).
