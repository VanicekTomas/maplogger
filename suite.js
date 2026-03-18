(function(){
  const btnBuilder = document.getElementById('tab-btn-builder');
  const btnAnalyser = document.getElementById('tab-btn-analyser');
  const btnCartologger = document.getElementById('tab-btn-cartologger');
  const panelBuilder = document.getElementById('tab-panel-builder');
  const panelAnalyser = document.getElementById('tab-panel-analyser');
  const panelCartologger = document.getElementById('tab-panel-cartologger');
  const badge = document.querySelector('.badge');
  const panels = {
    builder: panelBuilder,
    analyser: panelAnalyser,
    cartologger: panelCartologger
  };

  const TAB_TRANSITION_MS = 180;
  let activeTab = null;
  let transitionTimer = null;

  function prefersReducedMotion(){
    try{ return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch(e){ return false; }
  }

  function cleanupPanelState(panel){
    if (!panel) return;
    panel.classList.remove('is-entering');
    panel.classList.remove('is-leaving');
  }

  function updateTabsUi(tab){
    const isBuilder = tab === 'builder';
    const isAnalyser = tab === 'analyser';
    const isCartologger = tab === 'cartologger';

    if (btnBuilder){ btnBuilder.classList.toggle('active', isBuilder); btnBuilder.setAttribute('aria-selected', String(isBuilder)); }
    if (btnAnalyser){ btnAnalyser.classList.toggle('active', isAnalyser); btnAnalyser.setAttribute('aria-selected', String(isAnalyser)); }
    if (btnCartologger){ btnCartologger.classList.toggle('active', isCartologger); btnCartologger.setAttribute('aria-selected', String(isCartologger)); }

    if (badge){
      if (isBuilder) badge.textContent = 'Builder';
      else if (isAnalyser) badge.textContent = 'Analyser';
      else badge.textContent = 'CartoLogger';
    }
  }

  function showOnly(tab){
    for (const key of Object.keys(panels)){
      const p = panels[key];
      if (!p) continue;
      p.classList.add('tab-panel-anim');
      cleanupPanelState(p);
      p.classList.toggle('hidden', key !== tab);
    }
  }

  function setTab(tab){
    if (!panels[tab]) return;
    window.MAPLOGGER_ACTIVE_TAB = tab;
    updateTabsUi(tab);

    const nextPanel = panels[tab];
    const currentPanel = activeTab ? panels[activeTab] : null;

    if (transitionTimer){
      clearTimeout(transitionTimer);
      transitionTimer = null;
    }

    if (!activeTab || !currentPanel || currentPanel === nextPanel || prefersReducedMotion()){
      showOnly(tab);
      activeTab = tab;
      try{ window.scrollTo({ top: 0, behavior: 'smooth' }); }catch(e){ window.scrollTo(0,0); }
      return;
    }

    // Entering panel
    nextPanel.classList.add('tab-panel-anim');
    nextPanel.classList.remove('hidden');
    cleanupPanelState(nextPanel);
    nextPanel.classList.add('is-entering');

    // Leaving panel
    currentPanel.classList.add('tab-panel-anim');
    cleanupPanelState(currentPanel);
    currentPanel.classList.add('is-leaving');

    // Trigger transition frame
    requestAnimationFrame(()=>{
      nextPanel.classList.remove('is-entering');
    });

    transitionTimer = setTimeout(()=>{
      for (const key of Object.keys(panels)){
        const p = panels[key];
        if (!p) continue;
        cleanupPanelState(p);
        p.classList.toggle('hidden', key !== tab);
      }
      transitionTimer = null;
    }, TAB_TRANSITION_MS + 20);

    activeTab = tab;

    // Scroll to top for a predictable context when switching tools
    try{ window.scrollTo({ top: 0, behavior: 'smooth' }); }catch(e){ window.scrollTo(0,0); }
  }

  if (btnBuilder) btnBuilder.addEventListener('click', ()=> setTab('builder'));
  if (btnAnalyser) btnAnalyser.addEventListener('click', ()=> setTab('analyser'));
  if (btnCartologger) btnCartologger.addEventListener('click', ()=> setTab('cartologger'));

  // Default tab
  setTab('builder');
})();
