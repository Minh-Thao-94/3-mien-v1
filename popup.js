let REAL_DATA = { history: [] }; 
const regionNames = { mb: "MIỀN BẮC", mn: "MIỀN NAM", mt: "MIỀN TRUNG" };

const BONG_DUONG = {'0':'5','1':'6','2':'7','3':'8','4':'9','5':'0','6':'1','7':'2','8':'3','9':'4'};
const BONG_AM = {'0':'7','1':'4','2':'9','3':'6','4':'1','5':'8','6':'3','7':'0','8':'5','9':'2'};

document.addEventListener("DOMContentLoaded", () => {
  setTodayDefault();
  // Đã đổi tên hàm thành handleFetchData cho phù hợp với logic mới
  document.getElementById("btnXemKQ").addEventListener("click", handleFetchData);
  document.getElementById("btnPhanTich").addEventListener("click", handlePredictions);
});

function setTodayDefault() {
  const today = new Date();
  document.getElementById("datePicker").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

async function fetchSingleDay(year, month, day, offset, regCode) {
  let d = new Date(year, month - 1, day - offset);
  let dStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  let fetchDay = String(d.getDate()).padStart(2, '0');
  let fetchMonth = String(d.getMonth() + 1).padStart(2, '0');
  let fetchYear = d.getFullYear();

  const urls = [
    `https://xosodaiphat.com/${regCode}-${fetchDay}-${fetchMonth}-${fetchYear}.html`,
    `https://xskt.com.vn/${regCode}/ngay-${parseInt(fetchDay, 10)}-${parseInt(fetchMonth, 10)}-${fetchYear}`,
    `https://xoso.com.vn/${regCode}-${fetchDay}-${fetchMonth}-${fetchYear}.html`
  ];
  
  for (let url of urls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); 
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) continue;
      const html = await res.text();
      if (!html.toLowerCase().includes("đặc biệt")) continue;

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
    } catch (e) { } 
  }
  return null; 
}

async function handleFetchData() {
  document.getElementById("predictSection").style.display = "none";
  document.getElementById("resultSection").style.display = "block";
  const dateVal = document.getElementById("datePicker").value;
  if (!dateVal) return;
  
  const [year, month, day] = dateVal.split("-").map(Number);
  const regCode = document.getElementById("regionSelect").value === "mb" ? "xsmb" : (document.getElementById("regionSelect").value === "mn" ? "xsmn" : "xsmt");

  const contentBox = document.getElementById("resultContent");
  
  // Đã cập nhật dòng thông báo theo yêu cầu mới
  contentBox.innerHTML = `
    <div class="loading-msg">
      🚀 Đang phát đa luồng lấy dữ liệu 60 ngày...<br>
      <span style="font-size:0.9rem; font-weight:normal; color:#475569;">Tiến trình có thể mất 5 - 8 giây.</span>
    </div>`;

  let fetchPromises = [];
  // Đã tăng số vòng lặp từ 8 lên 30 để lấy dữ liệu 30 ngày
  for (let i = 0; i < 60; i++) {
    fetchPromises.push(fetchSingleDay(year, month, day, i, regCode));
  }

  let results = await Promise.all(fetchPromises);
  REAL_DATA.history = results.filter(d => d !== null);

  if (REAL_DATA.history.length === 0) {
    contentBox.innerHTML = `<div class="loading-msg" style="color:#b91c1c;">⚠️ Không thể lấy dữ liệu. Hãy kiểm tra kết nối mạng.</div>`;
    return;
  }

let msg = `✅ Đã quét thành công ${REAL_DATA.history.length} ngày!`;
  if (REAL_DATA.history[0].prizes.length === 0) {
    REAL_DATA.history.shift(); 
    msg = `⚠️ Ngày T0 chưa quay thưởng! Hệ thống tự động lùi mốc lấy dữ liệu.`;
  }
  
  // Lấy ra ngày thực tế của bảng dữ liệu đang hiển thị
  let actualDate = REAL_DATA.history[0].date;
  
  contentBox.innerHTML = `
    <div style="text-align:center; padding:10px; color:#166534; font-weight:bold; background:#dcfce7; margin-bottom:10px; border-radius:6px;">
        ${msg}
    </div>
    
    <!-- KHỐI HIỂN THỊ NGÀY THÁNG ĐƯỢC THÊM VÀO ĐÂY -->
    <div style="text-align:center; padding:12px; margin-bottom:15px; border-radius:6px; background:#fff5f5; border: 2px dashed #fca5a5; color: #b91c1c; font-size: 1.6rem; font-weight: 800; text-transform: uppercase;">
        📅 KẾT QUẢ XỔ SỐ NGÀY: ${actualDate}
    </div>
    
    ${REAL_DATA.history[0].htmlTable}
  `;
}

function computePascal(str) {
  let cur = (str || "00000").split('').map(n => parseInt(n, 10) || 0);
  while (cur.length > 2) {
    let nxt = [];
    for (let i = 0; i < cur.length - 1; i++) nxt.push((cur[i] + cur[i + 1]) % 10);
    cur = nxt;
  }
  return cur.join('');
}

function computeMatrix(str1, str2) {
  let s1 = (str1 || "00000").padStart(5, '0').slice(-5);
  let s2 = (str2 || "00000").padStart(5, '0').slice(-5);
  let v1 = s1.split('').map(Number);
  let v2 = s2.split('').map(Number);
  let dot = 0;
  for(let i=0; i<5; i++) dot += (v1[i] * v2[4-i]);
  return `${Math.floor(dot/10)%10}${dot%10}`;
}

function getDigitAt(dayData, prizeIdx, charIdx) {
  if (!dayData || !dayData.prizes || !dayData.prizes[prizeIdx]) return null;
  let prizeStr = dayData.prizes[prizeIdx].toString();
  if (charIdx >= prizeStr.length) return null;
  return prizeStr[charIdx];
}

function getBong(numStr, type) {
    if (!numStr || numStr.length !== 2) return "00";
    let bmap = type === 'duong' ? BONG_DUONG : BONG_AM;
    return bmap[numStr[0]] + bmap[numStr[1]];
}

function getSum(numStr) {
    if (!numStr || numStr.length !== 2) return 0;
    return (parseInt(numStr[0]) + parseInt(numStr[1])) % 10;
}

function normalizeScores(scoresDict) {
    let maxVal = 0;
    for (let k in scoresDict) {
        if (scoresDict[k] > maxVal) maxVal = scoresDict[k];
    }
    
    let arr = [];
    for (let k in scoresDict) {
        let raw = scoresDict[k];
        let norm = 0;
        if (maxVal > 0) {
             norm = (raw / maxVal) * 100;
        }
        
        if (norm === 100) norm = 100;
        else if (norm > 0) norm = Math.max(15, Math.floor(norm)); 
        else norm = Math.floor(Math.random() * 10) + 1; 
        
        arr.push({ num: k, score: norm, raw: raw });
    }
    arr.sort((a,b) => b.raw - a.raw);
    
    if (arr.length > 0 && arr[0].raw > 0) {
        arr[0].score = 100;
    }
    return arr;
}

function runDynamicAnalysis() {
  try {
    const history = REAL_DATA.history; 
    if (!history || history.length < 2) {
      document.getElementById("resultSection").innerHTML = `<div class="loading-msg" style="color:red;">⚠️ Dữ liệu không đủ để phân tích.</div>`;
      return;
    }

    const winningPairsByDay = history.map(day => {
      let wSet = new Set();
      if(day.prizes) day.prizes.forEach(p => { if (p && p.length >= 2) wSet.add(p.slice(-2)); });
      return wSet;
    });

    let scoresLo = {};
    let scoresDe = {};
    for (let i = 0; i < 100; i++) {
        let nStr = i.toString().padStart(2, '0');
        scoresLo[nStr] = 0;
        scoresDe[nStr] = 0;
    }

    let headFreq = Array(10).fill(0);
    let tailFreq = Array(10).fill(0);
    history.forEach(day => {
        if(day.prizes) {
            day.prizes.forEach(p => {
                if(p && p.length >= 2) {
                    let pair = p.slice(-2);
                    headFreq[parseInt(pair[0])]++;
                    tailFreq[parseInt(pair[1])]++;
                }
            });
        }
    });

    for (let i = 0; i < 100; i++) {
        let nStr = i.toString().padStart(2, '0');
        let h = parseInt(nStr[0]);
        let t = parseInt(nStr[1]);
        scoresLo[nStr] += (headFreq[h] + tailFreq[t]) * 0.5; 
        scoresDe[nStr] += (headFreq[h] + tailFreq[t]) * 0.1; 
    }

    let deT0 = "";
    if (history[0].prizes && history[0].prizes[0]) {
        deT0 = history[0].prizes[0].slice(-2);
    }
    
    if (deT0.length === 2) {
        let bDuong = getBong(deT0, 'duong');
        let bAm = getBong(deT0, 'am');
        let sumT0 = getSum(deT0);

        scoresDe[bDuong] += 20; 
        scoresDe[bAm] += 15;    
        scoresDe[deT0.split('').reverse().join('')] += 10; 

        for (let i = 0; i < 100; i++) {
            let nStr = i.toString().padStart(2, '0');
            if (getSum(nStr) === sumT0 && nStr !== deT0) {
                scoresDe[nStr] += 8;
            }
        }
    }

    let coords = [];
    if(history[0].prizes) {
      history[0].prizes.forEach((prize, pIdx) => {
        if(prize) {
          let pStr = prize.toString();
          for(let cIdx = 0; cIdx < pStr.length; cIdx++) coords.push({ pIdx, cIdx, val: pStr[cIdx] });
        }
      });
    }
    let len = coords.length;
    for (let i = 0; i < len; i++) {
      for (let j = i + 1; j < len; j++) {
        let currentStreak = 0;
        let cA = coords[i], cB = coords[j];
        for (let d = 1; d < history.length; d++) {
          let num1 = getDigitAt(history[d], cA.pIdx, cA.cIdx);
          let num2 = getDigitAt(history[d], cB.pIdx, cB.cIdx);
          if (num1 === null || num2 === null) break; 
          let pair1 = `${num1}${num2}`, pair2 = `${num2}${num1}`;
          if (winningPairsByDay[d - 1].has(pair1) || winningPairsByDay[d - 1].has(pair2)) currentStreak++; else break;
        }
        
        if (currentStreak >= 3) {
          let n1 = getDigitAt(history[0], cA.pIdx, cA.cIdx);
          let n2 = getDigitAt(history[0], cB.pIdx, cB.cIdx);
          if (n1 !== null && n2 !== null) {
              scoresLo[`${n1}${n2}`] += currentStreak * 2; 
              scoresLo[`${n2}${n1}`] += currentStreak * 1; 
          }
        }
      }
    }

    let numPrizes = history[0].prizes ? history[0].prizes.length : 0;
    for (let i = 0; i < numPrizes - 1; i++) {
      let streakP = 0, streakM = 0;
      for (let d = 1; d < history.length; d++) {
        let pA = history[d].prizes[i], pB = history[d].prizes[i+1];
        if (!pA || !pB) break;
        let predP = computePascal(pA.toString() + pB.toString());
        if (winningPairsByDay[d - 1].has(predP) || winningPairsByDay[d - 1].has(predP.split('').reverse().join(''))) streakP++; else break;
      }
      for (let d = 1; d < history.length; d++) {
        let pA = history[d].prizes[i], pB = history[d].prizes[i+1];
        if (!pA || !pB) break;
        let predM = computeMatrix(pA.toString(), pB.toString());
        if (winningPairsByDay[d - 1].has(predM) || winningPairsByDay[d - 1].has(predM.split('').reverse().join(''))) streakM++; else break;
      }

      let pA_T0 = (history[0].prizes[i] || "").toString();
      let pB_T0 = (history[0].prizes[i+1] || "").toString();
      
      if (streakP >= 2) {
         let predP = computePascal(pA_T0 + pB_T0);
         scoresDe[predP] += streakP * 5; 
      }
      if (streakM >= 2) {
         let predM = computeMatrix(pA_T0, pB_T0);
         scoresLo[predM] += streakM * 4; 
         scoresLo[predM.split('').reverse().join('')] += streakM * 2;
      }
    }

    let sortedLo = normalizeScores(scoresLo);
    let sortedDe = normalizeScores(scoresDe);

    const getScoreHtml = (item, badgeClass) => `
      <div class="score-group">
        <span class="${badgeClass}">${item.num}</span>
        <span class="pts">${item.score} ⭐</span>
      </div>`;

    const getSimpleBadge = (num) => `<span class="badge-normal">${num}</span>`;

    // 1. IN KẾT QUẢ LÔ TÔ
    document.getElementById("top1LoBox").innerHTML = getScoreHtml(sortedLo[0], 'badge-top1');
    document.getElementById("top23LoBox").innerHTML = getScoreHtml(sortedLo[1], 'badge-top2') + getScoreHtml(sortedLo[2], 'badge-top2');
    
    // 2. IN KẾT QUẢ ĐẶC BIỆT & CÁC DÀN
    document.getElementById("top1DeBox").innerHTML = getScoreHtml(sortedDe[0], 'badge-top1');
    document.getElementById("top23DeBox").innerHTML = getScoreHtml(sortedDe[1], 'badge-top2') + getScoreHtml(sortedDe[2], 'badge-top2');
    
    let dan4 = sortedDe.slice(0, 4).map(x => x.num).sort();
    let dan10 = sortedDe.slice(0, 10).map(x => x.num).sort();
    let dan20 = sortedDe.slice(0, 20).map(x => x.num).sort();
    let dan36 = sortedDe.slice(0, 36).map(x => x.num).sort();
    
    // Khai báo thêm các dàn 48, 52, 64
    let dan48 = sortedDe.slice(0, 48).map(x => x.num).sort();
    let dan52 = sortedDe.slice(0, 52).map(x => x.num).sort();
    let dan64 = sortedDe.slice(0, 64).map(x => x.num).sort();

    document.getElementById("dan4DeBox").innerHTML = dan4.map(getSimpleBadge).join(' ');
    document.getElementById("dan10DeBox").innerHTML = dan10.map(getSimpleBadge).join(' ');
    document.getElementById("dan20DeBox").innerHTML = dan20.map(getSimpleBadge).join(' ');
    document.getElementById("dan36DeBox").innerHTML = dan36.map(getSimpleBadge).join(' ');

    // Xuất các dàn 48, 52, 64 ra giao diện
    document.getElementById("dan48DeBox").innerHTML = dan48.map(getSimpleBadge).join(' ');
    document.getElementById("dan52DeBox").innerHTML = dan52.map(getSimpleBadge).join(' ');
    document.getElementById("dan64DeBox").innerHTML = dan64.map(getSimpleBadge).join(' ');

    // 3. TẠO CÁC SỐ CÀNG ĐƠN LẺ
    let gdbT0 = (history[0].prizes[0] || "00000").toString().padStart(5, '0');
    let g1T0 = (history[0].prizes[1] || "00000").toString().padStart(5, '0');
    
    let tapHop3Cang = Array.from(new Set([gdbT0[2], g1T0[2], gdbT0[3], g1T0[3]])).filter(x => x !== undefined);
    let fallback3 = ['1', '3', '5', '7', '9']; 
    while(tapHop3Cang.length < 4) {
        tapHop3Cang.push(fallback3.pop());
        tapHop3Cang = Array.from(new Set(tapHop3Cang));
    }
    let finalCang3 = tapHop3Cang.slice(0, 5).sort();

    let tapHop4Cang = Array.from(new Set([gdbT0[1], g1T0[1], gdbT0[0], g1T0[0]])).filter(x => x !== undefined);
    let fallback4 = ['2', '4', '6', '8', '0']; 
    while(tapHop4Cang.length < 4) {
        tapHop4Cang.push(fallback4.pop());
        tapHop4Cang = Array.from(new Set(tapHop4Cang));
    }
    let finalCang4 = tapHop4Cang.slice(0, 4).sort();

    let renderCang = (arr) => arr.map(c => `<span class="badge-cang">${c}</span>`).join(' ');

    document.getElementById("cang3LoBox").innerHTML = renderCang(finalCang3);
    document.getElementById("cang4LoBox").innerHTML = renderCang(finalCang4);
    
    document.getElementById("cang3DeBox").innerHTML = renderCang(finalCang3);
    document.getElementById("cang4DeBox").innerHTML = renderCang(finalCang4);

  } catch (error) {
    document.getElementById("predictSection").innerHTML = `
      <div style="padding:20px; background:#fee2e2; color:#991b1b; border-radius:8px; font-weight:bold; border:2px solid #fca5a5;">
        ⚠️ LỖI THUẬT TOÁN BẤT NGỜ:<br><br>Mã lỗi: ${error.message}
      </div>
    `;
  }
}

function handlePredictions() {
  if (REAL_DATA.history.length === 0) {
    alert("Chưa có dữ liệu! Vui lòng bấm 'Quét Dữ Liệu' trước.");
    return;
  }
  document.getElementById("resultSection").style.display = "none";
  document.getElementById("predictSection").style.display = "block";
  
  // TÍNH TOÁN VÀ IN RA NGÀY DỰ ĐOÁN (T0 + 1 NGÀY)
  const dateVal = document.getElementById("datePicker").value;
  if (dateVal) {
    const [year, month, day] = dateVal.split("-").map(Number);
    let nextDay = new Date(year, month - 1, day + 1);
    let nextDayStr = `${String(nextDay.getDate()).padStart(2, '0')}/${String(nextDay.getMonth() + 1).padStart(2, '0')}/${nextDay.getFullYear()}`;
    
    let titleBox = document.getElementById("predictTitle");
    if (titleBox) {
        titleBox.innerHTML = `🎯 KẾT QUẢ DỰ ĐOÁN NGÀY: ${nextDayStr}`;
    }
  }

  // Khôi phục trạng thái "Đang tính điểm..."
  ["top1LoBox", "top23LoBox", "cang3LoBox", "cang4LoBox", 
   "top1DeBox", "top23DeBox", "dan4DeBox", "dan10DeBox", "dan20DeBox", "dan36DeBox", 
   "dan48DeBox", "dan52DeBox", "dan64DeBox", 
   "cang3DeBox", "cang4DeBox"].forEach(id => {
    let el = document.getElementById(id);
    if (el) el.innerHTML = `<span style="color:#8b5cf6; font-size:14px; font-weight:bold;">Đang tính điểm... ⭐</span>`;
  });

  setTimeout(() => { runDynamicAnalysis(); }, 100);
}