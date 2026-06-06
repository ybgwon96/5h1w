# Neon Dash

> 한 손가락으로 즐기는 중력반전 엔드리스 아케이드 게임 — 모바일 PWA

탭하면 중력이 위아래로 뒤집힙니다. 네온 장애물을 피하고, 오브를 모아 콤보를 쌓고,
속도가 점점 빨라지는 가운데 최고 점수에 도전하세요. 폰에서 **"홈 화면에 추가"**
하면 전체화면 네이티브 앱처럼 실행되고, 오프라인에서도 동작합니다.

## 기술 스택

- **Vite** + **TypeScript** — 빠른 개발 서버 / 타입 안전성
- **HTML5 Canvas 2D** — 의존성 없는 자체 렌더링 (파티클, 네온 글로우, 화면 흔들림)
- **Web Audio API** — 에셋 없는 절차적 효과음
- **PWA** — 직접 작성한 매니페스트 + 서비스워커로 설치/오프라인 지원
- 모바일 햅틱(`navigator.vibrate`), 고해상도(DPR) 대응, 포트레이트 최적화

## 조작

| 입력 | 동작 |
| --- | --- |
| 화면 탭 / 클릭 | 중력 반전 (시작 / 다시 시작) |
| `Space` `↑` `Enter` | 동일 (데스크톱 테스트용) |

오브를 연속으로 모으면 콤보가 쌓이고 점수 배수가 올라갑니다.

## 개발

```bash
npm install      # 의존성 설치
npm run dev      # 개발 서버 (http://localhost:5173, 같은 와이파이의 폰에서도 접속 가능)
npm run build    # 타입 체크 + 프로덕션 빌드 → dist/
npm run preview  # 빌드 결과 미리보기
```

폰에서 바로 테스트하려면 `npm run dev` 실행 후 터미널에 표시되는 네트워크 주소를
폰 브라우저에서 열면 됩니다.

## 프로젝트 구조

```
index.html              진입 HTML (뷰포트/PWA 메타)
public/
  manifest.webmanifest  PWA 매니페스트
  sw.js                 서비스워커 (오프라인 캐시)
  icons/                앱 아이콘 (SVG)
src/
  main.ts               부트스트랩 · 캔버스/DPR · 게임 루프 · 입력
  game.ts               게임 상태머신 · 물리 · 충돌 · 렌더링
  particles.ts          파티클 시스템
  audio.ts              Web Audio 효과음
  storage.ts            최고 점수 / 음소거 저장
  style.css             전체화면 캔버스 스타일
```

## 라이선스

MIT
