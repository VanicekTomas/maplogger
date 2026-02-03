(function(){
  const btnBuilder = document.getElementById('tab-btn-builder');
  const btnAnalyser = document.getElementById('tab-btn-analyser');
  const panelBuilder = document.getElementById('tab-panel-builder');
  const panelAnalyser = document.getElementById('tab-panel-analyser');
  const badge = document.querySelector('.badge');

  function setTab(tab){
    window.MAPLOGGER_ACTIVE_TAB = tab;
    const isBuilder = tab === 'builder';

    if (btnBuilder){ btnBuilder.classList.toggle('active', isBuilder); btnBuilder.setAttribute('aria-selected', String(isBuilder)); }
    if (btnAnalyser){ btnAnalyser.classList.toggle('active', !isBuilder); btnAnalyser.setAttribute('aria-selected', String(!isBuilder)); }

    if (panelBuilder) panelBuilder.classList.toggle('hidden', !isBuilder);
    if (panelAnalyser) panelAnalyser.classList.toggle('hidden', isBuilder);

    if (badge) badge.textContent = isBuilder ? 'Builder' : 'Analyser';

    // Scroll to top for a predictable context when switching tools
    try{ window.scrollTo({ top: 0, behavior: 'smooth' }); }catch(e){ window.scrollTo(0,0); }
  }

  if (btnBuilder) btnBuilder.addEventListener('click', ()=> setTab('builder'));
  if (btnAnalyser) btnAnalyser.addEventListener('click', ()=> setTab('analyser'));

  // Default tab
  setTab('builder');
})();
