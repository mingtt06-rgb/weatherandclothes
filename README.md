# 👕 어제 체감 기반 오늘의 OOTD 추천기

방문자는 키 입력 없이 바로 쓰고, AI 호출은 관리자(나)의 Gemini 키 하나로 처리됩니다.
키는 Vercel 환경변수에만 저장되어 사이트 소스에는 노출되지 않습니다.

```
방문자 브라우저 → index.html ─→ /api/gemini (Vercel 서버, 키 보관) → Gemini API
                            └→ Open-Meteo (날씨, 키 불필요)
```

## 파일 구조

```
index.html      ← 앱 화면
api/gemini.js   ← 키를 숨기는 서버 함수 (반드시 api 폴더 안에)
README.md
```

## 설정 순서 (모두 웹에서, 터미널 필요 없음)

### 1. GitHub에 올리기
1. GitHub에서 새 저장소 생성 (Public/Private 모두 가능)
2. **Add file → Upload files**로 `index.html`, `README.md` 업로드 → Commit
3. **Add file → Create new file** → 파일 이름 칸에 `api/gemini.js` 입력
   (`/`를 치면 api 폴더가 자동으로 만들어져요) → `gemini.js` 내용 붙여넣기 → Commit

### 2. Vercel에 배포하기
1. https://vercel.com 에서 **Continue with GitHub**로 로그인
2. **Add New… → Project** → 방금 만든 저장소 **Import**
3. **Environment Variables** 펼치기
   - Key: `GEMINI_API_KEY` / Value: 내 Gemini API 키 → **Add**
4. **Deploy** → 완료되면 `https://프로젝트이름.vercel.app` 주소가 생깁니다.

이후 GitHub에서 파일을 고치면 Vercel이 자동으로 다시 배포합니다.

> 키를 나중에 추가/변경했다면: Vercel 프로젝트 **Settings → Environment Variables**에서 수정 후
> **Deployments** 탭 → 최신 배포 오른쪽 `⋯` → **Redeploy** 해야 반영됩니다.

## 알아둘 점
- **사용량 한도:** 모든 방문자가 키 하나의 한도를 나눠 씁니다. 무료 등급은 분당/일일 요청 수 제한이 있어, 사람이 많으면 "한도" 안내가 뜰 수 있습니다.
- **결제 연결 시 주의:** Google 계정에 결제를 연결했다면 사용량만큼 과금될 수 있으니 예산 알림을 설정해 두세요.
- **보안:** Gemini 키를 `index.html`이나 GitHub에 절대 적지 마세요. Vercel 환경변수에만 넣으면 됩니다.
