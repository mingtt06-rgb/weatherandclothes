// Vercel 서버리스 함수: Gemini API 키를 숨긴 채 대신 호출해 줍니다.
// Vercel 프로젝트 Settings → Environment Variables 에 GEMINI_API_KEY 를 등록하세요.
//
// ✅ 상태 확인: 브라우저에서 https://내사이트.vercel.app/api/gemini 를 열면
//    키 등록 여부, 키 유효성, 사용 가능한 모델 목록을 보여줍니다. (키 값 자체는 표시하지 않음)
//
// 모델은 아래 순서대로 시도하고, 없거나(404) 느리거나(시간 초과) 혼잡하면(429/5xx) 다음 모델로 넘어갑니다.
// Vercel 환경변수 GEMINI_MODEL 에 모델 이름을 넣으면 그 모델을 가장 먼저 시도합니다.

const MODEL_CHAIN = [
  'gemini-3.1-flash-lite',   // 빠르고 저렴 (옷 추천엔 충분)
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',        // 최신 Flash
  'gemini-3.6-flash',
  'gemini-2.5-flash',
];
const PER_MODEL_TIMEOUT_MS = 20000;
const MAX_BODY = 20000;
const API = 'https://generativelanguage.googleapis.com/v1beta';

function modelOrder() {
  const first = (process.env.GEMINI_MODEL || '').trim();
  return first ? [first, ...MODEL_CHAIN.filter(m => m !== first)] : MODEL_CHAIN;
}

async function callModel(model, apiKey, bodyObj, withThinking) {
  const payload = JSON.parse(JSON.stringify(bodyObj));
  payload.generationConfig = payload.generationConfig || {};
  delete payload.generationConfig.thinkingConfig;
  if (withThinking) payload.generationConfig.thinkingConfig = { thinkingLevel: 'low' };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_MODEL_TIMEOUT_MS);
  try {
    const r = await fetch(`${API}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    return { status: r.status, text: await r.text() };
  } catch (e) {
    return { status: e.name === 'AbortError' ? 504 : 502, text: JSON.stringify({ error: { message: e.name === 'AbortError' ? 'timeout' : 'upstream fetch failed' } }) };
  } finally {
    clearTimeout(timer);
  }
}

// GET: 상태 확인용
async function diagnose(res) {
  const apiKey = process.env.GEMINI_API_KEY;
  const out = {
    keySet: !!apiKey,
    keyPreview: apiKey ? `${apiKey.slice(0, 4)}…${apiKey.slice(-4)} (${apiKey.length}자)` : null,
    preferredModel: process.env.GEMINI_MODEL || null,
    modelChain: modelOrder(),
  };
  if (!apiKey) {
    out.message = '❌ GEMINI_API_KEY가 없어요. Vercel Settings → Environment Variables에 추가하고 Redeploy 하세요.';
    return res.status(200).json(out);
  }
  try {
    const r = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      out.keyValid = false;
      out.message = `❌ 키 확인 실패 (${r.status}): ${data?.error?.message || ''}`;
    } else {
      const names = (data.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace('models/', ''));
      out.keyValid = true;
      out.availableInChain = modelOrder().filter(m => names.includes(m));
      out.availableFlashModels = names.filter(n => n.includes('flash'));
      out.message = '✅ 키가 정상이에요.';
    }
  } catch {
    out.message = '⚠️ Google 서버에 연결하지 못했어요.';
  }
  return res.status(200).json(out);
}

module.exports = async (req, res) => {
  if (req.method === 'GET') return diagnose(res);
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'POST only' } });

  // 내 사이트에서 온 요청만 허용
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: { message: 'origin not allowed' } });
    } catch {
      return res.status(403).json({ error: { message: 'bad origin' } });
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: { message: 'GEMINI_API_KEY not set' } });

  let bodyObj = req.body;
  if (typeof bodyObj === 'string') { try { bodyObj = JSON.parse(bodyObj); } catch { bodyObj = null; } }
  if (!bodyObj || typeof bodyObj !== 'object') return res.status(400).json({ error: { message: 'bad request body' } });
  if (JSON.stringify(bodyObj).length > MAX_BODY) return res.status(413).json({ error: { message: 'request too large' } });

  let last = null;
  const tried = [];
  for (const model of modelOrder()) {
    let r = await callModel(model, apiKey, bodyObj, true);
    // 이 모델이 thinkingLevel 설정을 지원하지 않으면 설정 없이 한 번 더
    if (r.status === 400 && /thinking/i.test(r.text)) r = await callModel(model, apiKey, bodyObj, false);
    tried.push(`${model}:${r.status}`);

    if (r.status === 200) {
      res.setHeader('X-Gemini-Model', model);
      res.status(200).setHeader('Content-Type', 'application/json');
      return res.send(r.text);
    }
    // 키 문제 등은 다른 모델로 넘어가도 소용없으니 바로 반환
    const keyProblem = r.status === 401 || r.status === 403 || (r.status === 400 && /api.?key/i.test(r.text));
    if (keyProblem) {
      res.status(r.status).setHeader('Content-Type', 'application/json');
      return res.send(r.text);
    }
    last = r; // 404(모델 없음) / 400(모델별 설정 미지원) / 429 / 5xx / 시간 초과 → 다음 모델 시도
  }

  console.error('All models failed:', tried.join(', '));
  let msg = 'all models failed';
  try { msg = JSON.parse(last.text)?.error?.message || msg; } catch {}
  return res.status(last?.status === 429 ? 429 : 503).json({ error: { message: `${msg} (tried: ${tried.join(', ')})` } });
};
