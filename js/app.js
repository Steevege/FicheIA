/* ============================================
   FicheIA — Application principale
   ============================================ */

// --- Configuration par défaut (clé pré-remplie au premier lancement) ---
const DEFAULT_API_KEY = ''; // Renseignée via les paramètres de l'app

// --- État global ---
const state = {
  photos: [],        // { file: File, base64: string, thumbnail: string }
  currentFiche: null, // { html, subject, mainColor, accentColor, fontSize, id? }
  progressTimers: [],
  isGenerating: false
};

// --- Navigation ---
function navigateTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById('screen-' + screenId);
  if (screen) {
    screen.classList.add('active');
  }
  // Actions spécifiques à chaque écran
  if (screenId === 'home') {
    updateHomeScreen();
  } else if (screenId === 'history') {
    renderHistory();
  }
}

// --- Accueil ---
function updateHomeScreen() {
  const count = getHistory().length;
  const countEl = document.getElementById('history-count');
  countEl.textContent = count > 0 ? `(${count})` : '';

  const statusEl = document.getElementById('api-status');
  const key = getApiKey();
  if (key) {
    statusEl.textContent = 'Clé API configurée';
    statusEl.className = 'api-status ok';
  } else {
    statusEl.textContent = 'Clé API non configurée';
    statusEl.className = 'api-status error';
  }
}

// --- Import photos ---
async function addPhotos(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const thumbnail = await createThumbnail(file);
      state.photos.push({ file, base64: null, thumbnail });
    } catch (e) {
      console.error('Erreur création miniature:', e);
    }
  }
  renderPhotoGrid();
}

function removePhoto(index) {
  state.photos.splice(index, 1);
  renderPhotoGrid();
}

function renderPhotoGrid() {
  const grid = document.getElementById('photo-grid');
  const count = document.getElementById('photo-count');
  const btnConfig = document.getElementById('btn-to-config');

  grid.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const div = document.createElement('div');
    div.className = 'photo-thumb';
    div.innerHTML = `
      <img src="${photo.thumbnail}" alt="Photo ${i + 1}">
      <button class="btn-remove" data-index="${i}" aria-label="Supprimer">&times;</button>
      <span class="photo-order">${i + 1}</span>
    `;
    grid.appendChild(div);
  });

  // Bouton "+" toujours visible dans la grille
  const addDiv = document.createElement('div');
  addDiv.className = 'photo-thumb photo-add-btn';
  addDiv.innerHTML = `
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    <span>Ajouter</span>
  `;
  addDiv.addEventListener('click', () => {
    document.getElementById('input-gallery').click();
  });
  grid.appendChild(addDiv);

  const n = state.photos.length;
  count.textContent = n > 0 ? `${n} photo${n > 1 ? 's' : ''} sélectionnée${n > 1 ? 's' : ''}` : 'Aucune photo — ajoute tes notes !';
  btnConfig.disabled = n === 0;

  // Événements de suppression
  grid.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removePhoto(parseInt(btn.dataset.index));
    });
  });
}

// --- Configuration ---
async function initConfigScreen() {
  const loadingEl = document.getElementById('config-loading');
  const formEl = document.getElementById('config-form');
  const selectSubject = document.getElementById('select-subject');

  loadingEl.hidden = false;
  formEl.hidden = true;

  // Compresser toutes les images en parallèle
  try {
    const compressionPromises = state.photos.map(async (photo) => {
      if (!photo.base64) {
        photo.base64 = await compressImage(photo.file);
      }
    });
    await Promise.all(compressionPromises);
  } catch (e) {
    console.error('Erreur compression:', e);
    showError('Erreur lors du traitement des images.');
    return;
  }

  // Détecter la matière (sauf si une matière par défaut est configurée)
  const settings = getSettings();
  let detectedSubject = settings.defaultSubject || '';
  if (!detectedSubject) {
    try {
      detectedSubject = await detectSubject(state.photos[0].base64);
    } catch (e) {
      console.error('Erreur détection matière:', e);
      detectedSubject = 'Autre';
    }
  }

  // Mettre à jour le formulaire
  selectSubject.value = detectedSubject;
  updateColorsForSubject(detectedSubject);

  // Pré-remplir les instructions par matière
  const subjectInstructions = (settings.subjectInstructions || {})[detectedSubject] || '';
  const instructionsField = document.getElementById('custom-instructions');
  if (instructionsField && subjectInstructions && !instructionsField.value.trim()) {
    instructionsField.value = subjectInstructions;
  }

  loadingEl.hidden = true;
  formEl.hidden = false;
}

function updateColorsForSubject(subject) {
  const colors = SUBJECTS[subject] || SUBJECTS['Autre'];
  const dots = document.querySelectorAll('.color-dot');

  // Sélectionner la pastille correspondante
  let found = false;
  dots.forEach(dot => {
    dot.classList.remove('active');
    if (dot.dataset.main === colors.main) {
      dot.classList.add('active');
      found = true;
    }
  });
  if (!found && dots.length > 0) {
    dots[0].classList.add('active');
  }
}

function getSelectedColors() {
  const activeDot = document.querySelector('.color-dot.active');
  if (activeDot) {
    return {
      main: activeDot.dataset.main,
      accent: activeDot.dataset.accent
    };
  }
  return { main: '#2980b9', accent: '#e67e22' };
}

// --- Pill Pickers ---
function initPillPickers() {
  document.querySelectorAll('.pill-picker').forEach(picker => {
    picker.addEventListener('click', (e) => {
      const pill = e.target.closest('.pill');
      if (!pill) return;
      picker.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });
}

function getPickerValue(pickerId) {
  const active = document.querySelector(`#${pickerId} .pill.active`);
  return active ? active.dataset.value : null;
}

// --- Génération ---
async function startGeneration() {
  const subject = document.getElementById('select-subject').value;
  const colors = getSelectedColors();
  const fontSize = parseInt(document.getElementById('slider-fontsize').value);
  const level = getPickerValue('level-picker') || 'seconde';
  const ficheType = getPickerValue('type-picker') || 'revision';
  const density = getPickerValue('density-picker') || 'normal';
  const addSynthesis = document.getElementById('toggle-synthesis').checked;
  const customInstructions = (document.getElementById('custom-instructions').value || '').trim();

  // Charger les instructions par matière
  const settings = getSettings();
  const subjectInstructions = (settings.subjectInstructions || {})[subject] || '';

  navigateTo('viewer');

  const progressEl = document.getElementById('generation-progress');
  const messageEl = document.getElementById('generation-message');
  const containerEl = document.getElementById('fiche-container');
  const viewerTitle = document.getElementById('viewer-title');
  const viewerSlider = document.getElementById('slider-viewer-fontsize');
  const viewerSizeValue = document.getElementById('viewer-fontsize-value');

  progressEl.hidden = false;
  containerEl.hidden = true;
  viewerTitle.textContent = subject;
  viewerSlider.value = fontSize;
  viewerSizeValue.textContent = fontSize + 'px';

  // Messages de progression
  state.progressTimers = startProgressMessages(messageEl);
  state.isGenerating = true;

  try {
    const images = state.photos.map(p => p.base64);
    const html = await generateFiche(images, {
      subject,
      mainColor: colors.main,
      accentColor: colors.accent,
      fontSize,
      level,
      ficheType,
      density,
      addSynthesis,
      customInstructions,
      subjectInstructions
    });

    stopProgressMessages(state.progressTimers);

    // Stocker la fiche courante
    state.currentFiche = {
      html,
      subject,
      mainColor: colors.main,
      accentColor: colors.accent,
      fontSize,
      title: extractTitleFromHtml(html)
    };

    // Afficher dans l'iframe
    const iframe = document.getElementById('fiche-iframe');
    renderFicheInIframe(iframe, html);

    progressEl.hidden = true;
    containerEl.hidden = false;
    state.isGenerating = false;

    // Notifier si l'onglet n'est pas actif
    notifyGenerationDone(state.currentFiche.title);

  } catch (e) {
    state.isGenerating = false;
    stopProgressMessages(state.progressTimers);
    console.error('Erreur génération:', e);
    messageEl.textContent = getErrorMessage(e);
    document.querySelector('#generation-progress .spinner').hidden = true;
  }
}

// --- Viewer actions ---
function handleSave() {
  if (!state.currentFiche) return;
  const entry = saveToHistory(state.currentFiche);
  state.currentFiche.id = entry.id;
  alert('Fiche sauvegardée !');
}

function handlePdf() {
  if (!state.currentFiche) return;
  exportPDF(state.currentFiche.html);
}

function handlePrint() {
  const iframe = document.getElementById('fiche-iframe');
  printFiche(iframe);
}

function handleEdit() {
  if (!state.currentFiche) return;
  const editor = document.getElementById('editor-overlay');
  const textarea = document.getElementById('html-editor');
  textarea.value = state.currentFiche.html;
  editor.hidden = false;
}

function applyEdit() {
  const textarea = document.getElementById('html-editor');
  const html = textarea.value;
  state.currentFiche.html = html;
  state.currentFiche.title = extractTitleFromHtml(html);

  // Mettre à jour l'iframe
  const iframe = document.getElementById('fiche-iframe');
  renderFicheInIframe(iframe, html);

  // Mettre à jour le localStorage si déjà sauvegardé
  if (state.currentFiche.id) {
    updateFicheHtml(state.currentFiche.id, html);
  }

  document.getElementById('editor-overlay').hidden = true;
}

function handleRegenerate() {
  if (!state.photos || state.photos.length === 0) {
    alert('Aucune photo en mémoire. Importe de nouvelles photos.');
    return;
  }
  if (!confirm('Régénérer la fiche avec les mêmes photos ?')) return;
  navigateTo('config');
  // Le formulaire config garde ses valeurs, l'utilisateur peut modifier avant de relancer
}

/** Injecte une barre de contrôle taille dans le HTML exporté */
function addToolbarToHtml(html) {
  const toolbar = `
<div id="toolbar" style="position:fixed;top:0;left:0;right:0;background:#2980b9;color:white;padding:8px 16px;display:flex;align-items:center;gap:12px;z-index:9999;font-family:sans-serif;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.2);print-color-adjust:exact;-webkit-print-color-adjust:exact;">
  <span>Taille :</span>
  <input type="range" min="10" max="22" value="14" step="1" oninput="document.body.style.fontSize=this.value+'px';document.getElementById('sz').textContent=this.value+'px'" style="flex:1;max-width:200px;">
  <span id="sz">14px</span>
  <button onclick="document.getElementById('toolbar').style.display='none';window.print();document.getElementById('toolbar').style.display='flex'" style="background:white;color:#2980b9;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:600;">Imprimer</button>
</div>
<style>@media print{#toolbar{display:none!important;}}</style>`;

  // Injecter après <body> ou au début
  if (html.includes('<body')) {
    return html.replace(/(<body[^>]*>)/i, '$1' + toolbar);
  }
  return toolbar + html;
}

async function handleShare() {
  if (!state.currentFiche) return;

  const htmlWithToolbar = addToolbarToHtml(state.currentFiche.html);

  // Essayer l'API Web Share si disponible (mobile)
  if (navigator.share) {
    try {
      const blob = new Blob([htmlWithToolbar], { type: 'text/html' });
      const file = new File([blob], (state.currentFiche.title || 'fiche') + '.html', { type: 'text/html' });
      await navigator.share({
        title: state.currentFiche.title || 'Ma fiche',
        files: [file]
      });
      return;
    } catch (e) {
      // Fallback si share annulé ou non supporté pour fichiers
    }
  }

  // Fallback : télécharger le fichier HTML
  const blob = new Blob([htmlWithToolbar], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (state.currentFiche.title || 'fiche') + '.html';
  a.click();
  URL.revokeObjectURL(url);
  alert('Fichier HTML téléchargé !');
}

// --- Historique ---
function renderHistory() {
  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  const searchInput = document.getElementById('history-search');
  const filterSelect = document.getElementById('history-filter-subject');
  const sortSelect = document.getElementById('history-sort');
  let history = getHistory();

  // Filtrer par recherche
  const searchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();
  if (searchTerm) {
    history = history.filter(f =>
      (f.title || '').toLowerCase().includes(searchTerm) ||
      (f.subject || '').toLowerCase().includes(searchTerm)
    );
  }

  // Filtrer par matière
  const subjectFilter = filterSelect ? filterSelect.value : '';
  if (subjectFilter) {
    history = history.filter(f => f.subject === subjectFilter);
  }

  // Trier selon le critère choisi
  const sortValue = sortSelect ? sortSelect.value : 'recent';
  history.sort((a, b) => {
    // Favoris toujours en premier
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    // Puis tri secondaire
    switch (sortValue) {
      case 'ancien':
        return new Date(a.date) - new Date(b.date);
      case 'matiere':
        return (a.subject || '').localeCompare(b.subject || '', 'fr');
      case 'alpha':
        return (a.title || '').localeCompare(b.title || '', 'fr');
      case 'recent':
      default:
        return new Date(b.date) - new Date(a.date);
    }
  });

  if (history.length === 0) {
    list.innerHTML = '';
    empty.hidden = false;
    empty.textContent = searchTerm || subjectFilter ? 'Aucune fiche trouvée' : 'Aucune fiche sauvegardée';
    return;
  }

  empty.hidden = true;
  list.innerHTML = '';

  // Tags par type
  const typeTagLabels = {
    cours: 'Cours',
    questions: 'Questions',
    exercices: 'Exercices',
    redaction: 'Rédaction',
    methode: 'Méthode',
    chat: 'Chat',
    libre: 'Libre'
  };

  history.forEach(fiche => {
    const date = new Date(fiche.date);
    const dateStr = date.toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });

    const ficheType = fiche.type || 'cours';
    const tagLabel = typeTagLabels[ficheType] || 'Cours';
    const isChild = !!fiche.parentId;

    const card = document.createElement('div');
    card.className = 'history-card' + (isChild ? ' child-card' : '');
    card.innerHTML = `
      <button class="btn-icon btn-fav${fiche.favorite ? ' active' : ''}" data-id="${fiche.id}" aria-label="Favori">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="${fiche.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </button>
      <div class="history-color" style="background:${fiche.color}"></div>
      <div class="history-info">
        <div class="history-subject">${fiche.subject}<span class="history-type-tag tag-${ficheType}">${tagLabel}</span></div>
        <div class="history-title">${fiche.title}</div>
        <div class="history-date">${dateStr}</div>
      </div>
      <div class="history-actions">
        <button class="btn-icon btn-work" data-id="${fiche.id}" aria-label="Travailler" title="Travailler">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
        </button>
        <button class="btn-icon btn-rename" data-id="${fiche.id}" data-title="${(fiche.title || '').replace(/"/g, '&quot;')}" aria-label="Renommer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
        </button>
        <button class="btn-icon btn-duplicate" data-id="${fiche.id}" aria-label="Dupliquer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>
        <button class="btn-icon btn-open" data-id="${fiche.id}" aria-label="Ouvrir">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
        <button class="btn-icon btn-delete" data-id="${fiche.id}" aria-label="Supprimer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>
    `;
    list.appendChild(card);
  });

  // Événements favoris
  list.querySelectorAll('.btn-fav').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(btn.dataset.id);
      renderHistory();
    });
  });

  // Événements travailler
  list.querySelectorAll('.btn-work').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const fiche = getFicheById(btn.dataset.id);
      if (fiche) {
        initWorkMode({
          html: fiche.html,
          subject: fiche.subject,
          title: fiche.title,
          id: fiche.id,
          mainColor: fiche.color
        });
      }
    });
  });

  // Événements renommer
  list.querySelectorAll('.btn-rename').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const newTitle = prompt('Nouveau titre :', btn.dataset.title);
      if (newTitle && newTitle.trim()) {
        renameFiche(btn.dataset.id, newTitle.trim());
        renderHistory();
      }
    });
  });

  // Événements dupliquer
  list.querySelectorAll('.btn-duplicate').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      duplicateFiche(btn.dataset.id);
      renderHistory();
    });
  });

  // Événements ouvrir
  list.querySelectorAll('.btn-open').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openFicheFromHistory(btn.dataset.id);
    });
  });

  list.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Supprimer cette fiche ?')) {
        deleteFiche(btn.dataset.id);
        renderHistory();
      }
    });
  });

  // Clic sur la carte entière
  list.querySelectorAll('.history-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.querySelector('.btn-open').dataset.id;
      openFicheFromHistory(id);
    });
  });
}

function openFicheFromHistory(id) {
  const fiche = getFicheById(id);
  if (!fiche) return;

  state.currentFiche = {
    html: fiche.html,
    subject: fiche.subject,
    mainColor: fiche.color,
    accentColor: '#e67e22',
    fontSize: fiche.fontSize || 14,
    title: fiche.title,
    id: fiche.id
  };

  navigateTo('viewer');

  const progressEl = document.getElementById('generation-progress');
  const containerEl = document.getElementById('fiche-container');
  const viewerTitle = document.getElementById('viewer-title');
  const viewerSlider = document.getElementById('slider-viewer-fontsize');
  const viewerSizeValue = document.getElementById('viewer-fontsize-value');

  progressEl.hidden = true;
  containerEl.hidden = false;
  viewerTitle.textContent = fiche.subject;
  viewerSlider.value = fiche.fontSize || 14;
  viewerSizeValue.textContent = (fiche.fontSize || 14) + 'px';

  const iframe = document.getElementById('fiche-iframe');
  renderFicheInIframe(iframe, fiche.html);
}

// --- Paramètres ---
function openSettings() {
  const modal = document.getElementById('modal-settings');
  const inputKey = document.getElementById('input-api-key');
  const sliderFont = document.getElementById('slider-settings-fontsize');
  const fontValue = document.getElementById('settings-fontsize-value');
  const selectSubject = document.getElementById('select-default-subject');
  const testResult = document.getElementById('api-test-result');

  const settings = getSettings();
  inputKey.value = settings.apiKey || '';
  sliderFont.value = settings.defaultFontSize || 14;
  fontValue.textContent = sliderFont.value;
  selectSubject.value = settings.defaultSubject || '';
  testResult.textContent = '';

  // Modèle IA
  const modelValue = settings.model || 'sonnet';
  document.querySelectorAll('#model-picker .pill').forEach(p => {
    p.classList.toggle('active', p.dataset.value === modelValue);
  });

  // Mode sombre
  const darkToggle = document.getElementById('toggle-darkmode');
  if (darkToggle) {
    darkToggle.checked = !!settings.darkMode;
  }

  // Instructions par matière
  const instrSelect = document.getElementById('select-instruction-subject');
  const instrText = document.getElementById('subject-instructions');
  if (instrSelect && instrText) {
    const si = (settings.subjectInstructions || {})[instrSelect.value] || '';
    instrText.value = si;
  }

  modal.hidden = false;
}

function closeSettings() {
  document.getElementById('modal-settings').hidden = true;
}

async function testApi() {
  const input = document.getElementById('input-api-key');
  const result = document.getElementById('api-test-result');
  const key = input.value.trim();

  if (!key) {
    result.textContent = 'Veuillez entrer une clé API.';
    result.className = 'api-test-result error';
    return;
  }

  result.textContent = 'Test en cours...';
  result.className = 'api-test-result';

  try {
    const ok = await testApiKey(key);
    if (ok) {
      result.textContent = 'Connexion réussie !';
      result.className = 'api-test-result success';
    } else {
      result.textContent = 'Clé API invalide.';
      result.className = 'api-test-result error';
    }
  } catch (e) {
    result.textContent = 'Erreur de connexion.';
    result.className = 'api-test-result error';
  }
}

function saveSettingsForm() {
  const key = document.getElementById('input-api-key').value.trim();
  const fontSize = parseInt(document.getElementById('slider-settings-fontsize').value);
  const subject = document.getElementById('select-default-subject').value;
  const modelPill = document.querySelector('#model-picker .pill.active');
  const model = modelPill ? modelPill.dataset.value : 'sonnet';

  saveSettings({
    apiKey: key,
    defaultFontSize: fontSize,
    defaultSubject: subject,
    model: model
  });

  closeSettings();
  updateHomeScreen();
}

// --- Gestion d'erreurs ---
function getErrorMessage(error) {
  const msg = error.message || error;
  switch (msg) {
    case 'NO_API_KEY':
      return 'Clé API non configurée. Allez dans les paramètres.';
    case 'API_KEY_INVALID':
      return 'Clé API invalide. Vérifiez dans les paramètres.';
    case 'RATE_LIMIT':
      return 'Trop de requêtes. Attendez 1 minute avant de réessayer.';
    case 'PAYLOAD_TOO_LARGE':
      return 'Images trop lourdes. Essayez avec moins de photos.';
    default:
      if (msg.startsWith('API_ERROR_')) {
        return `Erreur serveur (${msg.replace('API_ERROR_', '')}). Réessayez.`;
      }
      if (!navigator.onLine) {
        return 'Pas de connexion internet.';
      }
      return 'Une erreur est survenue. Réessayez.';
  }
}

function handleApiError(error) {
  const msg = error.message || error;
  if (msg === 'NO_API_KEY' || msg === 'API_KEY_INVALID') {
    if (confirm(getErrorMessage(error) + '\n\nOuvrir les paramètres ?')) {
      openSettings();
    }
  } else {
    showError(getErrorMessage(error));
  }
}

function showError(message) {
  alert(message);
}

// --- Copier le texte brut ---
function handleCopyText() {
  if (!state.currentFiche) return;
  const iframe = document.getElementById('fiche-iframe');
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  const text = doc.body ? doc.body.innerText : '';
  if (!text.trim()) {
    alert('Aucun contenu à copier.');
    return;
  }
  navigator.clipboard.writeText(text).then(() => {
    alert('Texte copié dans le presse-papier !');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    alert('Texte copié !');
  });
}

// --- Confirmation avant de quitter ---
function initBeforeUnload() {
  window.addEventListener('beforeunload', (e) => {
    if (state.isGenerating) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

// --- Drag & Drop ---
function initDragDrop() {
  const dropZone = document.getElementById('drop-zone');
  const overlay = document.getElementById('drop-overlay');
  if (!dropZone) return;

  let dragCounter = 0;

  dropZone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    overlay.hidden = false;
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      overlay.hidden = true;
    }
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    overlay.hidden = true;
    if (e.dataTransfer.files.length > 0) {
      addPhotos(e.dataTransfer.files);
    }
  });
}

// --- Notification de fin ---
function notifyGenerationDone(title) {
  if (document.hasFocus()) return;
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification('FicheIA', { body: 'Fiche "' + title + '" prête !', icon: 'assets/icon-192.png' });
  }
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// --- Plein écran ---
function toggleFullscreen() {
  const container = document.getElementById('fiche-container');
  if (!container) return;
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    container.requestFullscreen().catch(() => {});
  }
}

// --- Raccourcis clavier ---
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignorer si dans un input/textarea
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    const isViewer = document.getElementById('screen-viewer').classList.contains('active');
    if (!isViewer) return;

    const mod = e.metaKey || e.ctrlKey;

    if (mod && e.key === 'p') {
      e.preventDefault();
      handlePrint();
    } else if (mod && e.key === 's') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'f' && !mod) {
      toggleFullscreen();
    } else if (e.key === 'Escape') {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        const editor = document.getElementById('editor-overlay');
        if (!editor.hidden) editor.hidden = true;
      }
    }
  });
}

// --- Initialisation ---
function init() {
  // Pré-remplir la clé API au premier lancement
  if (!getApiKey() && DEFAULT_API_KEY) {
    saveApiKey(DEFAULT_API_KEY);
  }

  // Navigation retour
  document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.target);
    });
  });

  // Accueil
  document.getElementById('btn-new-fiche').addEventListener('click', () => {
    state.photos = [];
    renderPhotoGrid();
    navigateTo('import');
  });

  document.getElementById('btn-history').addEventListener('click', () => {
    navigateTo('history');
  });

  document.getElementById('btn-settings').addEventListener('click', openSettings);

  // Pill pickers (niveau, type, densité)
  initPillPickers();

  // Drag & drop photos
  initDragDrop();

  // Raccourcis clavier
  initKeyboardShortcuts();

  // Demander la permission de notification
  requestNotificationPermission();

  // Confirmation avant de quitter pendant génération
  initBeforeUnload();

  // Import photos
  document.getElementById('btn-add-camera').addEventListener('click', () => {
    document.getElementById('input-camera').click();
  });

  document.getElementById('btn-add-gallery').addEventListener('click', () => {
    document.getElementById('input-gallery').click();
  });

  document.getElementById('input-camera').addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
      await addPhotos(e.target.files);
      e.target.value = '';
      // Proposer de reprendre une photo
      if (confirm('Photo ajoutée ! En prendre une autre ?')) {
        document.getElementById('input-camera').click();
      }
    } else {
      e.target.value = '';
    }
  });

  document.getElementById('input-gallery').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      addPhotos(e.target.files);
    }
    e.target.value = '';
  });

  document.getElementById('btn-to-config').addEventListener('click', () => {
    navigateTo('config');
    initConfigScreen();
  });

  // Configuration
  document.getElementById('select-subject').addEventListener('change', (e) => {
    updateColorsForSubject(e.target.value);
    // Mettre à jour les instructions par matière
    const si = (getSettings().subjectInstructions || {})[e.target.value] || '';
    document.getElementById('custom-instructions').value = si;
  });

  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
    });
  });

  const sliderFontsize = document.getElementById('slider-fontsize');
  const fontSizeValue = document.getElementById('font-size-value');
  sliderFontsize.addEventListener('input', () => {
    fontSizeValue.textContent = sliderFontsize.value;
  });

  // Charger la taille par défaut depuis les paramètres
  const settings = getSettings();
  if (settings.defaultFontSize) {
    sliderFontsize.value = settings.defaultFontSize;
    fontSizeValue.textContent = settings.defaultFontSize;
  }

  document.getElementById('btn-generate').addEventListener('click', startGeneration);

  // Viewer
  const viewerSlider = document.getElementById('slider-viewer-fontsize');
  const viewerSizeValue = document.getElementById('viewer-fontsize-value');
  viewerSlider.addEventListener('input', () => {
    const size = viewerSlider.value;
    viewerSizeValue.textContent = size + 'px';
    const iframe = document.getElementById('fiche-iframe');
    updateIframeFontSize(iframe, size);
    if (state.currentFiche) {
      state.currentFiche.fontSize = parseInt(size);
    }
  });

  document.getElementById('btn-pdf').addEventListener('click', handlePdf);
  document.getElementById('btn-print').addEventListener('click', handlePrint);
  document.getElementById('btn-save').addEventListener('click', handleSave);
  document.getElementById('btn-edit').addEventListener('click', handleEdit);
  document.getElementById('btn-regenerate').addEventListener('click', handleRegenerate);
  document.getElementById('btn-share').addEventListener('click', handleShare);
  document.getElementById('btn-copy-text').addEventListener('click', handleCopyText);
  document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);

  // Bouton Travailler depuis le Viewer
  document.getElementById('btn-work').addEventListener('click', () => {
    if (!state.currentFiche) return;
    initWorkMode({
      html: state.currentFiche.html,
      subject: state.currentFiche.subject,
      title: state.currentFiche.title,
      id: state.currentFiche.id || null,
      mainColor: state.currentFiche.mainColor
    });
  });

  // Éditeur
  document.getElementById('btn-close-editor').addEventListener('click', () => {
    document.getElementById('editor-overlay').hidden = true;
  });
  document.getElementById('btn-apply-edit').addEventListener('click', applyEdit);

  // Paramètres
  document.getElementById('btn-close-settings').addEventListener('click', closeSettings);
  document.getElementById('modal-settings').querySelector('.modal-backdrop').addEventListener('click', closeSettings);
  document.getElementById('btn-test-api').addEventListener('click', testApi);
  document.getElementById('btn-save-api').addEventListener('click', saveSettingsForm);

  document.getElementById('btn-toggle-key').addEventListener('click', () => {
    const input = document.getElementById('input-api-key');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  const settingsSlider = document.getElementById('slider-settings-fontsize');
  const settingsFontValue = document.getElementById('settings-fontsize-value');
  settingsSlider.addEventListener('input', () => {
    settingsFontValue.textContent = settingsSlider.value;
  });

  // Recherche + filtre + tri historique
  const historySearch = document.getElementById('history-search');
  const historyFilter = document.getElementById('history-filter-subject');
  const historySort = document.getElementById('history-sort');
  if (historySearch) {
    historySearch.addEventListener('input', renderHistory);
  }
  if (historyFilter) {
    historyFilter.addEventListener('change', renderHistory);
  }
  if (historySort) {
    historySort.addEventListener('change', renderHistory);
  }

  // Instructions par matière
  const instrSubjectSelect = document.getElementById('select-instruction-subject');
  const instrTextarea = document.getElementById('subject-instructions');
  if (instrSubjectSelect && instrTextarea) {
    instrSubjectSelect.addEventListener('change', () => {
      const si = (getSettings().subjectInstructions || {})[instrSubjectSelect.value] || '';
      instrTextarea.value = si;
    });
  }
  document.getElementById('btn-save-instruction').addEventListener('click', () => {
    const subject = instrSubjectSelect.value;
    const text = instrTextarea.value.trim();
    const settings = getSettings();
    const si = settings.subjectInstructions || {};
    si[subject] = text;
    saveSettings({ subjectInstructions: si });
    alert('Instructions pour ' + subject + ' enregistrées !');
  });

  // Export / Import
  document.getElementById('btn-export').addEventListener('click', () => {
    exportHistory();
  });
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('input-import').click();
  });
  document.getElementById('input-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importHistory(reader.result);
      if (result === -1) {
        alert('Fichier invalide. Utilise un export FicheIA.');
      } else {
        alert(result + ' fiche(s) importée(s) !');
        updateHomeScreen();
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Mode sombre
  const darkToggle = document.getElementById('toggle-darkmode');
  if (darkToggle) {
    const savedDark = getSettings().darkMode;
    if (savedDark) {
      document.body.classList.add('dark');
      darkToggle.checked = true;
    }
    darkToggle.addEventListener('change', () => {
      document.body.classList.toggle('dark', darkToggle.checked);
      saveSettings({ darkMode: darkToggle.checked });
    });
  }

  // Work mode listeners
  initWorkListeners();

  // Sliders comptage (questions et exercices)
  const questionsCount = document.getElementById('work-questions-count');
  const questionsLabel = document.getElementById('work-questions-count-label');
  if (questionsCount && questionsLabel) {
    questionsCount.addEventListener('input', () => {
      questionsLabel.textContent = questionsCount.value;
    });
  }
  const exercicesCount = document.getElementById('work-exercices-count');
  const exercicesLabel = document.getElementById('work-exercices-count-label');
  if (exercicesCount && exercicesLabel) {
    exercicesCount.addEventListener('input', () => {
      exercicesLabel.textContent = exercicesCount.value;
    });
  }

  // Init écran d'accueil
  updateHomeScreen();
}

// Lancer l'app
document.addEventListener('DOMContentLoaded', init);
