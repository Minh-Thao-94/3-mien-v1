async function fetchSingleDay(year, month, day, offset, regCode) {
  let d = new Date(year, month - 1, day - offset);
  let dStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  let fetchDay = String(d.getDate()).padStart(2, '0');
  let fetchMonth = String(d.getMonth() + 1).padStart(2, '0');
  let fetchYear = d.getFullYear();

  // Danh sách URL gốc
  const rawUrls = [
    `https://xosodaiphat.com/${regCode}-${fetchDay}-${fetchMonth}-${fetchYear}.html`,
    `https://xskt.com.vn/${regCode}/ngay-${parseInt(fetchDay, 10)}-${parseInt(fetchMonth, 10)}-${fetchYear}`,
    `https://xoso.com.vn/${regCode}-${fetchDay}-${fetchMonth}-${fetchYear}.html`
  ];
  
  for (let rawUrl of rawUrls) {
    try {
      const controller = new AbortController();
      // Tăng thời gian chờ lên 10 giây để tải trọng 60 ngày có đủ thời gian xử lý
      const timeoutId = setTimeout(() => controller.abort(), 10000); 
      
      let html = null;
      try {
        // BƯỚC 1: Thử lấy dữ liệu trực tiếp (Laptop sẽ chạy rất nhanh qua bước này)
        let res = await fetch(rawUrl, { signal: controller.signal });
        if (res.ok) html = await res.text();
      } catch (directError) {
        // BƯỚC 2: Nếu lấy trực tiếp lỗi (do Safari iOS chặn CORS), tự động dùng Proxy dự phòng
        let proxyUrl = `https://corsproxy.io/?${encodeURIComponent(rawUrl)}`;
        let proxyRes = await fetch(proxyUrl, { signal: controller.signal });
        if (proxyRes.ok) html = await proxyRes.text();
      }
      
      clearTimeout(timeoutId);

      // Bỏ qua nếu vẫn không có dữ liệu hoặc không phải bảng Đặc biệt
      if (!html || !html.toLowerCase().includes("đặc biệt")) continue;

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const tables = doc.querySelectorAll("table");
      let targetTable = null;

      for (let tbl of tables) {
        let t = tbl.innerText.toLowerCase();
        if (t.includes("tiền thưởng") || t.includes("trùng") || t.includes("sl giải")) continue;
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
        return dayData; 
      }
    } catch (e) { 
        // Bỏ qua lỗi vòng lặp hiện tại để thử URL dự phòng tiếp theo
    } 
  }
  return null; 
}
