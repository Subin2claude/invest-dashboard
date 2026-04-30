// ════════════════════════════════════════════════════
// /api/stocks.js — 시세 데이터 백엔드 (Yahoo Finance v8)
// ════════════════════════════════════════════════════
// v8 chart API 사용 — 인증 불필요, 안정적
// previousClose 필드만 사용 (chartPreviousClose는 range 시작점이라 부정확)
// ════════════════════════════════════════════════════

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  const { symbols } = req.query;
  if (!symbols) {
    return res.status(400).json({ error: 'symbols query required' });
  }

  const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);

  try {
    // 모든 심볼 병렬 호출
    const results = await Promise.allSettled(
      symbolList.map(s => fetchYahooV8(s))
    );

    const data = {};
    results.forEach((r, i) => {
      const sym = symbolList[i];
      if (r.status === 'fulfilled' && r.value) {
        data[sym] = r.value;
      } else {
        data[sym] = { error: true, msg: r.reason?.message || 'fetch failed' };
      }
    });

    return res.status(200).json({ ok: true, data, ts: Date.now() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// ─────────────────────────────────────────────────────
// v8 chart API
// ─────────────────────────────────────────────────────
async function fetchYahooV8(symbol) {
  // 2일 range만 (어제+오늘) — 적은 데이터로 빠르게
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('no data');

  const meta = result.meta;
  const closes = result.indicators?.quote?.[0]?.close || [];
  const validCloses = closes.filter(c => c !== null && c !== undefined);

  // 현재가 — meta.regularMarketPrice가 가장 신뢰할 수 있음
  const price = meta.regularMarketPrice ?? validCloses[validCloses.length - 1];

  // 전일 종가 — meta.previousClose가 정확한 전일 종가
  // ★ chartPreviousClose는 차트 range 시작점이라 절대 사용 X
  const prev = meta.previousClose ?? validCloses[validCloses.length - 2];

  if (price === undefined || price === null) throw new Error('no price');

  const change = prev ? price - prev : 0;
  const changePercent = prev ? ((price - prev) / prev) * 100 : 0;

  return {
    symbol,
    price,
    previousClose: prev,
    change,
    changePercent,
    currency: meta.currency,
    marketState: meta.marketState,
    exchangeName: meta.exchangeName,
    longName: meta.longName || meta.shortName || symbol
  };
}
