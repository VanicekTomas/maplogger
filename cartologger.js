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
  const taskMinEl = document.getElementById('carto-task-min');
  const taskMaxEl = document.getElementById('carto-task-max');
  const taskResetBtn = document.getElementById('carto-task-reset');
  const bundleModeEl = document.getElementById('carto-bundle-mode');
  const bundleFileEl = document.getElementById('carto-bundle-file');
  const bundleClearBtn = document.getElementById('carto-bundle-clear');

  const summaryEl = document.getElementById('carto-summary');
  const transitionsEl = document.getElementById('carto-transitions');
  const qualityEl = document.getElementById('carto-quality');
  const applySuggestedRangeBtn = document.getElementById('carto-apply-suggested-range');
  const taskRandomizationWarningEl = document.getElementById('carto-task-randomization-warning');
  const bundleStatusEl = document.getElementById('carto-bundle-status');

  const chartEventTypesCanvas = document.getElementById('carto-chart-event-types');
  const chartCategoriesCanvas = document.getElementById('carto-chart-url-categories');
  const chartTimelineCanvas = document.getElementById('carto-chart-timeline');
  const chartTaskSummaryCanvas = document.getElementById('carto-chart-task-summary');
  const chartTaskMapsCanvas = document.getElementById('carto-chart-task-maps');

  const infoModalEl = document.getElementById('info-modal');
  const infoModalTitleEl = document.getElementById('info-modal-title');
  const infoModalBodyEl = document.getElementById('info-modal-body');
  const infoModalCloseBtn = document.getElementById('info-modal-close');

  const REQUIRED_COLUMNS = ['absoluteTime','session','task','time','type','val'];

  /** @type {{name:string,size:number,rows:any[],meta:{parseErrors:string[]}}[]} */
  let datasets = [];
  let lastSuggestedRange = null;
  /** @type {Map<string,string>} */
  let manualBundleMap = new Map();
  let manualBundleRows = 0;

  const charts = {
    eventTypes: null,
    urlCategories: null,
    timeline: null,
    taskSummary: null,
    taskMaps: null
  };

  const CARTO_HELP_CONTENT = {
    cartoEventTypes: {
      title: 'Event types (CartoLogger)',
      body: 'Shows how often each CartoLogger event type appears in the current selection (participant + task filter). Use this to see whether behaviour is dominated by URL changes, pointer events, or wheel actions.'
    },
    cartoUrlCategories: {
      title: 'URL change categories',
      body: 'Each <strong>url_change</strong> is compared to the previous URL within the same task. Categories summarise what changed (zoom, centre coordinates, map ID, projection, layers/style, and other parameters).'
    },
    cartoTimeline: {
      title: 'URL changes over time',
      body: 'Counts <strong>url_change</strong> events over time bins. In aggregate mode this is the sum across selected participants; in participant mode it shows one participant only.'
    },
    cartoTaskSummary: {
      title: 'Per-task interactions, zoom, and duration',
      body: 'Bars show interaction count and zoom-related URL transitions per task, while the line shows mean task duration. Use this to identify demanding tasks or tasks with heavy zooming.'
    },
    cartoTaskMaps: {
      title: 'Map usage duration by task',
      body: 'Stacked bars estimate how long each map ID (<strong>id=...</strong> in URL) was active within each task, derived from consecutive <strong>url_change</strong> timestamps.'
    },
    cartoBundleMapping: {
      title: 'Manual bundle mapping CSV format',
      body: 'Use a CSV with exactly these columns: <strong>participant</strong>, <strong>task</strong>, <strong>bundle</strong>.<br/><br/>'
        + 'Rules:<br/>'
        + '1) <strong>participant</strong>: must match participant IDs from the loaded CartoLogger files (e.g., U01).<br/>'
        + '2) <strong>task</strong>: numeric task ID from the CSV (e.g., 0, 1, 2).<br/>'
        + '3) <strong>bundle</strong>: your target assignment label (e.g., B1, Climate-task, Route-A).<br/>'
        + '4) One row = one participant-task pair.<br/>'
        + '5) If a pair is missing, it will appear as <em>Unmapped</em> in grouped views.<br/><br/>'
        + 'Example:<br/><pre style="margin:.35rem 0 0;white-space:pre-wrap">participant,task,bundle\nU01,0,B1\nU01,1,B4\nU02,0,B3\nU02,1,B1</pre>'
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
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
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
    return REQUIRED_COLUMNS.filter(c => !set.has(c));
  }

  async function parseCsvFile(file){
    const text = await file.text();
    return new Promise((resolve)=>{
      const parseErrors = [];
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        transformHeader: h => String(h || '').trim(),
        complete: (res)=>{
          try{
            const missing = validateColumns(res.meta && res.meta.fields);
            if (missing.length) parseErrors.push('Missing columns: ' + missing.join(', '));
            resolve({
              name: file.name,
              size: file.size,
              rows: Array.isArray(res.data) ? res.data : [],
              meta: { parseErrors }
            });
          }catch(_e){
            resolve({ name: file.name, size: file.size, rows: [], meta: { parseErrors: ['Failed to parse CSV.'] } });
          }
        },
        error: (err)=>{
          parseErrors.push(String(err && err.message ? err.message : err));
        }
      });
    });
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

  function mapParamLabel(key){
    const labels = {
      z: 'Zoom level',
      x: 'Center X',
      y: 'Center Y',
      id: 'Map ID',
      p: 'Projection/mode',
      n: 'Base layer',
      d: 'Overlay dataset',
      tl: 'Time layer',
      m: 'Map mode'
    };
    return labels[key] || key;
  }

  function deriveCategoriesAndSummary(prevUrl, currUrl){
    if (!currUrl || !currUrl.raw) return { categories: ['unknown'], summary: 'URL value missing.' };
    if (!prevUrl || !prevUrl.raw){
      return { categories: ['initial_state'], summary: 'Initial URL state captured.' };
    }

    const categories = new Set();
    const changeParts = [];

    if (prevUrl.host !== currUrl.host || prevUrl.path !== currUrl.path){
      categories.add('route');
      changeParts.push('Route changed');
    }

    const keys = new Set();
    for (const k of prevUrl.params.keys()) keys.add(k);
    for (const k of currUrl.params.keys()) keys.add(k);

    const keyDiffs = [];
    for (const k of keys){
      const a = prevUrl.params.has(k) ? prevUrl.params.get(k) : null;
      const b = currUrl.params.has(k) ? currUrl.params.get(k) : null;
      if (a !== b) keyDiffs.push([k, a, b]);
    }

    const hasZoom = keyDiffs.some(d => d[0] === 'z');
    const hasCenter = keyDiffs.some(d => d[0] === 'x' || d[0] === 'y');
    const hasMap = keyDiffs.some(d => d[0] === 'id');
    const hasProjection = keyDiffs.some(d => d[0] === 'p');
    const hasLayers = keyDiffs.some(d => d[0] === 'n' || d[0] === 'd' || d[0] === 'tl' || d[0] === 'm');

    if (hasZoom) categories.add('zoom');
    if (hasCenter) categories.add('center');
    if (hasMap) categories.add('map');
    if (hasProjection) categories.add('projection');
    if (hasLayers) categories.add('layers_or_style');

    for (const [k, oldVal, newVal] of keyDiffs.slice(0, 8)){
      const label = mapParamLabel(k);
      const left = oldVal === null ? '(none)' : String(oldVal);
      const right = newVal === null ? '(none)' : String(newVal);
      changeParts.push(label + ': ' + left + ' → ' + right);
    }

    if (!keyDiffs.length && prevUrl.raw !== currUrl.raw){
      categories.add('url_text_change');
      changeParts.push('URL text changed');
    }

    if (!keyDiffs.length && prevUrl.raw === currUrl.raw){
      categories.add('no_change');
      changeParts.push('No parameter difference');
    }

    if (keyDiffs.some(d => !['z','x','y','id','p','n','d','tl','m'].includes(d[0]))){
      categories.add('other_params');
    }

    return {
      categories: Array.from(categories),
      summary: changeParts.join(' | ')
    };
  }

  function extractMapId(urlString){
    const parsed = tryParseUrl(urlString);
    if (!parsed || !parsed.params) return '(unknown)';
    const mapId = normalizeText(parsed.params.get('id'));
    return mapId || '(unknown)';
  }

  function computeParticipantStats(ds){
    const rows = Array.isArray(ds.rows) ? ds.rows : [];
    const fileId = baseName(ds.name);

    const normalizedRows = rows.map((r, idx)=>{
      const absoluteTime = toNumber(r.absoluteTime);
      const relTime = toNumber(r.time);
      const task = toNumber(r.task);
      const type = normalizeText(r.type);
      const val = normalizeText(r.val);
      const session = normalizeText(r.session) || fileId;
      return {
        idx,
        absoluteTime,
        relTime,
        task,
        type,
        val,
        session,
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
      const key = [r.absoluteTime, r.session, r.task === null ? '' : r.task, r.type, r.val].join('|');
      duplicateKeyCounts.set(key, (duplicateKeyCounts.get(key) || 0) + 1);
    }
    const duplicateRows = Array.from(duplicateKeyCounts.values()).reduce((sum, c)=> sum + (c > 1 ? (c - 1) : 0), 0);

    normalizedRows.sort((a,b)=> (a.absoluteTime - b.absoluteTime) || (a.idx - b.idx));

    const eventCounts = new Map();
    const sessionCounts = new Map();
    for (const r of normalizedRows){
      eventCounts.set(r.type, (eventCounts.get(r.type) || 0) + 1);
      if (r.session) sessionCounts.set(r.session, (sessionCounts.get(r.session) || 0) + 1);
    }

    let participantId = fileId;
    if (sessionCounts.size){
      participantId = Array.from(sessionCounts.entries())
        .sort((a,b)=> (b[1] - a[1]) || a[0].localeCompare(b[0], 'en-GB'))[0][0];
    }

    const urlRows = normalizedRows.filter(r => r.type === 'url_change' && r.val);

    /** @type {any[]} */
    const transitions = [];
    let prevByTask = new Map();

    for (const row of urlRows){
      const taskKey = row.task === null ? '__no_task__' : String(row.task);
      const prev = prevByTask.get(taskKey) || null;

      const prevUrl = prev ? tryParseUrl(prev.val) : null;
      const currUrl = tryParseUrl(row.val);
      const diff = deriveCategoriesAndSummary(prevUrl, currUrl);

      transitions.push({
        participantId,
        task: row.task,
        absoluteTime: row.absoluteTime,
        relTime: row.relTime,
        prevVal: prev ? prev.val : '',
        currentVal: row.val,
        categories: diff.categories,
        summary: diff.summary
      });

      prevByTask.set(taskKey, row);
    }

    const times = normalizedRows.map(r => r.absoluteTime).filter(v => v !== null);
    const minTime = times.length ? Math.min.apply(null, times) : null;
    const maxTime = times.length ? Math.max.apply(null, times) : null;

    return {
      participantId,
      rows: normalizedRows,
      eventCounts,
      urlRows,
      transitions,
      minTime,
      maxTime,
      quality: {
        missingTaskRows: normalizedRows.filter(r => r.task === null).length,
        negativeTaskRows: normalizedRows.filter(r => r.task !== null && r.task < 0).length,
        nonMonotonicTimeInInput,
        duplicateRows
      }
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

  function taskPassesFilter(task, filter){
    if (!filter || !filter.active) return true;
    if (task === null || task === undefined || !Number.isFinite(task)) return false;
    if (filter.min !== null && task < filter.min) return false;
    if (filter.max !== null && task > filter.max) return false;
    return true;
  }

  function filterRowsByTask(rows, filter){
    if (!filter || !filter.active) return (rows || []).slice();
    return (rows || []).filter(r => taskPassesFilter(r.task, filter));
  }

  function filterTransitionsByTask(transitions, filter){
    if (!filter || !filter.active) return (transitions || []).slice();
    return (transitions || []).filter(t => taskPassesFilter(t.task, filter));
  }

  function getFilteredParticipantData(p, filter){
    return {
      rows: filterRowsByTask(p.rows, filter),
      urlRows: filterRowsByTask(p.urlRows, filter),
      transitions: filterTransitionsByTask(p.transitions, filter)
    };
  }

  function pairKey(participantId, task){
    return String(participantId || '') + '|' + (task === null || task === undefined ? '' : String(task));
  }

  async function loadManualBundleMapping(file){
    if (!file) return;
    const text = await file.text();
    const parsed = await new Promise((resolve)=>{
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: h => String(h || '').trim().toLowerCase(),
        complete: (res)=> resolve(res)
      });
    });

    const fields = (parsed && parsed.meta && parsed.meta.fields) ? parsed.meta.fields : [];
    const hasCols = fields.includes('participant') && fields.includes('task') && fields.includes('bundle');
    if (!hasCols){
      warn('Bundle mapping CSV must contain columns: participant, task, bundle.');
      return;
    }

    const map = new Map();
    let rows = 0;
    for (const r of (parsed.data || [])){
      const participant = normalizeText(r.participant);
      const task = toNumber(r.task);
      const bundle = normalizeText(r.bundle);
      if (!participant || task === null || !bundle) continue;
      map.set(pairKey(participant, task), bundle);
      rows += 1;
    }

    manualBundleMap = map;
    manualBundleRows = rows;
    clearWarn();
  }

  function inferAutoBundleMapping(participants, taskFilter){
    const map = new Map();
    const details = new Map();

    for (const p of participants){
      const filtered = getFilteredParticipantData(p, taskFilter);
      const byTask = new Map();

      for (const r of filtered.urlRows || []){
        if (r.task === null || !Number.isFinite(r.task)) continue;
        const k = String(r.task);
        if (!byTask.has(k)) byTask.set(k, new Map());
        const mapId = extractMapId(r.val || '');
        const m = byTask.get(k);
        m.set(mapId, (m.get(mapId) || 0) + 1);
      }

      for (const [taskKey, counts] of byTask.entries()){
        const arr = Array.from(counts.entries()).sort((a,b)=> (b[1]-a[1]) || a[0].localeCompare(b[0], 'en-GB'));
        if (!arr.length) continue;
        const top = arr[0];
        const total = arr.reduce((s,e)=> s + e[1], 0);
        const share = total ? (top[1] / total) : 0;
        const label = 'Bundle map:' + top[0];
        const pk = pairKey(p.participantId, Number(taskKey));
        map.set(pk, label);
        details.set(pk, { dominantMapId: top[0], confidence: share });
      }
    }

    return { map, details };
  }

  function getGroupingConfig(participants, taskFilter){
    const mode = bundleModeEl ? String(bundleModeEl.value || 'off') : 'off';

    if (mode === 'manual'){
      return {
        mode,
        resolve: (participantId, task)=>{
          const key = pairKey(participantId, task);
          const bundle = manualBundleMap.get(key);
          if (bundle) return { key: 'bundle:' + bundle, label: bundle };
          return { key: 'bundle:unmapped', label: 'Unmapped' };
        }
      };
    }

    if (mode === 'auto'){
      const inferred = inferAutoBundleMapping(participants, taskFilter);
      return {
        mode,
        inferred,
        resolve: (participantId, task)=>{
          const key = pairKey(participantId, task);
          const bundle = inferred.map.get(key);
          if (bundle) return { key: 'bundle:' + bundle, label: bundle };
          return { key: 'bundle:unmapped', label: 'Unmapped' };
        }
      };
    }

    return {
      mode: 'off',
      resolve: (_participantId, task)=>{
        if (task === null || task === undefined || !Number.isFinite(task)) return { key: 'task:none', label: 'No task' };
        return { key: 'task:' + task, label: 'Task ' + task };
      }
    };
  }

  function computeTaskStats(participants, selectedId, taskFilter, grouping){
    const pool = getParticipantsForView(participants, selectedId);
    const byGroup = new Map();

    function ensureGroup(groupKey, groupLabel){
      if (!byGroup.has(groupKey)){
        byGroup.set(groupKey, {
          groupKey,
          groupLabel,
          interactions: 0,
          zoomTransitions: 0,
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
      for (const r of filtered.rows || []){
        const g = grouping.resolve(p.participantId, r.task);
        const gk = g.key;
        if (!rowsByGroup.has(gk)) rowsByGroup.set(gk, { label: g.label, rows: [] });
        rowsByGroup.get(gk).rows.push(r);

        if (r.type !== 'projection'){
          const t = ensureGroup(gk, g.label);
          t.interactions += 1;
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
        const t = ensureGroup(groupKey, payload.label || groupKey);
        t.durationSamplesSec.push(durationSec);
      }

      const transitionsByGroup = new Map();
      for (const tr of filtered.transitions || []){
        const g = grouping.resolve(p.participantId, tr.task);
        const gk = g.key;
        if (!transitionsByGroup.has(gk)) transitionsByGroup.set(gk, { label: g.label, rows: [] });
        transitionsByGroup.get(gk).rows.push(tr);

        if ((tr.categories || []).includes('zoom')){
          const t = ensureGroup(gk, g.label);
          t.zoomTransitions += 1;
        }
      }

      for (const [groupKey, payload] of transitionsByGroup.entries()){
        const sorted = (payload.rows || []).slice().sort((a,b)=> (a.absoluteTime - b.absoluteTime));
        const t = ensureGroup(groupKey, payload.label || groupKey);
        for (let i=0;i<sorted.length;i++){
          const curr = sorted[i];
          const next = sorted[i+1] || null;
          const mapId = extractMapId(curr.currentVal);
          const durSec = next ? Math.max(0, (next.absoluteTime - curr.absoluteTime) / 1000) : 0;
          t.mapTransitions.set(mapId, (t.mapTransitions.get(mapId) || 0) + 1);
          t.mapDurationSec.set(mapId, (t.mapDurationSec.get(mapId) || 0) + durSec);
        }
      }
    }

    const tasks = Array.from(byGroup.values())
      .sort((a,b)=> String(a.groupLabel).localeCompare(String(b.groupLabel), 'en-GB', { numeric: true }))
      .map(t => {
        const durs = t.durationSamplesSec.filter(v => Number.isFinite(v));
        const meanDurationSec = durs.length ? (durs.reduce((a,b)=>a+b,0) / durs.length) : null;
        return {
          task: null,
          groupKey: t.groupKey,
          groupLabel: t.groupLabel,
          interactions: t.interactions,
          zoomTransitions: t.zoomTransitions,
          meanDurationSec,
          mapDurationSec: t.mapDurationSec,
          mapTransitions: t.mapTransitions
        };
      });

    return { tasks };
  }

  function computeTaskRecommendation(participants){
    const nParticipants = participants.length;
    const stats = new Map();

    function ensure(task){
      if (!stats.has(task)) stats.set(task, { participants: new Set(), urlRows: 0, transitions: 0 });
      return stats.get(task);
    }

    for (const p of participants){
      const seenTasks = new Set();
      for (const r of p.urlRows || []){
        if (r.task === null || !Number.isFinite(r.task) || r.task < 0) continue;
        ensure(r.task).urlRows += 1;
        seenTasks.add(r.task);
      }
      for (const t of seenTasks) ensure(t).participants.add(p.participantId);
      for (const tr of p.transitions || []){
        if (tr.task === null || !Number.isFinite(tr.task) || tr.task < 0) continue;
        ensure(tr.task).transitions += 1;
      }
    }

    const tasks = Array.from(stats.keys()).sort((a,b)=> a-b);
    if (!tasks.length) return { suggested: null, perTask: [] };

    const minParticipants = Math.max(2, Math.ceil(nParticipants * 0.5));
    const minUrlRows = Math.max(3, Math.ceil(nParticipants * 0.75));

    const perTask = tasks.map(task => {
      const s = stats.get(task);
      const participantCount = s.participants.size;
      const qualifies = participantCount >= minParticipants && s.urlRows >= minUrlRows;
      return { task, participantCount, urlRows: s.urlRows, transitions: s.transitions, qualifies };
    });

    const qualified = perTask.filter(t => t.qualifies).map(t => t.task);
    let suggested = null;

    if (qualified.length){
      let best = null;
      let segStart = qualified[0];
      let prev = qualified[0];
      for (let i=1;i<=qualified.length;i++){
        const t = qualified[i];
        if (t === prev + 1){
          prev = t;
          continue;
        }
        const seg = { min: segStart, max: prev, len: prev - segStart + 1 };
        if (!best || seg.len > best.len || (seg.len === best.len && seg.min < best.min)) best = seg;
        segStart = t;
        prev = t;
      }
      suggested = best ? { min: best.min, max: best.max } : null;
    } else {
      const fallback = perTask.filter(t => t.participantCount >= Math.max(1, Math.ceil(nParticipants * 0.3))).map(t => t.task);
      if (fallback.length) suggested = { min: Math.min.apply(null, fallback), max: Math.max.apply(null, fallback) };
    }

    return { suggested, perTask };
  }

  function computeRandomizationRisk(participants, taskFilter){
    const byTaskParticipantMap = new Map();

    for (const p of participants){
      const filtered = getFilteredParticipantData(p, taskFilter);
      const rowsByTask = new Map();

      for (const r of filtered.urlRows || []){
        if (r.task === null || !Number.isFinite(r.task)) continue;
        const key = String(r.task);
        if (!rowsByTask.has(key)) rowsByTask.set(key, new Map());
        const mapId = extractMapId(r.val || '');
        const m = rowsByTask.get(key);
        m.set(mapId, (m.get(mapId) || 0) + 1);
      }

      for (const [taskKey, mapCounts] of rowsByTask.entries()){
        if (!byTaskParticipantMap.has(taskKey)) byTaskParticipantMap.set(taskKey, []);
        const dominant = Array.from(mapCounts.entries()).sort((a,b)=> (b[1]-a[1]) || a[0].localeCompare(b[0], 'en-GB'))[0];
        if (dominant) byTaskParticipantMap.get(taskKey).push(dominant[0]);
      }
    }

    const perTaskDistinctDominant = [];
    for (const vals of byTaskParticipantMap.values()){
      if (!vals || vals.length < 2) continue;
      perTaskDistinctDominant.push(new Set(vals).size);
    }

    const avgDistinct = perTaskDistinctDominant.length
      ? perTaskDistinctDominant.reduce((a,b)=>a+b,0) / perTaskDistinctDominant.length
      : 1;

    let level = 'LOW';
    if (avgDistinct >= 2.2) level = 'HIGH';
    else if (avgDistinct >= 1.5) level = 'MEDIUM';

    let message = 'Randomization risk (task-ID mismatch): ' + level + '. ';
    if (level === 'HIGH'){
      message += 'Task IDs appear to mix different map patterns across participants. Treat task-based charts as exploratory only.';
    } else if (level === 'MEDIUM'){
      message += 'Some task IDs likely combine multiple actual assignments. Interpret task comparisons with caution.';
    } else {
      message += 'Task IDs look relatively consistent for the current selection, but randomisation can still bias interpretation.';
    }

    return { level, message, avgDistinct, taskCount: byTaskParticipantMap.size };
  }

  function renderQuality(participants){
    if (!qualityEl) return;
    if (!participants.length){
      qualityEl.textContent = 'Load CartoLogger data to see diagnostics and task recommendation.';
      if (applySuggestedRangeBtn) applySuggestedRangeBtn.disabled = true;
      lastSuggestedRange = null;
      return;
    }

    const rec = computeTaskRecommendation(participants);
    const taskFilter = getTaskFilter();
    const risk = computeRandomizationRisk(participants, taskFilter);
    lastSuggestedRange = rec.suggested || null;

    const missingTaskRows = participants.reduce((sum,p)=> sum + (p.quality ? p.quality.missingTaskRows : 0), 0);
    const negativeTaskRows = participants.reduce((sum,p)=> sum + (p.quality ? p.quality.negativeTaskRows : 0), 0);
    const nonMonotonic = participants.reduce((sum,p)=> sum + (p.quality ? p.quality.nonMonotonicTimeInInput : 0), 0);
    const duplicateRows = participants.reduce((sum,p)=> sum + (p.quality ? p.quality.duplicateRows : 0), 0);

    const lines = [];
    lines.push(risk.message);
    if (rec.suggested){
      lines.push('Suggested valid task range: ' + rec.suggested.min + '–' + rec.suggested.max + ' (based on participant coverage and URL-change volume).');
    } else {
      lines.push('Suggested valid task range: not available (insufficient consistent task signal).');
    }
    lines.push('Missing task values: ' + missingTaskRows.toLocaleString('en-GB') + ' rows.');
    lines.push('Negative task values: ' + negativeTaskRows.toLocaleString('en-GB') + ' rows.');
    lines.push('Non-monotonic absoluteTime in input order: ' + nonMonotonic.toLocaleString('en-GB') + ' occurrences.');
    lines.push('Exact duplicate rows (same time/session/task/type/val): ' + duplicateRows.toLocaleString('en-GB') + '.');

    if (rec.perTask && rec.perTask.length){
      const preview = rec.perTask.slice(0, 12).map(t =>
        'task ' + t.task + ': participants=' + t.participantCount + ', url_changes=' + t.urlRows + ', transitions=' + t.transitions + (t.qualifies ? ' [candidate]' : '')
      );
      lines.push('Task signal preview:\n' + preview.join('\n'));
      if (rec.perTask.length > 12) lines.push('... (' + (rec.perTask.length - 12) + ' more task IDs)');
    }

    qualityEl.textContent = lines.join('\n');
    if (applySuggestedRangeBtn) applySuggestedRangeBtn.disabled = !rec.suggested;

    if (taskRandomizationWarningEl){
      const mode = bundleModeEl ? String(bundleModeEl.value || 'off') : 'off';
      const riskText = (mode === 'off')
        ? ((risk.level === 'HIGH')
          ? 'Task-based charts are likely biased by randomisation in the current selection. Prefer cautious interpretation or switch to bundle grouping.'
          : (risk.level === 'MEDIUM')
            ? 'Task-based charts may be partially biased by randomisation. Interpret differences by task ID with caution.'
            : 'Task-based charts appear relatively stable in the current selection, but randomised assignments can still introduce hidden mixing.')
        : ('Bundle grouping is active (' + (mode === 'manual' ? 'manual mapping' : 'auto inferred') + '). This can reduce task-ID randomisation bias, but inferred/grouped assignments should still be validated.');
      taskRandomizationWarningEl.textContent = riskText;
    }
  }

  function renderBundleStatus(participants){
    if (!bundleStatusEl) return;
    const mode = bundleModeEl ? String(bundleModeEl.value || 'off') : 'off';
    const taskFilter = getTaskFilter();

    if (!participants.length){
      bundleStatusEl.textContent = 'Grouping mode: Off (use task IDs).';
      return;
    }

    if (mode === 'manual'){
      if (!manualBundleRows){
        bundleStatusEl.textContent = 'Grouping mode: Manual bundles. No mapping loaded yet. CSV columns must be: participant, task, bundle.';
        return;
      }
      const pairsTotal = participants.reduce((sum, p)=>{
        const filtered = getFilteredParticipantData(p, taskFilter);
        const keys = new Set();
        for (const r of filtered.urlRows || []){
          if (r.task === null || !Number.isFinite(r.task)) continue;
          keys.add(pairKey(p.participantId, r.task));
        }
        return sum + keys.size;
      }, 0);

      let mapped = 0;
      for (const p of participants){
        const filtered = getFilteredParticipantData(p, taskFilter);
        const keys = new Set();
        for (const r of filtered.urlRows || []){
          if (r.task === null || !Number.isFinite(r.task)) continue;
          keys.add(pairKey(p.participantId, r.task));
        }
        for (const k of keys){ if (manualBundleMap.has(k)) mapped += 1; }
      }

      bundleStatusEl.textContent = 'Grouping mode: Manual bundles. Mapping rows loaded: ' + manualBundleRows.toLocaleString('en-GB') + '. Coverage in current selection: ' + mapped.toLocaleString('en-GB') + '/' + pairsTotal.toLocaleString('en-GB') + ' participant-task pairs.';
      return;
    }

    if (mode === 'auto'){
      const inferred = inferAutoBundleMapping(participants, taskFilter);
      const confVals = Array.from(inferred.details.values()).map(v => Number(v.confidence || 0)).filter(v => Number.isFinite(v));
      const meanConf = confVals.length ? (confVals.reduce((a,b)=>a+b,0) / confVals.length) : 0;
      bundleStatusEl.textContent = 'Grouping mode: Auto bundles (experimental). Inferred pairs: ' + inferred.map.size.toLocaleString('en-GB') + '. Mean confidence: ' + niceNumber(meanConf * 100, 1) + '%.';
      return;
    }

    bundleStatusEl.textContent = 'Grouping mode: Off (use task IDs).';
  }

  function renderSummary(participants, selectedId){
    if (!summaryEl) return;
    if (!participants.length){
      summaryEl.innerHTML = '<div class="empty" style="grid-column:1/-1">Add CartoLogger files to see results.</div>';
      return;
    }

    const taskFilter = getTaskFilter();
    const pool = getParticipantsForView(participants, selectedId);
    const totalEvents = pool.reduce((sum, p)=> sum + getFilteredParticipantData(p, taskFilter).rows.length, 0);
    const totalUrlChanges = pool.reduce((sum, p)=> sum + getFilteredParticipantData(p, taskFilter).urlRows.length, 0);
    const totalTransitions = pool.reduce((sum, p)=> sum + getFilteredParticipantData(p, taskFilter).transitions.length, 0);

    const uniqueTasks = new Set();
    for (const p of pool){
      const filtered = getFilteredParticipantData(p, taskFilter);
      for (const r of filtered.urlRows){
        if (r.task !== null) uniqueTasks.add(r.task);
      }
    }

    const grouping = getGroupingConfig(participants, taskFilter);
    const taskStats = computeTaskStats(participants, selectedId, taskFilter, grouping);
    const tasks = taskStats.tasks || [];

    const mostInteractions = tasks.slice().sort((a,b)=> b.interactions - a.interactions)[0] || null;
    const mostZoom = tasks.slice().sort((a,b)=> b.zoomTransitions - a.zoomTransitions)[0] || null;
    const durationTasks = tasks.filter(t => Number.isFinite(t.meanDurationSec));
    const fastest = durationTasks.slice().sort((a,b)=> a.meanDurationSec - b.meanDurationSec)[0] || null;
    const slowest = durationTasks.slice().sort((a,b)=> b.meanDurationSec - a.meanDurationSec)[0] || null;

    function groupLabel(item){ return item && item.groupLabel ? item.groupLabel : 'No group'; }

    const groupingLabel = grouping.mode === 'manual'
      ? 'Manual bundles'
      : (grouping.mode === 'auto' ? 'Auto bundles' : 'Task IDs');

    const cards = [
      { k: 'Participants', v: String(pool.length), s: selectedId === '__aggregate__' ? 'All loaded participants' : 'Filtered participant' },
      { k: 'Task filter', v: taskFilter.active ? ((taskFilter.min !== null ? taskFilter.min : 'min') + '–' + (taskFilter.max !== null ? taskFilter.max : 'max')) : 'All tasks', s: taskFilter.active ? 'Inclusive range' : 'No task filtering' },
      { k: 'Grouping mode', v: groupingLabel, s: grouping.mode === 'off' ? 'Charts grouped by task ID' : 'Charts grouped by bundle assignment' },
      { k: 'Events (all types)', v: totalEvents.toLocaleString('en-GB'), s: 'Across uploaded CartoLogger rows' },
      { k: 'URL change events', v: totalUrlChanges.toLocaleString('en-GB'), s: 'Rows where type = url_change' },
      { k: 'URL transitions analysed', v: totalTransitions.toLocaleString('en-GB'), s: 'Each url_change compared to previous url_change within the same task' },
      { k: 'Task IDs detected', v: String(uniqueTasks.size), s: 'Based on the task column in url_change rows' },
      { k: 'Most interactions', v: mostInteractions ? groupLabel(mostInteractions) : '–', s: mostInteractions ? (mostInteractions.interactions.toLocaleString('en-GB') + ' interactions') : 'No grouped data' },
      { k: 'Most zoom transitions', v: mostZoom ? groupLabel(mostZoom) : '–', s: mostZoom ? (mostZoom.zoomTransitions.toLocaleString('en-GB') + ' URL transitions with zoom changes') : 'No zoom transitions' },
      { k: 'Fastest group (mean)', v: fastest ? groupLabel(fastest) : '–', s: fastest ? (niceNumber(fastest.meanDurationSec, 1) + ' s') : 'No duration data' },
      { k: 'Slowest group (mean)', v: slowest ? groupLabel(slowest) : '–', s: slowest ? (niceNumber(slowest.meanDurationSec, 1) + ' s') : 'No duration data' }
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
      for (const tr of filtered.transitions){
        for (const c of tr.categories || []) counts.set(c, (counts.get(c) || 0) + 1);
      }
    }

    const entries = Array.from(counts.entries()).sort((a,b)=> b[1]-a[1]);

    destroyChart(charts.urlCategories);
    charts.urlCategories = new Chart(chartCategoriesCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: entries.map(e => e[0]),
        datasets: [{
          label: 'Transitions',
          data: entries.map(e => e[1]),
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
      if (!filtered.urlRows.length) continue;
      const rows = filtered.urlRows.slice().sort((a,b)=> a.absoluteTime - b.absoluteTime);
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
          y: { beginAtZero: true, title: { display: true, text: 'URL changes per bin' } },
          x: { title: { display: true, text: 'Time since first URL change' } }
        }
      }
    });
  }

  function buildTaskSummaryChart(participants, selectedId){
    if (!chartTaskSummaryCanvas || !window.Chart) return;
    const taskFilter = getTaskFilter();
    const grouping = getGroupingConfig(participants, taskFilter);
    const taskStats = computeTaskStats(participants, selectedId, taskFilter, grouping);
    const tasks = taskStats.tasks || [];

    if (!tasks.length){
      destroyChart(charts.taskSummary);
      charts.taskSummary = null;
      return;
    }

    const labels = tasks.map(t => t.groupLabel || 'No group');
    const interactions = tasks.map(t => t.interactions || 0);
    const zoomTransitions = tasks.map(t => t.zoomTransitions || 0);
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
            label: 'Zoom transitions',
            data: zoomTransitions,
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
            borderColor: 'rgba(220,38,38,.9)',
            backgroundColor: 'rgba(220,38,38,.15)',
            tension: 0.25,
            pointRadius: 2
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
    const grouping = getGroupingConfig(participants, taskFilter);
    const taskStats = computeTaskStats(participants, selectedId, taskFilter, grouping);
    const tasks = taskStats.tasks || [];

    if (!tasks.length){
      destroyChart(charts.taskMaps);
      charts.taskMaps = null;
      return;
    }

    const labels = tasks.map(t => t.groupLabel || 'No group');

    const totalsByMap = new Map();
    for (const t of tasks){
      for (const [mapId, sec] of t.mapDurationSec.entries()){
        totalsByMap.set(mapId, (totalsByMap.get(mapId) || 0) + sec);
      }
    }

    const topMapIds = Array.from(totalsByMap.entries())
      .sort((a,b)=> b[1] - a[1])
      .slice(0, 6)
      .map(e => e[0]);

    if (!topMapIds.length){
      destroyChart(charts.taskMaps);
      charts.taskMaps = null;
      return;
    }

    const palette = [
      ['rgba(37,99,235,.20)','rgba(37,99,235,.85)'],
      ['rgba(16,163,74,.20)','rgba(16,163,74,.85)'],
      ['rgba(220,38,38,.18)','rgba(220,38,38,.85)'],
      ['rgba(124,58,237,.18)','rgba(124,58,237,.85)'],
      ['rgba(245,158,11,.20)','rgba(245,158,11,.90)'],
      ['rgba(14,165,233,.20)','rgba(14,165,233,.90)'],
      ['rgba(100,116,139,.24)','rgba(100,116,139,.95)']
    ];

    const datasets = topMapIds.map((mapId, idx)=>{
      const colors = palette[idx % palette.length];
      return {
        label: mapId,
        data: tasks.map(t => t.mapDurationSec.get(mapId) || 0),
        backgroundColor: colors[0],
        borderColor: colors[1],
        borderWidth: 1,
        stack: 'maps'
      };
    });

    const otherData = tasks.map(t => {
      let other = 0;
      for (const [mapId, sec] of t.mapDurationSec.entries()){
        if (!topMapIds.includes(mapId)) other += sec;
      }
      return other;
    });
    if (otherData.some(v => v > 0)){
      const colors = palette[palette.length - 1];
      datasets.push({
        label: 'Other',
        data: otherData,
        backgroundColor: colors[0],
        borderColor: colors[1],
        borderWidth: 1,
        stack: 'maps'
      });
    }

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

  function fmtAbsTime(ms){
    if (!Number.isFinite(ms)) return '–';
    try{ return new Date(ms).toLocaleString('en-GB'); }
    catch(_e){ return String(ms); }
  }

  function renderUrlCell(url, maxLen){
    const raw = normalizeText(url);
    if (!raw) return '–';
    const parsed = tryParseUrl(raw);
    const label = esc(truncate(raw, maxLen || 100));
    if (!parsed) return label;
    return '<a class="url-link-plain" href="' + esc(raw) + '" target="_blank" rel="noopener noreferrer" title="' + esc(raw) + '">' + label + '</a>';
  }

  function enableDragScroll(container){
    if (!container || container.__dragScrollBound) return;
    container.__dragScrollBound = true;
    container.classList.add('draggable');

    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;

    container.addEventListener('mousedown', (e)=>{
      if (e.button !== 0) return;
      isDragging = true;
      startX = e.clientX;
      startScrollLeft = container.scrollLeft;
      container.classList.add('dragging');
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e)=>{
      if (!isDragging) return;
      const dx = e.clientX - startX;
      container.scrollLeft = startScrollLeft - dx;
    });

    function stopDragging(){
      if (!isDragging) return;
      isDragging = false;
      container.classList.remove('dragging');
    }

    window.addEventListener('mouseup', stopDragging);
    container.addEventListener('mouseleave', stopDragging);
  }

  function renderTransitionsTable(participants, selectedId){
    if (!transitionsEl) return;
    const taskFilter = getTaskFilter();
    const grouping = getGroupingConfig(participants, taskFilter);
    const pool = getParticipantsForView(participants, selectedId);

    const all = [];
    for (const p of pool){
      const filtered = getFilteredParticipantData(p, taskFilter);
      for (const t of filtered.transitions) all.push(t);
    }
    all.sort((a,b)=> (String(a.participantId).localeCompare(String(b.participantId), 'en-GB', { numeric: true })) || (a.absoluteTime - b.absoluteTime));

    if (!all.length){
      transitionsEl.innerHTML = '<div class="empty">No url_change transitions available in the current selection.</div>';
      return;
    }

    const html = [
      '<div class="table-scroll"><table class="table" aria-label="CartoLogger URL transition table">',
      '<thead><tr>',
      '<th>Participant</th>',
      '<th>Task</th>',
      '<th>Group</th>',
      '<th>Absolute time</th>',
      '<th>Categories</th>',
      '<th>Change summary</th>',
      '<th>Previous URL</th>',
      '<th>Current URL (val)</th>',
      '</tr></thead>',
      '<tbody>',
      all.map(r =>
        '<tr>'
        + '<td>' + esc(r.participantId) + '</td>'
        + '<td>' + esc(r.task === null ? '–' : String(r.task)) + '</td>'
        + '<td>' + esc((grouping.resolve(r.participantId, r.task) || {}).label || '–') + '</td>'
        + '<td>' + esc(fmtAbsTime(r.absoluteTime)) + '</td>'
        + '<td>' + esc((r.categories || []).join(', ')) + '</td>'
        + '<td>' + esc(truncate(r.summary, 180)) + '</td>'
        + '<td>' + renderUrlCell(r.prevVal || '', 95) + '</td>'
        + '<td>' + renderUrlCell(r.currentVal || '', 110) + '</td>'
        + '</tr>'
      ).join(''),
      '</tbody></table></div>'
    ].join('');

    transitionsEl.innerHTML = html;
    const scrollWrap = transitionsEl.querySelector('.table-scroll');
    if (scrollWrap) enableDragScroll(scrollWrap);
  }

  function rebuildAll(){
    clearWarn();

    const participants = datasets
      .filter(d => Array.isArray(d.rows) && d.rows.length)
      .map(computeParticipantStats);

    rebuildParticipantSelect(participants);

    const selectedId = participantSelectEl ? participantSelectEl.value : '__aggregate__';
    const binSizeSec = Number(binSizeEl && binSizeEl.value) || 10;

    renderSummary(participants, selectedId);
    renderQuality(participants);
    renderBundleStatus(participants);

    if (!participants.length){
      destroyChart(charts.eventTypes);
      destroyChart(charts.urlCategories);
      destroyChart(charts.timeline);
      destroyChart(charts.taskSummary);
      destroyChart(charts.taskMaps);
      charts.eventTypes = null;
      charts.urlCategories = null;
      charts.timeline = null;
      charts.taskSummary = null;
      charts.taskMaps = null;
      renderTransitionsTable([], selectedId);
      return;
    }

    buildEventTypesChart(participants, selectedId);
    buildUrlCategoriesChart(participants, selectedId);
    buildTimelineChart(participants, selectedId, binSizeSec);
    buildTaskSummaryChart(participants, selectedId);
    buildTaskMapsChart(participants, selectedId);
    renderTransitionsTable(participants, selectedId);

    const warnings = datasets.flatMap(d => (d.meta && d.meta.parseErrors ? d.meta.parseErrors.map(e => d.name + ': ' + e) : []));
    if (warnings.length) warn(warnings.slice(0, 6).join('\n'));
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
          const parsed = await new Promise((resolve)=>{
            const parseErrors = [];
            Papa.parse(text, {
              header: true,
              skipEmptyLines: true,
              transformHeader: h => String(h || '').trim(),
              complete: (r)=>{
                const missing = validateColumns(r.meta && r.meta.fields);
                if (missing.length) parseErrors.push('Missing columns: ' + missing.join(', '));
                resolve({ name, size: text.length, rows: Array.isArray(r.data) ? r.data : [], meta: { parseErrors } });
              }
            });
          });
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

    if (bundleModeEl) bundleModeEl.addEventListener('change', rebuildAll);
    if (bundleFileEl){
      bundleFileEl.addEventListener('change', async (e)=>{
        const file = e.target && e.target.files ? e.target.files[0] : null;
        if (file){
          await loadManualBundleMapping(file);
          rebuildAll();
        }
        bundleFileEl.value = '';
      });
    }
    if (bundleClearBtn){
      bundleClearBtn.addEventListener('click', ()=>{
        manualBundleMap = new Map();
        manualBundleRows = 0;
        if (bundleFileEl) bundleFileEl.value = '';
        rebuildAll();
      });
    }

    if (participantSelectEl) participantSelectEl.addEventListener('change', rebuildAll);
    if (binSizeEl) binSizeEl.addEventListener('change', rebuildAll);
    if (taskMinEl) taskMinEl.addEventListener('input', rebuildAll);
    if (taskMaxEl) taskMaxEl.addEventListener('input', rebuildAll);
    if (taskResetBtn){
      taskResetBtn.addEventListener('click', ()=>{
        if (taskMinEl) taskMinEl.value = '';
        if (taskMaxEl) taskMaxEl.value = '';
        rebuildAll();
      });
    }

    if (applySuggestedRangeBtn){
      applySuggestedRangeBtn.addEventListener('click', ()=>{
        if (!lastSuggestedRange) return;
        if (taskMinEl) taskMinEl.value = String(lastSuggestedRange.min);
        if (taskMaxEl) taskMaxEl.value = String(lastSuggestedRange.max);
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
