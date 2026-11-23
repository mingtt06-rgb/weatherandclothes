// Vercel 서버리스 함수: 동·역·장소 이름을 좌표로 바꿔 줍니다 (OpenStreetMap Nominatim, 키 불필요)
// 앱 안에 내장된 시·군·구 목록에 없는 이름(예: 여의도, 성수동, 판교)을 찾을 때만 사용됩니다.
// Nominatim 이용 정책: 초당 1회 이하, 앱 식별 User-Agent 필수 → 아래에서 지킵니다.

const UA = 'ootd-recommender/1.0 (vercel serverless; weather outfit app)';
const cache = new Map();          // 같은 검색어는 다시 묻지 않기
let lastCall = 0;

const join = (parts) => parts.filter((v, i, a) => v && a.indexOf(v) === i);

module.exports = async (req, res) => {
  const q = String(req.query?.q || '').trim().slice(0, 60);
  if (q.length < 2) return res.status(400).json({ results: [], error: 'query too short' });

  const key = q.toLowerCase();
  if (cache.has(key)) {
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ results: cache.get(key) });
  }

  // 초당 1회 제한 지키기
  const wait = 1100 - (Date.now() - lastCall);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCall = Date.now();

  const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({
    q, format: 'jsonv2', countrycodes: 'kr', 'accept-language': 'ko', limit: '8', addressdetails: '1',
  });

  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' } });
    if (!r.ok) return res.status(502).json({ results: [], error: `nominatim ${r.status}` });
    const data = await r.json();
    const results = (data || []).map(x => {
      const a = x.address || {};
      const name = x.name || String(x.display_name || '').split(',')[0].trim();
      const parts = join([a.province, a.state, a.city, a.county, a.borough, a.city_district, a.town, a.suburb, a.quarter, a.village, name]);
      const label = (parts.length > 4 ? [parts[0], ...parts.slice(-3)] : parts).join(' ');
      return { name, label, lat: Number(x.lat), lon: Number(x.lon), kind: x.addresstype || x.type || '' };
    }).filter(x => x.name && Number.isFinite(x.lat) && Number.isFinite(x.lon));

    cache.set(key, results);
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ results });
  } catch (e) {
    return res.status(502).json({ results: [], error: 'nominatim unreachable' });
  }
};
