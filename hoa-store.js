// Persistance Supabase — site + images
(function () {
  const ROW_ID = 1;
  let sb = null;
  let canWrite = false;
  let images = {};
  let saveImagesTimer = null;
  let onRemoteChange = null;

  function setClient(client) {
    sb = client;
  }

  function setCanWrite(v) {
    canWrite = !!v;
    if (window.HOA_IMAGE_STORE) window.HOA_IMAGE_STORE.canSave = () => canWrite;
  }

  function onRemote(cb) {
    onRemoteChange = cb;
  }

  async function loadSite() {
    if (!sb) return null;
    const { data, error } = await sb
      .from('site_config')
      .select('title, subtitle, people, images')
      .eq('id', ROW_ID)
      .maybeSingle();
    if (error) {
      const msg = error.message || 'Erreur Supabase';
      const hint = msg.includes('does not exist')
        ? msg + ' — Lance supabase/setup.sql dans le SQL Editor.'
        : msg;
      console.warn('[hoa-store] load failed:', hint);
      return { error: hint };
    }
    if (!data) return null;
    images = data.images && typeof data.images === 'object' ? data.images : {};
    if (window.HOA_IMAGE_STORE) window.HOA_IMAGE_STORE._hydrate(images);
    return {
      title: data.title,
      subtitle: data.subtitle,
      people: data.people,
    };
  }

  async function saveSite({ title, subtitle, people }) {
    if (!sb) return { error: 'Supabase non configuré' };
    if (!canWrite) return { error: 'Connecte-toi en admin pour enregistrer.' };

    const payload = {
      id: ROW_ID,
      title,
      subtitle,
      people,
      images,
      updated_at: new Date().toISOString(),
    };

    const { error } = await sb.from('site_config').upsert(payload, { onConflict: 'id' });
    if (error) {
      const hint = error.message?.includes('does not exist')
        ? error.message + ' — Lance supabase/setup.sql dans le SQL Editor.'
        : error.message;
      console.warn('[hoa-store] save failed:', hint);
      return { error: hint };
    }
    return { error: null };
  }

  async function flushImages(slots) {
    if (!sb || !canWrite) return;
    images = slots;
    const { error } = await sb
      .from('site_config')
      .update({ images, updated_at: new Date().toISOString() })
      .eq('id', ROW_ID);
    if (error) console.warn('[hoa-store] images save failed:', error.message);
  }

  function scheduleImageSave(slots) {
    images = slots;
    clearTimeout(saveImagesTimer);
    saveImagesTimer = setTimeout(() => flushImages(slots), 600);
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
          if (row.images && typeof row.images === 'object') {
            images = row.images;
            if (window.HOA_IMAGE_STORE) window.HOA_IMAGE_STORE._hydrate(images);
          }
          onRemoteChange({
            title: row.title,
            subtitle: row.subtitle,
            people: row.people,
          });
        }
      )
      .subscribe();
  }

  window.HOA_STORE = {
    setClient,
    setCanWrite,
    onRemote,
    loadSite,
    saveSite,
    subscribeRealtime,
  };

  window.HOA_IMAGE_STORE = {
    canSave: () => canWrite,
    _hydrate(newImages) {
      images = newImages && typeof newImages === 'object' ? newImages : {};
      window.dispatchEvent(new CustomEvent('hoa-images-updated', { detail: images }));
    },
    load() {
      return Promise.resolve(images);
    },
    save(slots) {
      if (!canWrite) return Promise.resolve();
      scheduleImageSave(slots);
      return Promise.resolve();
    },
  };
})();
