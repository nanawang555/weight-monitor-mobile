const storageKey = 'weight-monitor-records';
const heightKey = 'weight-monitor-height';
const nameKey = 'weight-monitor-name';
const cycleKey = 'weight-monitor-cycle-settings';
const periodStartsKey = 'weight-monitor-period-starts';
const byId = (id) => document.getElementById(id);
const form = byId('recordForm');
let records = loadRecords();
let heightCm = Number(localStorage.getItem(heightKey)) || 170;
let cycleSettings = loadCycleSettings();
let periodStarts = loadPeriodStarts();
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

function loadRecords() { try { return (JSON.parse(localStorage.getItem(storageKey)) || []).map((record) => ({ ...record, period: record.period || 'morning' })); } catch { return []; } }
function loadCycleSettings() { try { return { cycleLength: 28, periodLength: 5, ...JSON.parse(localStorage.getItem(cycleKey)) }; } catch { return { cycleLength: 28, periodLength: 5 }; } }
function loadPeriodStarts() { try { return [...new Set(JSON.parse(localStorage.getItem(periodStartsKey)) || [])].sort(); } catch { return []; } }
function saveRecords() { localStorage.setItem(storageKey, JSON.stringify(records)); }
function savePeriods() { localStorage.setItem(periodStartsKey, JSON.stringify(periodStarts)); }
function bmi(weight) { return weight / ((heightCm / 100) ** 2); }
function formatBmi(weight) { return bmi(weight).toFixed(1); }
function periodLabel(period) { return period === 'evening' ? '晚' : '早'; }
function sortedRecords() { return [...records].sort((a, b) => `${b.date}${b.period}`.localeCompare(`${a.date}${a.period}`)); }
function escapeHtml(value) { const element = document.createElement('div'); element.textContent = value; return element.innerHTML; }
function dateAtNoon(value) { return new Date(`${value}T12:00:00`); }
function formatDate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function shiftDate(value, days) { const date = dateAtNoon(value); date.setDate(date.getDate() + days); return formatDate(date); }
function daysBetween(start, end) { return Math.round((dateAtNoon(end) - dateAtNoon(start)) / 86400000); }
function getCycleStart(date) {
  if (!periodStarts.length) return null;
  const latest = periodStarts.at(-1); const offset = daysBetween(latest, date); if (offset < 0) return null;
  return shiftDate(latest, Math.floor(offset / cycleSettings.cycleLength) * cycleSettings.cycleLength);
}
function getPhase(date) {
  const cycleStart = getCycleStart(date); if (!cycleStart) return null;
  const day = daysBetween(cycleStart, date); const actual = periodStarts.includes(cycleStart); const ovulationDay = Math.max(cycleSettings.periodLength, cycleSettings.cycleLength - 14);
  if (day < cycleSettings.periodLength) return { label: actual ? '经期' : '预计经期', className: actual ? 'period-actual' : 'period-predicted' };
  if (day === ovulationDay) return { label: '排卵期', className: 'ovulation' };
  return { label: day < ovulationDay ? '卵泡期' : '黄体期', className: '' };
}
function nextPeriod() {
  if (!periodStarts.length) return null;
  const today = formatDate(new Date()); let date = periodStarts.at(-1); while (date <= today) date = shiftDate(date, cycleSettings.cycleLength); return date;
}

function render() {
  const ordered = sortedRecords(); const latest = ordered[0]; const oldest = ordered.at(-1); const userName = localStorage.getItem(nameKey)?.trim();
  document.title = userName ? `${userName}的体重监测` : '体重监测'; document.querySelector('h1').textContent = userName ? `${userName}的体重监测` : '体重监测';
  byId('latestWeight').textContent = latest ? `${latest.weight.toFixed(2)} kg` : '—'; byId('latestBmi').textContent = latest ? formatBmi(latest.weight) : '—'; byId('weightChange').textContent = latest && oldest ? `${(latest.weight - oldest.weight >= 0 ? '+' : '') + (latest.weight - oldest.weight).toFixed(2)} kg` : '—';
  byId('recordsBody').innerHTML = ordered.map((record) => `<tr><td>${record.date}</td><td>${periodLabel(record.period)}</td><td>${record.weight.toFixed(2)} kg</td><td>${formatBmi(record.weight)}</td><td>${escapeHtml(record.note || '—')}</td><td><button data-edit="${record.id}" class="secondary">编辑</button><button data-delete="${record.id}" class="danger">删除</button></td></tr>`).join('');
  byId('emptyTable').classList.toggle('hidden', ordered.length > 0); byId('chartHint').textContent = records.length ? `身高 ${heightCm} cm · BMI 自动计算` : ''; renderPeriodArea(); renderCalendar(); drawChart();
}

function renderPeriodArea() {
  const upcoming = nextPeriod(); byId('nextPeriod').textContent = upcoming ? upcoming.replaceAll('-', '.') : '请先记录首日'; byId('cycleSettings').textContent = `${cycleSettings.cycleLength} 天周期 / ${cycleSettings.periodLength} 天经期`; byId('cycleHint').textContent = periodStarts.length ? `已记录 ${periodStarts.length} 次` : '请记录月经第一天';
  byId('periodHistory').innerHTML = periodStarts.slice().reverse().map((date) => `<span class="period-chip">${date.replaceAll('-', '.')}<button data-period-delete="${date}" aria-label="删除 ${date}">×</button></span>`).join('');
}

function renderCalendar() {
  const year = calendarMonth.getFullYear(); const month = calendarMonth.getMonth(); const lastDay = new Date(year, month + 1, 0).getDate(); const firstDay = new Date(year, month, 1).getDay();
  byId('calendarTitle').textContent = `${year} 年 ${month + 1} 月体重与经期日历`; byId('calendarPrompt').classList.toggle('hidden', periodStarts.length > 0); const recordMap = new Map(records.map((record) => [`${record.date}-${record.period}`, record])); const cells = Array.from({ length: firstDay }, () => '<div class="calendar-day empty-day"></div>');
  for (let day = 1; day <= lastDay; day += 1) { const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const morning = recordMap.get(`${date}-morning`); const evening = recordMap.get(`${date}-evening`); const phase = getPhase(date); cells.push(`<div class="calendar-day ${phase?.className || ''}"><div class="calendar-date">${day}</div>${phase ? `<div class="calendar-phase">${phase.label}</div>` : ''}<div class="calendar-weight"><span>早</span> ${morning ? morning.weight.toFixed(2) : '—'}<br><span>晚</span> ${evening ? evening.weight.toFixed(2) : '—'}</div></div>`); }
  while (cells.length % 7) cells.push('<div class="calendar-day empty-day"></div>'); byId('calendarGrid').innerHTML = cells.join('');
}

function chartPoints() {
  const range = byId('trendRange').value; const points = [...records].sort((a, b) => `${a.date}${a.period}`.localeCompare(`${b.date}${b.period}`)); if (range === 'all') return points;
  const start = range === 'month' ? formatDate(calendarMonth) : formatDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 2, 1)); const end = formatDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0)); return points.filter((point) => point.date >= start && point.date <= end);
}
function drawChart() {
  const canvas = byId('trendChart'); const empty = byId('emptyChart'); const points = chartPoints(); empty.classList.toggle('hidden', points.length > 0); const context = canvas.getContext('2d'); const rect = canvas.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1; canvas.width = rect.width * ratio; canvas.height = rect.height * ratio; context.scale(ratio, ratio); context.clearRect(0, 0, rect.width, rect.height); if (!points.length) return;
  const width = rect.width; const height = rect.height; const padding = { top: 24, right: 20, bottom: 38, left: 48 }; const weights = points.map((point) => point.weight); let min = Math.floor((Math.min(...weights) - 1) * 2) / 2; let max = Math.ceil((Math.max(...weights) + 1) * 2) / 2; if (min === max) { min -= 1; max += 1; }
  const x = (index) => points.length === 1 ? width / 2 : padding.left + index * ((width - padding.left - padding.right) / (points.length - 1)); const y = (weight) => padding.top + (max - weight) * ((height - padding.top - padding.bottom) / (max - min)); context.font = '12px Microsoft YaHei'; context.fillStyle = '#718075'; context.strokeStyle = '#e6ece6'; context.lineWidth = 1;
  for (let index = 0; index < 4; index += 1) { const value = min + index * (max - min) / 3; const lineY = y(value); context.beginPath(); context.moveTo(padding.left, lineY); context.lineTo(width - padding.right, lineY); context.stroke(); context.fillText(`${value.toFixed(1)}`, 4, lineY + 4); }
  context.strokeStyle = '#2f7555'; context.lineWidth = 3; context.beginPath(); points.forEach((point, index) => index ? context.lineTo(x(index), y(point.weight)) : context.moveTo(x(index), y(point.weight))); context.stroke(); points.forEach((point, index) => { context.fillStyle = '#2f7555'; context.beginPath(); context.arc(x(index), y(point.weight), 4, 0, Math.PI * 2); context.fill(); context.fillStyle = '#65746a'; context.textAlign = 'center'; context.fillText(`${point.date.slice(5)}${periodLabel(point.period)}`, x(index), height - 12); }); context.textAlign = 'start';
}

function resetForm() { form.reset(); byId('recordId').value = ''; byId('date').value = formatDate(new Date()); byId('period').value = 'morning'; byId('formTitle').textContent = '记录体重'; byId('cancelEdit').classList.add('hidden'); }
form.addEventListener('submit', (event) => { event.preventDefault(); const id = byId('recordId').value || crypto.randomUUID(); const record = { id, date: byId('date').value, period: byId('period').value, weight: Number(byId('weight').value), note: byId('note').value.trim() }; const sameSlot = records.findIndex((item) => item.date === record.date && item.period === record.period && item.id !== id); const index = records.findIndex((item) => item.id === id); if (sameSlot >= 0) records[sameSlot] = record; else if (index >= 0) records[index] = record; else records.push(record); saveRecords(); resetForm(); render(); });
byId('cancelEdit').addEventListener('click', resetForm);
byId('recordsBody').addEventListener('click', (event) => { const id = event.target.dataset.edit || event.target.dataset.delete; if (!id) return; const record = records.find((item) => item.id === id); if (event.target.dataset.edit) { byId('recordId').value = record.id; byId('date').value = record.date; byId('period').value = record.period; byId('weight').value = record.weight; byId('note').value = record.note; byId('formTitle').textContent = '编辑记录'; byId('cancelEdit').classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' }); } else if (confirm(`删除 ${record.date} ${periodLabel(record.period)}的记录？`)) { records = records.filter((item) => item.id !== id); saveRecords(); render(); } });
byId('periodForm').addEventListener('submit', (event) => { event.preventDefault(); const date = byId('periodStartDate').value; if (!periodStarts.includes(date)) { periodStarts.push(date); periodStarts.sort(); savePeriods(); } byId('periodStartDate').value = ''; render(); });
byId('periodHistory').addEventListener('click', (event) => { const date = event.target.dataset.periodDelete; if (date && confirm(`删除 ${date} 的经期首日记录？`)) { periodStarts = periodStarts.filter((item) => item !== date); savePeriods(); render(); } });
byId('settingsButton').addEventListener('click', () => { byId('height').value = heightCm; byId('userName').value = localStorage.getItem(nameKey) || ''; byId('cycleLength').value = cycleSettings.cycleLength; byId('periodLength').value = cycleSettings.periodLength; byId('settingsDialog').showModal(); }); byId('closeSettings').addEventListener('click', () => byId('settingsDialog').close()); byId('settingsForm').addEventListener('submit', () => { heightCm = Number(byId('height').value); localStorage.setItem(heightKey, heightCm); localStorage.setItem(nameKey, byId('userName').value.trim()); cycleSettings = { cycleLength: Number(byId('cycleLength').value), periodLength: Number(byId('periodLength').value) }; localStorage.setItem(cycleKey, JSON.stringify(cycleSettings)); render(); });
byId('previousMonth').addEventListener('click', () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1); renderCalendar(); drawChart(); }); byId('nextMonth').addEventListener('click', () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1); renderCalendar(); drawChart(); }); byId('trendRange').addEventListener('change', drawChart);
byId('exportButton').addEventListener('click', () => { const rows = ['日期,时段,体重(kg),备注', ...sortedRecords().map((record) => [record.date, periodLabel(record.period), record.weight, `"${record.note.replaceAll('"', '""')}"`].join(','))]; const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' })); link.download = `体重记录_${formatDate(new Date())}.csv`; link.click(); URL.revokeObjectURL(link.href); });
byId('importInput').addEventListener('change', async (event) => { const file = event.target.files[0]; if (!file) return; const text = (await file.text()).replace(/^\ufeff/, ''); const lines = text.split(/\r?\n/).filter(Boolean); const imported = lines.slice(1).map((line) => { const parts = line.match(/^([^,]+),([^,]+),([^,]+),(.*)$/) || line.match(/^([^,]+),([^,]+),(.*)$/); if (!parts) return null; const modern = parts.length === 5; return { id: crypto.randomUUID(), date: parts[1].trim(), period: modern && parts[2].trim() === '晚' ? 'evening' : 'morning', weight: Number(modern ? parts[3] : parts[2]), note: (modern ? parts[4] : parts[3]).trim().replace(/^"|"$/g, '').replaceAll('""', '"') }; }).filter((record) => /^\d{4}-\d{2}-\d{2}$/.test(record?.date) && record.weight > 0); if (!imported.length) alert('未找到可导入的记录。请使用本软件导出的 CSV 格式。'); else if (confirm(`将导入 ${imported.length} 条记录，相同日期和时段会更新，继续吗？`)) { imported.forEach((record) => { const index = records.findIndex((item) => item.date === record.date && item.period === record.period); if (index >= 0) records[index] = record; else records.push(record); }); saveRecords(); render(); alert('导入完成。'); } event.target.value = ''; });
window.addEventListener('resize', drawChart); resetForm(); render();
