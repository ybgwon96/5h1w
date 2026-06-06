# Block Blast

> 네온 8×8 블록 퍼즐 — 콤보 · 레벨 · 테마 · 일일 챌린지를 갖춘 설치형(PWA) 모바일 게임
> A polished neon 8×8 block-puzzle PWA with combos, levels, themes, and a daily challenge.

[![CI](https://github.com/ybgwon96/5h1w/actions/workflows/ci.yml/badge.svg)](https://github.com/ybgwon96/5h1w/actions/workflows/ci.yml)

블록 3개를 8×8 보드에 드래그해 가로/세로 줄을 채워 없애는, 2026년 최고 인기 캐주얼
장르의 완성도 높은 구현입니다. 폰에서 **"홈 화면에 추가"** 하면 전체화면 네이티브
앱처럼 실행되고 오프라인에서도 동작합니다.

## ✨ 기능

- **클래식 / 일일 챌린지** — 일일 챌린지는 날짜 시드 기반으로 전 세계 동일한 블록 순서
- **레벨 & 점수 배수** — 줄을 모을수록 레벨업, 배수 상승
- **콤보 & 연속(streak) 보너스** — 한 수 다중 줄 + 연속 제거로 점수 폭발
- **부활(revive)** — 게임당 1회, 바닥 줄을 비우고 재도전
- **3가지 테마** (네온 / 캔디 / 모노) + **한/영 i18n** (자동 감지)
- **설정** — 효과음 · 배경음악 · 진동 · 모션 줄이기 · 테마 · 언어 (기기에 영속 저장)
- **통계** — 최고 점수 · 최대 콤보 · 누적 줄 · 플레이 횟수
- **연출** — 네온 글로우, 파티클, 화면 흔들림, 점수 팝업, 블록 팝 애니메이션, 햅틱
- **PWA** — 설치 · 오프라인 · OG 메타 · 절차적 BGM/효과음(에셋 0)
- **접근성** — `prefers-reduced-motion` 자동 적용, 모션 줄이기 토글

## 🎮 규칙

1. 트레이의 블록 3개를 8×8 보드로 **드래그** (손가락 위로 떠서 보임)
2. **가로/세로 한 줄이 가득 차면 자동 제거** + 점수
3. **여러 줄 동시 제거 = 콤보 배수**, **연속 제거 = streak 보너스**
4. 블록 3개를 다 쓰면 새 블록 3개 등장 (항상 1개는 놓을 수 있게 보장)
5. 더 놓을 곳이 없으면 **GAME OVER**

| 동작      | 점수                                                   |
| --------- | ------------------------------------------------------ |
| 블록 배치 | 칸 수 만큼                                             |
| 줄 제거   | (지운 칸 × 10) × 동시 줄 수 + 연속 보너스, × 레벨 배수 |

## 🏗 아키텍처

순수 게임 로직(`src/core/`)은 UI·브라우저와 완전히 분리되어 있어 단위 테스트가 가능합니다.

```
src/
  core/                 # 순수 로직 (의존성 0, 100% 단위 테스트)
    rng.ts              # 시드 PRNG (mulberry32) — 일일 챌린지/재현성
    shapes.ts           # 폴리오미노 + 회전 생성
    board.ts            # 보드 연산: 배치/줄검출/게임오버
    scoring.ts          # 점수/레벨/콤보 수식
    engine.ts           # GameEngine 상태머신 (이벤트 방출)
    *.test.ts           # Vitest 단위 테스트 (44개)
  ui/                   # 표현 계층
    audio.ts            # Web Audio 효과음 + 절차적 BGM
    themes.ts           # 컬러 테마
    i18n.ts             # 한/영 번역
    settings.ts         # 설정 모델 + 영속화
    stats.ts            # 통계 영속화
    storage.ts          # 예외 안전 localStorage 래퍼
    dom.ts              # 메뉴 오버레이용 하이퍼스크립트 헬퍼
  app.ts                # 컨트롤러 + 캔버스 렌더러 + 화면 전환
  main.ts              # 부트스트랩 (캔버스/DPR/입력/루프/SW)
public/                 # manifest, service worker, 아이콘, OG 이미지
```

## 🛠 개발

```bash
npm install
npm run dev          # 개발 서버 (폰에서 같은 와이파이로 접속 가능)
npm test             # 단위 테스트 (Vitest)
npm run typecheck    # 타입 체크
npm run lint         # ESLint
npm run format       # Prettier
npm run build        # 프로덕션 빌드 → dist/
npm run preview      # 빌드 미리보기
```

## 🚀 CI / 배포

- **CI** (`.github/workflows/ci.yml`): 타입체크 · 린트 · 포맷 · 테스트 · 빌드
- **배포** (`.github/workflows/deploy.yml`): `main` 푸시 시 GitHub Pages 자동 배포

GitHub Pages를 쓰려면 저장소 **Settings → Pages → Source: GitHub Actions**로 설정하세요.

## 🔒 개인정보

이 게임은 어떤 개인정보도 수집·전송하지 않습니다. 최고 점수와 설정은 기기 안
(localStorage)에만 저장됩니다.

## 라이선스

MIT
