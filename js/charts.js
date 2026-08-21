/* ============================================================
   CHARTS — Chart.js loaded on demand, never on first paint
   ============================================================ */
window.Charts = (function () {
  let loading = null;

  function load() {
    if (window.Chart) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      // A blocked or slow CDN must not leave the page waiting forever —
      // without this the whole view never finishes rendering.
      const timer = setTimeout(() => {
        loading = null;
        rej(new Error('Chart.js took too long to load'));
      }, 8000);
      s.onload = () => { clearTimeout(timer); res(); };
      s.onerror = () => { clearTimeout(timer); loading = null;
        rej(new Error('Chart.js could not be loaded')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  function base() {
    const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
    return {
      responsive:true, maintainAspectRatio:false,
      animation: reduced ? false : { duration:420 },
      interaction:{ mode:'index', intersect:false },
      plugins:{ legend:{ display:true, labels:{ usePointStyle:true, boxWidth:8,
        font:{ family:'Outfit, system-ui, sans-serif', size:11 }, color:css('--muted-text') } } },
      scales:{
        x:{ grid:{ display:false }, ticks:{ color:css('--muted-text'),
            font:{ size:10 }, maxRotation:0, autoSkipPadding:16 } },
        y:{ beginAtZero:true, grid:{ color:css('--border-soft') },
            ticks:{ color:css('--muted-text'), font:{ size:10 } } }
      }
    };
  }

  async function line_(id, points, keep, existing) {
    await load();
    const el = document.getElementById(id); if (!el) return;
    if (existing) existing.destroy();
    const labels = points.map(p => new Date(p.day)
      .toLocaleDateString(CONFIG.LOCALE, { day:'2-digit', month:'short' }));
    const c = new Chart(el, {
      type:'line',
      data:{ labels, datasets:[
        { label:'Sales (₹)', data:points.map(p => p.sales), tension:.34,
          borderColor:css('--primary'), backgroundColor:'rgba(122,38,58,.10)',
          fill:true, pointRadius:0, pointHoverRadius:4, borderWidth:2, yAxisID:'y' },
        { label:'Orders', data:points.map(p => p.orders), tension:.34,
          borderColor:css('--secondary'), borderDash:[5,4], fill:false,
          pointRadius:0, pointHoverRadius:4, borderWidth:2, yAxisID:'y1' }
      ]},
      options:{ ...base(), scales:{ ...base().scales,
        y1:{ position:'right', beginAtZero:true, grid:{ display:false },
             ticks:{ color:css('--muted-text'), font:{ size:10 }, precision:0 } } } }
    });
    if (keep) keep(c);
    return c;
  }

  async function bar_(id, labels, values, label) {
    await load();
    const el = document.getElementById(id); if (!el) return;
    if (el._chart) el._chart.destroy();
    el._chart = new Chart(el, {
      type:'bar',
      data:{ labels, datasets:[{ label:label || 'Revenue', data:values,
        backgroundColor:css('--primary'), borderRadius:6, maxBarThickness:34 }] },
      options:{ ...base(), plugins:{ legend:{ display:false } } }
    });
    return el._chart;
  }

  async function doughnut_(id, labels, values) {
    await load();
    const el = document.getElementById(id); if (!el) return;
    if (el._chart) el._chart.destroy();
    const palette = [css('--primary'), css('--secondary'), css('--accent'),
                     css('--primary-soft'), css('--secondary-soft'), '#8A6524', '#C08340'];
    el._chart = new Chart(el, {
      type:'doughnut',
      data:{ labels, datasets:[{ data:values, backgroundColor:palette, borderWidth:0 }] },
      options:{ responsive:true, maintainAspectRatio:false, cutout:'62%',
        plugins:{ legend:{ position:'right', labels:{ usePointStyle:true, boxWidth:8,
          font:{ size:11 }, color:css('--muted-text') } } } }
    });
    return el._chart;
  }

  /* Wrap each draw call: if Chart.js is unavailable the canvas is replaced
     with a short note and the rest of the page still works. */
  function guard(fn) {
    return async function (id, ...rest) {
      try { return await fn(id, ...rest); }
      catch (e) {
        const el = document.getElementById(id);
        if (el && el.parentElement) {
          el.parentElement.innerHTML =
            '<div class="empty"><i class="bi bi-graph-up"></i>' +
            '<b>Chart unavailable</b><p>' + (e.message || 'Could not load the chart library.') +
            '</p></div>';
        }
        return null;
      }
    };
  }

  return { load, line:guard(line_), bar:guard(bar_), doughnut:guard(doughnut_) };
})();
