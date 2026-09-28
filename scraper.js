const fs = require('fs');
const { JSDOM } = require('jsdom');

async function fetchDay(dateOffset, regCode) {
  let d = new Date();
  d.setDate(d.getDate() - dateOffset);
  let dStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  let url = `https://xskt.com.vn/${regCode}/ngay-${d.getDate()}-${d.getMonth()+1}-${d.getFullYear()}`;

  try {
    let res = await fetch(url);
    if (!res.ok) return null;
    let html = await res.text();
    if (!html.includes("đặc biệt")) return null;

    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const tables = doc.querySelectorAll("table");
    let targetTable = null;

    for (let tbl of tables) {
      let t = tbl.textContent.toLowerCase();
      if (t.includes("tiền thưởng") || t.includes("sl giải")) continue;
      if (t.includes("đặc biệt") || t.includes("giải đb")) { targetTable = tbl; break; }
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
              if (text.toLowerCase().includes("đặc biệt") || text.toLowerCase().includes("đb")) isDBRow = true;
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
      return dayData;
    }
  } catch (e) { return null; }
  return null;
}

async function run() {
  const regions = ['xsmb', 'xsmn', 'xsmt'];
  for (let reg of regions) {
      let results = [];
      console.log(`Đang cào dữ liệu đài: ${reg.toUpperCase()}`);
      for (let i = 0; i < 100; i++) {
        let data = await fetchDay(i, reg);
        if (data && data.prizes.length > 0) {
            results.push(data);
        }
        await new Promise(r => setTimeout(r, 100)); // Tránh nghẽn kết nối
      }
      fs.writeFileSync(`data_${reg}.json`, JSON.stringify(results));
      console.log(`Hoàn tất ${results.length} ngày cho đài ${reg}`);
  }
}

run();
