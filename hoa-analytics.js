// Journal des visites — IP + FAI (ISP)
(function () {
  const SESSION_KEY = 'hoa-visit-logged';
  let sb = null;

  function setClient(client) {
    sb = client;
  }

  async function trackVisit() {
    if (!sb || sessionStorage.getItem(SESSION_KEY)) return;

    try {
      const res = await fetch('https://ipwho.is/');
      const d = await res.json();
      if (!d.success || !d.ip) return;

      const { error } = await sb.from('visitor_logs').insert({
        ip: d.ip,
        isp: d.connection?.isp || null,
        org: d.connection?.org || null,
        city: d.city || null,
        country: d.country || null,
        user_agent: navigator.userAgent.slice(0, 500),
        page: location.pathname || '/',
      });

      if (!error) sessionStorage.setItem(SESSION_KEY, '1');
    } catch (e) {
      console.warn('[hoa-analytics] track failed:', e);
    }
  }

  async function loadVisitors(limit = 200) {
    if (!sb) return { rows: [], error: 'Supabase non configuré' };
    const { data, error } = await sb
      .from('visitor_logs')
      .select('id, ip, isp, org, city, country, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return { rows: [], error: error.message };
    return { rows: data || [], error: null };
  }

  window.HOA_ANALYTICS = { setClient, trackVisit, loadVisitors };
})();
