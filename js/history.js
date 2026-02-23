/* ============================================
   FicheIA — Gestion de l'historique (localStorage)
   ============================================ */

const STORAGE_KEY = 'ficheIA_history';
const SETTINGS_KEY = 'ficheIA_settings';
const MAX_FICHES = 50;

/** Récupère l'historique complet */
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

/** Sauvegarde une fiche dans l'historique */
function saveToHistory(fiche) {
  const history = getHistory();
  const entry = {
    id: 'fiche_' + Date.now(),
    title: fiche.title || 'Sans titre',
    subject: fiche.subject,
    color: fiche.mainColor,
    date: new Date().toISOString(),
    html: fiche.html,
    fontSize: fiche.fontSize
  };
  history.unshift(entry);
  if (history.length > MAX_FICHES) history.pop();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  return entry;
}

/** Met à jour le HTML d'une fiche existante */
function updateFicheHtml(id, html) {
  const history = getHistory();
  const fiche = history.find(f => f.id === id);
  if (fiche) {
    fiche.html = html;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }
}

/** Supprime une fiche */
function deleteFiche(id) {
  const history = getHistory().filter(f => f.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

/** Récupère une fiche par ID */
function getFicheById(id) {
  return getHistory().find(f => f.id === id) || null;
}

/** Toggle favori sur une fiche */
function toggleFavorite(id) {
  const history = getHistory();
  const fiche = history.find(f => f.id === id);
  if (fiche) {
    fiche.favorite = !fiche.favorite;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }
  return fiche ? fiche.favorite : false;
}

/** Récupère les paramètres */
function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch {
    return {};
  }
}

/** Sauvegarde les paramètres */
function saveSettings(settings) {
  const current = getSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
}

/** Récupère la clé API */
function getApiKey() {
  return getSettings().apiKey || '';
}

/** Sauvegarde la clé API */
function saveApiKey(key) {
  saveSettings({ apiKey: key });
}
