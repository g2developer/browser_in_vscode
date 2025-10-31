# Browser in VS Code

## 이 익스텐션은 VS Code에서 웹뷰로 localhost등의 디버깅을 하기 위해 만들어졌습니다.

간단한 VS Code 익스텐션 예제입니다. 

- `Browser in VS Code: Open Webview` — 간단한 주소창과 iframe을 가진 웹뷰 열기

참고: 많은 웹사이트가 보안 정책(CSP/X-Frame-Options)으로 iframe 임베드를 막습니다. 일부 주소는 로드되지 않을 수 있습니다.

콘솔을 이용할 경우 index.html 파일내 다음 스크립트를 포함하세요.
<code>&lt;script src="https://unpkg.com/iframe-console-relay/dist/index.umd.min.js"&gt;&lt;/script&gt;</code>

npm 사용시 아래 사이트의 가이드를 참고하세요.
https://github.com/g2developer/iframe-console-relay

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
- `npm run build:install`: VSIX 생성 후 바로 VS Code에 설치(`--force` 재설치) 혹은 빌드 browser-in-vscode.vsix로 직접설치
