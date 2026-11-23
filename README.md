# 👕 어제 체감 기반 오늘의 OOTD 추천기

어제 입은 옷과 체감(추움/적당/더움), 오늘 방문할 동네의 날씨를 비교해 오늘 입을 상의·외투·하의를 추천하는 웹앱입니다.

- 날씨: [Open-Meteo](https://open-meteo.com/) (키 불필요)
- AI: Google Gemini API `gemini-2.5-flash` (사용자 본인 키, 브라우저 localStorage에만 저장)
- 구성: `index.html` 단일 파일 (Tailwind CDN, Lucide CDN, Vanilla JS)

## GitHub Pages로 배포하기

1. GitHub에서 새 저장소를 만듭니다 (예: `ootd`). Public으로 만드세요.
2. 이 폴더의 `index.html`, `README.md`를 저장소에 올립니다.
   - 웹에서: **Add file → Upload files**로 드래그 후 Commit
   - 터미널에서:
     ```bash
     git init
     git add index.html README.md
     git commit -m "OOTD 추천기 첫 배포"
     git branch -M main
     git remote add origin https://github.com/<내아이디>/ootd.git
     git push -u origin main
     ```
3. 저장소 **Settings → Pages → Build and deployment**에서
   Source: `Deploy from a branch`, Branch: `main` / `/ (root)` 선택 후 Save.
4. 1~2분 뒤 `https://<내아이디>.github.io/ootd/` 에서 열립니다.

## Gemini API 키

1. [Google AI Studio](https://aistudio.google.com/apikey)에서 키를 발급받습니다.
2. 배포된 페이지 상단 **Gemini API 키** 칸에 붙여넣고 [저장]을 누릅니다.

> ⚠️ API 키를 `index.html`이나 저장소에 **절대 직접 적지 마세요.** 공개 저장소에 올라간 키는 자동 수집되어 도용됩니다.
> 키는 각 사용자의 브라우저에만 저장되며, 원하면 [Google Cloud Console → API 및 서비스 → 사용자 인증 정보]에서 해당 키의 "웹사이트 제한"에 `https://<내아이디>.github.io/*`를 추가해 더 안전하게 쓸 수 있습니다.

## 로컬에서 실행

`index.html`을 브라우저로 바로 열어도 동작합니다.
(`localStorage`가 막히는 환경이면 `python3 -m http.server` 후 `http://localhost:8000` 접속)

## 동작 방식

1. **지역 → 좌표**: Open-Meteo Geocoding에서 한국(KR) 결과 검색. "서울 노원구"처럼 입력해도 마지막 단어·접미사(역/동/구)를 떼어 재검색합니다.
2. **날씨 요약**: 어제·오늘 08~21시 기준 최저/최고 기온, 평균 체감기온, 최대 강수확률, 강수량, 비/눈 시간대, ΔT(오늘−어제 체감) 계산.
3. **Gemini 추론**: 체감 보정 매트릭스 + 강수 시 방수 우선 규칙을 systemInstruction으로 전달하고, `responseSchema`로 정형 JSON을 받아 카드에 표시합니다.
   비 판정(강수확률 ≥ 40% 또는 강수량 ≥ 0.5mm)은 앱이 직접 계산하므로 AI 응답과 관계없이 비 배너가 정확히 뜹니다.
