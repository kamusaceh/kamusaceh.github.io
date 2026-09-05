function escapeHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Diff baris berbasis LCS (Longest Common Subsequence)
function computeLineDiff(oldStr, newStr){
  const a = oldStr.length ? oldStr.split('\n') : [];
  const b = newStr.length ? newStr.split('\n') : [];
  const m = a.length, n = b.length;

  if(m * n > 4000000){
    return null; // terlalu besar untuk diff detail baris-per-baris
  }

  const dp = Array.from({length: m + 1}, () => new Uint32Array(n + 1));
  for(let i = m - 1; i >= 0; i--){
    for(let j = n - 1; j >= 0; j--){
      dp[i][j] = (a[i] === b[j]) ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
    }
  }

  const result = [];
  let i = 0, j = 0;
  while(i < m && j < n){
    if(a[i] === b[j]){ result.push({type:'ctx', text:a[i]}); i++; j++; }
    else if(dp[i+1][j] >= dp[i][j+1]){ result.push({type:'del', text:a[i]}); i++; }
    else{ result.push({type:'add', text:b[j]}); j++; }
  }
  while(i < m){ result.push({type:'del', text:a[i]}); i++; }
  while(j < n){ result.push({type:'add', text:b[j]}); j++; }
  return result;
}

// Render diff jadi HTML, dengan baris tak-berubah yang jauh dari perubahan dirangkum
function renderDiffHtml(diffArr){
  if(!diffArr) return '<span class="diff-hunk">Terlalu besar untuk ditampilkan diff detail.</span>';
  if(diffArr.length === 0) return '<span class="diff-hunk">Tidak ada perubahan pada isi file.</span>';

  const context = 3;
  const len = diffArr.length;
  const show = new Array(len).fill(false);
  for(let k = 0; k < len; k++){
    if(diffArr[k].type !== 'ctx'){
      for(let x = Math.max(0, k - context); x <= Math.min(len - 1, k + context); x++) show[x] = true;
    }
  }

  let html = '';
  let k = 0;
  while(k < len){
    if(!show[k]){
      let start = k;
      while(k < len && !show[k]) k++;
      html += `<span class="diff-hunk">⋯ ${k - start} baris tidak berubah ⋯</span>`;
      continue;
    }
    const d = diffArr[k];
    const esc = escapeHtml(d.text);
    if(d.type === 'add') html += `<span class="diff-add">+ ${esc}</span>`;
    else if(d.type === 'del') html += `<span class="diff-del">- ${esc}</span>`;
    else html += `<span class="diff-ctx">  ${esc}</span>`;
    k++;
  }
  return html;
}
