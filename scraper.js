const fs = require('fs');
const { JSDOM } = require('jsdom');

async function fetchDay(dateOffset, regCode) {
  let d = new Date();
  d.setUTCHours(d.getUTCHours() + 7); // Ép chuẩn giờ Việt Nam
  d.setDate(d.getDate() - dateOffset);

  let dStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  let fetchDay = String(d.getDate()).padStart(2, '0');
  let fetchMonth = String(d.getMonth() + 1).padStart(2, '0');
  let fetchYear = d.getFullYear();

  // Chiến thuật đa nguồn: Nếu xskt chặn, nhảy sang xosodaiphat hoặc xoso.com.vn
  const urls = [
    `https://xosodaiphat.com/${regCode}-${fetchDay}-${fetchMonth}-${fetchYear}.html`,
    `https://xskt.com.vn/${regCode}/ngay-${parseInt(fetchDay, 10)}-${parseInt(fetchMonth, 10)}-${fetchYear}`,
    `https://xoso.com.vn/${regCode}-${fetchDay}-${fetchMonth}-${fetchYear}.html`
  ];

  let headers = { 
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" 
  };

  let html = null;

  for (let rawUrl of urls) {
    try {
      // Ưu tiên dùng Proxy Codetabs để bọc dải IP của GitHub
      let proxyUrl = `https://api.codetabs.com/v1/proxy/?quest=${rawUrl}`;
      let res = await fetch(proxyUrl, { headers });
      if (res.ok) {
        html = await res.text();
        if (html.toLowerCase().includes("đặc biệt")) break;
      }
    } catch(e) {}

    try {
      // Nếu Proxy sập, thử đâm thẳng (Direct Fetch)
      let res = await fetch(rawUrl, { headers });
      if (res.ok) {
        html = await res.text();
        if (html.toLowerCase().includes("đặc biệt")) break;
      }
    } catch(e) {}
  }

  if (!html || !html.toLowerCase().includes("đặc biệt")) {
      console.log(`[!] BỎ QUA ${dStr} - Bị tường lửa chặn hoặc đài chưa quay.`);
      return null;
  }

  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const tables = doc.querySelectorAll("table");
  let targetTable = null;

  for (let tbl of tables) {
    let t = tbl.textContent.toLowerCase();
    if (t.includes("tiền thưởng") || t.includes("sl giải")) continue;
    if (t.includes("đặc biệt") || t.includes("giải đb") || t.includes("g.đb")) { targetTable = tbl; break; }
  }

  if (targetTable) {
    let dayData = { date: dStr, prizes: [], htmlTable: "" };
    const rows = targetTable.querySelectorAll("tr");
    let cleanHtml = '<table class="clean-table">';

    rows.forEach((tr, idx) => {
      if (tr.closest('thead') && idx > 0) return;
      let cells = tr.querySelectorAll("th, td");
      if (cells.length < 2) return;
      let rowHtml = "<tr>";
      let isDBRow = false;

      cells.forEach((cell, ci) => {
        let text = cell.textContent.replace(/\n/g, ' ').trim();
        if (idx === 0 || cell.tagName === "TH") {
          rowHtml += `<th>${text}</th>`;
        } else {
          if (ci === 0) {
            rowHtml += `<td class="prize-name">${text}</td>`;
            if (text.toLowerCase().includes("đặc biệt") || text.toLowerCase().includes("đb") || text.toLowerCase().includes("gđb")) isDBRow = true;
          } else {
            let nums = text.split(/\s+/).filter(n => !isNaN(n) && n.length > 0);
            rowHtml += `<td class="prize-number">`;
            nums.forEach(n => {
              rowHtml += `<span class="num-pill">${n}</span>`;
              dayData.prizes.push(n.replace(/\D/g, ''));
            });
            rowHtml += `</td>`;
          }
        }
      });
      rowHtml += "</tr>";
      if (isDBRow) rowHtml = rowHtml.replace('<tr>', '<tr class="row-db">');
      cleanHtml += rowHtml;
    });
    cleanHtml += '</table>';
    dayData.htmlTable = cleanHtml;
    console.log(`[+] THÀNH CÔNG: Đã lấy dữ liệu ngày ${dStr}`);
    return dayData;
  }
  return null;
}

async function run() {
  const TOTAL_DAYS = 65; // Lấy 65 ngày để đảm bảo luôn có đủ dư 60 ngày cho AI
  const regions = ['xsmb', 'xsmn', 'xsmt'];
  
  for (let reg of regions) {
      let results = [];
      console.log(`\n=== BẮT ĐẦU QUÉT ĐÀI: ${reg.toUpperCase()} ===`);
      for (let i = 0; i < TOTAL_DAYS; i++) {
        let data = await fetchDay(i, reg);
        if (data && data.prizes.length > 0) {
            results.push(data);
        }
        await new Promise(r => setTimeout(r, 600)); // Nhịp nghỉ 0.6s để qua mặt hệ thống chống Spam
      }
      // Lưu file dưới định dạng format đẹp (xuống dòng) để dễ kiểm tra thay vì 1 dòng dài
      fs.writeFileSync(`data_${reg}.json`, JSON.stringify(results, null, 2));
      console.log(`=== HOÀN TẤT ${reg.toUpperCase()}: Thu được ${results.length} ngày hợp lệ ===\n`);
  }
}

run();
