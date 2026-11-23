// Vercel 서버리스 함수: Gemini API 키를 숨긴 채 대신 호출해 줍니다.
// Vercel 프로젝트 Settings → Environment Variables 에 GEMINI_API_KEY 를 등록하세요.

// 모델 변경이 필요하면 Vercel 환경변수 GEMINI_MODEL 로 바꿀 수 있어요 (코드 수정 불필요)
const DEFAULT_MODEL = 'gemini-3.5-flash';
const MAX_BODY = 20000; // 요청 크기 제한 (남용 방지)

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'POST only' } });
  }

  // 내 사이트에서 온 요청만 허용 (다른 사이트가 내 키를 가져다 쓰는 것 방지)
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) {
        return res.status(403).json({ error: { message: 'origin not allowed' } });
      }
    } catch {
      return res.status(403).json({ error: { message: 'bad origin' } });
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: 'GEMINI_API_KEY not set' } });
  }

  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  if (body.length > MAX_BODY) {
    return res.status(413).json({ error: { message: 'request too large' } });
  }

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || DEFAULT_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body,
      }
    );
    const text = await r.text();
    res.status(r.status).setHeader('Content-Type', 'application/json');
    return res.send(text);
  } catch (e) {
    return res.status(502).json({ error: { message: 'upstream fetch failed' } });
  }
};
