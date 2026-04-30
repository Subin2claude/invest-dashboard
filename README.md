# 투자 인텔리전스 대시보드

슈빙이 개인 투자 모니터링 대시보드. Vercel + GitHub 자동 배포.

## 기능

- 📊 **종합** — 주요 지수 + 보유 종목 실시간 시세 + 환율·원자재
- 💼 **포트폴리오** — 보유/관심 종목 (편집 가능, localStorage 저장)
- 🌐 **시장** — 미국/일본 차트 + 글로벌·국내 뉴스
- 🏢 **부동산** — 지역별 통계 + 부동산 뉴스 + 정책 + 청약 캘린더
- 🎯 **전략** — 손절/익절/매수 카드

## 기술 스택

- 프론트엔드: Vanilla HTML/CSS/JS
- 백엔드: Vercel Serverless Functions (Node.js)
- 시세: Yahoo Finance API
- 뉴스: Google News RSS
- 차트: TradingView 위젯

## 디렉토리 구조

```
invest-dashboard/
├── public/
│   ├── index.html       # 대시보드 화면
│   └── app.js           # 데이터 처리·렌더 로직
├── api/
│   ├── stocks.js        # 시세 API (Yahoo Finance 프록시)
│   └── news.js          # 뉴스 API (Google News RSS 프록시)
├── package.json
├── vercel.json
└── README.md
```

## 배포

GitHub에 push하면 Vercel이 자동 배포합니다.
