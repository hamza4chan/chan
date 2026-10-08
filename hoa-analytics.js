// Journal des visites — IPv4, IPv6, FAI, zone, user-agent
(function () {
  const SESSION_KEY = 'hoa-visit-logged';
  let sb = null;

  function setClient(client) {
    sb = client;
  }

  function collectDevice() {
    const nav = navigator;
    const scr = screen;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    return {
      user_agent: nav.userAgent.slice(0, 800),
      language: nav.language,
      languages: (nav.languages || []).slice(0, 5).join(', '),
      platform: nav.platform,
      vendor: nav.vendor || null,
      cookie_enabled: nav.cookieEnabled,
      do_not_track: nav.doNotTrack,
      hardware_concurrency: nav.hardwareConcurrency || null,
      device_memory: nav.deviceMemory || null,
      max_touch_points: nav.maxTouchPoints || 0,
      screen: scr.width + 'x' + scr.height + '@' + (scr.colorDepth || '?') + 'bit',
      viewport: innerWidth + 'x' + innerHeight,
      pixel_ratio: devicePixelRatio || 1,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezone_offset: new Date().getTimezoneOffset(),
      online: nav.onLine,
      connection_type: conn?.type || null,
      effective_type: conn?.effectiveType || null,
      mobile_ua: /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(nav.userAgent),
    };
  }

  function guessConnectionType(ipData, device) {
    const isp = (ipData.connection?.isp || ipData.isp || '').toLowerCase();
    const org = (ipData.connection?.org || ipData.org || '').toLowerCase();
    const hay = isp + ' ' + org;
    const mobileKw = ['mobile', 'cellular', '4g', 'lte', '5g', 'wireless', 'free mobile', 'bouygues'];
    const boxKw = ['fibre', 'fiber', 'adsl', 'dsl', 'cable', 'ftth', 'broadband', 'fixed'];

    if (device.connection_type === 'cellular') return '4G/mobile';
    if (device.effective_type === '4g' || device.effective_type === '3g') return '4G/mobile';
    if (mobileKw.some((k) => hay.includes(k)) && device.mobile_ua) return 'Probable 4G/mobile';
    if (boxKw.some((k) => hay.includes(k))) return 'Probable box/fixe';
    if (device.mobile_ua) return 'Probable 4G/mobile';
    return 'Probable box/fixe';
  }

  function isV6(ip) {
    return typeof ip === 'string' && ip.includes(':');
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(url + ' ' + res.status);
    return res.json();
  }

  async function fetchIpWho() {
    const d = await fetchJson('https://ipwho.is/');
    if (!d.success || !d.ip) throw new Error('ipwho.is failed');
    return d;
  }

  async function fetchIpApiCo() {
    const d = await fetchJson('https://ipapi.co/json/');
    if (!d.ip) throw new Error('ipapi.co failed');
    return {
      success: true,
      ip: d.ip,
      city: d.city,
      region: d.region,
      country: d.country_name,
      country_code: d.country_code,
      latitude: d.latitude,
      longitude: d.longitude,
      type: d.version || (isV6(d.ip) ? 'IPv6' : 'IPv4'),
      connection: { isp: d.org, org: d.org, asn: d.asn },
    };
  }

  async function fetchIpify(v6) {
    const url = v6 ? 'https://api64.ipify.org?format=json' : 'https://api.ipify.org?format=json';
    const d = await fetchJson(url);
    if (!d.ip) throw new Error('ipify failed');
    return d.ip;
  }

  async function fetchIpInfo() {
    let base = null;
    for (const fn of [fetchIpWho, fetchIpApiCo]) {
      try {
        base = await fn();
        break;
      } catch (_) { /* next */ }
    }
    if (!base) throw new Error('IP lookup failed');

    let ipv4 = isV6(base.ip) ? null : base.ip;
    let ipv6 = isV6(base.ip) ? base.ip : null;

    try {
      const v4 = await fetchIpify(false);
      if (!isV6(v4)) ipv4 = v4;
    } catch (_) { /* optional */ }

    try {
      const v6 = await fetchIpify(true);
      if (isV6(v6)) ipv6 = v6;
    } catch (_) { /* optional */ }

    return { ...base, ipv4: ipv4 || null, ipv6: ipv6 || null };
  }

  function buildRow(ipData, device) {
    const deviceOut = { ...device, ipv4: ipData.ipv4, ipv6: ipData.ipv6 };
    return {
      ip: ipData.ipv4 || ipData.ip,
      isp: ipData.connection?.isp || null,
      org: ipData.connection?.org || null,
      city: ipData.city || null,
      region: ipData.region || null,
      country: ipData.country || null,
      country_code: ipData.country_code || null,
      latitude: ipData.latitude ?? null,
      longitude: ipData.longitude ?? null,
      asn: ipData.connection?.asn ? String(ipData.connection.asn) : null,
      ip_type: ipData.ipv4 && ipData.ipv6 ? 'IPv4+IPv6' : (ipData.ipv6 ? 'IPv6' : 'IPv4'),
      connection_guess: guessConnectionType(ipData, device),
      user_agent: device.user_agent,
      page: location.pathname || '/',
      device: deviceOut,
      geo_lat: null,
      geo_lng: null,
      geo_accuracy: null,
      geo_status: 'skipped',
    };
  }

  async function insertVisit(row) {
    const attempts = [
      row,
      {
        ip: row.ip,
        isp: row.isp,
        org: row.org,
        city: row.city,
        region: row.region,
        country: row.country,
        country_code: row.country_code,
        latitude: row.latitude,
        longitude: row.longitude,
        asn: row.asn,
        ip_type: row.ip_type,
        connection_guess: row.connection_guess,
        user_agent: row.user_agent,
        page: row.page,
        device: row.device,
        geo_status: row.geo_status,
      },
      {
        ip: row.ip,
        isp: row.isp,
        org: row.org,
        city: row.city,
        country: row.country,
        user_agent: row.user_agent,
        page: row.page,
      },
    ];

    let lastError = null;
    for (const payload of attempts) {
      const { error } = await sb.from('visitor_logs').insert(payload);
      if (!error) return null;
      lastError = error;
      if (!/column|schema|visitor_logs/i.test(error.message || '')) break;
    }
    return lastError;
  }

  async function trackVisit() {
    if (!sb || sessionStorage.getItem(SESSION_KEY)) return;
    try {
      const [ipData, device] = await Promise.all([
        fetchIpInfo(),
        Promise.resolve(collectDevice()),
      ]);
      const error = await insertVisit(buildRow(ipData, device));
      if (error) {
        console.warn('[hoa-analytics] insert failed:', error.message);
        return;
      }
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch (e) {
      console.warn('[hoa-analytics] track failed:', e);
    }
  }

  async function loadVisitors(limit = 300) {
    if (!sb) return { rows: [], error: 'Supabase non configuré' };

    const full = await sb
      .from('visitor_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!full.error) return { rows: full.data || [], error: null };

    const msg = full.error.message || '';
    const basic = await sb
      .from('visitor_logs')
      .select('id, ip, isp, org, city, region, country, user_agent, device, created_at, connection_guess')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (basic.error) {
      const friendly =
        /visitor_logs|relation|does not exist/i.test(msg)
          ? 'Table visitor_logs manquante — lance supabase/visitor_logs.sql dans Supabase.'
          : /permission|policy|RLS|JWT/i.test(msg + ' ' + (basic.error.message || ''))
            ? 'Lecture bloquée (RLS) — reconnecte-toi ou vérifie les policies Supabase.'
            : basic.error.message || msg;
      return { rows: [], error: friendly };
    }
    return { rows: basic.data || [], error: null };
  }

  window.HOA_ANALYTICS = {
    setClient,
    trackVisit,
    loadVisitors,
    collectDevice,
    fetchIpInfo,
  };
})();
