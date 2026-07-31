(() => {
  'use strict';

  const TYPES = [
    ['background', '正式背景'],
    ['character', '正式キャラクター'],
    ['art', '正式フード／イベントカード']
  ];
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);

  function imageCard(type, id, entry) {
    const subject = entry.subjectLabel ? `subject: ${entry.subjectLabel}` : entry.alt;
    return `<article class="asset" data-type="${escapeHtml(type)}">
      <img src="${escapeHtml(entry.src)}" alt="${escapeHtml(entry.alt || '')}" loading="lazy" decoding="async">
      <div class="meta"><span class="badge">${escapeHtml(type)}</span><strong>${escapeHtml(id)}</strong>
      <small>${escapeHtml(subject || '装飾背景（代替テキストなし）')}</small><small>${escapeHtml(entry.licenseId)}</small></div>
    </article>`;
  }

  function render(manifest) {
    const assets = manifest && manifest.assets || {};
    const sections = TYPES.map(([type, title]) => {
      const entries = Object.entries(assets[type] || {}).filter(([, entry]) => entry && entry.src);
      return `<section><div class="section-head"><h2>${title}</h2><span class="count">${entries.length}点</span></div>
        <div class="grid">${entries.map(([id, entry]) => imageCard(type, id, entry)).join('') || '<p class="empty">登録なし</p>'}</div></section>`;
    });
    const tracks = Object.entries(assets.bgm || {}).map(([id, entry]) => `<div class="track"><strong>${escapeHtml(entry.label)}</strong><span>${escapeHtml(entry.durationSeconds)}秒</span><span>${entry.loop === false ? 'one-shot' : 'loop'} / ${escapeHtml(entry.generator)}</span></div>`).join('');
    sections.push(`<section><div class="section-head"><h2>オリジナルBGM</h2><span class="count">${Object.keys(assets.bgm || {}).length}曲</span></div><div class="music">${tracks}</div></section>`);
    document.getElementById('gallery').innerHTML = sections.join('');
    document.getElementById('galleryStatus').textContent = `manifest ${manifest.manifestVersion} — 外部画像・外部フォント・音声サンプル不使用`;
  }

  fetch('./assets/manifest.json', { cache: 'no-cache' })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(render)
    .catch(() => {
      const status = document.getElementById('galleryStatus');
      status.className = 'error';
      status.textContent = 'アセット台帳を読み込めませんでした。ゲーム本体の進行には影響しません。';
    });
})();
