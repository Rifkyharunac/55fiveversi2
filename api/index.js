// Cache in-memory module scope untuk Vercel Serverless Function
let cachedData = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 2500; // Cache 2.5 detik untuk cegah spam upstream & rate limit

export default async function handler(req, res) {
  // Allow CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const now = Date.now();

  // Kembalikan cache jika masih dalam batas TTL (hemat latency & cegah ban IP)
  if (cachedData && (now - lastFetchTime) < CACHE_TTL_MS) {
    return res.status(200).json(cachedData);
  }

  try {
    const timeoutSignal = AbortSignal.timeout(6000);

    const issuePromise = fetch(
      "https://newapi.55lottertttapi.com/api/webapi/GetGameIssue",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: timeoutSignal,
        body: JSON.stringify({
          typeId: 30,
          language: 0,
          random: "166b81d9568e4123a83a2c7fdb80b7d9",
          signature: "5DB43C344C7381B72B5262FFB3572444",
          timestamp: 1737252405
        })
      }
    );

    const historyPromise = fetch(
      "https://newapi.55lottertttapi.com/api/webapi/GetNoaverageEmerdList",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: timeoutSignal,
        body: JSON.stringify({
          pageSize: 10,
          pageNo: 1,
          typeId: 30,
          language: 0,
          random: "b631eb26bac6403e99093913e5bb48c5",
          signature: "A6203E85132E5FE26B5F43DDF1ECDD07",
          timestamp: 1737252405
        })
      }
    );

    // Ambil kedua endpoint secara paralel untuk performa 2x lebih cepat
    const [issueResp, resultResp] = await Promise.all([issuePromise, historyPromise]);

    const issueJson = await issueResp.json();
    const resultJson = await resultResp.json();

    if (!issueJson?.data?.issueNumber) {
      if (cachedData) return res.status(200).json(cachedData);
      return res.status(500).json({ error: "Gagal ambil periode" });
    }

    const fullIssue = issueJson.data.issueNumber;
    const periode = fullIssue.toString().slice(-5);
    const list = resultJson?.data?.list || [];

    if (!list.length) {
      if (cachedData) return res.status(200).json(cachedData);
      return res.status(500).json({ error: "List hasil kosong" });
    }

    const numberString = list[0].number;
    const lastDigit = parseInt(String(numberString).split(",").pop(), 10);

    const payload = {
      periode,
      issue: fullIssue,
      hasil: lastDigit,
      number: numberString,
      list: list.slice(0, 10).map(e => ({
        issueNumber: e.issueNumber,
        number: e.number,
        hasil: parseInt(String(e.number).split(",").pop(), 10),
        colour: e.colour || ''
      })),
      timestamp: now
    };

    cachedData = payload;
    lastFetchTime = now;

    return res.status(200).json(payload);

  } catch (err) {
    // Jika upstream lambat / timeout tapi kita punya cache sebelumnya, pakai cache!
    if (cachedData) {
      return res.status(200).json(cachedData);
    }
    return res.status(500).json({
      error: "Server error",
      detail: err.message
    });
  }
}
