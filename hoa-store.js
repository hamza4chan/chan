// Persistance Supabase — contenu du site (blocs) + upload médias
(function () {
  const ROW_ID = 1;
  const BUCKET = 'media';

  let sb = null;
  let canWrite = false;
  let onRemoteChange = null;
  let saveTimer = null;
  let lastLocalWrite = 0;

  function setClient(client) { sb = client; }
  function setCanWrite(v) { canWrite = !!v; }
  function onRemote(cb) { onRemoteChange = cb; }
  function isWriter() { return canWrite; }

  function normalizeBlocks(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter((b) => b && typeof b === 'object' && typeof b.type === 'string');
  }

  async function loadSite() {
    if (!sb) return null;
    const { data, error } = await sb
      .from('site_config')
      .select('title, subtitle, blocks')
      .eq('id', ROW_ID)
      .maybeSingle();

    if (error) {
      const msg = error.message || 'Erreur Supabase';
      const hint = msg.includes('does not exist') || msg.includes('column')
        ? msg + ' — lance supabase/setup.sql dans le SQL Editor.'
        : msg;
      console.warn('[hoa-store] load failed:', hint);
      return { error: hint };
    }

    if (!data) return { title: 'grossepute.org', subtitle: '', blocks: [] };

    return {
      title: data.title || 'grossepute.org',
      subtitle: data.subtitle || '',
      blocks: normalizeBlocks(data.blocks),
    };
  }

  async function persist({ title, subtitle, blocks }) {
    if (!sb) return { error: 'Supabase non configuré' };
    if (!canWrite) return { error: 'Connecte-toi en admin pour enregistrer.' };

    lastLocalWrite = Date.now();
    const payload = {
      id: ROW_ID,
      title,
      subtitle,
      blocks: normalizeBlocks(blocks),
      updated_at: new Date().toISOString(),
    };

    const { error } = await sb.from('site_config').upsert(payload, { onConflict: 'id' });
    if (error) {
      const hint = error.message?.includes('does not exist') || error.message?.includes('column')
        ? error.message + ' — lance supabase/setup.sql dans le SQL Editor.'
        : error.message;
      console.warn('[hoa-store] save failed:', hint);
      return { error: hint };
    }
    return { error: null };
  }

  // Sauvegarde différée (débounce) — renvoie via callback l'état d'enregistrement
  function scheduleSave(state, statusCb) {
    if (!canWrite) return;
    clearTimeout(saveTimer);
    if (statusCb) statusCb('pending');
    saveTimer = setTimeout(async () => {
      if (statusCb) statusCb('saving');
      const { error } = await persist(state);
      if (statusCb) statusCb(error ? 'error' : 'saved', error);
    }, 500);
  }

  // Upload d'un fichier image vers le bucket, renvoie l'URL publique
  async function uploadMedia(file) {
    if (!sb) return { error: 'Supabase non configuré' };
    if (!canWrite) return { error: 'Connecte-toi en admin.' };

    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const id = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));
    const path = `${id}.${ext || 'png'}`;

    const { error } = await sb.storage.from(BUCKET).upload(path, file, {
      cacheControl: '31536000',
      upsert: false,
      contentType: file.type || undefined,
    });

    if (error) {
      console.warn('[hoa-store] upload failed:', error.message);
      return { error: error.message };
    }

    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, path };
  }

  function subscribeRealtime() {
    if (!sb || sb._hoaRealtime) return;
    sb._hoaRealtime = sb
      .channel('hoa-site-config')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_config', filter: 'id=eq.1' },
        (payload) => {
          const row = payload.new;
          if (!row || !onRemoteChange) return;
          // Ignore l'écho de notre propre écriture récente pour ne pas écraser l'édition en cours
          if (Date.now() - lastLocalWrite < 1500) return;
          onRemoteChange({
            title: row.title || 'grossepute.org',
            subtitle: row.subtitle || '',
            blocks: normalizeBlocks(row.blocks),
          });
        }
      )
      .subscribe();
  }

  window.HOA_STORE = {
    setClient,
    setCanWrite,
    isWriter,
    onRemote,
    loadSite,
    persist,
    scheduleSave,
    uploadMedia,
    subscribeRealtime,
  };
})();
