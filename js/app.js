/* ============================================
   FicheIA — Application principale
   ============================================ */

// --- Configuration par défaut (clé pré-remplie au premier lancement) ---
const DEFAULT_API_KEY = ''; // Renseignée via les paramètres de l'app

// --- État global ---
const state = {
  photos: [],        // { file: File, base64: string, thumbnail: string }
  currentFiche: null, // { html, subject, mainColor, accentColor, fontSize, id? }
  progressTimers: []
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

  const n = state.photos.length;
  count.textContent = n > 0 ? `${n} photo${n > 1 ? 's' : ''} sélectionnée${n > 1 ? 's' : ''}` : '';
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

  // Détecter la matière
  let detectedSubject = 'Autre';
  try {
    detectedSubject = await detectSubject(state.photos[0].base64);
  } catch (e) {
    console.error('Erreur détection matière:', e);
    handleApiError(e);
  }

  // Mettre à jour le formulaire
  selectSubject.value = detectedSubject;
  updateColorsForSubject(detectedSubject);

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

// --- Génération ---
async function startGeneration() {
  const subject = document.getElementById('select-subject').value;
  const colors = getSelectedColors();
  const fontSize = parseInt(document.getElementById('slider-fontsize').value);

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

  try {
    const images = state.photos.map(p => p.base64);
    const html = await generateFiche(images, {
      subject,
      mainColor: colors.main,
      accentColor: colors.accent,
      fontSize
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

  } catch (e) {
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

// --- Historique ---
function renderHistory() {
  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  const history = getHistory();

  if (history.length === 0) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  list.innerHTML = '';

  history.forEach(fiche => {
    const date = new Date(fiche.date);
    const dateStr = date.toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });

    const card = document.createElement('div');
    card.className = 'history-card';
    card.innerHTML = `
      <div class="history-color" style="background:${fiche.color}"></div>
      <div class="history-info">
        <div class="history-subject">${fiche.subject}</div>
        <div class="history-title">${fiche.title}</div>
        <div class="history-date">${dateStr}</div>
      </div>
      <div class="history-actions">
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

  // Événements
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

  saveSettings({
    apiKey: key,
    defaultFontSize: fontSize,
    defaultSubject: subject
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

  // Import photos
  document.getElementById('btn-add-camera').addEventListener('click', () => {
    document.getElementById('input-camera').click();
  });

  document.getElementById('btn-add-gallery').addEventListener('click', () => {
    document.getElementById('input-gallery').click();
  });

  document.getElementById('input-camera').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      addPhotos(e.target.files);
    }
    e.target.value = '';
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

  // Init écran d'accueil
  updateHomeScreen();
}

// Lancer l'app
document.addEventListener('DOMContentLoaded', init);
