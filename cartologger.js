(function(){
  const inputEl = document.getElementById('carto-csv-input');
  const dropzoneEl = document.getElementById('carto-dropzone');
  const clearBtn = document.getElementById('carto-csv-clear');
  const sampleBtn = document.getElementById('carto-load-sample');

  const countEl = document.getElementById('carto-count');
  const totalSizeEl = document.getElementById('carto-total-size');
  const listEl = document.getElementById('carto-list');
  const warningsEl = document.getElementById('carto-warnings');

  const participantSelectEl = document.getElementById('carto-participant-select');
  const binSizeEl = document.getElementById('carto-bin-size');
  const firstActionModeEl = document.getElementById('carto-first-action-mode');
  const taskMinEl = document.getElementById('carto-task-min');
  const taskMaxEl = document.getElementById('carto-task-max');
  const taskResetBtn = document.getElementById('carto-task-reset');
  const exportConvertedBtn = document.getElementById('carto-export-converted');

  const summaryEl = document.getElementById('carto-summary');
  const sequenceStreamEl = document.getElementById('carto-sequence-stream');
  const qualityEl = document.getElementById('carto-quality');

  const chartEventTypesCanvas = document.getElementById('carto-chart-event-types');
  const chartCategoriesCanvas = document.getElementById('carto-chart-url-categories');
  const chartTimelineCanvas = document.getElementById('carto-chart-timeline');
  const chartTaskSummaryCanvas = document.getElementById('carto-chart-task-summary');
  const chartTaskMapsCanvas = document.getElementById('carto-chart-task-maps');
  const chartMapTransitionsCanvas = document.getElementById('carto-chart-map-transitions');
  const chartFirstActionCanvas = document.getElementById('carto-chart-first-action');
  const chartSequenceCanvas = document.getElementById('carto-chart-sequence');

  const infoModalEl = document.getElementById('info-modal');
  const infoModalTitleEl = document.getElementById('info-modal-title');
  const infoModalBodyEl = document.getElementById('info-modal-body');
  const infoModalCloseBtn = document.getElementById('info-modal-close');

  const REQUIRED_COLUMNS = ['absoluteTime','task','time','type','val'];

  /** @type {{name:string,size:number,rows:any[],meta:{parseErrors:string[]}}[]} */
  let datasets = [];
  /** @type {any[]} */
  let lastComputedParticipants = [];

  // IPAtlas classification: URL id=mapa -> canonical task_ID
  const TASK_ID_BY_MAP_ID = {
    'povrch-zeme': 1,
    'podnebne-pasy': 2,
    biomy: 2,
    'zalidneni-oblasti': 3,
    zalidneni: 3,
    tezba: 4,
    tektonika: 5,
    'litosfericke-desky': 5,
    'prirodni-rizika': 5,
    'spotreba-kalorii': 6,
    'komplexni-doprava': 7,
    'objevne-cesty': 8
  };

  const charts = {
    eventTypes: null,
    urlCategories: null,
    timeline: null,
    taskSummary: null,
    taskMaps: null,
    mapTransitions: null,
    firstAction: null,
    sequence: null
  };

  const CARTO_HELP_CONTENT = {
    cartoEventTypes: {
      title: 'Event types (CartoLogger)',
      body: 'Shows how often each transformed CartoLogger event type appears in the current selection (participant + task_ID filter). The converter removes <strong>pointerup</strong> and <strong>mouse_wheel_end</strong>, and renames <strong>mouse_wheel_start</strong> to <strong>zoom</strong>.'
    },
    cartoUrlCategories: {
      title: 'Pointer click targets',
      body: 'Summarises values from the derived <strong>click</strong> column (computed from <strong>pointerdown</strong> rows). This captures mapset names, legend interactions, map clicks, and UI controls (maps panel, search controls, bookmarks, timeline, sidebars, modals, and tools). Unmatched interactions remain in <strong>other</strong>.' 
    },
    cartoTimeline: {
      title: 'Interactions over time',
      body: 'Counts transformed interaction events over time bins. In aggregate mode this is the sum across selected participants; in participant mode it shows one participant only.'
    },
    cartoTaskSummary: {
      title: 'Per-task interactions, zoom events, and duration',
      body: 'Bars show interaction count and <strong>zoom</strong> event count per <strong>task_ID</strong>, while red points show mean task duration. Use this to identify demanding tasks or tasks with heavy zooming activity.'
    },
    cartoTaskMaps: {
      title: 'Map usage duration by task',
      body: 'Stacked bars estimate how long each map from the derived <strong>map</strong> column (parsed from <strong>url_change</strong> URLs) was active within each <strong>task_ID</strong>, based on consecutive URL-change timestamps.'
    },
    cartoMapTransitions: {
      title: 'Map transition matrix',
      body: 'Shows transitions between maps within the same <strong>task_ID</strong>, using consecutive <strong>url_change</strong> rows. Bubble size and colour intensity represent transition frequency from one map (x-axis) to another map (y-axis).'
    },
    cartoFirstAction: {
      title: 'Time to first action by task_ID',
      body: 'For each participant and task_ID, this metric measures the delay between the first event and the first action defined by the selected mode in the control panel (e.g., pointerdown only, pointerdown/zoom, pointerdown/zoom/url_change, or any non-projection event). Bars show mean delay; lines show median and P75.'
    },
    cartoSequence: {
      title: 'Interaction sequence reconstruction',
      body: 'Shows chronological participant behaviour as an event sequence. Each point is one transformed event (type on y-axis, elapsed time on x-axis), with details from derived columns (<strong>parameter</strong>, <strong>zoom</strong>, <strong>map</strong>, <strong>click</strong>, <strong>projection</strong>). Hold the left mouse button and drag horizontally to pan. Zoom is available only with the mouse wheel.'
    }
  };

  function esc(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function formatBytes(n){
    const units = ['B','KB','MB','GB'];
    let i = 0;
    let x = Number(n) || 0;
    while (x >= 1024 && i < units.length - 1){ x /= 1024; i++; }
    return (i === 0 ? x.toString() : x.toFixed(1)) + ' ' + units[i];
  }

  function toNumber(v){
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    let s = String(v).trim();
    if (!s) return null;
    s = s.replace(/^"+|"+$/g, '').replace(/;+$/g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeEventType(v){
    let s = normalizeText(v).toLowerCase();
    if (!s) return '';
    s = s.replace(/^"+|"+$/g, '').replace(/;+$/g, '');
    return s;
  }

  function normalizeText(v){
    if (v === null || v === undefined) return '';
    return String(v).replace(/\s+/g, ' ').trim();
  }

  function truncate(s, maxLen){
    const t = normalizeText(s);
    if (!maxLen || t.length <= maxLen) return t;
    return t.slice(0, Math.max(0, maxLen - 1)).trimEnd() + '…';
  }

  function niceNumber(n, digits){
    if (n === null || n === undefined || !Number.isFinite(n)) return '–';
    const d = Number.isFinite(digits) ? digits : 2;
    const abs = Math.abs(n);
    if (abs >= 1000) return Math.round(n).toLocaleString('en-GB');
    if (abs >= 100) return n.toFixed(0);
    if (abs >= 10) return n.toFixed(1);
    return n.toFixed(d);
  }

  function baseName(path){
    const s = String(path || '');
    const just = s.split(/[/\\]/).pop() || s;
    return just.replace(/\.csv$/i, '');
  }

  function clearWarn(){
    if (!warningsEl) return;
    warningsEl.classList.add('hidden');
    warningsEl.textContent = '';
  }

  function warn(message){
    if (!warningsEl) return;
    warningsEl.classList.remove('hidden');
    warningsEl.textContent = String(message || '');
  }

  function openInfoModal(helpKey){
    if (!infoModalEl || !infoModalTitleEl || !infoModalBodyEl) return;
    const item = CARTO_HELP_CONTENT[helpKey] || { title: 'Info', body: 'No help text is available for this visualisation.' };
    infoModalTitleEl.textContent = item.title || 'Info';
    infoModalBodyEl.innerHTML = item.body || '';
    infoModalEl.classList.remove('hidden');
    try{ infoModalCloseBtn && infoModalCloseBtn.focus(); }catch(_e){}
  }

  function closeInfoModal(){
    if (!infoModalEl) return;
    infoModalEl.classList.add('hidden');
  }

  function validateColumns(fields){
    const set = new Set((fields || []).map(s => String(s || '').trim()));
    const missing = REQUIRED_COLUMNS.filter(c => !set.has(c));
    if (!set.has('session') && !set.has('participant_ID')){
      missing.push('session or participant_ID');
    }
    return missing;
  }

  function normalizeCsvCell(v){
    let s = String(v === null || v === undefined ? '' : v);
    if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
    s = s.trim();
    s = s.replace(/^"+|"+$/g, '');
    s = s.replace(/;+$/g, '');
    return s;
  }

  function splitCsvLineLoose(line){
    const src = String(line || '');
    const out = [];
    let current = '';
    let inQuotes = false;

    for (let i=0;i<src.length;i++){
      const ch = src[i];
      if (ch === '"'){
        if (inQuotes && src[i+1] === '"'){
          current += '"';
          i += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === ',' && !inQuotes){
        out.push(normalizeCsvCell(current));
        current = '';
        continue;
      }
      current += ch;
    }

    out.push(normalizeCsvCell(current));
    return { fields: out, malformedQuotes: inQuotes };
  }

  function parseCartoCsvText(text){
    const lines = String(text || '').split(/\r\n|\n|\r/);
    if (!lines.length) return { fields: [], rows: [], parseErrors: ['Empty file.'] };

    const header = splitCsvLineLoose(lines[0]);
    const fields = (header.fields || []).map(h => String(h || '').trim()).filter(h => h.length > 0);
    const rows = [];

    const hasNamedColumns = fields.length > 0;

    for (let i=1;i<lines.length;i++){
      const line = lines[i];
      if (!line || !line.trim()) continue;
      const parsed = splitCsvLineLoose(line);
      const cols = parsed.fields || [];

      const row = {};
      if (hasNamedColumns){
        for (let c=0;c<fields.length;c++){
          row[fields[c]] = c < cols.length ? cols[c] : '';
        }
      } else {
        row.absoluteTime = cols[0] || '';
        row.session = cols[1] || '';
        row.task = cols[2] || '';
        row.time = cols[3] || '';
        row.type = cols[4] || '';
        row.val = cols[5] || '';
      }

      rows.push(row);
    }

    return { fields, rows, parseErrors: [] };
  }

  async function parseCsvFile(file){
    const text = await file.text();
    try{
      const parsed = parseCartoCsvText(text);
      const parseErrors = [];
      const missing = validateColumns(parsed.fields);
      if (missing.length) parseErrors.push('Missing columns: ' + missing.join(', '));
      if (parsed.parseErrors && parsed.parseErrors.length) parseErrors.push.apply(parseErrors, parsed.parseErrors);
      return {
        name: file.name,
        size: file.size,
        rows: Array.isArray(parsed.rows) ? parsed.rows : [],
        meta: { parseErrors }
      };
    }catch(_e){
      return { name: file.name, size: file.size, rows: [], meta: { parseErrors: ['Failed to parse CSV.'] } };
    }
  }

  async function exportCanvasAsPng(canvas, filenameBase){
    if (!canvas) return;
    const margin = 20;
    const out = document.createElement('canvas');
    out.width = canvas.width + margin * 2;
    out.height = canvas.height + margin * 2;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,out.width,out.height);
    ctx.drawImage(canvas, margin, margin);

    const blob = await new Promise(resolve => out.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const filename = (filenameBase || 'cartologger_chart') + '.png';
    try{ saveAs(blob, filename); }
    catch(_e){
      const a = document.createElement('a');
      a.download = filename;
      a.href = URL.createObjectURL(blob);
      a.click();
    }
  }

  function renderFileList(){
    const total = datasets.reduce((sum, d)=> sum + (d.size || 0), 0);
    if (countEl) countEl.textContent = String(datasets.length);
    if (totalSizeEl) totalSizeEl.textContent = formatBytes(total);

    if (!listEl) return;
    if (!datasets.length){
      listEl.innerHTML = '<div class="empty">Add CartoLogger CSV files to begin.</div>';
      return;
    }

    listEl.innerHTML = datasets.map((d, idx)=>{
      const idGuess = baseName(d.name);
      const rows = Array.isArray(d.rows) ? d.rows.length : 0;
      const errs = (d.meta && d.meta.parseErrors && d.meta.parseErrors.length) ? d.meta.parseErrors.length : 0;
      const meta = [rows + ' rows', formatBytes(d.size || 0)].concat(errs ? [errs + ' parse warning' + (errs > 1 ? 's' : '')] : []).join(' · ');
      return '<div class="item">'
        + '<span class="name"><strong>' + esc(idGuess) + '</strong> <span style="color:#7a879d">(' + esc(d.name) + ')</span></span>'
        + '<span class="meta">' + esc(meta) + '</span>'
        + '<button class="remove" data-index="' + idx + '" aria-label="Remove ' + esc(d.name) + '" title="Remove">×</button>'
        + '</div>';
    }).join('');
  }

  async function addCsvFiles(files){
    clearWarn();
    const arr = Array.from(files || []).filter(f => f && /\.csv$/i.test(f.name || ''));
    if (!arr.length){
      warn('Please add one or more CSV files.');
      return;
    }

    for (const f of arr){
      try{
        const parsed = await parseCsvFile(f);
        datasets.push(parsed);
      }catch(_e){
        datasets.push({ name: f.name, size: f.size, rows: [], meta: { parseErrors: ['Failed to read file.'] } });
      }
    }

    datasets.sort((a,b)=> baseName(a.name).localeCompare(baseName(b.name), 'en-GB', { numeric: true }));
    renderFileList();
    rebuildAll();
  }

  function tryParseUrl(urlString){
    const raw = normalizeText(urlString);
    if (!raw) return null;
    try{
      const url = new URL(raw);
      const params = new Map();
      url.searchParams.forEach((value, key)=>{
        if (!params.has(key)) params.set(key, value);
      });
      return {
        raw,
        host: url.host || '',
        path: url.pathname || '',
        params
      };
    }catch(_e){
      return null;
    }
  }

  function decodeUrlPart(value){
    const raw = normalizeText(value);
    if (!raw) return '';
    try{ return decodeURIComponent(raw); }
    catch(_e){ return raw; }
  }

  function extractUrlParam(urlString, key){
    const parsed = tryParseUrl(urlString);
    if (!parsed || !parsed.params || !parsed.params.has(key)) return '';
    return decodeUrlPart(parsed.params.get(key));
  }

  function extractClickTarget(val){
    const raw = String(val === null || val === undefined ? '' : val);
    if (!raw) return 'other';

    const titleMatch = raw.match(/title\s*=\s*['"]([^'"]+)['"]/i);
    if (titleMatch && normalizeText(titleMatch[1])) return normalizeText(titleMatch[1]);

    const mapsetMatch = raw.match(/data-mapset\s*=\s*['"]([^'"]+)['"]/i);
    if (mapsetMatch && normalizeText(mapsetMatch[1])) return normalizeText(mapsetMatch[1]);

    const dots = [];
    const dotRegex = /data-dot\s*=\s*['"]([^'"]+)['"]/ig;
    let dotMatch = null;
    while ((dotMatch = dotRegex.exec(raw)) !== null){
      const dotName = normalizeText(dotMatch[1]);
      if (dotName) dots.push(dotName);
    }
    if (dots.length) return dots.join(' ');

    const hasLegend = /div\.legend/i.test(raw);
    const hasLegendHover = /tr\.interactive\.hover\.is-active/i.test(raw);
    if (hasLegend && hasLegendHover) return 'hover in legend';
    if (hasLegend) return 'click in legend';

    const hasMap = /div#map\b/i.test(raw);
    const hasMaps = /div#maps\b/i.test(raw);
    if (hasMap && !hasMaps) return 'click in map';

    const hasMenuBookmark = /div#menu\b/i.test(raw) && /\bbookmark\b/i.test(raw);
    if (hasMenuBookmark) return 'menu bookmark';
    if (/div#menu\b/i.test(raw)) return 'menu control';

    const hasTimelineCanvas = /div#timeline\b/i.test(raw) && /\bcanvas\b/i.test(raw);
    if (hasTimelineCanvas) return 'timeline control';

    if (/div#maps\b/i.test(raw)) return 'maps panel control';

    const hasSearchUi = /search-form|ul\.search\b|ul\.suggest\b/i.test(raw);
    if (hasSearchUi) return 'search controls';

    const hasMapsetPanel = /mapset\.(detail|summary)/i.test(raw);
    if (hasMapsetPanel) return 'mapset panel control';

    const hasSidebarToggle = /div#sidebar\b/i.test(raw) && /button\.toggle/i.test(raw);
    if (hasSidebarToggle) return 'sidebar toggle';

    const hasModalUi = /modal-box|#sources\.|#lectures\./i.test(raw);
    if (hasModalUi) return 'modal control';

    if (/div#tools\b/i.test(raw)) return 'tools link';

    if (/div#sidebar\b/i.test(raw)) return 'sidebar control';

    return 'other';
  }

  function transformEventRow(row, participantId){
    if (!row || !row.type) return null;

    let outType = row.type;
    if (outType === 'mouse_wheel_start') outType = 'zoom';
    if (outType === 'pointerup' || outType === 'mouse_wheel_end') return null;

    const out = {
      idx: row.idx,
      absoluteTime: row.absoluteTime,
      relTime: row.relTime,
      task: row.task,
      taskId: row.taskId,
      participantId,
      type: outType,
      parameter: '',
      zoom: '',
      map: '',
      click: '',
      projection: ''
    };

    if (outType === 'url_change'){
      out.parameter = extractUrlParam(row.val, 'p');
      out.zoom = extractUrlParam(row.val, 'z');
      out.map = normalizeText(extractUrlParam(row.val, 'id'));
    } else if (outType === 'pointerdown'){
      out.click = extractClickTarget(row.val);
    } else if (outType === 'projection'){
      out.projection = normalizeText(row.val);
    }

    return out;
  }

  function extractMapIdRaw(urlString){
    const mapId = normalizeText(extractUrlParam(urlString, 'id'));
    if (!mapId) return '';
    return mapId.trim().toLowerCase();
  }

  function extractMapId(urlString){
    const mapId = extractMapIdRaw(urlString);
    return mapId || '(unknown)';
  }

  function resolveTaskIdFromMapId(mapId){
    const key = normalizeText(mapId).toLowerCase();
    if (!key) return null;
    return Number.isFinite(TASK_ID_BY_MAP_ID[key]) ? TASK_ID_BY_MAP_ID[key] : null;
  }

  function buildTaskIdMap(rows, participantId){
    const byTask = new Map();
    const taskIdByTask = new Map();
    const issues = [];

    for (const r of rows){
      if (r.task === null || !Number.isFinite(r.task) || r.task < 0) continue;
      if (!byTask.has(r.task)) byTask.set(r.task, []);
      byTask.get(r.task).push(r);
    }

    const tasks = Array.from(byTask.keys()).sort((a,b)=> a - b);
    for (const task of tasks){
      if (task === 0){
        taskIdByTask.set(task, 0);
        continue;
      }

      const taskRows = byTask.get(task) || [];
      const urlRows = taskRows.filter(r => r.type === 'url_change' && r.val);
      if (!urlRows.length){
        issues.push({ participantId, task, reason: 'missing_url_change' });
        continue;
      }

      const lastUrlChange = urlRows.slice().sort((a,b)=> (a.absoluteTime - b.absoluteTime) || (a.idx - b.idx)).pop();
      const mapId = extractMapIdRaw(lastUrlChange ? lastUrlChange.val : '');
      if (!mapId){
        issues.push({ participantId, task, reason: 'missing_map_id' });
        continue;
      }

      const taskId = resolveTaskIdFromMapId(mapId);
      if (taskId === null){
        issues.push({ participantId, task, reason: 'unknown_map_id', mapId });
        continue;
      }

      taskIdByTask.set(task, taskId);
    }

    return { taskIdByTask, issues };
  }

  function computeParticipantStats(ds){
    const rows = Array.isArray(ds.rows) ? ds.rows : [];
    const fileId = baseName(ds.name);

    const normalizedRows = rows.map((r, idx)=>{
      const absoluteTime = toNumber(r.absoluteTime);
      const relTime = toNumber(r.time);
      const task = toNumber(r.task);
      const type = normalizeEventType(r.type);
      const val = normalizeText(r.val).replace(/^"+|"+$/g, '');
      const participantIdRaw = normalizeText(r.participant_ID || r.session) || fileId;
      return {
        idx,
        absoluteTime,
        relTime,
        task,
        type,
        val,
        participantIdRaw,
        taskId: null,
        raw: r
      };
    }).filter(r => r.type && r.absoluteTime !== null);

    const rowsInInputOrder = normalizedRows.slice().sort((a,b)=> a.idx - b.idx);
    let nonMonotonicTimeInInput = 0;
    for (let i=1;i<rowsInInputOrder.length;i++){
      if (rowsInInputOrder[i].absoluteTime < rowsInInputOrder[i-1].absoluteTime) nonMonotonicTimeInInput += 1;
    }

    const duplicateKeyCounts = new Map();
    for (const r of normalizedRows){
      const key = [r.absoluteTime, r.participantIdRaw, r.task === null ? '' : r.task, r.type, r.val].join('|');
      duplicateKeyCounts.set(key, (duplicateKeyCounts.get(key) || 0) + 1);
    }
    const duplicateRows = Array.from(duplicateKeyCounts.values()).reduce((sum, c)=> sum + (c > 1 ? (c - 1) : 0), 0);

    normalizedRows.sort((a,b)=> (a.absoluteTime - b.absoluteTime) || (a.idx - b.idx));

    const participantCounts = new Map();
    for (const r of normalizedRows){
      if (r.participantIdRaw) participantCounts.set(r.participantIdRaw, (participantCounts.get(r.participantIdRaw) || 0) + 1);
    }

    let participantId = fileId;
    if (participantCounts.size){
      participantId = Array.from(participantCounts.entries())
        .sort((a,b)=> (b[1] - a[1]) || a[0].localeCompare(b[0], 'en-GB'))[0][0];
    }

    const taskIdMapping = buildTaskIdMap(normalizedRows, participantId);
    for (const r of normalizedRows){
      if (r.task === null || !Number.isFinite(r.task) || r.task < 0){
        r.taskId = null;
      } else {
        r.taskId = taskIdMapping.taskIdByTask.has(r.task) ? taskIdMapping.taskIdByTask.get(r.task) : null;
      }
    }

    const transformedRows = [];
    for (const r of normalizedRows){
      const transformed = transformEventRow(r, participantId);
      if (!transformed) continue;
      transformedRows.push(transformed);
    }

    const eventCounts = new Map();
    for (const r of transformedRows){
      eventCounts.set(r.type, (eventCounts.get(r.type) || 0) + 1);
    }

    const urlRows = transformedRows.filter(r => r.type === 'url_change');
    const times = transformedRows.map(r => r.absoluteTime).filter(v => v !== null);
    const minTime = times.length ? Math.min.apply(null, times) : null;
    const maxTime = times.length ? Math.max.apply(null, times) : null;

    return {
      participantId,
      rows: transformedRows,
      eventCounts,
      urlRows,
      minTime,
      maxTime,
      quality: {
        missingTaskRows: normalizedRows.filter(r => r.task === null).length,
        negativeTaskRows: normalizedRows.filter(r => r.task !== null && r.task < 0).length,
        missingTaskIdRows: normalizedRows.filter(r => r.task !== null && Number.isFinite(r.task) && r.task >= 0 && !Number.isFinite(r.taskId)).length,
        nonMonotonicTimeInInput,
        duplicateRows
      },
      taskIdIssues: taskIdMapping.issues
    };
  }

  function rebuildParticipantSelect(participants){
    if (!participantSelectEl) return;
    const current = participantSelectEl.value || '__aggregate__';
    const opts = ['<option value="__aggregate__">Aggregate</option>']
      .concat(participants.map(p => '<option value="' + esc(p.participantId) + '">' + esc(p.participantId) + '</option>'));
    participantSelectEl.innerHTML = opts.join('');
    try{ participantSelectEl.value = current; }catch(_e){}
    if (participantSelectEl.value !== current) participantSelectEl.value = '__aggregate__';
  }

  function destroyChart(chart){
    try{ if (chart) chart.destroy(); }catch(_e){}
  }

  function ensureZoomPluginRegistered(){
    if (!window.Chart || typeof window.Chart.register !== 'function') return;
    try{
      const reg = window.Chart.registry && window.Chart.registry.plugins;
      if (reg && typeof reg.get === 'function' && reg.get('zoom')) return;
    }catch(_e){
      // continue and try registration
    }

    const candidate = window.ChartZoom || window['chartjs-plugin-zoom'] || null;
    if (!candidate) return;
    try{
      if (candidate.default) window.Chart.register(candidate.default);
      else window.Chart.register(candidate);
    }catch(_e){
      // plugin may already be registered or unavailable in this runtime
    }
  }

  function getParticipantsForView(participants, selectedId){
    if (!selectedId || selectedId === '__aggregate__') return participants.slice();
    return participants.filter(p => p.participantId === selectedId);
  }

  function getTaskFilter(){
    const minRaw = taskMinEl ? taskMinEl.value : '';
    const maxRaw = taskMaxEl ? taskMaxEl.value : '';
    const min = toNumber(minRaw);
    const max = toNumber(maxRaw);

    const hasMin = min !== null;
    const hasMax = max !== null;
    let lo = hasMin ? min : null;
    let hi = hasMax ? max : null;

    if (lo !== null && hi !== null && lo > hi){
      const tmp = lo;
      lo = hi;
      hi = tmp;
    }

    return {
      min: lo,
      max: hi,
      active: lo !== null || hi !== null
    };
  }

  function getFirstActionMode(){
    const raw = firstActionModeEl ? normalizeText(firstActionModeEl.value).toLowerCase() : '';
    if (raw === 'pointerdown') return raw;
    if (raw === 'pointer_zoom_or_url') return raw;
    if (raw === 'any_non_projection') return raw;
    return 'pointer_or_zoom';
  }

  function getFirstActionModeLabel(mode){
    if (mode === 'pointerdown') return 'Pointerdown only';
    if (mode === 'pointer_zoom_or_url') return 'Pointerdown, zoom, or URL change';
    if (mode === 'any_non_projection') return 'Any non-projection event';
    return 'Pointerdown or zoom';
  }

  function isFirstActionEvent(row, mode){
    const type = normalizeText(row && row.type).toLowerCase();
    if (!type) return false;
    if (mode === 'pointerdown') return type === 'pointerdown';
    if (mode === 'pointer_zoom_or_url') return type === 'pointerdown' || type === 'zoom' || type === 'url_change';
    if (mode === 'any_non_projection') return type !== 'projection';
    return type === 'pointerdown' || type === 'zoom';
  }

  function taskPassesFilter(taskId, filter){
    if (!filter || !filter.active) return true;
    if (taskId === null || taskId === undefined || !Number.isFinite(taskId)) return false;
    if (filter.min !== null && taskId < filter.min) return false;
    if (filter.max !== null && taskId > filter.max) return false;
    return true;
  }

  function filterRowsByTask(rows, filter){
    if (!filter || !filter.active) return (rows || []).slice();
    return (rows || []).filter(r => taskPassesFilter(r.taskId, filter));
  }

  function getFilteredParticipantData(p, filter){
    return {
      rows: filterRowsByTask(p.rows, filter),
      urlRows: filterRowsByTask(p.urlRows, filter)
    };
  }

  function getTaskLabel(taskId){
    if (taskId === null || taskId === undefined || !Number.isFinite(taskId)) return 'No task_ID';
    return 'Task_ID ' + taskId;
  }

  function computeTaskStats(participants, selectedId, taskFilter){
    const pool = getParticipantsForView(participants, selectedId);
    const byGroup = new Map();

    function groupKeyForTaskId(taskId){
      return 'taskid:' + taskId;
    }

    function ensureGroup(groupKey, groupLabel, taskId){
      if (!byGroup.has(groupKey)){
        byGroup.set(groupKey, {
          groupKey,
          groupLabel,
          taskId,
          interactions: 0,
          zoomEvents: 0,
          durationSamplesSec: [],
          mapDurationSec: new Map(),
          mapTransitions: new Map()
        });
      }
      return byGroup.get(groupKey);
    }

    for (const p of pool){
      const filtered = getFilteredParticipantData(p, taskFilter);
      const rowsByGroup = new Map();
      const urlRowsByGroup = new Map();

      for (const r of filtered.rows || []){
        const taskId = Number.isFinite(r.taskId) ? r.taskId : null;
        if (!Number.isFinite(taskId)) continue;
        const gk = groupKeyForTaskId(taskId);
        const label = getTaskLabel(taskId);
        if (!rowsByGroup.has(gk)) rowsByGroup.set(gk, { label, taskId, rows: [] });
        rowsByGroup.get(gk).rows.push(r);

        if (r.type !== 'projection'){
          const t = ensureGroup(gk, label, taskId);
          t.interactions += 1;
        }

        if (r.type === 'zoom'){
          const t = ensureGroup(gk, label, taskId);
          t.zoomEvents += 1;
        }

        if (r.type === 'url_change'){
          if (!urlRowsByGroup.has(gk)) urlRowsByGroup.set(gk, { label, taskId, rows: [] });
          urlRowsByGroup.get(gk).rows.push(r);
        }
      }

      for (const [groupKey, payload] of rowsByGroup.entries()){
        const groupRows = payload.rows || [];
        if (!groupRows.length) continue;
        const times = groupRows.map(r => r.absoluteTime).filter(v => Number.isFinite(v));
        if (!times.length) continue;
        const minT = Math.min.apply(null, times);
        const maxT = Math.max.apply(null, times);
        const durationSec = Math.max(0, (maxT - minT) / 1000);
        const t = ensureGroup(groupKey, payload.label || groupKey, payload.taskId);
        t.durationSamplesSec.push(durationSec);
      }

      for (const [groupKey, payload] of urlRowsByGroup.entries()){
        const sorted = (payload.rows || []).slice().sort((a,b)=> (a.absoluteTime - b.absoluteTime));
        const t = ensureGroup(groupKey, payload.label || groupKey, payload.taskId);
        for (let i=0;i<sorted.length;i++){
          const curr = sorted[i];
          const next = sorted[i+1] || null;
          const mapId = normalizeText(curr.map) || '(unknown)';
          const durSec = next ? Math.max(0, (next.absoluteTime - curr.absoluteTime) / 1000) : 0;
          t.mapTransitions.set(mapId, (t.mapTransitions.get(mapId) || 0) + 1);
          t.mapDurationSec.set(mapId, (t.mapDurationSec.get(mapId) || 0) + durSec);
        }
      }
    }

    const tasks = Array.from(byGroup.values())
      .sort((a,b)=>{
        const ai = Number.isFinite(a.taskId) ? a.taskId : Number.MAX_SAFE_INTEGER;
        const bi = Number.isFinite(b.taskId) ? b.taskId : Number.MAX_SAFE_INTEGER;
        if (ai !== bi) return ai - bi;
        return String(a.groupLabel).localeCompare(String(b.groupLabel), 'en-GB', { numeric: true });
      })
      .map(t => {
        const durs = t.durationSamplesSec.filter(v => Number.isFinite(v));
        const meanDurationSec = durs.length ? (durs.reduce((a,b)=>a+b,0) / durs.length) : null;
        return {
          taskId: t.taskId,
          groupKey: t.groupKey,
          groupLabel: t.groupLabel,
          interactions: t.interactions,
          zoomEvents: t.zoomEvents,
          meanDurationSec,
          mapDurationSec: t.mapDurationSec,
          mapTransitions: t.mapTransitions
        };
      });

    return { tasks };
  }

  function percentile(values, p){
    const arr = (values || []).filter(v => Number.isFinite(v)).slice().sort((a,b)=> a - b);
    if (!arr.length) return null;
    const pp = Math.min(1, Math.max(0, Number.isFinite(p) ? p : 0));
    const idx = (arr.length - 1) * pp;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return arr[lo];
    const frac = idx - lo;
    return arr[lo] + ((arr[hi] - arr[lo]) * frac);
  }

  function computeMapTransitionStats(participants, selectedId, taskFilter){
    const pool = getParticipantsForView(participants, selectedId);
    const transitionCounts = new Map();
    const nodeTotals = new Map();

    function addTransition(fromMap, toMap){
      const from = normalizeText(fromMap) || '(unknown)';
      const to = normalizeText(toMap) || '(unknown)';
      if (!from || !to || from === to) return;
      const key = from + '\u0000' + to;
      transitionCounts.set(key, (transitionCounts.get(key) || 0) + 1);
      nodeTotals.set(from, (nodeTotals.get(from) || 0) + 1);
      nodeTotals.set(to, (nodeTotals.get(to) || 0) + 1);
    }

    for (const p of pool){
      const filtered = getFilteredParticipantData(p, taskFilter);
      const byTask = new Map();

      for (const r of (filtered.rows || [])){
        if (r.type !== 'url_change') continue;
        if (!Number.isFinite(r.taskId)) continue;
        if (!byTask.has(r.taskId)) byTask.set(r.taskId, []);
        byTask.get(r.taskId).push(r);
      }

      for (const rows of byTask.values()){
        const sorted = rows.slice().sort((a,b)=> (a.absoluteTime - b.absoluteTime) || (a.idx - b.idx));
        for (let i=0;i<sorted.length-1;i++){
          addTransition(sorted[i].map, sorted[i+1].map);
        }
      }
    }

    const transitions = Array.from(transitionCounts.entries())
      .map(([key, count])=>{
        const parts = key.split('\u0000');
        return { from: parts[0] || '(unknown)', to: parts[1] || '(unknown)', count };
      })
      .sort((a,b)=> b.count - a.count);

    const nodes = Array.from(nodeTotals.entries())
      .sort((a,b)=> b[1] - a[1])
      .map(e => e[0]);

    return { transitions, nodes };
  }

  function computeFirstActionStats(participants, selectedId, taskFilter, firstActionMode){
    const pool = getParticipantsForView(participants, selectedId);
    const byTask = new Map();

    function ensureTask(taskId){
      const key = Number.isFinite(taskId) ? taskId : null;
      if (!Number.isFinite(key)) return null;
      if (!byTask.has(key)){
        byTask.set(key, {
          taskId: key,
          label: getTaskLabel(key),
          samplesSec: []
        });
      }
      return byTask.get(key);
    }

    for (const p of pool){
      const filtered = getFilteredParticipantData(p, taskFilter);
      const rowsByTask = new Map();

      for (const r of (filtered.rows || [])){
        if (!Number.isFinite(r.taskId)) continue;
        if (!rowsByTask.has(r.taskId)) rowsByTask.set(r.taskId, []);
        rowsByTask.get(r.taskId).push(r);
      }

      for (const [taskId, rows] of rowsByTask.entries()){
        const sorted = rows.slice().sort((a,b)=> (a.absoluteTime - b.absoluteTime) || (a.idx - b.idx));
        if (!sorted.length) continue;
        const firstEvent = sorted.find(r => Number.isFinite(r.absoluteTime));
        const firstAction = sorted.find(r => Number.isFinite(r.absoluteTime) && isFirstActionEvent(r, firstActionMode));
        if (!firstEvent || !firstAction) continue;

        const delaySec = Math.max(0, (firstAction.absoluteTime - firstEvent.absoluteTime) / 1000);
        const task = ensureTask(taskId);
        if (!task) continue;
        task.samplesSec.push(delaySec);
      }
    }

    const tasks = Array.from(byTask.values())
      .map(t => {
        const samples = t.samplesSec.filter(v => Number.isFinite(v));
        const meanSec = samples.length ? (samples.reduce((a,b)=> a + b, 0) / samples.length) : null;
        return {
          taskId: t.taskId,
          label: t.label,
          count: samples.length,
          meanSec,
          medianSec: percentile(samples, 0.5),
          p75Sec: percentile(samples, 0.75)
        };
      })
      .filter(t => t.count > 0)
      .sort((a,b)=> a.taskId - b.taskId);

    return { tasks };
  }

  function formatTaskIdIssue(issue){
    const participantId = issue && issue.participantId ? issue.participantId : '(unknown)';
    const task = issue && Number.isFinite(issue.task) ? String(issue.task) : '(unknown)';
    if (issue && issue.reason === 'unknown_map_id'){
      return 'participant_ID=' + participantId + ', task=' + task + ' -> unsupported id=mapa (' + (issue.mapId || 'missing') + ')';
    }
    if (issue && issue.reason === 'missing_map_id'){
      return 'participant_ID=' + participantId + ', task=' + task + ' -> id=mapa was not found in the URL.';
    }
    return 'participant_ID=' + participantId + ', task=' + task + ' -> no url_change row found for this task.';
  }

  function renderQuality(participants){
    if (!qualityEl) return;
    if (!participants.length){
      qualityEl.textContent = 'Load CartoLogger data to see task_ID converter diagnostics.';
      return;
    }

    const missingTaskRows = participants.reduce((sum,p)=> sum + (p.quality ? p.quality.missingTaskRows : 0), 0);
    const negativeTaskRows = participants.reduce((sum,p)=> sum + (p.quality ? p.quality.negativeTaskRows : 0), 0);
    const missingTaskIdRows = participants.reduce((sum,p)=> sum + (p.quality ? p.quality.missingTaskIdRows : 0), 0);
    const nonMonotonic = participants.reduce((sum,p)=> sum + (p.quality ? p.quality.nonMonotonicTimeInInput : 0), 0);
    const duplicateRows = participants.reduce((sum,p)=> sum + (p.quality ? p.quality.duplicateRows : 0), 0);
    const taskIdIssues = participants.flatMap(p => (p.taskIdIssues || []));

    const lines = [];
    lines.push('Task_ID conversion summary (IPAtlas mapping):');
    lines.push('Missing task values: ' + missingTaskRows.toLocaleString('en-GB') + ' rows.');
    lines.push('Negative task values: ' + negativeTaskRows.toLocaleString('en-GB') + ' rows.');
    lines.push('Rows without computed task_ID (task >= 0): ' + missingTaskIdRows.toLocaleString('en-GB') + '.');
    lines.push('Non-monotonic absoluteTime in input order: ' + nonMonotonic.toLocaleString('en-GB') + ' occurrences.');
    lines.push('Exact duplicate rows (same time/participant_ID/task/type/val): ' + duplicateRows.toLocaleString('en-GB') + '.');

    if (taskIdIssues.length){
      lines.push('Task_ID conversion issues (participant_ID + task where id=mapa was not resolved):');
      const preview = taskIdIssues.slice(0, 30).map(formatTaskIdIssue);
      lines.push(preview.join('\n'));
      if (taskIdIssues.length > 30){
        lines.push('... (' + (taskIdIssues.length - 30) + ' more unresolved participant/task combinations)');
      }
    } else {
      lines.push('Task_ID conversion issues: none.');
    }
    qualityEl.textContent = lines.join('\n');
  }

  function renderSummary(participants, selectedId){
    if (!summaryEl) return;
    if (!participants.length){
      summaryEl.innerHTML = '<div class="empty" style="grid-column:1/-1">Add CartoLogger files to see results.</div>';
      return;
    }

    const taskFilter = getTaskFilter();
    const pool = getParticipantsForView(participants, selectedId);
    const firstActionModeLabel = getFirstActionModeLabel(getFirstActionMode());
    const totalEvents = pool.reduce((sum, p)=> sum + getFilteredParticipantData(p, taskFilter).rows.length, 0);
    const totalUrlChanges = pool.reduce((sum, p)=> sum + getFilteredParticipantData(p, taskFilter).urlRows.length, 0);
    const totalZoomEvents = pool.reduce((sum, p)=>{
      const filtered = getFilteredParticipantData(p, taskFilter);
      return sum + filtered.rows.filter(r => r.type === 'zoom').length;
    }, 0);

    const uniqueTaskIds = new Set();
    for (const p of pool){
      const filtered = getFilteredParticipantData(p, taskFilter);
      for (const r of filtered.urlRows){
        if (r.taskId !== null && Number.isFinite(r.taskId)) uniqueTaskIds.add(r.taskId);
      }
    }

    const taskStats = computeTaskStats(participants, selectedId, taskFilter);
    const tasks = taskStats.tasks || [];

    const mostInteractions = tasks.slice().sort((a,b)=> b.interactions - a.interactions)[0] || null;
    const mostZoom = tasks.slice().sort((a,b)=> b.zoomEvents - a.zoomEvents)[0] || null;
    const durationTasks = tasks.filter(t => Number.isFinite(t.meanDurationSec));
    const fastest = durationTasks.slice().sort((a,b)=> a.meanDurationSec - b.meanDurationSec)[0] || null;
    const slowest = durationTasks.slice().sort((a,b)=> b.meanDurationSec - a.meanDurationSec)[0] || null;

    function taskLabel(item){ return item && item.groupLabel ? item.groupLabel : 'No task_ID'; }

    const cards = [
      { k: 'Participants', v: String(pool.length), s: selectedId === '__aggregate__' ? 'All loaded participants' : 'Filtered participant' },
      { k: 'Task_ID filter', v: taskFilter.active ? ((taskFilter.min !== null ? taskFilter.min : 'min') + '–' + (taskFilter.max !== null ? taskFilter.max : 'max')) : 'All task_ID values', s: taskFilter.active ? 'Inclusive range' : 'No task_ID filtering' },
      { k: 'First action definition', v: firstActionModeLabel, s: 'Used in time-to-first-action chart' },
      { k: 'Events (all types)', v: totalEvents.toLocaleString('en-GB'), s: 'Across uploaded CartoLogger rows' },
      { k: 'URL change events', v: totalUrlChanges.toLocaleString('en-GB'), s: 'Rows where type = url_change' },
      { k: 'Zoom events', v: totalZoomEvents.toLocaleString('en-GB'), s: 'Rows converted from type = mouse_wheel_start' },
      { k: 'Task_ID values detected', v: String(uniqueTaskIds.size), s: 'Computed from id=mapa in last url_change of each task' },
      { k: 'Most interactions', v: mostInteractions ? taskLabel(mostInteractions) : '–', s: mostInteractions ? (mostInteractions.interactions.toLocaleString('en-GB') + ' interactions') : 'No grouped data' },
      { k: 'Most zoom activity', v: mostZoom ? taskLabel(mostZoom) : '–', s: mostZoom ? (mostZoom.zoomEvents.toLocaleString('en-GB') + ' zoom events') : 'No zoom events' },
      { k: 'Fastest task_ID (mean)', v: fastest ? taskLabel(fastest) : '–', s: fastest ? (niceNumber(fastest.meanDurationSec, 1) + ' s') : 'No duration data' },
      { k: 'Slowest task_ID (mean)', v: slowest ? taskLabel(slowest) : '–', s: slowest ? (niceNumber(slowest.meanDurationSec, 1) + ' s') : 'No duration data' }
    ];

    summaryEl.innerHTML = cards.map(c =>
      '<div class="stat"><div class="k">' + esc(c.k) + '</div><div class="v">' + esc(c.v) + '</div><div class="s">' + esc(c.s) + '</div></div>'
    ).join('');
  }

  function buildEventTypesChart(participants, selectedId){
    if (!chartEventTypesCanvas || !window.Chart) return;
    const taskFilter = getTaskFilter();
    const pool = getParticipantsForView(participants, selectedId);
    const counts = new Map();
    for (const p of pool){
      const filtered = getFilteredParticipantData(p, taskFilter);
      for (const r of filtered.rows){
        counts.set(r.type, (counts.get(r.type) || 0) + 1);
      }
    }
    const entries = Array.from(counts.entries()).sort((a,b)=> b[1]-a[1]);

    destroyChart(charts.eventTypes);
    charts.eventTypes = new Chart(chartEventTypesCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: entries.map(e => e[0]),
        datasets: [{
          label: 'Count',
          data: entries.map(e => e[1]),
          backgroundColor: 'rgba(37,99,235,.22)',
          borderColor: 'rgba(37,99,235,.85)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        animation: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  function buildUrlCategoriesChart(participants, selectedId){
    if (!chartCategoriesCanvas || !window.Chart) return;
    const taskFilter = getTaskFilter();
    const pool = getParticipantsForView(participants, selectedId);

    const counts = new Map();
    for (const p of pool){
      const filtered = getFilteredParticipantData(p, taskFilter);
      for (const r of filtered.rows){
        if (r.type !== 'pointerdown') continue;
        const click = normalizeText(r.click) || 'other';
        counts.set(click, (counts.get(click) || 0) + 1);
      }
    }

    const entries = Array.from(counts.entries()).sort((a,b)=> b[1]-a[1]);
    const labels = entries.length ? entries.map(e => e[0]) : ['(none)'];
    const values = entries.length ? entries.map(e => e[1]) : [0];

    destroyChart(charts.urlCategories);
    charts.urlCategories = new Chart(chartCategoriesCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Pointerdown clicks',
          data: values,
          backgroundColor: 'rgba(16,163,74,.20)',
          borderColor: 'rgba(16,163,74,.85)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true },
          x: { ticks: { maxRotation: 45, minRotation: 0 } }
        }
      }
    });
  }

  function buildTimelineChart(participants, selectedId, binSizeSec){
    if (!chartTimelineCanvas || !window.Chart) return;

    const taskFilter = getTaskFilter();
    const pool = getParticipantsForView(participants, selectedId);
    const perParticipantBins = new Map();
    let maxBin = 0;

    for (const p of pool){
      const filtered = getFilteredParticipantData(p, taskFilter);
      const rows = filtered.rows
        .filter(r => r.type !== 'projection')
        .slice()
        .sort((a,b)=> a.absoluteTime - b.absoluteTime);
      if (!rows.length) continue;
      const t0 = rows[0].absoluteTime;
      const bins = [];
      for (const r of rows){
        const sec = (r.absoluteTime - t0) / 1000;
        const bi = Math.floor(sec / binSizeSec);
        while (bins.length <= bi) bins.push(0);
        bins[bi] += 1;
      }
      perParticipantBins.set(p.participantId, bins);
      maxBin = Math.max(maxBin, bins.length);
    }

    if (maxBin === 0){
      destroyChart(charts.timeline);
      charts.timeline = null;
      return;
    }

    const labels = Array.from({ length: maxBin }, (_,i)=> String(i * binSizeSec));
    const aggregate = new Array(maxBin).fill(0);
    for (let i=0;i<maxBin;i++){
      let s = 0;
      for (const bins of perParticipantBins.values()) s += (bins[i] || 0);
      aggregate[i] = s;
    }

    const datasets = [];
    if (selectedId && selectedId !== '__aggregate__'){
      const bins = perParticipantBins.get(selectedId) || [];
      datasets.push({
        label: selectedId,
        data: labels.map((_,i)=> bins[i] || 0),
        tension: 0.25,
        borderColor: 'rgba(37,99,235,.9)',
        backgroundColor: 'rgba(37,99,235,.14)',
        fill: true,
        pointRadius: 0
      });
    } else {
      datasets.push({
        label: 'Sum',
        data: aggregate,
        tension: 0.25,
        borderColor: 'rgba(37,99,235,.9)',
        backgroundColor: 'rgba(37,99,235,.12)',
        fill: true,
        pointRadius: 0
      });
    }

    destroyChart(charts.timeline);
    charts.timeline = new Chart(chartTimelineCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: labels.map(s => (Number(s) >= 60 ? (Number(s) / 60).toFixed(1) + ' min' : s + ' s')),
        datasets
      },
      options: {
        responsive: true,
        animation: false,
        plugins: { legend: { display: true } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Interactions per bin' } },
          x: { title: { display: true, text: 'Time since first interaction' } }
        }
      }
    });
  }

  function buildTaskSummaryChart(participants, selectedId){
    if (!chartTaskSummaryCanvas || !window.Chart) return;
    const taskFilter = getTaskFilter();
    const taskStats = computeTaskStats(participants, selectedId, taskFilter);
    const tasks = taskStats.tasks || [];

    if (!tasks.length){
      destroyChart(charts.taskSummary);
      charts.taskSummary = null;
      return;
    }

    const labels = tasks.map(t => t.groupLabel || 'No task_ID');
    const interactions = tasks.map(t => t.interactions || 0);
    const zoomEvents = tasks.map(t => t.zoomEvents || 0);
    const durations = tasks.map(t => Number.isFinite(t.meanDurationSec) ? t.meanDurationSec : 0);

    destroyChart(charts.taskSummary);
    charts.taskSummary = new Chart(chartTaskSummaryCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Interactions',
            data: interactions,
            yAxisID: 'y',
            backgroundColor: 'rgba(37,99,235,.20)',
            borderColor: 'rgba(37,99,235,.85)',
            borderWidth: 1
          },
          {
            label: 'Zoom events',
            data: zoomEvents,
            yAxisID: 'y',
            backgroundColor: 'rgba(16,163,74,.20)',
            borderColor: 'rgba(16,163,74,.85)',
            borderWidth: 1
          },
          {
            type: 'line',
            label: 'Mean duration (s)',
            data: durations,
            yAxisID: 'y1',
            borderColor: 'rgba(220,38,38,0)',
            backgroundColor: 'rgba(220,38,38,.92)',
            showLine: false,
            pointRadius: 3.5,
            pointHoverRadius: 5,
            pointStyle: 'circle'
          }
        ]
      },
      options: {
        responsive: true,
        animation: false,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Count' } },
          y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Seconds' } }
        }
      }
    });
  }

  function buildTaskMapsChart(participants, selectedId){
    if (!chartTaskMapsCanvas || !window.Chart) return;
    const taskFilter = getTaskFilter();
    const taskStats = computeTaskStats(participants, selectedId, taskFilter);
    const tasks = taskStats.tasks || [];

    if (!tasks.length){
      destroyChart(charts.taskMaps);
      charts.taskMaps = null;
      return;
    }

    const labels = tasks.map(t => t.groupLabel || 'No task_ID');

    const totalsByMap = new Map();
    for (const t of tasks){
      for (const [mapId, sec] of t.mapDurationSec.entries()){
        totalsByMap.set(mapId, (totalsByMap.get(mapId) || 0) + sec);
      }
    }

    const topMapIds = Array.from(totalsByMap.entries())
      .sort((a,b)=> b[1] - a[1])
      .map(e => e[0]);

    if (!topMapIds.length){
      destroyChart(charts.taskMaps);
      charts.taskMaps = null;
      return;
    }

    const mapColorById = {
      'povrch-zeme': ['rgba(37,99,235,.20)','rgba(37,99,235,.90)'],
      'podnebne-pasy': ['rgba(16,163,74,.20)','rgba(16,163,74,.90)'],
      biomy: ['rgba(16,163,74,.20)','rgba(16,163,74,.90)'],
      'zalidneni-oblasti': ['rgba(245,158,11,.22)','rgba(245,158,11,.92)'],
      zalidneni: ['rgba(245,158,11,.22)','rgba(245,158,11,.92)'],
      tezba: ['rgba(220,38,38,.20)','rgba(220,38,38,.90)'],
      tektonika: ['rgba(124,58,237,.20)','rgba(124,58,237,.90)'],
      'litosfericke-desky': ['rgba(124,58,237,.20)','rgba(124,58,237,.90)'],
      'prirodni-rizika': ['rgba(124,58,237,.20)','rgba(124,58,237,.90)'],
      'spotreba-kalorii': ['rgba(236,72,153,.20)','rgba(236,72,153,.90)'],
      'komplexni-doprava': ['rgba(14,165,233,.20)','rgba(14,165,233,.90)'],
      'objevne-cesty': ['rgba(20,184,166,.20)','rgba(20,184,166,.90)']
    };
    const defaultMapColors = ['rgba(100,116,139,.24)','rgba(100,116,139,.95)'];

    const datasets = topMapIds.map((mapId)=>{
      const key = normalizeText(mapId).toLowerCase();
      const colors = mapColorById[key] || defaultMapColors;
      return {
        label: mapId,
        data: tasks.map(t => t.mapDurationSec.get(mapId) || 0),
        backgroundColor: colors[0],
        borderColor: colors[1],
        borderWidth: 1,
        stack: 'maps'
      };
    });

    destroyChart(charts.taskMaps);
    charts.taskMaps = new Chart(chartTaskMapsCanvas.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        animation: false,
        plugins: {
          legend: { display: true },
          tooltip: {
            callbacks: {
              label: (ctx)=>{
                const sec = Number(ctx.raw || 0);
                return (ctx.dataset.label || '') + ': ' + niceNumber(sec, 1) + ' s';
              }
            }
          }
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Estimated map-active time (s)' } }
        }
      }
    });
  }

  function buildMapTransitionsChart(participants, selectedId){
    if (!chartMapTransitionsCanvas || !window.Chart) return;

    const taskFilter = getTaskFilter();
    const stats = computeMapTransitionStats(participants, selectedId, taskFilter);
    const transitions = stats.transitions || [];

    if (!transitions.length){
      destroyChart(charts.mapTransitions);
      charts.mapTransitions = null;
      return;
    }

    const preferredNodes = (stats.nodes || []).slice(0, 10);
    let nodes = preferredNodes.slice();
    if (!nodes.length){
      nodes = Array.from(new Set(transitions.flatMap(t => [t.from, t.to]))).slice(0, 10);
    }

    const nodeSet = new Set(nodes);
    let filtered = transitions.filter(t => nodeSet.has(t.from) && nodeSet.has(t.to));
    if (!filtered.length){
      const fallbackNodes = Array.from(new Set(transitions.slice(0, 14).flatMap(t => [t.from, t.to]))).slice(0, 10);
      nodes = fallbackNodes;
      const fallbackSet = new Set(nodes);
      filtered = transitions.filter(t => fallbackSet.has(t.from) && fallbackSet.has(t.to));
    }

    if (!filtered.length || !nodes.length){
      destroyChart(charts.mapTransitions);
      charts.mapTransitions = null;
      return;
    }

    const idxByNode = new Map(nodes.map((n,i)=> [n, i]));
    const maxCount = Math.max.apply(null, filtered.map(t => t.count));
    const points = filtered
      .map(t => {
        if (!idxByNode.has(t.from) || !idxByNode.has(t.to)) return null;
        const ratio = maxCount > 0 ? (t.count / maxCount) : 0;
        return {
          x: idxByNode.get(t.from),
          y: idxByNode.get(t.to),
          r: 5 + (ratio * 13),
          count: t.count,
          from: t.from,
          to: t.to
        };
      })
      .filter(Boolean);

    if (!points.length){
      destroyChart(charts.mapTransitions);
      charts.mapTransitions = null;
      return;
    }

    destroyChart(charts.mapTransitions);
    charts.mapTransitions = new Chart(chartMapTransitionsCanvas.getContext('2d'), {
      type: 'bubble',
      data: {
        datasets: [{
          label: 'Map transitions',
          data: points,
          borderWidth: 1,
          borderColor: 'rgba(37,99,235,.9)',
          backgroundColor: (ctx)=>{
            const raw = ctx && ctx.raw ? ctx.raw : null;
            const count = raw && Number.isFinite(raw.count) ? raw.count : 0;
            const ratio = maxCount > 0 ? (count / maxCount) : 0;
            return 'rgba(37,99,235,' + (0.14 + (ratio * 0.68)).toFixed(3) + ')';
          }
        }]
      },
      options: {
        responsive: true,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items)=>{
                const raw = items && items.length ? items[0].raw : null;
                if (!raw) return 'Transition';
                return (raw.from || '(unknown)') + ' -> ' + (raw.to || '(unknown)');
              },
              label: (ctx)=>{
                const raw = ctx && ctx.raw ? ctx.raw : null;
                return 'Count: ' + (raw && Number.isFinite(raw.count) ? raw.count.toLocaleString('en-GB') : '0');
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            min: -0.5,
            max: nodes.length - 0.5,
            ticks: {
              stepSize: 1,
              callback: (value)=>{
                const idx = Math.round(Number(value));
                if (!Number.isFinite(idx) || idx < 0 || idx >= nodes.length) return '';
                return nodes[idx];
              }
            },
            title: { display: true, text: 'From map' },
            grid: { color: 'rgba(100,116,139,.09)' }
          },
          y: {
            type: 'linear',
            min: -0.5,
            max: nodes.length - 0.5,
            reverse: true,
            ticks: {
              stepSize: 1,
              callback: (value)=>{
                const idx = Math.round(Number(value));
                if (!Number.isFinite(idx) || idx < 0 || idx >= nodes.length) return '';
                return nodes[idx];
              }
            },
            title: { display: true, text: 'To map' },
            grid: { color: 'rgba(100,116,139,.09)' }
          }
        }
      }
    });
  }

  function buildFirstActionChart(participants, selectedId){
    if (!chartFirstActionCanvas || !window.Chart) return;

    const taskFilter = getTaskFilter();
    const firstActionMode = getFirstActionMode();
    const firstActionModeLabel = getFirstActionModeLabel(firstActionMode);
    const stats = computeFirstActionStats(participants, selectedId, taskFilter, firstActionMode);
    const tasks = stats.tasks || [];

    if (!tasks.length){
      destroyChart(charts.firstAction);
      charts.firstAction = null;
      return;
    }

    const labels = tasks.map(t => t.label);
    const means = tasks.map(t => Number.isFinite(t.meanSec) ? t.meanSec : 0);
    const medians = tasks.map(t => Number.isFinite(t.medianSec) ? t.medianSec : 0);
    const p75 = tasks.map(t => Number.isFinite(t.p75Sec) ? t.p75Sec : 0);

    destroyChart(charts.firstAction);
    charts.firstAction = new Chart(chartFirstActionCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Mean time to first action (s)',
            data: means,
            backgroundColor: 'rgba(14,165,233,.20)',
            borderColor: 'rgba(14,165,233,.90)',
            borderWidth: 1
          },
          {
            type: 'line',
            label: 'Median (s)',
            data: medians,
            borderColor: 'rgba(220,38,38,.90)',
            backgroundColor: 'rgba(220,38,38,.90)',
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.2,
            fill: false
          },
          {
            type: 'line',
            label: 'P75 (s)',
            data: p75,
            borderColor: 'rgba(245,158,11,.92)',
            backgroundColor: 'rgba(245,158,11,.92)',
            borderDash: [6,4],
            pointRadius: 2.5,
            pointHoverRadius: 4,
            tension: 0.2,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        animation: false,
        plugins: {
          legend: { display: true },
          subtitle: {
            display: true,
            text: 'Definition: ' + firstActionModeLabel
          },
          tooltip: {
            callbacks: {
              afterBody: (items)=>{
                const first = items && items.length ? items[0] : null;
                if (!first || !Number.isInteger(first.dataIndex)) return '';
                const idx = first.dataIndex;
                const n = tasks[idx] && Number.isFinite(tasks[idx].count) ? tasks[idx].count : 0;
                return 'Participants with detected action: ' + n.toLocaleString('en-GB');
              }
            }
          }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Seconds' } },
          x: { title: { display: true, text: 'Task_ID' } }
        }
      }
    });
  }

  function fmtAbsTime(ms){
    if (!Number.isFinite(ms)) return '–';
    try{ return new Date(ms).toLocaleString('en-GB'); }
    catch(_e){ return String(ms); }
  }

  function formatSequenceDetail(row){
    if (!row || typeof row !== 'object') return '';

    const parts = [];
    if (row.type === 'url_change'){
      if (normalizeText(row.map)) parts.push('map=' + normalizeText(row.map));
      if (normalizeText(row.parameter)) parts.push('p=' + normalizeText(row.parameter));
      if (normalizeText(row.zoom)) parts.push('z=' + normalizeText(row.zoom));
    }

    if (row.type === 'pointerdown'){
      parts.push('click=' + (normalizeText(row.click) || 'other'));
    }

    if (row.type === 'projection' && normalizeText(row.projection)){
      parts.push('projection=' + normalizeText(row.projection));
    }

    if (!parts.length){
      if (normalizeText(row.click)) parts.push('click=' + normalizeText(row.click));
      if (normalizeText(row.map)) parts.push('map=' + normalizeText(row.map));
      if (normalizeText(row.parameter)) parts.push('p=' + normalizeText(row.parameter));
      if (normalizeText(row.zoom)) parts.push('z=' + normalizeText(row.zoom));
      if (normalizeText(row.projection)) parts.push('projection=' + normalizeText(row.projection));
    }

    return parts.join(' | ');
  }

  function eventColor(type){
    const palette = {
      url_change: 'rgba(37,99,235,.95)',
      pointerdown: 'rgba(16,163,74,.95)',
      zoom: 'rgba(245,158,11,.95)',
      projection: 'rgba(124,58,237,.95)'
    };
    return palette[type] || 'rgba(100,116,139,.95)';
  }

  function renderSequenceVisualisation(participants, selectedId){
    const canChart = !!(chartSequenceCanvas && window.Chart);
    const canStream = !!sequenceStreamEl;
    if (!canChart && !canStream) return;

    const taskFilter = getTaskFilter();
    if (!selectedId || selectedId === '__aggregate__'){
      if (canChart){
        destroyChart(charts.sequence);
        charts.sequence = null;
      }
      if (canStream){
        sequenceStreamEl.innerHTML = '<div class="empty">Select one participant to reconstruct the interaction sequence over time.</div>';
      }
      return;
    }

    const participant = (participants || []).find(p => p.participantId === selectedId) || null;
    const filtered = participant ? getFilteredParticipantData(participant, taskFilter) : { rows: [] };
    const rows = (filtered.rows || []).slice().sort((a,b)=> (a.absoluteTime - b.absoluteTime) || (a.idx - b.idx));

    if (!rows.length){
      if (canChart){
        destroyChart(charts.sequence);
        charts.sequence = null;
      }
      if (canStream){
        sequenceStreamEl.innerHTML = '<div class="empty">No events available for this participant and task_ID filter.</div>';
      }
      return;
    }

    const typeLabels = [];
    const typeIndex = new Map();
    for (const row of rows){
      const t = normalizeText(row.type) || 'unknown';
      if (typeIndex.has(t)) continue;
      typeIndex.set(t, typeLabels.length);
      typeLabels.push(t);
    }

    const t0 = rows[0].absoluteTime;
    const ySpacing = 0.62;
    const yPadding = ySpacing * 0.62;
    const points = rows.map((row, idx)=>{
      const x = Number.isFinite(row.absoluteTime) && Number.isFinite(t0) ? Math.max(0, (row.absoluteTime - t0) / 1000) : 0;
      const y = typeIndex.has(row.type) ? typeIndex.get(row.type) * ySpacing : 0;
      return {
        x,
        y,
        order: idx + 1,
        row
      };
    });

    if (canChart){
      ensureZoomPluginRegistered();
      destroyChart(charts.sequence);
      charts.sequence = new Chart(chartSequenceCanvas.getContext('2d'), {
        type: 'scatter',
        data: {
          datasets: [
            {
              type: 'line',
              label: 'Sequence path',
              data: points.map(p => ({ x: p.x, y: p.y })),
              borderColor: 'rgba(100,116,139,.14)',
              borderWidth: 0.8,
              pointRadius: 0,
              tension: 0
            },
            {
              label: 'Events',
              data: points,
              showLine: false,
              pointRadius: 3,
              pointHoverRadius: 5,
              pointBackgroundColor: (ctx)=> eventColor(ctx && ctx.raw && ctx.raw.row ? ctx.raw.row.type : ''),
              pointBorderColor: (ctx)=> eventColor(ctx && ctx.raw && ctx.raw.row ? ctx.raw.row.type : '')
            }
          ]
        },
        options: {
          responsive: true,
          animation: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items)=>{
                  const first = items && items.length ? items[0] : null;
                  const raw = first && first.raw ? first.raw : null;
                  if (!raw || !raw.row) return 'Event';
                  return '#' + raw.order + ' - ' + (raw.row.type || 'event');
                },
                label: (ctx)=>{
                  const raw = ctx && ctx.raw ? ctx.raw : null;
                  const row = raw && raw.row ? raw.row : null;
                  if (!row) return 'No details';
                  const lines = [];
                  lines.push('t=' + niceNumber(raw.x, 2) + ' s');
                  lines.push('absolute=' + fmtAbsTime(row.absoluteTime));
                  lines.push('task=' + (Number.isFinite(row.task) ? row.task : '–') + ', task_ID=' + (Number.isFinite(row.taskId) ? row.taskId : '–'));
                  const detail = formatSequenceDetail(row);
                  if (detail) lines.push(detail);
                  return lines;
                }
              }
            },
            zoom: {
              pan: {
                enabled: true,
                mode: 'x'
              },
              zoom: {
                mode: 'x',
                wheel: { enabled: true },
                pinch: { enabled: false },
                drag: { enabled: false }
              }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: 'rgba(100,116,139,.08)' },
              title: { display: true, text: 'Time since first event (s)' }
            },
            y: {
              min: -yPadding,
              max: Math.max((typeLabels.length - 1) * ySpacing + yPadding, yPadding),
              grid: { color: 'rgba(100,116,139,.08)' },
              ticks: {
                stepSize: ySpacing,
                callback: (value)=>{
                  const v = Number(value);
                  if (!Number.isFinite(v)) return '';
                  const idx = Math.round(v / ySpacing);
                  if (idx < 0 || idx >= typeLabels.length) return '';
                  return Math.abs(v - (idx * ySpacing)) < (ySpacing * 0.25) ? typeLabels[idx] : '';
                }
              },
              title: { display: true, text: 'Event type' }
            }
          }
        }
      });
    }

    if (canStream){
      const maxRows = 400;
      const previewRows = rows.slice(0, maxRows);
      const itemsHtml = previewRows.map((row, idx)=>{
        const relSec = Number.isFinite(row.absoluteTime) && Number.isFinite(t0) ? Math.max(0, (row.absoluteTime - t0) / 1000) : 0;
        const taskLabel = Number.isFinite(row.task) ? String(row.task) : '–';
        const taskIdLabel = Number.isFinite(row.taskId) ? String(row.taskId) : '–';
        const detail = formatSequenceDetail(row) || 'no derived detail';
        return '<article class="seq-item">'
          + '<div class="seq-top">'
          + '<span class="seq-step">#' + (idx + 1) + '</span>'
          + '<span class="seq-type">' + esc(row.type || 'event') + '</span>'
          + '<span class="seq-time">' + esc(niceNumber(relSec, 2)) + ' s</span>'
          + '</div>'
          + '<div class="seq-meta">task=' + esc(taskLabel) + ' | task_ID=' + esc(taskIdLabel) + ' | ' + esc(detail) + '</div>'
          + '</article>';
      }).join('');

      const tailNote = rows.length > maxRows
        ? '<div class="help" style="margin:.55rem 0 0">Showing first ' + maxRows + ' events out of ' + rows.length + '. Download converted CSV for the complete sequence.</div>'
        : '';

      sequenceStreamEl.innerHTML = '<div class="seq-stream">' + itemsHtml + '</div>' + tailNote;
    }
  }

  function buildConvertedRows(participants){
    const rows = [];

    for (const p of (participants || [])){
      for (const r of (p.rows || [])){
        const out = {
          absoluteTime: Number.isFinite(r.absoluteTime) ? r.absoluteTime : '',
          participant_ID: p.participantId,
          task: Number.isFinite(r.task) ? r.task : '',
          task_ID: Number.isFinite(r.taskId) ? r.taskId : '',
          time: Number.isFinite(r.relTime) ? r.relTime : '',
          type: r.type || '',
          parameter: r.type === 'url_change' ? (r.parameter || '') : '',
          zoom: r.type === 'url_change' ? (r.zoom || '') : '',
          map: r.type === 'url_change' ? (r.map || '') : '',
          click: r.type === 'pointerdown' ? (r.click || '') : '',
          projection: r.type === 'projection' ? (r.projection || '') : ''
        };

        rows.push(out);
      }
    }

    rows.sort((a,b)=>{
      const pa = normalizeText(a.participant_ID);
      const pb = normalizeText(b.participant_ID);
      const cmpP = pa.localeCompare(pb, 'en-GB', { numeric: true });
      if (cmpP !== 0) return cmpP;
      const ta = toNumber(a.absoluteTime);
      const tb = toNumber(b.absoluteTime);
      if (ta !== null && tb !== null && ta !== tb) return ta - tb;
      return 0;
    });

    return rows;
  }

  function buildConvertedFields(){
    return ['absoluteTime','participant_ID','task','task_ID','time','type','parameter','zoom','map','click','projection'];
  }

  function downloadConvertedCsv(participants){
    if (!participants || !participants.length){
      warn('No CartoLogger participants are available to export yet.');
      return;
    }

    const rows = buildConvertedRows(participants);
    if (!rows.length){
      warn('No converted rows are available to export.');
      return;
    }

    const fields = buildConvertedFields();
    const data = rows.map(r => fields.map(f => (r[f] === undefined || r[f] === null) ? '' : r[f]));
    const csv = Papa.unparse({ fields, data });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const fileName = 'cartologger_converted_all_participants.csv';

    try{ saveAs(blob, fileName); }
    catch(_e){
      const a = document.createElement('a');
      a.download = fileName;
      a.href = URL.createObjectURL(blob);
      a.click();
    }
  }

  function rebuildAll(){
    clearWarn();

    const participants = datasets
      .filter(d => Array.isArray(d.rows) && d.rows.length)
      .map(computeParticipantStats);

    lastComputedParticipants = participants;

    rebuildParticipantSelect(participants);

    const selectedId = participantSelectEl ? participantSelectEl.value : '__aggregate__';
    const binSizeSec = Number(binSizeEl && binSizeEl.value) || 10;

    renderSummary(participants, selectedId);
    renderQuality(participants);

    if (!participants.length){
      destroyChart(charts.eventTypes);
      destroyChart(charts.urlCategories);
      destroyChart(charts.timeline);
      destroyChart(charts.taskSummary);
      destroyChart(charts.taskMaps);
      destroyChart(charts.mapTransitions);
      destroyChart(charts.firstAction);
      destroyChart(charts.sequence);
      charts.eventTypes = null;
      charts.urlCategories = null;
      charts.timeline = null;
      charts.taskSummary = null;
      charts.taskMaps = null;
      charts.mapTransitions = null;
      charts.firstAction = null;
      charts.sequence = null;
      renderSequenceVisualisation([], selectedId);
      return;
    }

    buildEventTypesChart(participants, selectedId);
    buildUrlCategoriesChart(participants, selectedId);
    buildTimelineChart(participants, selectedId, binSizeSec);
    buildTaskSummaryChart(participants, selectedId);
    buildTaskMapsChart(participants, selectedId);
    buildMapTransitionsChart(participants, selectedId);
    buildFirstActionChart(participants, selectedId);
    renderSequenceVisualisation(participants, selectedId);

    const parseWarnings = datasets.flatMap(d => (d.meta && d.meta.parseErrors ? d.meta.parseErrors.map(e => d.name + ': ' + e) : []));
    const conversionIssues = participants.flatMap(p => (p.taskIdIssues || []).map(formatTaskIdIssue));
    const warningBlocks = [];
    if (parseWarnings.length) warningBlocks.push(parseWarnings.slice(0, 6).join('\n'));
    if (conversionIssues.length){
      const preview = conversionIssues.slice(0, 12).join('\n');
      const suffix = conversionIssues.length > 12 ? ('\n... (' + (conversionIssues.length - 12) + ' more)') : '';
      warningBlocks.push('Unresolved task_ID mappings:\n' + preview + suffix);
    }
    if (warningBlocks.length) warn(warningBlocks.join('\n\n'));
  }

  async function loadSampleData(){
    clearWarn();
    const sampleNames = ['U01.csv','U02.csv','U03.csv','U04.csv','U05.csv'];
    const baseUrls = [
      './sample_data_CartoLogger/',
      '/sample_data_CartoLogger/',
      '../sample_data_CartoLogger/',
      '../../sample_data_CartoLogger/'
    ];

    const loaded = [];
    const attempted = [];

    for (const name of sampleNames){
      let ok = false;
      for (const base of baseUrls){
        try{
          const url = base + name;
          attempted.push(url);
          const res = await fetch(url, { cache: 'no-store' });
          if (!res.ok) continue;
          const text = await res.text();
          const parsedRaw = parseCartoCsvText(text);
          const parseErrors = [];
          const missing = validateColumns(parsedRaw.fields);
          if (missing.length) parseErrors.push('Missing columns: ' + missing.join(', '));
          const parsed = {
            name,
            size: text.length,
            rows: Array.isArray(parsedRaw.rows) ? parsedRaw.rows : [],
            meta: { parseErrors }
          };
          loaded.push(parsed);
          ok = true;
          break;
        }catch(_e){
          // try next base path
        }
      }
      if (!ok){
        warn('Could not load CartoLogger sample data. If you use Live Server, start it from the folder that contains index.html so ./sample_data_CartoLogger is accessible. Tried: ' + attempted.slice(0, 6).join(', ') + (attempted.length > 6 ? ', …' : '') + '.');
        break;
      }
    }

    if (loaded.length){
      datasets = loaded;
      datasets.sort((a,b)=> baseName(a.name).localeCompare(baseName(b.name), 'en-GB', { numeric: true }));
      renderFileList();
      rebuildAll();
    }
  }

  function wireEvents(){
    if (inputEl){
      inputEl.addEventListener('change', async (e)=>{
        const files = e.target && e.target.files ? e.target.files : [];
        await addCsvFiles(files);
        inputEl.value = '';
      });
    }

    if (dropzoneEl){
      dropzoneEl.addEventListener('click', (e)=>{ if (e.target === dropzoneEl && inputEl) inputEl.click(); });
      dropzoneEl.addEventListener('dragover', (e)=>{ e.preventDefault(); });
      dropzoneEl.addEventListener('drop', async (e)=>{
        e.preventDefault();
        const files = e.dataTransfer ? e.dataTransfer.files : [];
        await addCsvFiles(files);
      });
    }

    if (listEl){
      listEl.addEventListener('click', (e)=>{
        const btn = e.target && e.target.closest ? e.target.closest('button.remove') : null;
        if (!btn) return;
        const idx = Number(btn.getAttribute('data-index'));
        if (!Number.isInteger(idx) || idx < 0 || idx >= datasets.length) return;
        datasets.splice(idx, 1);
        renderFileList();
        rebuildAll();
      });
    }

    if (clearBtn){
      clearBtn.addEventListener('click', ()=>{
        datasets = [];
        renderFileList();
        rebuildAll();
      });
    }

    if (sampleBtn){
      sampleBtn.addEventListener('click', loadSampleData);
    }

    if (exportConvertedBtn){
      exportConvertedBtn.addEventListener('click', ()=>{
        downloadConvertedCsv(lastComputedParticipants);
      });
    }

    if (participantSelectEl) participantSelectEl.addEventListener('change', rebuildAll);
    if (binSizeEl) binSizeEl.addEventListener('change', rebuildAll);
    if (firstActionModeEl) firstActionModeEl.addEventListener('change', rebuildAll);
    if (taskMinEl) taskMinEl.addEventListener('input', rebuildAll);
    if (taskMaxEl) taskMaxEl.addEventListener('input', rebuildAll);
    if (taskResetBtn){
      taskResetBtn.addEventListener('click', ()=>{
        if (taskMinEl) taskMinEl.value = '';
        if (taskMaxEl) taskMaxEl.value = '';
        rebuildAll();
      });
    }

    document.addEventListener('click', async (e)=>{
      const infoBtn = e.target && e.target.closest ? e.target.closest('button.carto-info-btn') : null;
      if (infoBtn){
        const key = infoBtn.getAttribute('data-help') || '';
        openInfoModal(key);
        return;
      }

      const dlBtn = e.target && e.target.closest ? e.target.closest('button.carto-download-btn') : null;
      if (dlBtn){
        const targetId = dlBtn.getAttribute('data-export') || '';
        if (!targetId) return;
        const canvas = document.getElementById(targetId);
        await exportCanvasAsPng(canvas, targetId.replace(/[^a-z0-9_-]+/gi,'_'));
      }
    });

    if (infoModalCloseBtn) infoModalCloseBtn.addEventListener('click', closeInfoModal);
    if (infoModalEl){
      infoModalEl.addEventListener('click', (e)=>{ if (e.target === infoModalEl) closeInfoModal(); });
    }
    window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') closeInfoModal(); });
  }

  // Boot
  if (!inputEl || !dropzoneEl || !summaryEl) return;
  renderFileList();
  wireEvents();
  rebuildAll();
})();
