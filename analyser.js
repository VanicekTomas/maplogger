(function(){
  const input = document.getElementById('csv-input');
  const dropzone = document.getElementById('csv-dropzone');
  const listEl = document.getElementById('csv-list');
  const countEl = document.getElementById('csv-count');
  const totalSizeEl = document.getElementById('csv-total-size');
  const clearBtn = document.getElementById('csv-clear');
  const exportBtn = document.getElementById('csv-export');
  const sampleBtn = document.getElementById('csv-load-sample');
  const warningsEl = document.getElementById('csv-warnings');

  const binSizeEl = document.getElementById('bin-size');
  const timelineAggEl = document.getElementById('timeline-agg');
  const exportScaleEl = document.getElementById('export-scale');
  const participantSelectEl = document.getElementById('participant-select');
  const includeMetaEl = document.getElementById('include-meta');

  const summaryEl = document.getElementById('summary');
  const tablesEl = document.getElementById('tables');

  const evtFilterEls = Array.from(document.querySelectorAll('input.evt-filter'));

  const chartEventTypesCanvas = document.getElementById('chart-event-types');
  const chartPerParticipantCanvas = document.getElementById('chart-per-participant');
  const chartTimelineCanvas = document.getElementById('chart-timeline');
  const chartTasksCanvas = document.getElementById('chart-tasks');
  const chartTaskProfilesCanvas = document.getElementById('chart-task-profiles');
  const chartTaskSharesCanvas = document.getElementById('chart-task-shares');
  const chartTaskSharesFallbackEl = document.getElementById('chart-task-shares-fallback');

  const ternaryCanvas = document.getElementById('ternary-canvas');
  const ternaryTaskEl = document.getElementById('ternary-task');
  const ternaryAEl = document.getElementById('ternary-a');
  const ternaryBEl = document.getElementById('ternary-b');
  const ternaryCEl = document.getElementById('ternary-c');
  const ternaryFallbackEl = document.getElementById('ternary-fallback');

  const chartElementTagCanvas = document.getElementById('chart-element-tag');
  const chartElementIdCanvas = document.getElementById('chart-element-id');
  const chartElementTextCanvas = document.getElementById('chart-element-text');
  const chartMouseButtonCanvas = document.getElementById('chart-mouse-button');
  const chartZoomDirectionCanvas = document.getElementById('chart-zoom-direction');
  const chartKeyCanvas = document.getElementById('chart-key');
  const chartCodeCanvas = document.getElementById('chart-code');
  const chartModifiersCanvas = document.getElementById('chart-modifiers');
  const chartEventTimelineCanvas = document.getElementById('chart-event-timeline');

  const heatmapViewportEl = document.getElementById('heatmap-viewport');
  const heatmapOpacityEl = document.getElementById('heatmap-opacity');
  const heatmapBgEl = document.getElementById('heatmap-bg');
  const heatmapClearBgBtn = document.getElementById('heatmap-clear-bg');
  const heatmapCanvas = document.getElementById('heatmap-canvas');
  const heatmapNoteEl = document.getElementById('heatmap-note');

  const interpretationTextEl = document.getElementById('interpretation-text');
  const interpretationCopyBtn = document.getElementById('interpretation-copy');
  const interpretationDownloadBtn = document.getElementById('interpretation-download');

  const infoModalEl = document.getElementById('info-modal');
  const infoModalTitleEl = document.getElementById('info-modal-title');
  const infoModalBodyEl = document.getElementById('info-modal-body');
  const infoModalCloseBtn = document.getElementById('info-modal-close');

  /** @type {{name:string,size:number,rows:any[],meta:{parseErrors:string[]}}[]} */
  let datasets = [];

  let lastComputed = {
    participants: /** @type {any[]} */([]),
    agg: null,
    selectedParticipant: '__aggregate__',
    selectedEvents: new Set(),
    includeMeta: false,
    binSizeSec: 10
  };

  let charts = {
    eventTypes: null,
    perParticipant: null,
    timeline: null,
    tasks: null,
    taskProfiles: null,
    taskShares: null,
    elementTag: null,
    elementId: null,
    elementText: null,
    mouseButton: null,
    zoomDirection: null,
    key: null,
    code: null,
    modifiers: null,
    eventTimeline: null
  };

  const EXPORT_DPI = 300;
  const SCREEN_DPI = 96;
  const EXPORT_SCALE = EXPORT_DPI / SCREEN_DPI;
  const EXPORT_MARGIN_PX = 20;

  function getExportPreset(){
    const mode = exportScaleEl ? String(exportScaleEl.value || '').trim() : '';
    if (mode === 'print'){
      return { mode: 'print', scale: EXPORT_SCALE, suffix: '_300dpi', marginPx: EXPORT_MARGIN_PX };
    }
    return { mode: 'screen', scale: 1, suffix: '_screen', marginPx: EXPORT_MARGIN_PX };
  }

  function scaleFont(fontObj, scale){
    if (!fontObj || typeof fontObj !== 'object') return;
    if (typeof fontObj.size === 'number' && Number.isFinite(fontObj.size)) fontObj.size = fontObj.size * scale;
  }

  function scaleChartConfigForExport(cfg, scale){
    try{
      if (!cfg || !cfg.options) return;
      const o = cfg.options;

      scaleFont(o.font, scale);

      if (o.plugins){
        if (o.plugins.legend && o.plugins.legend.labels) scaleFont(o.plugins.legend.labels.font, scale);
        if (o.plugins.title) scaleFont(o.plugins.title.font, scale);
        if (o.plugins.tooltip){
          scaleFont(o.plugins.tooltip.titleFont, scale);
          scaleFont(o.plugins.tooltip.bodyFont, scale);
          scaleFont(o.plugins.tooltip.footerFont, scale);
        }
      }

      if (o.scales && typeof o.scales === 'object'){
        for (const k of Object.keys(o.scales)){
          const s = o.scales[k];
          if (!s) continue;
          if (s.ticks) scaleFont(s.ticks.font, scale);
          if (s.title) scaleFont(s.title.font, scale);
        }
      }

      if (o.elements){
        if (o.elements.line && typeof o.elements.line.borderWidth === 'number') o.elements.line.borderWidth *= scale;
        if (o.elements.bar && typeof o.elements.bar.borderWidth === 'number') o.elements.bar.borderWidth *= scale;
        if (o.elements.point){
          if (typeof o.elements.point.radius === 'number') o.elements.point.radius *= scale;
          if (typeof o.elements.point.hoverRadius === 'number') o.elements.point.hoverRadius *= scale;
          if (typeof o.elements.point.borderWidth === 'number') o.elements.point.borderWidth *= scale;
        }
      }

      if (cfg.data && Array.isArray(cfg.data.datasets)){
        for (const ds of cfg.data.datasets){
          if (!ds || typeof ds !== 'object') continue;
          if (typeof ds.borderWidth === 'number') ds.borderWidth *= scale;
          if (typeof ds.pointRadius === 'number') ds.pointRadius *= scale;
          if (typeof ds.pointHoverRadius === 'number') ds.pointHoverRadius *= scale;
        }
      }
    }catch(e){
      // best-effort only
    }
  }

  const heatmapState = {
    viewportKey: '',
    opacity: 0.85,
    bgUrl: '',
    bgImage: null
  };

  const ternaryState = {
    taskIndex: null,
    a: 'click',
    b: 'wheel',
    c: 'keydown'
  };

  const REQUIRED_COLUMNS = [
    'session_id','timestamp_ms_since_start','iso_time','task_index','task_label','event_type'
  ];

  const META_EVENTS = new Set(['session_start','session_page','visibility','resize','focus','blur','end_clicked','session_end','task_next','task_start','task_end']);

  const HELP_CONTENT = {
    eventTypes: {
      title: 'Event types',
      body: 'Shows how often each <strong>event_type</strong> occurs in the loaded logs. Use it to identify dominant interaction modes (e.g., many <em>wheel</em> events indicate intensive zooming/panning; many <em>keydown</em> events suggest keyboard-driven input).'
    },
    perParticipant: {
      title: 'Total interactions per participant',
      body: 'Compares overall interaction volume between participants. Large differences can indicate different strategies, task difficulty for some participants, or outliers caused by technical issues (e.g., repeated mis-clicks).'
    },
    timeline: {
      title: 'Interactions over time',
      body: 'Counts interaction events per time bin (e.g., every 10 seconds) since the first event. Peaks may indicate moments of intensive exploration; low-activity periods can indicate reading, thinking, or waiting. Use the aggregation switch to compare <em>sum</em> vs <em>mean per participant</em>.'
    },
    tasks: {
      title: 'Per-task interactions and duration',
      body: 'Summarises mean interaction counts per task (bars) and mean task duration (line). High interaction counts combined with long durations typically indicate higher task complexity or interface friction. Note: task durations are derived from <strong>iso_time</strong> as the time span between the first and last recorded row for the given <strong>task_index</strong> (within the selected contiguous session segment).'
    },
    taskProfiles: {
      title: 'Task-specific interaction profiles (proportional)',
      body: 'Shows the relative <strong>composition</strong> of interaction types for each task. For each task we count interaction events (using the currently selected event filters), then normalise within that task so every bar sums to 100%. This enables direct comparison of interaction strategies across tasks.'
    },
    taskShares: {
      title: 'Per-task interaction type shares (boxplots)',
      body: 'For each participant and task, we compute how the participant\'s actions split across interaction types (e.g., click vs wheel vs keydown). Each boxplot summarises the <strong>share</strong> of a given interaction type within the task (0–100%) across participants. Use it to compare strategies and variability between tasks.'
    },
    elementTag: {
      title: 'Element tag (top)',
      body: 'Top element tags involved in interaction events (e.g., <em>button</em>, <em>input</em>, <em>canvas</em>). Useful to distinguish between UI control use vs map canvas interaction.'
    },
    elementId: {
      title: 'Element id (top)',
      body: 'Top element IDs targeted by interactions. This helps you pinpoint specific UI components that were used frequently (or caused repeated attempts).'
    },
    elementText: {
      title: 'Element text (top)',
      body: 'Top text labels of interacted elements (when available). This is helpful for interpreting which labelled controls were used. Text is normalised and truncated to avoid overly long labels.'
    },
    mouseButton: {
      title: 'Mouse button',
      body: 'Counts interactions by mouse button (left/middle/right). Right-clicks are often associated with context menus; middle clicks may indicate special map navigation patterns depending on the application.'
    },
    zoomDirection: {
      title: 'Wheel zoom direction',
      body: 'Estimates zoom direction (in/out) based on <strong>zoom_hint</strong> and/or <strong>wheel_direction</strong>. A strong imbalance towards zoom-in may indicate search/exploration; frequent zoom-out may reflect re-orientation or loss of context.'
    },
    key: {
      title: 'Key (top)',
      body: 'Most frequent keyboard keys used (from the <strong>key</strong> column). Useful for detecting patterns such as many <em>Enter</em>/<em>Escape</em> presses or heavy use of arrow keys.'
    },
    code: {
      title: 'Code (top)',
      body: 'Most frequent physical key codes (from the <strong>code</strong> column). Compared to <em>key</em>, this can be more stable across keyboard layouts.'
    },
    modifiers: {
      title: 'Modifier keys (Ctrl / Alt / Shift)',
      body: 'Counts how often modifier keys were held during events. Frequent Ctrl/Shift usage may indicate advanced interactions (e.g., multi-select, special map gestures, shortcuts), depending on the tested interface.'
    },
    eventTimeline: {
      title: 'Event timeline (participant)',
      body: 'A chronological view of what happened over time for a single participant. Each point is an event; the y-axis groups events by type (with additional detail such as zoom in/out or key pressed shown in the tooltip). Use it to reconstruct strategies and detect critical moments.'
    },
    heatmap: {
      title: 'Heatmap',
      body: 'Shows where participants interacted most based on pointer coordinates (<strong>x</strong>, <strong>y</strong>) within a given viewport size (<strong>viewport_w</strong>, <strong>viewport_h</strong>). Overlay a screenshot to interpret hotspots in the context of the UI.'
    },
    interpretation: {
      title: 'Interpretation (copy-ready)',
      body: 'Generates a short narrative summary based on the currently displayed data, intended to be pasted into a report. Always review and adjust phrasing to match your study design and reporting style.'
    },
    ternary: {
      title: 'Ternary interaction strategy (per task)',
      body: 'Shows each participant as a point in a ternary (triangle) diagram for the selected task. The point position represents the <strong>relative mix</strong> of the three selected interaction types (A/B/C) within that task. Use it to compare strategies (e.g., click‑dominant vs wheel‑dominant) and to inspect clusters or outliers. If enabled, colours approximate device category derived from the user agent string (from <strong>extra_json.ua</strong> on session start/page events).'
    }
  };

  // If there is a long idle gap, treat it as a new session segment.
  // This prevents unrealistic durations when a participant resumes days later (localStorage persistence).
  const SEGMENT_GAP_SECONDS = 10 * 60; // 10 minutes

  function esc(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  }

  function formatBytes(n){
    const units = ['B','KB','MB','GB'];
    let i=0, x=Number(n)||0;
    while (x>=1024 && i<units.length-1){ x/=1024; i++; }
    return (i===0? x.toString(): x.toFixed(1)) + ' ' + units[i];
  }

  function baseName(path){
    const s = String(path||'');
    const just = s.split(/[/\\]/).pop() || s;
    return just.replace(/\.csv$/i,'');
  }

  function toNumber(v){
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function parseJsonLoose(s){
    if (!s) return null;
    if (typeof s !== 'string') return null;
    const t = s.trim();
    if (!t) return null;
    try{ return JSON.parse(t); }catch(e){ return null; }
  }

  function parseIsoMs(iso){
    if (!iso) return null;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : null;
  }

  function quantile(sorted, q){
    if (!sorted.length) return null;
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base+1] === undefined) return sorted[base];
    return sorted[base] + rest * (sorted[base+1] - sorted[base]);
  }

  function mean(nums){
    const arr = nums.filter(n => Number.isFinite(n));
    if (!arr.length) return null;
    return arr.reduce((a,b)=>a+b,0) / arr.length;
  }

  function stdev(nums){
    const arr = nums.filter(n => Number.isFinite(n));
    if (arr.length < 2) return null;
    const m = mean(arr);
    const v = arr.reduce((acc,x)=> acc + Math.pow(x - m, 2), 0) / (arr.length - 1);
    return Math.sqrt(v);
  }

  function median(nums){
    const arr = nums.filter(n => Number.isFinite(n)).slice().sort((a,b)=>a-b);
    return quantile(arr, 0.5);
  }

  function niceNumber(n, digits=2){
    if (n === null || n === undefined || !Number.isFinite(n)) return '–';
    const abs = Math.abs(n);
    if (abs >= 1000) return Math.round(n).toLocaleString('en-GB');
    if (abs >= 100) return n.toFixed(0);
    if (abs >= 10) return n.toFixed(1);
    return n.toFixed(digits);
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

  function toBool(v){
    if (v === true) return true;
    if (v === false) return false;
    if (v === 1) return true;
    if (v === 0) return false;
    const s = String(v || '').trim().toLowerCase();
    if (!s) return false;
    return s === 'true' || s === '1' || s === 'yes' || s === 'y';
  }

  function topNWithOther(entries, topN){
    const arr = (entries || []).slice().sort((a,b)=> (b[1]-a[1]) || String(a[0]).localeCompare(String(b[0]), 'en-GB'));
    const head = arr.slice(0, topN);
    const rest = arr.slice(topN);
    if (rest.length){
      const other = rest.reduce((sum, e)=> sum + (e[1] || 0), 0);
      if (other > 0) head.push(['Other', other]);
    }
    return head;
  }

  function cloneDeepPreserveFunctions(obj){
    if (obj === null || obj === undefined) return obj;
    const t = typeof obj;
    if (t !== 'object') return obj; // includes functions
    if (Array.isArray(obj)) return obj.map(cloneDeepPreserveFunctions);
    const out = {};
    for (const k of Object.keys(obj)) out[k] = cloneDeepPreserveFunctions(obj[k]);
    return out;
  }

  function warn(message){
    if (!warningsEl) return;
    warningsEl.classList.remove('hidden');
    warningsEl.innerHTML = esc(message);
  }

  function clearWarn(){
    if (!warningsEl) return;
    warningsEl.classList.add('hidden');
    warningsEl.textContent = '';
  }

  function openInfoModal(helpKey){
    if (!infoModalEl || !infoModalTitleEl || !infoModalBodyEl) return;
    const item = HELP_CONTENT[helpKey] || { title: 'Info', body: 'No help text is available for this item.' };
    infoModalTitleEl.textContent = item.title || 'Info';
    infoModalBodyEl.innerHTML = item.body || '';
    infoModalEl.classList.remove('hidden');
    try{ infoModalCloseBtn && infoModalCloseBtn.focus(); }catch(e){}
  }

  function closeInfoModal(){
    if (!infoModalEl) return;
    infoModalEl.classList.add('hidden');
  }

  function setTaskSharesFallback(message){
    if (!chartTaskSharesFallbackEl) return;
    const msg = (message === null || message === undefined) ? '' : String(message);
    if (!msg.trim()){
      chartTaskSharesFallbackEl.classList.add('hidden');
      chartTaskSharesFallbackEl.textContent = '';
      return;
    }
    chartTaskSharesFallbackEl.classList.remove('hidden');
    chartTaskSharesFallbackEl.textContent = msg;
  }

  function setTernaryFallback(message){
    if (!ternaryFallbackEl) return;
    const msg = (message === null || message === undefined) ? '' : String(message);
    if (!msg.trim()){
      ternaryFallbackEl.classList.add('hidden');
      ternaryFallbackEl.textContent = '';
      return;
    }
    ternaryFallbackEl.classList.remove('hidden');
    ternaryFallbackEl.textContent = msg;
  }

  function updateTernaryStateFromUi(){
    if (ternaryTaskEl){
      const n = toNumber(ternaryTaskEl.value);
      if (n !== null) ternaryState.taskIndex = n;
    }
    if (ternaryAEl) ternaryState.a = String(ternaryAEl.value || '').trim() || 'click';
    if (ternaryBEl) ternaryState.b = String(ternaryBEl.value || '').trim() || 'wheel';
    if (ternaryCEl) ternaryState.c = String(ternaryCEl.value || '').trim() || 'keydown';
  }

  function ensureTernaryTaskOptions(agg){
    if (!ternaryTaskEl) return;
    const keys = Array.from((agg && agg.sumTaskCounts ? agg.sumTaskCounts.keys() : [])).filter(k => Number.isFinite(k)).sort((a,b)=>a-b);
    const prev = ternaryTaskEl.value;
    const opts = keys.map(k => {
      const text = 'Task ' + k;
      return '<option value="' + esc(String(k)) + '">' + esc(text) + '</option>';
    });
    ternaryTaskEl.innerHTML = opts.join('');

    if (prev){
      try{ ternaryTaskEl.value = prev; }catch(e){}
    }

    if (!ternaryTaskEl.value && keys.length) ternaryTaskEl.value = String(keys[0]);
    const n = toNumber(ternaryTaskEl.value);
    if (n !== null) ternaryState.taskIndex = n;
  }

  function setupCanvas2dHiDpi(canvas){
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(rect.width || 0));
    const cssH = Math.max(1, Math.round(rect.height || 0));
    const dpr = window.devicePixelRatio || 1;
    const pxW = Math.max(1, Math.round(cssW * dpr));
    const pxH = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== pxW) canvas.width = pxW;
    if (canvas.height !== pxH) canvas.height = pxH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, cssW, cssH };
  }

  function baryToXY(a, b, c, A, B, C){
    return {
      x: a * A.x + b * B.x + c * C.x,
      y: a * A.y + b * B.y + c * C.y
    };
  }

  function buildTernaryPlot(participants, agg, selectedParticipant){
    if (!ternaryCanvas) return;
    setTernaryFallback('');

    ensureTernaryTaskOptions(agg);
    updateTernaryStateFromUi();

    const aType = String(ternaryState.a || '').trim();
    const bType = String(ternaryState.b || '').trim();
    const cType = String(ternaryState.c || '').trim();
    const unique = new Set([aType,bType,cType].filter(Boolean));
    if (unique.size !== 3){
      setTernaryFallback('Please select three different interaction types (A/B/C).');
      const ctx = ternaryCanvas.getContext('2d');
      if (ctx) ctx.clearRect(0,0,ternaryCanvas.width,ternaryCanvas.height);
      return;
    }

    const taskIndex = (ternaryState.taskIndex !== null) ? ternaryState.taskIndex : null;
    if (taskIndex === null){
      setTernaryFallback('No tasks detected in the uploaded logs.');
      const ctx = ternaryCanvas.getContext('2d');
      if (ctx) ctx.clearRect(0,0,ternaryCanvas.width,ternaryCanvas.height);
      return;
    }

    const canvasInfo = setupCanvas2dHiDpi(ternaryCanvas);
    if (!canvasInfo) return;
    const { ctx, cssW: W, cssH: H } = canvasInfo;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Triangle geometry
    const margin = 28;
    const maxW = Math.max(50, W - margin * 2);
    const maxH = Math.max(50, H - margin * 2);
    const side = Math.min(maxW, (maxH * 2) / Math.sqrt(3));
    const triH = side * Math.sqrt(3) / 2;
    const leftX = (W - side) / 2;
    const topY = margin;

    const A = { x: leftX + side / 2, y: topY };
    const B = { x: leftX, y: topY + triH };
    const C = { x: leftX + side, y: topY + triH };

    // Grid
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    for (const t of [0.2,0.4,0.6,0.8]){
      {
        const p1 = baryToXY(t, 1 - t, 0, A, B, C);
        const p2 = baryToXY(t, 0, 1 - t, A, B, C);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      {
        const p1 = baryToXY(1 - t, t, 0, A, B, C);
        const p2 = baryToXY(0, t, 1 - t, A, B, C);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      {
        const p1 = baryToXY(1 - t, 0, t, A, B, C);
        const p2 = baryToXY(0, 1 - t, t, A, B, C);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Border
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.lineTo(C.x, C.y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Axis labels
    ctx.save();
    ctx.fillStyle = '#111827';
    ctx.font = '600 12px Noto Sans, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('A: ' + aType, A.x, A.y - 6);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('B: ' + bType, B.x, B.y + 8);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('C: ' + cType, C.x, C.y + 8);
    ctx.restore();

    const pool = (selectedParticipant && selectedParticipant !== '__aggregate__')
      ? participants.filter(p => p.participantId === selectedParticipant)
      : participants.slice();

    /** @type {{participantId:string,a:number,b:number,c:number,total:number}[]} */
    const points = [];
    for (const p of pool){
      const rows = (Array.isArray(p.analysisRows) && p.analysisRows.length) ? p.analysisRows : (p.rows || []);
      let ca = 0, cb = 0, cc = 0;
      for (const r of rows){
        const ti = toNumber(r && r.task_index);
        if (ti === null || ti !== taskIndex) continue;
        const evt = String(r && r.event_type || '').trim();
        if (META_EVENTS.has(evt)) continue;
        if (evt === aType) ca++;
        else if (evt === bType) cb++;
        else if (evt === cType) cc++;
      }
      const total = ca + cb + cc;
      if (!total) continue;
      points.push({
        participantId: p.participantId,
        a: ca / total,
        b: cb / total,
        c: cc / total,
        total
      });
    }

    if (!points.length){
      setTernaryFallback('No matching A/B/C events found for the selected task.');
      return;
    }

    // Points
    ctx.save();
    for (const pt of points){
      const xy = baryToXY(pt.a, pt.b, pt.c, A, B, C);
      ctx.beginPath();
      ctx.fillStyle = '#2563eb';
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      const r = (selectedParticipant && selectedParticipant !== '__aggregate__') ? 5 : 4;
      ctx.arc(xy.x, xy.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // Footer
    ctx.save();
    ctx.fillStyle = 'rgba(17,24,39,0.85)';
    ctx.font = '12px Noto Sans, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Task ' + taskIndex + ' · points: ' + points.length.toLocaleString('en-GB'), 10, H - 10);
    ctx.restore();

  }

  function rerenderTernary(){
    try{
      if (!lastComputed || !lastComputed.participants || !lastComputed.participants.length){
        setTernaryFallback('');
        if (ternaryCanvas){
          const ctx = ternaryCanvas.getContext('2d');
          if (ctx) ctx.clearRect(0,0,ternaryCanvas.width,ternaryCanvas.height);
        }
        return;
      }
      if (lastComputed.agg){
        buildTernaryPlot(lastComputed.participants, lastComputed.agg, lastComputed.selectedParticipant);
      }
    }catch(e){ /* no-op */ }
  }

  function isNavigatorOnline(){
    try{
      // navigator.onLine is not perfect, but it's a useful hint.
      if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') return navigator.onLine;
    }catch(e){ /* no-op */ }
    return true;
  }

  function findBoxplotPluginScriptTag(){
    try{
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      return scripts.find(s => /chartjs-chart-box-and-violin-plot|Chart\.BoxPlot|@sgratzl\/chartjs-chart-boxplot|chartjs-chart-boxplot/i.test(String(s.getAttribute('src') || ''))) || null;
    }catch(e){
      return null;
    }
  }

  function hasBoxplotControllerRegistered(){
    try{
      return !!(window.Chart && Chart.registry && Chart.registry.getController && Chart.registry.getController('boxplot'));
    }catch(e){
      return false;
    }
  }

  function ensureBoxplotPluginRegistered(){
    if (hasBoxplotControllerRegistered()) return true;
    try{
      if (!window.Chart || typeof Chart.register !== 'function') return false;

      // The UMD bundle often exposes exports under a global like ChartBoxPlot.
      const globalsToTry = [
        'ChartBoxPlot',
        'ChartBoxAndViolinPlot',
        'chartjsChartBoxAndViolinPlot'
      ];

      for (const name of globalsToTry){
        const g = window[name];
        if (!g || typeof g !== 'object') continue;
        try{
          const parts = Object.values(g).filter(Boolean);
          if (parts.length) Chart.register.apply(Chart, parts);
        }catch(e){ /* ignore and try next */ }
      }
    }catch(e){
      // ignore
    }
    return hasBoxplotControllerRegistered();
  }

  function buildBoxplotFallbackMessage(reason, err){
    const online = isNavigatorOnline();
    const scriptTag = findBoxplotPluginScriptTag();
    const src = scriptTag ? String(scriptTag.getAttribute('src') || '') : '';
    const lines = [];

    // Status (helps debugging without DevTools)
    lines.push('Boxplot cannot be rendered (' + reason + ').');
    lines.push('Status: ' + (online ? 'online' : 'offline') + '; script: ' + (scriptTag ? ('found (' + src + ')') : 'not found in HTML') + '.');
    lines.push('');

    if (!online){
      lines.push('What to do (offline):');
      lines.push('1) Download the UMD build of the boxplot plugin (@sgratzl/chartjs-chart-boxplot).');
      lines.push('2) Save it into this project (e.g., ./vendor/chartjs-chart-boxplot/index.umd.min.js).');
      lines.push('3) In index.html, replace the CDN <script src="…"> with a local path (e.g., ./vendor/chartjs-chart-boxplot/index.umd.min.js).');
      lines.push('4) Hard refresh the page (Ctrl+F5).');
      return lines.join('\n');
    }

    // Online but missing or blocked script
    if (!scriptTag){
      lines.push('What to do:');
      lines.push('1) Check that index.html includes a <script> for the boxplot plugin (@sgratzl/chartjs-chart-boxplot) and that it appears after the Chart.js script.');
      lines.push('2) Hard refresh the page (Ctrl+F5).');
      return lines.join('\n');
    }

    lines.push('What to do (online, but the plugin did not load / register):');
    lines.push('1) Open DevTools → Network and confirm the plugin script loads with HTTP 200 (not 404 / blocked).');
    lines.push('   - If you see 404, the CDN URL is wrong for that version/file. Update the <script src> to a valid file (or use a local copy).');
    lines.push('2) Open DevTools → Console and check for errors such as “blocked by client”, CSP violations, or “ERR_*”.');
    lines.push('3) If the CDN is blocked (adblock/corporate firewall), use a local copy (see the offline steps above).');
    lines.push('');
    lines.push('Quick console checks:');
    lines.push("- typeof Chart === 'function'");
    lines.push("- Chart.registry?.getController?.('boxplot')");

    if (err){
      const msg = (err && (err.message || err.toString)) ? String(err.message || err.toString()) : '';
      if (msg) lines.push('\nError: ' + msg);
    }
    return lines.join('\n');
  }

  function getSelectedEventTypes(){
    const selected = new Set();
    for (const el of evtFilterEls){
      if (el && el.checked) selected.add(el.value);
    }
    return selected;
  }

  function isInteractionEvent(evtType, selected, includeMeta){
    if (!evtType) return false;
    if (includeMeta) return true;
    if (META_EVENTS.has(evtType)) return false;
    return selected.has(evtType);
  }

  function renderFileList(){
    const total = datasets.reduce((sum, d)=> sum + (d.size || 0), 0);
    if (countEl) countEl.textContent = String(datasets.length);
    if (totalSizeEl) totalSizeEl.textContent = formatBytes(total);

    if (!listEl) return;
    if (!datasets.length){
      listEl.innerHTML = '<div class="empty">Add participant CSV files to begin.</div>';
      return;
    }

    listEl.innerHTML = datasets.map((d, idx)=>{
      const idGuess = baseName(d.name);
      const rows = Array.isArray(d.rows) ? d.rows.length : 0;
      const errs = (d.meta && d.meta.parseErrors && d.meta.parseErrors.length) ? d.meta.parseErrors.length : 0;
      const meta = [rows + ' rows', formatBytes(d.size || 0)].concat(errs ? [errs + ' parse warning' + (errs>1?'s':'')] : []).join(' · ');
      return '<div class="item">'
        + '<span class="name"><strong>' + esc(idGuess) + '</strong> <span style="color:#7a879d">(' + esc(d.name) + ')</span></span>'
        + '<span class="meta">' + esc(meta) + '</span>'
        + '<button class="remove" data-index="' + idx + '" aria-label="Remove ' + esc(d.name) + '" title="Remove">×</button>'
        + '</div>';
    }).join('');
  }

  function attachListHandlers(){
    if (!listEl) return;
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

  function validateColumns(fields){
    const set = new Set((fields || []).map(s => String(s||'').trim()));
    return REQUIRED_COLUMNS.filter(c => !set.has(c));
  }

  async function parseCsvFile(file){
    const text = await file.text();
    return new Promise((resolve)=>{
      const parseErrors = [];
      const result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        transformHeader: h => String(h || '').trim(),
        error: (err)=>{ parseErrors.push(String(err && err.message ? err.message : err)); },
        complete: (res)=>{
          try{
            const missing = validateColumns(res.meta && res.meta.fields);
            if (missing.length){
              parseErrors.push('Missing columns: ' + missing.join(', '));
            }
            resolve({
              name: file.name,
              size: file.size,
              rows: Array.isArray(res.data) ? res.data : [],
              meta: { parseErrors }
            });
          }catch(e){
            resolve({ name: file.name, size: file.size, rows: [], meta: { parseErrors: ['Failed to parse CSV.'] } });
          }
        }
      });
      // Avoid unused var lint in some contexts
      void result;
    });
  }

  async function addCsvFiles(files){
    clearWarn();
    const arr = Array.from(files || []).filter(f => f && /\.csv$/i.test(f.name || ''));
    if (!arr.length){
      warn('Please add one or more CSV files.');
      return;
    }

    // Parse sequentially to keep UI responsive and errors simpler
    for (const f of arr){
      try{
        const parsed = await parseCsvFile(f);
        datasets.push(parsed);
      }catch(e){
        datasets.push({ name: f.name, size: f.size, rows: [], meta: { parseErrors: ['Failed to read file.'] } });
      }
    }

    // Sort by participant-like name
    datasets.sort((a,b)=> baseName(a.name).localeCompare(baseName(b.name), 'en-GB', {numeric:true}));

    renderFileList();
    rebuildAll();
  }

  function computeParticipantStats(ds){
    const rows = Array.isArray(ds.rows) ? ds.rows : [];
    const idFromFile = baseName(ds.name);

    // Participant id from CSV content (if present)
    const firstId = rows.length ? String(rows[0].session_id || '').trim() : '';
    const participantId = firstId || idFromFile || ds.name;

    // Pre-normalise time for segmentation
    const items = rows.map((r, idx)=>{
      const evt = String(r.event_type || '').trim();
      const isoMs = parseIsoMs(String(r.iso_time || '').trim());
      return { r, idx, evt, isoMs };
    }).filter(it => it.isoMs !== null && it.evt);

    items.sort((a,b)=> (a.isoMs - b.isoMs) || (a.idx - b.idx));

    // Segment into contiguous sessions based on large time gaps
    /** @type {{startIsoMs:number,endIsoMs:number,rows:any[],events:Set<string>,interactionCount:number,taskRowCount:number,hasEnd:boolean}[]} */
    const segments = [];
    let current = null;
    for (const it of items){
      const hasTask = (toNumber(it.r && it.r.task_index) !== null);
      if (!current){
        current = { startIsoMs: it.isoMs, endIsoMs: it.isoMs, rows: [it.r], events: new Set([it.evt]), interactionCount: (META_EVENTS.has(it.evt) ? 0 : 1), taskRowCount: (hasTask ? 1 : 0), hasEnd: (it.evt === 'session_end' || it.evt === 'end_clicked') };
        continue;
      }
      const gapSec = (it.isoMs - current.endIsoMs) / 1000;
      if (gapSec > SEGMENT_GAP_SECONDS){
        segments.push(current);
        current = { startIsoMs: it.isoMs, endIsoMs: it.isoMs, rows: [it.r], events: new Set([it.evt]), interactionCount: (META_EVENTS.has(it.evt) ? 0 : 1), taskRowCount: (hasTask ? 1 : 0), hasEnd: (it.evt === 'session_end' || it.evt === 'end_clicked') };
        continue;
      }
      current.endIsoMs = it.isoMs;
      current.rows.push(it.r);
      current.events.add(it.evt);
      if (!META_EVENTS.has(it.evt)) current.interactionCount += 1;
      if (hasTask) current.taskRowCount += 1;
      if (it.evt === 'session_end' || it.evt === 'end_clicked') current.hasEnd = true;
    }
    if (current) segments.push(current);

    // Choose the segment that most likely represents the actual study run.
    // Priority: segments with the most task-related rows; tie-breaker: ended segments; then most interactions; then latest segment.
    let chosen = null;
    const segmentsWithTasks = segments.filter(s => (s.taskRowCount || 0) > 0);
    const pool = segmentsWithTasks.length ? segmentsWithTasks : segments;
    chosen = pool.slice().sort((a,b)=>
      (a.taskRowCount - b.taskRowCount)
      || ((a.hasEnd?1:0) - (b.hasEnd?1:0))
      || (a.interactionCount - b.interactionCount)
      || (a.endIsoMs - b.endIsoMs)
    ).pop();
    const analysisRows = chosen ? chosen.rows : rows;

    const eventCounts = new Map();
    const taskCounts = new Map();
    const taskInteractionCounts = new Map();
    const taskLabels = new Map();
    const taskFirstIsoMs = new Map();
    const taskLastIsoMs = new Map();
    const taskDurationsMs = new Map(); // derived from iso_time (per participant)

    let isoMin = null;
    let isoMax = null;

    let interactions = 0;
    let metaEvents = 0;

    for (const r of analysisRows){
      const evt = String(r.event_type || '').trim();
      if (!evt) continue;

      eventCounts.set(evt, (eventCounts.get(evt) || 0) + 1);

      const taskIndex = toNumber(r.task_index);
      if (taskIndex !== null){
        taskCounts.set(taskIndex, (taskCounts.get(taskIndex) || 0) + 1);
        if (!META_EVENTS.has(evt)) taskInteractionCounts.set(taskIndex, (taskInteractionCounts.get(taskIndex) || 0) + 1);
        const lbl = String(r.task_label || '').trim();
        if (lbl && !taskLabels.has(taskIndex)) taskLabels.set(taskIndex, lbl);
      }

      const isoMs = parseIsoMs(String(r.iso_time || '').trim());
      if (isoMs !== null){
        isoMin = (isoMin === null) ? isoMs : Math.min(isoMin, isoMs);
        isoMax = (isoMax === null) ? isoMs : Math.max(isoMax, isoMs);
      }

      if (META_EVENTS.has(evt)) metaEvents++;
      else interactions++;

      if (taskIndex !== null && isoMs !== null){
        if (!taskFirstIsoMs.has(taskIndex)) taskFirstIsoMs.set(taskIndex, isoMs);
        const prevLast = taskLastIsoMs.get(taskIndex);
        taskLastIsoMs.set(taskIndex, (prevLast === undefined) ? isoMs : Math.max(prevLast, isoMs));
      }
    }

    // Derive per-task durations from iso_time spans (first..last for each task).
    for (const [k, startMs] of taskFirstIsoMs.entries()){
      const endMs = taskLastIsoMs.get(k);
      if (endMs === undefined) continue;
      const dur = Math.max(0, endMs - startMs);
      if (dur > 0) taskDurationsMs.set(k, dur);
    }

    const durationSec = (isoMin !== null && isoMax !== null && isoMax >= isoMin)
      ? (isoMax - isoMin) / 1000
      : null;

    const interactionsPerMin = (durationSec && durationSec > 0)
      ? (interactions / (durationSec / 60))
      : null;

    return {
      participantId,
      idFromFile,
      firstId,
      rowsCount: rows.length,
      analysisRowsCount: analysisRows.length,
      analysisRows,
      interactions,
      metaEvents,
      durationSec,
      interactionsPerMin,
      eventCounts,
      taskCounts,
      taskInteractionCounts,
      taskLabels,
      taskDurationsMs,
      isoMin,
      isoMax,
      segmentsCount: segments.length,
      chosenSegmentHasEnd: chosen ? chosen.hasEnd : false,
      rows
    };
  }

  function computeAggregate(participants){
    const n = participants.length;

    const sumEventCounts = new Map();
    const sumTaskCounts = new Map();
    const taskLabels = new Map();
    const sumTaskDurationsMs = new Map();

    const totalsInteractions = [];
    const totalsRows = [];
    const totalsDurationSec = [];
    const totalsIpm = [];

    for (const p of participants){
      totalsInteractions.push(p.interactions);
      totalsRows.push(p.rowsCount);
      if (p.durationSec !== null) totalsDurationSec.push(p.durationSec);
      if (p.interactionsPerMin !== null) totalsIpm.push(p.interactionsPerMin);

      for (const [k,v] of p.eventCounts.entries()){
        sumEventCounts.set(k, (sumEventCounts.get(k) || 0) + v);
      }
      for (const [k,v] of p.taskCounts.entries()){
        sumTaskCounts.set(k, (sumTaskCounts.get(k) || 0) + v);
      }
      for (const [k,v] of p.taskLabels.entries()){
        if (!taskLabels.has(k)) taskLabels.set(k, v);
      }
      for (const [k,v] of p.taskDurationsMs.entries()){
        sumTaskDurationsMs.set(k, (sumTaskDurationsMs.get(k) || 0) + v);
      }
    }

    const sortedInteractions = totalsInteractions.slice().sort((a,b)=>a-b);
    const sortedDuration = totalsDurationSec.slice().sort((a,b)=>a-b);
    const sortedIpm = totalsIpm.slice().sort((a,b)=>a-b);

    return {
      n,
      sumEventCounts,
      sumTaskCounts,
      taskLabels,
      sumTaskDurationsMs,
      interactions: {
        sum: totalsInteractions.reduce((a,b)=>a+b,0),
        mean: mean(totalsInteractions),
        median: quantile(sortedInteractions,0.5),
        sd: stdev(totalsInteractions),
        min: sortedInteractions.length ? sortedInteractions[0] : null,
        max: sortedInteractions.length ? sortedInteractions[sortedInteractions.length-1] : null,
        q1: quantile(sortedInteractions,0.25),
        q3: quantile(sortedInteractions,0.75)
      },
      durationSec: {
        mean: mean(totalsDurationSec),
        median: quantile(sortedDuration,0.5),
        min: sortedDuration.length ? sortedDuration[0] : null,
        max: sortedDuration.length ? sortedDuration[sortedDuration.length-1] : null
      },
      interactionsPerMin: {
        mean: mean(totalsIpm),
        median: quantile(sortedIpm,0.5)
      }
    };
  }

  function buildTimeline(participants, selectedEvents, includeMeta, binSizeSec){
    // Returns {labels: string[], seriesByParticipant: Map(id, number[]), aggregateSum:number[], aggregateMean:number[]}
    const seriesByParticipant = new Map();
    let globalMaxBins = 0;

    for (const p of participants){
      if (p.isoMin === null) continue;
      const bins = [];
      // Use analysed rows so that long idle gaps do not blow up the timeline.
      const sourceRows = (Array.isArray(p.analysisRows) && p.analysisRows.length) ? p.analysisRows : (p.rows || []);
      for (const r of sourceRows){
        const evt = String(r.event_type || '').trim();
        if (!evt) continue;
        if (!isInteractionEvent(evt, selectedEvents, includeMeta)) continue;

        const iso = parseIsoMs(String(r.iso_time || '').trim());
        if (iso === null) continue;

        const tSec = (iso - p.isoMin) / 1000;
        if (tSec < 0) continue;
        const bi = Math.floor(tSec / binSizeSec);
        if (bi < 0) continue;
        if (!Number.isFinite(bi)) continue;
        while (bins.length <= bi) bins.push(0);
        bins[bi] += 1;
      }
      globalMaxBins = Math.max(globalMaxBins, bins.length);
      seriesByParticipant.set(p.participantId, bins);
    }

    const aggregateSum = new Array(globalMaxBins).fill(0);
    const aggregateMean = new Array(globalMaxBins).fill(0);

    for (let i=0;i<globalMaxBins;i++){
      let sum = 0;
      let count = 0;
      for (const bins of seriesByParticipant.values()){
        const v = bins[i] || 0;
        sum += v;
        count += 1;
      }
      aggregateSum[i] = sum;
      aggregateMean[i] = count ? (sum / count) : 0;
    }

    const labels = Array.from({length: globalMaxBins}, (_,i)=> String(i * binSizeSec));
    return { labels, seriesByParticipant, aggregateSum, aggregateMean };
  }

  function renderSummary(participants, agg){
    if (!summaryEl) return;
    if (!participants.length){
      summaryEl.innerHTML = '<div class="empty" style="grid-column:1/-1">Add CSV files to see results.</div>';
      return;
    }

    const totalRows = participants.reduce((sum,p)=> sum + p.rowsCount, 0);
    const totalInteractions = participants.reduce((sum,p)=> sum + p.interactions, 0);

    const cards = [
      {k:'Participants', v: String(agg.n), s:'One CSV file per participant'},
      {k:'Interactions (sum)', v: totalInteractions.toLocaleString('en-GB'), s:'Excludes session/task markers and page/focus/blur/resize'},
      {k:'Interactions (mean)', v: niceNumber(agg.interactions.mean, 2), s:'Per participant'},
      {k:'Session duration (median)', v: (agg.durationSec.median!==null? niceNumber(agg.durationSec.median/60, 2)+' min':'–'), s:'Based on the most relevant contiguous session segment'},
      {k:'Interactions/min (mean)', v: niceNumber(agg.interactionsPerMin.mean, 2), s:'Per participant'},
      {k:'Rows (sum)', v: totalRows.toLocaleString('en-GB'), s:'All events including meta'},
      {k:'Interactions (IQR)', v: (agg.interactions.q1!==null && agg.interactions.q3!==null) ? (niceNumber(agg.interactions.q1,0)+'–'+niceNumber(agg.interactions.q3,0)) : '–', s:'25th–75th percentile'},
      {k:'Interactions (min–max)', v: (agg.interactions.min!==null? (niceNumber(agg.interactions.min,0)+'–'+niceNumber(agg.interactions.max,0)) : '–'), s:'Across participants'}
    ];

    summaryEl.innerHTML = cards.map(c =>
      '<div class="stat"><div class="k">'+esc(c.k)+'</div><div class="v">'+esc(c.v)+'</div><div class="s">'+esc(c.s)+'</div></div>'
    ).join('');
  }

  function destroyChart(ch){
    try{ if (ch) ch.destroy(); }catch(e){}
  }

  function buildEventTypesChart(agg){
    if (!chartEventTypesCanvas || !window.Chart) return;

    const entries = Array.from(agg.sumEventCounts.entries())
      .sort((a,b)=> b[1]-a[1]);

    const labels = entries.map(e=> e[0]);
    const data = entries.map(e=> e[1]);

    destroyChart(charts.eventTypes);
    charts.eventTypes = new Chart(chartEventTypesCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Events',
          data,
          backgroundColor: 'rgba(37,99,235,.25)',
          borderColor: 'rgba(37,99,235,.8)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx)=> ctx.raw.toLocaleString('en-GB') } }
        },
        scales: {
          x: { ticks: { maxRotation: 60, minRotation: 0 } },
          y: { beginAtZero: true }
        }
      }
    });
  }

  function buildPerParticipantChart(participants){
    if (!chartPerParticipantCanvas || !window.Chart) return;

    const labels = participants.map(p=> p.participantId);
    const data = participants.map(p=> p.interactions);

    destroyChart(charts.perParticipant);
    charts.perParticipant = new Chart(chartPerParticipantCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Interactions',
          data,
          backgroundColor: 'rgba(14,165,233,.20)',
          borderColor: 'rgba(14,165,233,.85)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        animation: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  function buildTimelineChart(timeline, participants){
    if (!chartTimelineCanvas || !window.Chart) return;

    const selectedParticipant = participantSelectEl ? participantSelectEl.value : '__aggregate__';
    const aggMode = timelineAggEl ? timelineAggEl.value : 'sum';

    const labels = timeline.labels.map(s => (Number(s) / 60) >= 1 ? (niceNumber(Number(s)/60,2) + ' min') : (s + ' s'));

    const datasetsChart = [];
    if (selectedParticipant && selectedParticipant !== '__aggregate__'){
      const bins = timeline.seriesByParticipant.get(selectedParticipant) || [];
      datasetsChart.push({
        label: selectedParticipant,
        data: labels.map((_,i)=> bins[i] || 0),
        tension: 0.25,
        borderColor: 'rgba(37,99,235,.9)',
        backgroundColor: 'rgba(37,99,235,.15)',
        fill: true,
        pointRadius: 0
      });
    } else {
      const data = (aggMode === 'mean') ? timeline.aggregateMean : timeline.aggregateSum;
      datasetsChart.push({
        label: (aggMode === 'mean') ? 'Mean per participant' : 'Sum',
        data,
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
      data: { labels, datasets: datasetsChart },
      options: {
        responsive: true,
        animation: false,
        plugins: { legend: { display: true } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Events per bin' } },
          x: { title: { display: true, text: 'Time since first event' } }
        }
      }
    });
  }

  function buildTasksChart(participants, agg){
    if (!chartTasksCanvas || !window.Chart) return;

    // Aggregate per task: mean interactions and mean duration
    const taskKeys = Array.from(agg.sumTaskCounts.keys()).sort((a,b)=>a-b);
    const labels = taskKeys.map(k => 'Task ' + k);

    const countsPerTaskPerParticipant = taskKeys.map(k => participants.map(p => (p.taskInteractionCounts ? (p.taskInteractionCounts.get(k) || 0) : 0)));
    const meanCounts = countsPerTaskPerParticipant.map(arr => mean(arr) || 0);

    const durSecPerTaskPerParticipant = taskKeys.map(k => participants.map(p => (p.taskDurationsMs.get(k) || 0) / 1000).filter(v=>v>0));
    const meanDurSec = durSecPerTaskPerParticipant.map(arr => mean(arr) || 0);

    destroyChart(charts.tasks);
    charts.tasks = new Chart(chartTasksCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Mean interactions per participant',
            data: meanCounts,
            yAxisID: 'y',
            backgroundColor: 'rgba(16,163,74,.18)',
            borderColor: 'rgba(16,163,74,.85)',
            borderWidth: 1
          },
          {
            type: 'line',
            label: 'Mean task duration (s)',
            data: meanDurSec,
            yAxisID: 'y1',
            tension: 0.25,
            borderColor: 'rgba(220,38,38,.9)',
            backgroundColor: 'rgba(220,38,38,.12)',
            pointRadius: 2
          }
        ]
      },
      options: {
        responsive: true,
        animation: false,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Interactions' } },
          y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Seconds' } }
        }
      }
    });
  }

  function buildTaskSharesBoxplot(participants, selectedEvents){
    if (!chartTaskSharesCanvas || !window.Chart) return;

    const types = Array.from(selectedEvents || []).map(s => String(s || '').trim()).filter(Boolean);
    if (!types.length){
      destroyChart(charts.taskShares);
      charts.taskShares = null;
      setTaskSharesFallback('');
      return;
    }

    // Ensure the plugin is registered (some environments load the script but don't auto-register).
    if (!ensureBoxplotPluginRegistered()){
      destroyChart(charts.taskShares);
      charts.taskShares = null;
      setTaskSharesFallback(buildBoxplotFallbackMessage('plugin missing', null));
      return;
    }

    // Map(taskIndex -> Map(type -> number[] shares per participant))
    /** @type {Map<number, Map<string, number[]>>} */
    const sharesByTask = new Map();
    const taskSet = new Set();

    for (const p of participants){
      const src = (Array.isArray(p.analysisRows) && p.analysisRows.length) ? p.analysisRows : (p.rows || []);

      /** @type {Map<number, Map<string, number>>} */
      const countsByTask = new Map();
      /** @type {Map<number, number>} */
      const totalsByTask = new Map();

      for (const r of src){
        const taskIndex = toNumber(r.task_index);
        if (taskIndex === null) continue;
        const evt = String(r.event_type || '').trim();
        if (!evt) continue;
        // We treat "interaction types" as the currently selected event filters (click/wheel/keydown/etc).
        if (!selectedEvents || !selectedEvents.has(evt)) continue;

        taskSet.add(taskIndex);

        let m = countsByTask.get(taskIndex);
        if (!m){ m = new Map(); countsByTask.set(taskIndex, m); }
        m.set(evt, (m.get(evt) || 0) + 1);
        totalsByTask.set(taskIndex, (totalsByTask.get(taskIndex) || 0) + 1);
      }

      // Convert to shares (per participant) and append.
      for (const [taskIndex, total] of totalsByTask.entries()){
        if (!total) continue;
        const m = countsByTask.get(taskIndex) || new Map();
        let byType = sharesByTask.get(taskIndex);
        if (!byType){ byType = new Map(); sharesByTask.set(taskIndex, byType); }
        for (const t of types){
          const c = m.get(t) || 0;
          const share = c / total;
          if (!Number.isFinite(share)) continue;
          if (!byType.has(t)) byType.set(t, []);
          byType.get(t).push(share);
        }
      }
    }

    const taskKeys = Array.from(taskSet.values()).sort((a,b)=>a-b);
    if (!taskKeys.length){
      destroyChart(charts.taskShares);
      charts.taskShares = null;
      setTaskSharesFallback('');
      return;
    }

    const palette = [
      ['rgba(37,99,235,.18)','rgba(37,99,235,.9)'],
      ['rgba(16,163,74,.18)','rgba(16,163,74,.85)'],
      ['rgba(220,38,38,.14)','rgba(220,38,38,.9)'],
      ['rgba(124,58,237,.16)','rgba(124,58,237,.9)'],
      ['rgba(245,158,11,.18)','rgba(245,158,11,.9)']
    ];

    const labels = types.slice();
    const datasets = taskKeys.map((taskIndex, i)=>{
      const colors = palette[i % palette.length];
      const byType = sharesByTask.get(taskIndex) || new Map();
      const data = types.map(t => (byType.get(t) || []));
      return {
        label: 'Task ' + taskIndex,
        data,
        backgroundColor: colors[0],
        borderColor: colors[1],
        borderWidth: 1,
        outlierColor: 'rgba(0,0,0,.45)',
        itemRadius: 0
      };
    });

    destroyChart(charts.taskShares);
    try{
      charts.taskShares = new Chart(chartTaskSharesCanvas.getContext('2d'), {
        type: 'boxplot',
        data: { labels, datasets },
        options: {
          responsive: true,
          animation: false,
          plugins: {
            legend: { display: true },
            tooltip: {
              callbacks: {
                label: (ctx)=>{
                  const r = ctx.raw;
                  const p = (v)=> (Number.isFinite(v) ? (niceNumber(v*100,1) + '%') : '–');
                  if (r && typeof r === 'object' && !Array.isArray(r) && r.median !== undefined){
                    return (ctx.dataset.label || '') + ': median ' + p(r.median) + ' (Q1 ' + p(r.q1) + ', Q3 ' + p(r.q3) + ')';
                  }
                  return (ctx.dataset.label || '') + ': n=' + (Array.isArray(r) ? r.length : '–');
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              min: 0,
              max: 1,
              title: { display: true, text: 'Share of actions within task' },
              ticks: { callback: (v)=> (Number(v)*100).toFixed(0) + '%' }
            },
            x: {
              title: { display: true, text: 'Interaction type' }
            }
          }
        }
      });
      setTaskSharesFallback('');
    }catch(e){
      charts.taskShares = null;
      // Try to distinguish the common failure modes.
      const msg = String(e && (e.message || e) || '');
      const looksLikeMissing = /not\s+a\s+registered\s+controller|"boxplot"|boxplot/i.test(msg) || !hasBoxplotControllerRegistered();
      setTaskSharesFallback(buildBoxplotFallbackMessage(looksLikeMissing ? 'plugin not registered' : 'render error', e));
    }
  }

  function buildTaskInteractionProfilesChart(participants, agg, selectedParticipant, selectedEvents){
    if (!chartTaskProfilesCanvas || !window.Chart) return;

    const types = Array.from(selectedEvents || []).map(s => String(s || '').trim()).filter(Boolean);
    if (!types.length){
      destroyChart(charts.taskProfiles);
      charts.taskProfiles = null;
      return;
    }

    // Map(taskIndex -> Map(type -> count))
    /** @type {Map<number, Map<string, number>>} */
    const countsByTask = new Map();

    const addRow = (r)=>{
      const taskIndex = toNumber(r.task_index);
      if (taskIndex === null) return;
      const evt = String(r.event_type || '').trim();
      if (!evt) return;
      if (!selectedEvents || !selectedEvents.has(evt)) return;
      let m = countsByTask.get(taskIndex);
      if (!m){ m = new Map(); countsByTask.set(taskIndex, m); }
      m.set(evt, (m.get(evt) || 0) + 1);
    };

    if (!selectedParticipant || selectedParticipant === '__aggregate__'){
      for (const p of participants){
        const src = (Array.isArray(p.analysisRows) && p.analysisRows.length) ? p.analysisRows : (p.rows || []);
        for (const r of src) addRow(r);
      }
    }else{
      const p = participants.find(x => x.participantId === selectedParticipant);
      const src = p ? ((Array.isArray(p.analysisRows) && p.analysisRows.length) ? p.analysisRows : (p.rows || [])) : [];
      for (const r of src) addRow(r);
    }

    const taskKeys = Array.from(countsByTask.keys()).sort((a,b)=>a-b);
    if (!taskKeys.length){
      destroyChart(charts.taskProfiles);
      charts.taskProfiles = null;
      return;
    }

    const labels = taskKeys.map(k => {
      const lbl = (agg && agg.taskLabels && agg.taskLabels.get) ? (agg.taskLabels.get(k) || '') : '';
      return lbl ? ('Task ' + k + ': ' + truncate(lbl, 38)) : ('Task ' + k);
    });

    const totals = taskKeys.map(k => {
      const m = countsByTask.get(k) || new Map();
      let sum = 0;
      for (const t of types) sum += (m.get(t) || 0);
      return sum;
    });

    const colorMap = {
      click: ['rgba(37,99,235,.20)','rgba(37,99,235,.90)'],
      wheel: ['rgba(16,163,74,.20)','rgba(16,163,74,.85)'],
      keydown: ['rgba(124,58,237,.18)','rgba(124,58,237,.90)'],
      dblclick: ['rgba(245,158,11,.22)','rgba(245,158,11,.90)'],
      contextmenu: ['rgba(220,38,38,.18)','rgba(220,38,38,.90)']
    };
    const fallbackPalette = [
      ['rgba(37,99,235,.20)','rgba(37,99,235,.90)'],
      ['rgba(16,163,74,.20)','rgba(16,163,74,.85)'],
      ['rgba(124,58,237,.18)','rgba(124,58,237,.90)'],
      ['rgba(245,158,11,.22)','rgba(245,158,11,.90)'],
      ['rgba(220,38,38,.18)','rgba(220,38,38,.90)']
    ];

    const datasets = types.map((t, idx)=>{
      const colors = colorMap[t] || fallbackPalette[idx % fallbackPalette.length];
      const rawCounts = taskKeys.map(k => ((countsByTask.get(k) || new Map()).get(t) || 0));
      const shares = rawCounts.map((c, i)=>{
        const total = totals[i] || 0;
        return total > 0 ? (c / total) : 0;
      });
      return {
        label: t,
        data: shares,
        _rawCounts: rawCounts,
        backgroundColor: colors[0],
        borderColor: colors[1],
        borderWidth: 1,
        stack: 'share'
      };
    });

    destroyChart(charts.taskProfiles);
    charts.taskProfiles = new Chart(chartTaskProfilesCanvas.getContext('2d'), {
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
                const share = Number(ctx.parsed && ctx.parsed.y);
                const pct = Number.isFinite(share) ? (share*100).toFixed(0) + '%' : '–';
                const ds = ctx.dataset || {};
                const raw = Array.isArray(ds._rawCounts) ? (ds._rawCounts[ctx.dataIndex] || 0) : 0;
                const total = totals[ctx.dataIndex] || 0;
                return (ds.label || '') + ': ' + raw + ' / ' + total + ' (' + pct + ')';
              }
            }
          }
        },
        scales: {
          x: { stacked: true, title: { display: true, text: 'Task' } },
          y: {
            stacked: true,
            beginAtZero: true,
            min: 0,
            max: 1,
            title: { display: true, text: 'Share of interactions within task' },
            ticks: { callback: (v)=> (Number(v)*100).toFixed(0) + '%' }
          }
        }
      }
    });
  }

  function getRowsForView(participants, selectedParticipant){
    if (!selectedParticipant || selectedParticipant === '__aggregate__'){
      const all = [];
      for (const p of participants){
        const src = (Array.isArray(p.analysisRows) && p.analysisRows.length) ? p.analysisRows : (p.rows || []);
        all.push.apply(all, src);
      }
      return all;
    }
    const p = participants.find(x => x.participantId === selectedParticipant);
    if (!p) return [];
    return (Array.isArray(p.analysisRows) && p.analysisRows.length) ? p.analysisRows : (p.rows || []);
  }

  function countByColumn(rows, columnName, selectedEvents, includeMeta, transform){
    const counts = new Map();
    for (const r of rows || []){
      const evt = String(r.event_type || '').trim();
      if (!evt) continue;
      if (!isInteractionEvent(evt, selectedEvents, includeMeta)) continue;
      let v = r[columnName];
      if (typeof transform === 'function') v = transform(v, r);
      const s = normalizeText(v);
      if (!s) continue;
      counts.set(s, (counts.get(s) || 0) + 1);
    }
    return counts;
  }

  function buildTopNBarChart(canvas, chartRefKey, entries, opts){
    if (!canvas || !window.Chart) return;
    const options = opts || {};
    const labels = (entries || []).map(e => e[0]);
    const data = (entries || []).map(e => e[1]);
    destroyChart(charts[chartRefKey]);
    charts[chartRefKey] = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: options.datasetLabel || 'Count',
          data,
          backgroundColor: options.backgroundColor || 'rgba(99,102,241,.18)',
          borderColor: options.borderColor || 'rgba(99,102,241,.85)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        animation: false,
        indexAxis: options.indexAxis || 'x',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx)=> (ctx.raw || 0).toLocaleString('en-GB') } }
        },
        scales: {
          x: { ticks: { maxRotation: 60, minRotation: 0 } },
          y: { beginAtZero: true }
        }
      }
    });
  }

  function zoomDirectionFromRow(r){
    const hint = normalizeText(r && r.zoom_hint);
    if (hint){
      const h = hint.toLowerCase();
      if (h.includes('in')) return 'Zoom in';
      if (h.includes('out')) return 'Zoom out';
    }
    const wd = normalizeText(r && r.wheel_direction).toLowerCase();
    if (wd === 'up') return 'Zoom in';
    if (wd === 'down') return 'Zoom out';
    if (wd) return 'Other';
    return '';
  }

  function mouseButtonFromRow(r){
    const b = toNumber(r && r.button);
    if (b === null) return '';
    if (b === 0) return 'Left';
    if (b === 1) return 'Middle';
    if (b === 2) return 'Right';
    return 'Button ' + b;
  }

  function buildAttributeCharts(participants, selectedParticipant, selectedEvents, includeMeta){
    const rows = getRowsForView(participants, selectedParticipant);

    // element_tag
    {
      const m = countByColumn(rows, 'element_tag', selectedEvents, includeMeta, (v)=> normalizeText(v).toLowerCase());
      buildTopNBarChart(chartElementTagCanvas, 'elementTag', topNWithOther(Array.from(m.entries()), 12), {
        backgroundColor: 'rgba(14,165,233,.18)',
        borderColor: 'rgba(14,165,233,.85)'
      });
    }

    // element_id
    {
      const m = countByColumn(rows, 'element_id', selectedEvents, includeMeta, (v)=> normalizeText(v));
      buildTopNBarChart(chartElementIdCanvas, 'elementId', topNWithOther(Array.from(m.entries()), 12), {
        backgroundColor: 'rgba(37,99,235,.18)',
        borderColor: 'rgba(37,99,235,.85)'
      });
    }

    // element_text (horizontal)
    {
      const m = countByColumn(rows, 'element_text', selectedEvents, includeMeta, (v)=> truncate(v, 42));
      buildTopNBarChart(chartElementTextCanvas, 'elementText', topNWithOther(Array.from(m.entries()), 12), {
        indexAxis: 'y',
        backgroundColor: 'rgba(16,163,74,.14)',
        borderColor: 'rgba(16,163,74,.85)'
      });
    }

    // mouse button
    {
      const m = countByColumn(rows, 'button', selectedEvents, includeMeta, (_v, r)=> mouseButtonFromRow(r));
      buildTopNBarChart(chartMouseButtonCanvas, 'mouseButton', topNWithOther(Array.from(m.entries()), 8), {
        backgroundColor: 'rgba(234,88,12,.16)',
        borderColor: 'rgba(234,88,12,.85)'
      });
    }

    // zoom direction
    {
      const m = new Map();
      for (const r of rows || []){
        const evt = String(r.event_type || '').trim();
        if (!evt) continue;
        if (!isInteractionEvent(evt, selectedEvents, includeMeta)) continue;
        const zd = zoomDirectionFromRow(r);
        if (!zd) continue;
        m.set(zd, (m.get(zd) || 0) + 1);
      }
      // Stable order: in, out, other
      const ordered = ['Zoom in','Zoom out','Other'].map(k => [k, m.get(k) || 0]).filter(e => e[1] > 0);
      buildTopNBarChart(chartZoomDirectionCanvas, 'zoomDirection', ordered.length ? ordered : [], {
        backgroundColor: 'rgba(220,38,38,.14)',
        borderColor: 'rgba(220,38,38,.85)'
      });
    }

    // key
    {
      const m = countByColumn(rows, 'key', selectedEvents, includeMeta, (v)=> truncate(v, 24));
      buildTopNBarChart(chartKeyCanvas, 'key', topNWithOther(Array.from(m.entries()), 12), {
        backgroundColor: 'rgba(99,102,241,.16)',
        borderColor: 'rgba(99,102,241,.85)'
      });
    }

    // code
    {
      const m = countByColumn(rows, 'code', selectedEvents, includeMeta, (v)=> truncate(v, 24));
      buildTopNBarChart(chartCodeCanvas, 'code', topNWithOther(Array.from(m.entries()), 12), {
        backgroundColor: 'rgba(148,163,184,.28)',
        borderColor: 'rgba(100,116,139,.95)'
      });
    }

    // modifiers
    {
      if (chartModifiersCanvas && window.Chart){
        const counts = { Ctrl: 0, Alt: 0, Shift: 0 };
        let anyRows = 0;
        for (const r of rows || []){
          const evt = String(r.event_type || '').trim();
          if (!evt) continue;
          if (!isInteractionEvent(evt, selectedEvents, includeMeta)) continue;
          anyRows++;
          if (toBool(r.ctrl)) counts.Ctrl += 1;
          if (toBool(r.alt)) counts.Alt += 1;
          if (toBool(r.shift)) counts.Shift += 1;
        }

        destroyChart(charts.modifiers);
        charts.modifiers = new Chart(chartModifiersCanvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: ['Ctrl', 'Alt', 'Shift'],
            datasets: [{
              label: 'Events with modifier held',
              data: [counts.Ctrl, counts.Alt, counts.Shift],
              backgroundColor: 'rgba(2,132,199,.16)',
              borderColor: 'rgba(2,132,199,.85)',
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            animation: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx)=>{
                    const v = (ctx.raw || 0);
                    const pct = anyRows ? (100 * v / anyRows) : 0;
                    return v.toLocaleString('en-GB') + ' (' + niceNumber(pct, 1) + '% of events)';
                  }
                }
              }
            },
            scales: { y: { beginAtZero: true } }
          }
        });
      }
    }
  }

  function buildEventTimelineChart(participants, selectedParticipant, selectedEvents, includeMeta){
    if (!chartEventTimelineCanvas || !window.Chart) return;

    // Only for a single participant
    if (!selectedParticipant || selectedParticipant === '__aggregate__'){
      destroyChart(charts.eventTimeline);
      charts.eventTimeline = null;
      try{
        const ctx = chartEventTimelineCanvas.getContext('2d');
        ctx && ctx.clearRect(0,0,chartEventTimelineCanvas.width, chartEventTimelineCanvas.height);
      }catch(e){}
      return;
    }

    const p = participants.find(x => x.participantId === selectedParticipant);
    if (!p || p.isoMin === null){
      destroyChart(charts.eventTimeline);
      charts.eventTimeline = null;
      return;
    }

    const sourceRows = (Array.isArray(p.analysisRows) && p.analysisRows.length) ? p.analysisRows : (p.rows || []);
    const categories = ['Click','Wheel (zoom in)','Wheel (zoom out)','Wheel (other)','Key input','Double-click','Context menu','Meta'];
    const points = [];

    for (const r of sourceRows){
      const evt = String(r.event_type || '').trim();
      if (!evt) continue;
      if (!includeMeta && META_EVENTS.has(evt)){
        // skip
      } else {
        if (!isInteractionEvent(evt, selectedEvents, includeMeta)) continue;
      }
      const iso = parseIsoMs(String(r.iso_time || '').trim());
      if (iso === null) continue;
      const tSec = (iso - p.isoMin) / 1000;
      if (!Number.isFinite(tSec) || tSec < 0) continue;

      let cat = 'Meta';
      let detail = evt;

      if (evt === 'click'){
        cat = 'Click';
        const tag = normalizeText(r.element_tag);
        const id = normalizeText(r.element_id);
        const txt = truncate(r.element_text, 40);
        const btn = mouseButtonFromRow(r);
        detail = [btn, tag ? '<' + tag + '>' : '', id ? ('#' + id) : '', txt ? ('"' + txt + '"') : ''].filter(Boolean).join(' ');
      } else if (evt === 'wheel'){
        const zd = zoomDirectionFromRow(r);
        if (zd === 'Zoom in') cat = 'Wheel (zoom in)';
        else if (zd === 'Zoom out') cat = 'Wheel (zoom out)';
        else cat = 'Wheel (other)';
        detail = [normalizeText(r.wheel_direction), normalizeText(r.zoom_hint)].filter(Boolean).join(' / ') || 'wheel';
      } else if (evt === 'keydown'){
        cat = 'Key input';
        const k = normalizeText(r.key);
        const code = normalizeText(r.code);
        const mods = [toBool(r.ctrl) ? 'Ctrl' : '', toBool(r.alt) ? 'Alt' : '', toBool(r.shift) ? 'Shift' : ''].filter(Boolean).join('+');
        detail = [mods, k || code].filter(Boolean).join(' ');
      } else if (evt === 'dblclick'){
        cat = 'Double-click';
      } else if (evt === 'contextmenu'){
        cat = 'Context menu';
      } else if (META_EVENTS.has(evt)){
        cat = 'Meta';
      }

      points.push({ x: tSec, y: cat, __detail: detail, __evt: evt });
    }

    // Sampling for very long sessions
    let sampled = points;
    if (points.length > 5000){
      const step = Math.ceil(points.length / 5000);
      sampled = points.filter((_,i)=> (i % step) === 0);
    }

    destroyChart(charts.eventTimeline);
    charts.eventTimeline = new Chart(chartEventTimelineCanvas.getContext('2d'), {
      type: 'scatter',
      data: {
        datasets: [{
          label: selectedParticipant,
          data: sampled,
          parsing: false,
          pointRadius: sampled.length > 2000 ? 1.5 : 2.5,
          pointHoverRadius: 5,
          borderColor: 'rgba(37,99,235,.85)',
          backgroundColor: 'rgba(37,99,235,.35)'
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
                const it = items && items[0] ? items[0] : null;
                const x = it && it.parsed ? it.parsed.x : null;
                if (x === null || x === undefined) return '';
                const mm = Math.floor(x / 60);
                const ss = Math.floor(x % 60);
                return 't = ' + mm + ':' + String(ss).padStart(2,'0');
              },
              label: (ctx)=>{
                const raw = ctx.raw || {};
                const y = raw.y || '';
                const d = raw.__detail || raw.__evt || '';
                return (y ? (y + ': ') : '') + d;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: 'Time since first event (s)' },
            ticks: {
              callback: (v)=>{
                const x = Number(v);
                if (!Number.isFinite(x)) return '';
                const mm = Math.floor(x / 60);
                const ss = Math.floor(x % 60);
                return mm + ':' + String(ss).padStart(2,'0');
              }
            }
          },
          y: { type: 'category', labels: categories, title: { display: true, text: 'Event category' } }
        }
      }
    });
  }

  function makeHeatPalette(){
    // Simple blue -> cyan -> yellow -> red palette (256 stops)
    const stops = [
      {t:0.00, c:[16,  4,  72]},
      {t:0.25, c:[ 0, 83, 170]},
      {t:0.50, c:[ 0, 181, 204]},
      {t:0.75, c:[255, 215,  0]},
      {t:1.00, c:[220,  38, 38]}
    ];
    const out = new Array(256);
    for (let i=0;i<256;i++){
      const x = i / 255;
      let a = stops[0], b = stops[stops.length-1];
      for (let j=0;j<stops.length-1;j++){
        if (x >= stops[j].t && x <= stops[j+1].t){ a = stops[j]; b = stops[j+1]; break; }
      }
      const u = (b.t === a.t) ? 0 : (x - a.t) / (b.t - a.t);
      const r = Math.round(a.c[0] + (b.c[0]-a.c[0]) * u);
      const g = Math.round(a.c[1] + (b.c[1]-a.c[1]) * u);
      const bl = Math.round(a.c[2] + (b.c[2]-a.c[2]) * u);
      out[i] = [r,g,bl];
    }
    return out;
  }

  const HEAT_PALETTE = makeHeatPalette();

  function collectHeatmapGroups(participants, selectedParticipant, selectedEvents, includeMeta){
    const rows = getRowsForView(participants, selectedParticipant);
    /** @type {Map<string,{w:number,h:number,points:{x:number,y:number}[]}>} */
    const groups = new Map();
    for (const r of rows || []){
      const evt = String(r.event_type || '').trim();
      if (!evt) continue;
      if (!isInteractionEvent(evt, selectedEvents, includeMeta)) continue;

      const x = toNumber(r.x);
      const y = toNumber(r.y);
      const vw = toNumber(r.viewport_w);
      const vh = toNumber(r.viewport_h);
      if (x === null || y === null || vw === null || vh === null) continue;
      if (vw <= 0 || vh <= 0) continue;
      if (x < 0 || y < 0 || x > vw || y > vh) continue;

      const key = vw + 'x' + vh;
      if (!groups.has(key)) groups.set(key, { w: vw, h: vh, points: [] });
      groups.get(key).points.push({ x, y });
    }
    return groups;
  }

  function chooseDefaultViewportKey(groups){
    let bestKey = '';
    let bestN = -1;
    for (const [k, g] of groups.entries()){
      const n = (g.points || []).length;
      if (n > bestN){ bestN = n; bestKey = k; }
    }
    return bestKey;
  }

  function ensureHeatmapViewportOptions(groups){
    if (!heatmapViewportEl) return;
    const keys = Array.from(groups.entries())
      .sort((a,b)=> (b[1].points.length - a[1].points.length) || a[0].localeCompare(b[0]));
    const opts = keys.map(([k,g])=>{
      const label = g.w + '×' + g.h + ' (n=' + (g.points.length).toLocaleString('en-GB') + ')';
      return '<option value="'+esc(k)+'">' + esc(label) + '</option>';
    });
    heatmapViewportEl.innerHTML = opts.length ? opts.join('') : '<option value="">No viewport data</option>';

    const wanted = heatmapState.viewportKey;
    if (wanted && groups.has(wanted)){
      heatmapViewportEl.value = wanted;
    } else {
      const def = chooseDefaultViewportKey(groups);
      heatmapViewportEl.value = def;
      heatmapState.viewportKey = def;
    }
  }

  function buildHeatIntensityCanvas(w, h, points){
    const intensity = document.createElement('canvas');
    intensity.width = w;
    intensity.height = h;
    const ctx = intensity.getContext('2d');
    if (!ctx) return intensity;

    // Pre-render stamp
    const radius = Math.max(16, Math.round(Math.min(w,h) * 0.035));
    const stamp = document.createElement('canvas');
    stamp.width = radius * 2;
    stamp.height = radius * 2;
    const sctx = stamp.getContext('2d');
    const grad = sctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0,0,stamp.width, stamp.height);

    ctx.clearRect(0,0,w,h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.06;

    for (const p of points || []){
      const x = Math.round(p.x - radius);
      const y = Math.round(p.y - radius);
      ctx.drawImage(stamp, x, y);
    }
    ctx.globalAlpha = 1;
    return intensity;
  }

  function colouriseHeatmap(intensityCanvas){
    const w = intensityCanvas.width;
    const h = intensityCanvas.height;
    const ctx = intensityCanvas.getContext('2d');
    const img = ctx.getImageData(0,0,w,h);
    const data = img.data;
    let maxA = 0;
    for (let i=3;i<data.length;i+=4) maxA = Math.max(maxA, data[i]);
    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return outCanvas;
    const outImg = outCtx.createImageData(w,h);
    const out = outImg.data;

    const denom = maxA || 1;
    for (let i=0;i<data.length;i+=4){
      const a = data[i+3];
      if (!a){
        out[i+3] = 0;
        continue;
      }
      // Contrast curve
      const t = Math.pow(a / denom, 0.65);
      const idx = Math.max(0, Math.min(255, Math.round(t * 255)));
      const c = HEAT_PALETTE[idx];
      out[i] = c[0];
      out[i+1] = c[1];
      out[i+2] = c[2];
      out[i+3] = Math.round(255 * Math.min(1, t));
    }

    outCtx.putImageData(outImg, 0, 0);
    return outCanvas;
  }

  function drawBackground(ctx, w, h){
    // Fill with white first for consistent export/background.
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,w,h);
    ctx.restore();

    if (!heatmapState.bgImage) return;
    const img = heatmapState.bgImage;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;

    // Contain
    const s = Math.min(w / iw, h / ih);
    const dw = iw * s;
    const dh = ih * s;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;
    try{ ctx.drawImage(img, dx, dy, dw, dh); }catch(e){}
  }

  function renderHeatmap(participants, selectedParticipant, selectedEvents, includeMeta){
    if (!heatmapCanvas || !heatmapViewportEl) return;

    const groups = collectHeatmapGroups(participants, selectedParticipant, selectedEvents, includeMeta);
    ensureHeatmapViewportOptions(groups);

    const key = heatmapViewportEl.value || heatmapState.viewportKey;
    heatmapState.viewportKey = key;
    const g = key && groups.has(key) ? groups.get(key) : null;

    if (!g || !g.points.length){
      // Clear canvas
      try{
        const ctx = heatmapCanvas.getContext('2d');
        heatmapCanvas.width = 600;
        heatmapCanvas.height = 340;
        ctx && ctx.clearRect(0,0,heatmapCanvas.width, heatmapCanvas.height);
        if (heatmapNoteEl) heatmapNoteEl.textContent = 'No heatmap data found (missing x/y/viewport_w/viewport_h or filtered out by the current event settings).';
      }catch(e){}
      return;
    }

    heatmapCanvas.width = g.w;
    heatmapCanvas.height = g.h;
    const ctx = heatmapCanvas.getContext('2d');
    if (!ctx) return;

    drawBackground(ctx, g.w, g.h);

    const intensity = buildHeatIntensityCanvas(g.w, g.h, g.points);
    const coloured = colouriseHeatmap(intensity);

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, Number(heatmapState.opacity) || 0.85));
    ctx.drawImage(coloured, 0, 0);
    ctx.restore();

    const viewportCount = groups.size;
    const msg = [
      'Points: ' + g.points.length.toLocaleString('en-GB'),
      'Viewport: ' + g.w + '×' + g.h,
      viewportCount > 1 ? ('Viewport groups detected: ' + viewportCount + ' (select one above).') : ''
    ].filter(Boolean).join(' · ');
    if (heatmapNoteEl) heatmapNoteEl.textContent = msg;
  }

  function heatmapHotspotSummary(participants, selectedParticipant, selectedEvents, includeMeta){
    const groups = collectHeatmapGroups(participants, selectedParticipant, selectedEvents, includeMeta);
    const key = (heatmapState.viewportKey && groups.has(heatmapState.viewportKey))
      ? heatmapState.viewportKey
      : chooseDefaultViewportKey(groups);
    if (!key || !groups.has(key)) return null;
    const g = groups.get(key);
    if (!g.points.length) return null;

    const bins = 20;
    const grid = new Array(bins * bins).fill(0);
    for (const p of g.points){
      const xi = Math.max(0, Math.min(bins - 1, Math.floor((p.x / g.w) * bins)));
      const yi = Math.max(0, Math.min(bins - 1, Math.floor((p.y / g.h) * bins)));
      grid[yi * bins + xi] += 1;
    }
    let best = 0;
    for (let i=1;i<grid.length;i++) if (grid[i] > grid[best]) best = i;
    const bestX = (best % bins + 0.5) / bins;
    const bestY = (Math.floor(best / bins) + 0.5) / bins;
    return {
      viewportKey: key,
      w: g.w,
      h: g.h,
      points: g.points.length,
      hotspotX: bestX,
      hotspotY: bestY,
      hotspotCount: grid[best]
    };
  }

  async function exportCanvasAsPng(canvas, filenameBase){
    if (!canvas) return;
    const preset = getExportPreset();
    const margin = Math.round(preset.marginPx * preset.scale);
    const out = document.createElement('canvas');
    out.width = Math.round(canvas.width * preset.scale) + margin * 2;
    out.height = Math.round(canvas.height * preset.scale) + margin * 2;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,out.width,out.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, margin, margin, Math.round(canvas.width * preset.scale), Math.round(canvas.height * preset.scale));
    const blob = await new Promise(resolve => out.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const filename = (filenameBase || 'visualisation') + preset.suffix + '.png';
    try{ saveAs(blob, filename); }catch(e){
      const a = document.createElement('a');
      a.download = filename;
      a.href = URL.createObjectURL(blob);
      a.click();
    }
  }

  async function exportChartCanvasAsPng(canvas, filenameBase){
    if (!canvas || !window.Chart) return;
    const preset = getExportPreset();
    const chart = Chart.getChart(canvas);
    if (!chart){
      await exportCanvasAsPng(canvas, filenameBase);
      return;
    }

    // Re-render at export resolution (avoid blur)
    const dpr = chart.currentDevicePixelRatio || window.devicePixelRatio || 1;
    const cssW = Math.max(1, Math.round(chart.width / dpr));
    const cssH = Math.max(1, Math.round(chart.height / dpr));

    const off = document.createElement('canvas');
    off.width = Math.round(cssW * preset.scale);
    off.height = Math.round(cssH * preset.scale);

    const cfg = {
      type: chart.config.type,
      data: cloneDeepPreserveFunctions(chart.config.data),
      options: cloneDeepPreserveFunctions(chart.config.options || {}),
      plugins: chart.config.plugins ? chart.config.plugins.slice() : []
    };
    cfg.options = cfg.options || {};
    cfg.options.responsive = false;
    cfg.options.animation = false;

    // Keep export deterministic and aligned with the chosen pixel size.
    cfg.options.devicePixelRatio = 1;

    // For print exports, scale font sizes and strokes so the exported image matches
    // the on-screen appearance (rather than shrinking text relative to the larger canvas).
    if (preset.mode === 'print' && preset.scale !== 1){
      scaleChartConfigForExport(cfg, preset.scale);
    }

    let offChart = null;
    try{
      offChart = new Chart(off.getContext('2d'), cfg);
      offChart.update('none');
    }catch(e){
      // Fallback to current canvas
      await exportCanvasAsPng(canvas, filenameBase);
      try{ offChart && offChart.destroy(); }catch(_e){}
      return;
    }

    const margin = Math.round(preset.marginPx * preset.scale);
    const out = document.createElement('canvas');
    out.width = off.width + margin * 2;
    out.height = off.height + margin * 2;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,out.width,out.height);
    ctx.drawImage(off, margin, margin);

    const blob = await new Promise(resolve => out.toBlob(resolve, 'image/png'));
    try{ offChart && offChart.destroy(); }catch(e){}
    if (!blob) return;
    const filename = (filenameBase || 'chart') + preset.suffix + '.png';
    try{ saveAs(blob, filename); }catch(e){
      const a = document.createElement('a');
      a.download = filename;
      a.href = URL.createObjectURL(blob);
      a.click();
    }
  }

  function buildInterpretationText(participants, agg, selectedParticipant, selectedEvents, includeMeta, binSizeSec){
    const filters = Array.from(selectedEvents || []).sort().join(', ');
    const filterLine = 'Event filter: ' + (filters || 'none') + (includeMeta ? ' (meta events included)' : ' (meta events excluded)') + '. Time bin: ' + (binSizeSec || 10) + ' s.';

    const topEvents = Array.from((agg && agg.sumEventCounts ? agg.sumEventCounts.entries() : [])).sort((a,b)=> b[1]-a[1]).slice(0,3);
    const topEventsLine = topEvents.length
      ? ('Most frequent event types: ' + topEvents.map(([k,v])=> k + ' (n=' + v.toLocaleString('en-GB') + ')').join(', ') + '.')
      : 'Most frequent event types: not available.';

    const baseLines = [];
    baseLines.push('MapLogger Analyser – interpretation summary');
    baseLines.push('');
    baseLines.push('Dataset: ' + (agg ? agg.n : participants.length) + ' participant(s).');
    baseLines.push(filterLine);
    baseLines.push('');

    if (selectedParticipant && selectedParticipant !== '__aggregate__'){
      const p = participants.find(x => x.participantId === selectedParticipant);
      if (!p){
        baseLines.push('Selected participant: ' + selectedParticipant + ' (not found in the current dataset).');
        return baseLines.join('\n');
      }
      baseLines.push('Participant-level summary (' + p.participantId + '):');
      baseLines.push('- Total interactions: ' + p.interactions.toLocaleString('en-GB') + '.');
      baseLines.push('- Session duration (estimated): ' + (p.durationSec !== null ? (niceNumber(p.durationSec/60,2) + ' min') : 'not available') + '.');
      baseLines.push('- Interaction rate: ' + (p.interactionsPerMin !== null ? (niceNumber(p.interactionsPerMin,2) + ' interactions/min') : 'not available') + '.');

      const pe = Array.from(p.eventCounts.entries()).sort((a,b)=> b[1]-a[1]).slice(0,3);
      if (pe.length) baseLines.push('- Most frequent events: ' + pe.map(([k,v])=> k + ' (n=' + v.toLocaleString('en-GB') + ')').join(', ') + '.');

      // Zoom direction split
      let zin = 0, zout = 0;
      const src = (Array.isArray(p.analysisRows) && p.analysisRows.length) ? p.analysisRows : (p.rows || []);
      for (const r of src){
        const evt = String(r.event_type || '').trim();
        if (!evt) continue;
        if (!isInteractionEvent(evt, selectedEvents, includeMeta)) continue;
        const zd = zoomDirectionFromRow(r);
        if (zd === 'Zoom in') zin++;
        if (zd === 'Zoom out') zout++;
      }
      if (zin || zout) baseLines.push('- Wheel zoom direction: zoom-in n=' + zin.toLocaleString('en-GB') + ', zoom-out n=' + zout.toLocaleString('en-GB') + '.');

      const hs = heatmapHotspotSummary(participants, selectedParticipant, selectedEvents, includeMeta);
      if (hs){
        baseLines.push('- Heatmap: n=' + hs.points.toLocaleString('en-GB') + ' points (viewport ' + hs.w + '×' + hs.h + '), hotspot around ' + niceNumber(hs.hotspotX*100,1) + '% width and ' + niceNumber(hs.hotspotY*100,1) + '% height.');
      }

      baseLines.push('');
      baseLines.push('Interpretation:');
      baseLines.push('The participant\'s interaction pattern can be reconstructed from the event timeline, where bursts of events indicate active exploration and sparse periods likely reflect reading or decision-making. The distribution of zoom-in/zoom-out events may indicate whether the participant primarily drilled down into detail or repeatedly re-oriented to regain context. Heatmap hotspots highlight which screen regions received most interaction attention and can be mapped to interface components when overlaid with a screenshot.');
      return baseLines.join('\n');
    }

    // Aggregate view
    if (agg){
      baseLines.push('Aggregate summary:');
      baseLines.push('- Total interactions (sum): ' + (agg.interactions && agg.interactions.sum !== undefined ? agg.interactions.sum.toLocaleString('en-GB') : '–') + '.');
      baseLines.push('- Interactions per participant (median, IQR): ' + (agg.interactions && agg.interactions.median !== null ? (niceNumber(agg.interactions.median,0) + ' (' + niceNumber(agg.interactions.q1,0) + '–' + niceNumber(agg.interactions.q3,0) + ')') : '–') + '.');
      baseLines.push('- Session duration (median): ' + (agg.durationSec && agg.durationSec.median !== null ? (niceNumber(agg.durationSec.median/60,2) + ' min') : '–') + '.');
      baseLines.push('- Interaction rate (mean): ' + (agg.interactionsPerMin && agg.interactionsPerMin.mean !== null ? (niceNumber(agg.interactionsPerMin.mean,2) + ' interactions/min') : '–') + '.');
      baseLines.push(topEventsLine);

      const hs = heatmapHotspotSummary(participants, '__aggregate__', selectedEvents, includeMeta);
      if (hs){
        baseLines.push('Heatmap: n=' + hs.points.toLocaleString('en-GB') + ' points (viewport ' + hs.w + '×' + hs.h + '), hotspot around ' + niceNumber(hs.hotspotX*100,1) + '% width and ' + niceNumber(hs.hotspotY*100,1) + '% height.');
      }

      baseLines.push('');
      baseLines.push('Interpretation:');
      baseLines.push('Across participants, interaction volume and session duration provide a first-order estimate of task difficulty and interface efficiency. Event-type dominance (e.g., intensive zooming vs keyboard input) indicates the main interaction strategy. Temporal peaks in the timeline can be used to locate critical moments of intensive exploration or difficulty. Spatial hotspots in the heatmap indicate where attention and interaction effort concentrated on the interface.');
    }

    return baseLines.join('\n');
  }

  function renderInterpretation(participants, agg, selectedParticipant, selectedEvents, includeMeta, binSizeSec){
    if (!interpretationTextEl) return;
    interpretationTextEl.value = buildInterpretationText(participants, agg, selectedParticipant, selectedEvents, includeMeta, binSizeSec);
  }

  function renderParticipantTable(participants){
    if (!tablesEl) return;
    if (!participants.length){ tablesEl.innerHTML = ''; return; }

    const rows = participants.map(p => ({
      participant: p.participantId,
      interactions: p.interactions,
      durationMin: (p.durationSec!==null? (p.durationSec/60) : null),
      ipm: p.interactionsPerMin
    }));

    const html = [
      '<div style="margin-top:.75rem;margin-bottom:.35rem;font-weight:800">Participant summary</div>',
      '<table class="table" aria-label="Participant summary table">',
      '<thead><tr>',
      '<th>Participant</th>',
      '<th class="num">Interactions</th>',
      '<th class="num">Duration (min)</th>',
      '<th class="num">Interactions/min</th>',
      '</tr></thead>',
      '<tbody>',
      rows.map(r =>
        '<tr>'
          + '<td>' + esc(r.participant) + '</td>'
          + '<td class="num">' + esc((r.interactions).toLocaleString('en-GB')) + '</td>'
          + '<td class="num">' + esc(r.durationMin!==null? niceNumber(r.durationMin,2): '–') + '</td>'
          + '<td class="num">' + esc(r.ipm!==null? niceNumber(r.ipm,2): '–') + '</td>'
        + '</tr>'
      ).join(''),
      '</tbody></table>'
    ].join('');

    tablesEl.innerHTML = html;
  }

  function rebuildParticipantSelect(participants){
    if (!participantSelectEl) return;
    const current = participantSelectEl.value || '__aggregate__';
    const opts = ['<option value="__aggregate__">Aggregate</option>']
      .concat(participants.map(p => '<option value="'+esc(p.participantId)+'">'+esc(p.participantId)+'</option>'));
    participantSelectEl.innerHTML = opts.join('');
    // try to keep previous selection
    try{ participantSelectEl.value = current; }catch(e){}
    if (participantSelectEl.value !== current) participantSelectEl.value = '__aggregate__';
  }

  function rebuildAll(){
    clearWarn();

    const participants = datasets
      .filter(d => Array.isArray(d.rows) && d.rows.length)
      .map(computeParticipantStats);

    rebuildParticipantSelect(participants);

    if (!participants.length){
      renderSummary([], {n:0,sumEventCounts:new Map(),sumTaskCounts:new Map(),taskLabels:new Map(),sumTaskDurationsMs:new Map(),interactions:{},durationSec:{},interactionsPerMin:{}});
      destroyChart(charts.eventTypes);
      destroyChart(charts.perParticipant);
      destroyChart(charts.timeline);
      destroyChart(charts.tasks);
      destroyChart(charts.taskProfiles);
      destroyChart(charts.taskShares);
      destroyChart(charts.elementTag);
      destroyChart(charts.elementId);
      destroyChart(charts.elementText);
      destroyChart(charts.mouseButton);
      destroyChart(charts.zoomDirection);
      destroyChart(charts.key);
      destroyChart(charts.code);
      destroyChart(charts.modifiers);
      destroyChart(charts.eventTimeline);
      charts = {
        eventTypes: null,
        perParticipant: null,
        timeline: null,
        tasks: null,
        taskProfiles: null,
        taskShares: null,
        elementTag: null,
        elementId: null,
        elementText: null,
        mouseButton: null,
        zoomDirection: null,
        key: null,
        code: null,
        modifiers: null,
        eventTimeline: null
      };
      if (tablesEl) tablesEl.innerHTML = '';
      if (interpretationTextEl) interpretationTextEl.value = '';
      setTaskSharesFallback('');
      setTernaryFallback('');
      renderHeatmap([], '__aggregate__', getSelectedEventTypes(), !!(includeMetaEl && includeMetaEl.checked));
      return;
    }

    const agg = computeAggregate(participants);
    renderSummary(participants, agg);

    const selectedParticipant = participantSelectEl ? participantSelectEl.value : '__aggregate__';

    // Timeline
    const binSizeSec = Number(binSizeEl && binSizeEl.value) || 10;
    const selectedEvents = getSelectedEventTypes();
    const includeMeta = !!(includeMetaEl && includeMetaEl.checked);
    const timeline = buildTimeline(participants, selectedEvents, includeMeta, binSizeSec);

    lastComputed = { participants, agg, selectedParticipant, selectedEvents, includeMeta, binSizeSec };

    // Charts
    buildEventTypesChart(agg);
    buildPerParticipantChart(participants);
    buildTimelineChart(timeline, participants);
    buildTasksChart(participants, agg);
    buildTaskInteractionProfilesChart(participants, agg, selectedParticipant, selectedEvents);
    buildTaskSharesBoxplot(participants, selectedEvents);
    buildTernaryPlot(participants, agg, selectedParticipant);

    buildAttributeCharts(participants, selectedParticipant, selectedEvents, includeMeta);
    buildEventTimelineChart(participants, selectedParticipant, selectedEvents, includeMeta);

    renderHeatmap(participants, selectedParticipant, selectedEvents, includeMeta);
    renderInterpretation(participants, agg, selectedParticipant, selectedEvents, includeMeta, binSizeSec);

    renderParticipantTable(participants);

    // Surface parse warnings if any
    const warnings = datasets.flatMap(d => (d.meta && d.meta.parseErrors ? d.meta.parseErrors.map(e => d.name + ': ' + e) : []));
    if (warnings.length){
      warn(warnings.slice(0, 6).join(' \n '));
    }
  }

  function rerenderHeatmapAndInterpretation(){
    try{
      renderHeatmap(lastComputed.participants || [], lastComputed.selectedParticipant, lastComputed.selectedEvents, lastComputed.includeMeta);
      if (lastComputed.agg){
        renderInterpretation(lastComputed.participants || [], lastComputed.agg, lastComputed.selectedParticipant, lastComputed.selectedEvents, lastComputed.includeMeta, lastComputed.binSizeSec);
      }
    }catch(e){ /* no-op */ }
  }

  function exportSummaryCsv(){
    if (!datasets.length){ warn('Nothing to export yet.'); return; }

    const participants = datasets
      .filter(d => Array.isArray(d.rows) && d.rows.length)
      .map(computeParticipantStats);
    const agg = participants.length ? computeAggregate(participants) : null;

    const lines = [];
    lines.push(['participant','rows','interactions','duration_sec','interactions_per_min'].join(','));
    for (const p of participants){
      lines.push([
        p.participantId,
        p.rowsCount,
        p.interactions,
        (p.durationSec!==null? Math.round(p.durationSec): ''),
        (p.interactionsPerMin!==null? p.interactionsPerMin.toFixed(3): '')
      ].map(v => {
        const s = String(v);
        return (s.includes(',')||s.includes('"')||s.includes('\n')) ? ('"'+s.replace(/"/g,'""')+'"') : s;
      }).join(','));
    }

    if (agg){
      lines.push('');
      lines.push(['metric','value'].join(','));
      lines.push(['participants', agg.n].join(','));
      lines.push(['interactions_sum', agg.interactions.sum].join(','));
      lines.push(['interactions_mean', (agg.interactions.mean ?? '')].join(','));
      lines.push(['interactions_median', (agg.interactions.median ?? '')].join(','));
      lines.push(['duration_sec_mean', (agg.durationSec.mean ?? '')].join(','));
      lines.push(['duration_sec_median', (agg.durationSec.median ?? '')].join(','));
      lines.push(['interactions_per_min_mean', (agg.interactionsPerMin.mean ?? '')].join(','));
    }

    const utf8bom = "\ufeff";
    const blob = new Blob([utf8bom, lines.join('\n')], {type: 'text/csv;charset=utf-8'});
    try{
      saveAs(blob, 'maplogger_summary.csv');
    }catch(e){
      // fallback
      const a = document.createElement('a');
      a.download = 'maplogger_summary.csv';
      a.href = URL.createObjectURL(blob);
      a.click();
    }
  }

  async function loadSampleData(){
    clearWarn();
    // Works when served via a local/static server (file:// may block fetch)
    const sampleNames = ['P01.csv','P02.csv','P03.csv','P04.csv','P05.csv'];
    // Prefer a path relative to the Suite's index.html.
    // Live Server in multi-root workspaces often serves ONLY the folder you started it in.
    const baseUrls = [
      './sample_data/',
      '/sample_data/',
      '../sample_data/',
      '../../sample_data/'
    ];

    const loaded = [];
    const attempted = [];
    for (const name of sampleNames){
      let ok = false;
      for (const base of baseUrls){
        try{
          const url = base + name;
          attempted.push(url);
          const res = await fetch(url, {cache: 'no-store'});
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
                resolve({ name, size: text.length, rows: Array.isArray(r.data)? r.data: [], meta: { parseErrors } });
              }
            });
          });
          loaded.push(parsed);
          ok = true;
          break;
        }catch(e){
          // try next base url
        }
      }
      if (!ok){
        warn('Could not load sample data. If you are using Live Server, make sure it is started from the folder that contains the Suite\'s index.html (so ./sample_data is accessible). Tried: ' + attempted.slice(0, 6).join(', ') + (attempted.length > 6 ? ', …' : '') + '.');
        break;
      }
    }

    if (loaded.length){
      datasets = loaded;
      datasets.sort((a,b)=> baseName(a.name).localeCompare(baseName(b.name), 'en-GB', {numeric:true}));
      renderFileList();
      rebuildAll();
    }
  }

  function wireEvents(){
    if (input){
      input.addEventListener('change', async (e)=>{
        const files = e.target && e.target.files ? e.target.files : [];
        await addCsvFiles(files);
        input.value = '';
      });
    }

    if (dropzone){
      dropzone.addEventListener('click', (e)=>{ if (e.target === dropzone && input) input.click(); });
      dropzone.addEventListener('dragover', (e)=>{ e.preventDefault(); });
      dropzone.addEventListener('drop', async (e)=>{
        e.preventDefault();
        const files = e.dataTransfer ? e.dataTransfer.files : [];
        await addCsvFiles(files);
      });
    }

    if (clearBtn){
      clearBtn.addEventListener('click', ()=>{
        datasets = [];
        renderFileList();
        rebuildAll();
      });
    }

    if (exportBtn){
      exportBtn.addEventListener('click', exportSummaryCsv);
    }

    if (sampleBtn){
      sampleBtn.addEventListener('click', loadSampleData);
    }

    const controls = [binSizeEl, timelineAggEl, participantSelectEl, includeMetaEl].filter(Boolean);
    for (const c of controls){
      c.addEventListener('change', rebuildAll);
    }
    for (const el of evtFilterEls){
      el.addEventListener('change', rebuildAll);
    }

    // Ternary controls (no full recompute needed)
    const ternaryControls = [ternaryTaskEl, ternaryAEl, ternaryBEl, ternaryCEl].filter(Boolean);
    for (const c of ternaryControls){
      c.addEventListener('change', ()=>{
        updateTernaryStateFromUi();
        rerenderTernary();
      });
    }
    window.addEventListener('resize', ()=>{ rerenderTernary(); });

    // Heatmap controls
    if (heatmapViewportEl){
      heatmapViewportEl.addEventListener('change', ()=>{
        heatmapState.viewportKey = heatmapViewportEl.value || '';
        rerenderHeatmapAndInterpretation();
      });
    }
    if (heatmapOpacityEl){
      heatmapOpacityEl.addEventListener('input', ()=>{
        heatmapState.opacity = Number(heatmapOpacityEl.value);
        rerenderHeatmapAndInterpretation();
      });
    }
    if (heatmapBgEl){
      heatmapBgEl.addEventListener('change', ()=>{
        const file = heatmapBgEl.files && heatmapBgEl.files[0] ? heatmapBgEl.files[0] : null;
        if (!file){
          heatmapState.bgImage = null;
          if (heatmapState.bgUrl){ try{ URL.revokeObjectURL(heatmapState.bgUrl); }catch(e){} }
          heatmapState.bgUrl = '';
          rerenderHeatmapAndInterpretation();
          return;
        }
        if (heatmapState.bgUrl){ try{ URL.revokeObjectURL(heatmapState.bgUrl); }catch(e){} }
        const url = URL.createObjectURL(file);
        heatmapState.bgUrl = url;
        const img = new Image();
        img.onload = ()=>{ heatmapState.bgImage = img; rerenderHeatmapAndInterpretation(); };
        img.onerror = ()=>{ heatmapState.bgImage = null; rerenderHeatmapAndInterpretation(); };
        img.src = url;
      });
    }
    if (heatmapClearBgBtn){
      heatmapClearBgBtn.addEventListener('click', ()=>{
        heatmapState.bgImage = null;
        if (heatmapState.bgUrl){ try{ URL.revokeObjectURL(heatmapState.bgUrl); }catch(e){} }
        heatmapState.bgUrl = '';
        if (heatmapBgEl) heatmapBgEl.value = '';
        rerenderHeatmapAndInterpretation();
      });
    }

    // Global button delegation for info + download
    document.addEventListener('click', async (e)=>{
      const infoBtn = e.target && e.target.closest ? e.target.closest('button.info-btn') : null;
      if (infoBtn){
        const key = infoBtn.getAttribute('data-help') || '';
        openInfoModal(key);
        return;
      }

      const dlBtn = e.target && e.target.closest ? e.target.closest('button.download-btn') : null;
      if (dlBtn){
        const kind = dlBtn.getAttribute('data-export-kind') || 'canvas';
        const targetId = dlBtn.getAttribute('data-export') || '';
        if (!targetId) return;
        const canvas = document.getElementById(targetId);
        const base = targetId.replace(/^chart-/, '').replace(/[^a-z0-9_-]+/gi, '_');
        if (kind === 'chart') await exportChartCanvasAsPng(canvas, base);
        else await exportCanvasAsPng(canvas, base);
        return;
      }
    });

    // Modal close
    if (infoModalCloseBtn) infoModalCloseBtn.addEventListener('click', closeInfoModal);
    if (infoModalEl){
      infoModalEl.addEventListener('click', (e)=>{ if (e.target === infoModalEl) closeInfoModal(); });
    }
    window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') closeInfoModal(); });

    // Interpretation actions
    if (interpretationCopyBtn){
      interpretationCopyBtn.addEventListener('click', async ()=>{
        const text = (interpretationTextEl && interpretationTextEl.value) ? interpretationTextEl.value : '';
        if (!text) return;
        try{ await navigator.clipboard.writeText(text); }
        catch(e){
          // Fallback
          try{ interpretationTextEl.focus(); interpretationTextEl.select(); document.execCommand('copy'); }catch(_e){}
        }
      });
    }
    if (interpretationDownloadBtn){
      interpretationDownloadBtn.addEventListener('click', ()=>{
        const text = (interpretationTextEl && interpretationTextEl.value) ? interpretationTextEl.value : '';
        const blob = new Blob(["\ufeff", text], {type:'text/plain;charset=utf-8'});
        try{ saveAs(blob, 'maplogger_interpretation.txt'); }
        catch(e){
          const a = document.createElement('a');
          a.download = 'maplogger_interpretation.txt';
          a.href = URL.createObjectURL(blob);
          a.click();
        }
      });
    }
  }

  // Boot
  renderFileList();
  attachListHandlers();
  wireEvents();
  rebuildAll();
})();
