// Journal des visites — IP, FAI, device
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
      pdf_viewer: nav.pdfViewerEnabled ?? null,
      webdriver: nav.webdriver || false,
      connection_type: conn?.type || null,
      effective_type: conn?.effectiveType || null,
      downlink: conn?.downlink ?? null,
      rtt: conn?.rtt ?? null,
      save_data: conn?.saveData ?? null,
      mobile_ua: /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(nav.userAgent),
    };
  }

  function guessConnectionType(ipData, device) {
    const isp = (ipData.connection?.isp || ipData.isp || '').toLowerCase();
    const org = (ipData.connection?.org || ipData.org || '').toLowerCase();
    const hay = isp + ' ' + org;

    const mobileKw = [
      'mobile', 'cellular', '4g', 'lte', '5g', 'wireless', 'gsm', 'umts',
      'bouygues telecom', 'free mobile', 'sfr', 'orange', 'vodafone',
      'telekom', 't-mobile', 'o2', 'three', 'ee limited', 'proximus',
    ];
    const boxKw = [
      'fibre', 'fiber', 'adsl', 'dsl', 'cable', 'ftth', 'broadband',
      'residential', 'fixed', 'landline', 'numericable', 'free sas',
      'orange sa', 'societe francaise du radiotelephone',
    ];

    if (device.connection_type === 'cellular') return '4G/mobile (réseau)';
    if (device.connection_type === 'wifi' || device.connection_type === 'ethernet') {
      if (device.mobile_ua) return '4G/mobile (WiFi partagé ?)';
      return 'Box/fixe (réseau local)';
    }
    if (device.effective_type === '4g' || device.effective_type === '3g') return '4G/mobile (navigateur)';
    if (mobileKw.some((k) => hay.includes(k)) && device.mobile_ua) return 'Probable 4G/mobile';
    if (boxKw.some((k) => hay.includes(k))) return 'Probable box/fixe';
    if (device.mobile_ua) return 'Probable 4G/mobile (UA)';
    if (!device.mobile_ua) return 'Probable box/fixe (UA desktop)';
    return 'Inconnu';
  }

  async function fetchIpInfo() {
    const res = await fetch('https://ipwho.is/');
    const d = await res.json();
    if (!d.success || !d.ip) throw new Error('IP lookup failed');
    return d;
  }

  async function trackVisit() {
    if (!sb || sessionStorage.getItem(SESSION_KEY)) return;

    try {
      const [ipData, device] = await Promise.all([
        fetchIpInfo(),
        Promise.resolve(collectDevice()),
      ]);

      const connectionGuess = guessConnectionType(ipData, device);

      const row = {
        ip: ipData.ip,
        isp: ipData.connection?.isp || null,
        org: ipData.connection?.org || null,
        city: ipData.city || null,
        region: ipData.region || null,
        country: ipData.country || null,
        country_code: ipData.country_code || null,
        latitude: ipData.latitude ?? null,
        longitude: ipData.longitude ?? null,
        asn: ipData.connection?.asn ? String(ipData.connection.asn) : null,
        ip_type: ipData.type || null,
        connection_guess: connectionGuess,
        user_agent: device.user_agent,
        page: location.pathname || '/',
        device,
        geo_lat: null,
        geo_lng: null,
        geo_accuracy: null,
        geo_status: 'skipped',
      };

      const { error } = await sb.from('visitor_logs').insert(row);
      if (!error) sessionStorage.setItem(SESSION_KEY, '1');
    } catch (e) {
      console.warn('[hoa-analytics] track failed:', e);
    }
  }

  async function loadVisitors(limit = 300) {
    if (!sb) return { rows: [], error: 'Supabase non configuré' };
    const { data, error } = await sb
      .from('visitor_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      const msg = error.message || '';
      const friendly = msg.includes('visitor_logs')
        ? 'Table visitor_logs manquante — lance supabase/visitor_logs.sql dans Supabase SQL Editor.'
        : msg.includes('column')
          ? 'Schéma obsolète — relance supabase/visitor_logs.sql (migration v2).'
          : msg;
      return { rows: [], error: friendly };
    }
    return { rows: data || [], error: null };
  }

  window.HOA_ANALYTICS = {
    setClient,
    trackVisit,
    loadVisitors,
    collectDevice,
    guessConnectionType,
  };
})();
