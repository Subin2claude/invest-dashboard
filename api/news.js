// ════════════════════════════════════════════════════
// /api/news.js — 뉴스 데이터 백엔드 (구글 뉴스 RSS)
// ════════════════════════════════════════════════════
// 호출: GET /api/news?category=global|domestic|realestate
// 응답: { items: [{ title, link, source, pubDate }, ...] }
// ════════════════════════════════════════════════════

const QUERIES = {
  global: [
    { q: 'stock market when:1d', lang: 'en' },
    { q: 'Federal Reserve interest rate when:1d', lang: 'en' },
  ],
  domestic: [
    { q: '코스피 코스닥 증시 when:1d', lang: 'ko' },
    { q: '반도체 삼성전자 SK하이닉스 when:1d', lang: 'ko' },
  ],
  realestate: [
    { q: '부동산 아파트 시세 when:1d', lang: 'ko' },
    { q: '서울 아파트 분양 청약 when:1d', lang: 'ko' },
  ],
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');

  const { category = 'global' } = req.query;
  const queries = QUERIES[category];

  if (!queries) {
    return res.status(400).json({ error: 'invalid category' });
  }

  try {
    const allItems = [];
    for (const { q, lang } of queries) {
      const items = await fetchGoogleNews(q, lang);
      allItems.push(...items);
    }

    // 중복 제거 (link 기준)
    const seen = new Set();
    const unique = allItems.filter(it => {
      if (seen.has(it.link)) return false;
      seen.add(it.link);
      return true;
    });

    // 날짜순 정렬 후 8개만
    unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    const items = unique.slice(0, 8);

    return res.status(200).json({ ok: true, items, ts: Date.now() });
  } catch (e) {
    return res.status(500).json({ error: e.message, items: [] });
  }
}

async function fetchGoogleNews(query, lang) {
  const region = lang === 'ko' ? 'KR' : 'US';
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${lang}&gl=${region}&ceid=${region}:${lang}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; InvestDashboard/1.0)',
      'Accept': 'application/rss+xml, application/xml, text/xml'
    }
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const xml = await response.text();
  return parseRSS(xml);
}

function parseRSS(xml) {
  const items = [];
  // <item>...</item> 블록 추출
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    const sourceMatch = block.match(/<source[^>]*>([^<]+)<\/source>/);
    const source = sourceMatch ? decodeEntities(sourceMatch[1]) : '';
    if (title && link) {
      items.push({
        title: decodeEntities(title),
        link: decodeEntities(link),
        source,
        pubDate
      });
    }
  }
  return items;
}

function extractTag(block, tag) {
  // CDATA 우선
  const cdataRegex = new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`);
  const cdataMatch = block.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();
  // 일반 텍스트
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
  const m = block.match(regex);
  return m ? m[1].trim() : '';
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}
