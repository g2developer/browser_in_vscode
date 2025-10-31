# Browser in VS Code

간단한 VS Code 익스텐션 예제입니다. 두 가지 명령을 제공합니다.

- `Browser in VS Code: Hello World` — 알림 메시지 표시
- `Browser in VS Code: Open Webview` — 간단한 주소창과 iframe을 가진 웹뷰 열기

참고: 많은 웹사이트가 보안 정책(CSP/X-Frame-Options)으로 iframe 임베드를 막습니다. 일부 주소는 로드되지 않을 수 있습니다.

## 개발

1. 의존성 설치: `npm install`
2. 빌드: `npm run compile` 또는 `npm run watch`
3. VSIX 패키징: `npm run build` (또는 설치까지 한 번에 `npm run build:install`)
4. F5로 익스텐션 호스트 실행 후 명령 팔레트에서 명령 실행

개발 모드 편의 기능
- `media/*` 파일을 수정하면 웹뷰가 자동으로 리로드됩니다.
- `src`를 저장해 `out/*`가 갱신되면 VS Code 창이 자동으로 리로드되어(확장 호스트 재시작) 재설치 없이 변경사항이 반영됩니다.

### 빌드/설치 스크립트
- `npm run build`: TypeScript 컴파일 후 VSIX 생성
- `npm run build:install`: VSIX 생성 후 바로 VS Code에 설치(`--force` 재설치)
