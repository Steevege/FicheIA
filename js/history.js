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
    fontSize: fiche.fontSize,
    type: fiche.type || 'cours',
    parentId: fiche.parentId || null
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

/** Renomme une fiche */
function renameFiche(id, newTitle) {
  const history = getHistory();
  const fiche = history.find(f => f.id === id);
  if (fiche) {
    fiche.title = newTitle;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }
}

/** Duplique une fiche */
function duplicateFiche(id) {
  const history = getHistory();
  const original = history.find(f => f.id === id);
  if (!original) return null;
  const copy = {
    ...original,
    id: 'fiche_' + Date.now(),
    title: original.title + ' (copie)',
    date: new Date().toISOString(),
    favorite: false
  };
  history.unshift(copy);
  if (history.length > MAX_FICHES) history.pop();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  return copy;
}

/** Exporte tout l'historique en JSON */
function exportHistory() {
  const history = getHistory();
  const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ficheIA_backup_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

/** Importe un historique depuis un fichier JSON */
function importHistory(jsonString) {
  try {
    const imported = JSON.parse(jsonString);
    if (!Array.isArray(imported)) throw new Error('Format invalide');
    const current = getHistory();
    const existingIds = new Set(current.map(f => f.id));
    let added = 0;
    for (const fiche of imported) {
      if (!fiche.id || !fiche.html) continue;
      if (existingIds.has(fiche.id)) continue;
      current.push(fiche);
      added++;
    }
    // Trier par date décroissante
    current.sort((a, b) => new Date(b.date) - new Date(a.date));
    // Limiter à MAX_FICHES
    if (current.length > MAX_FICHES) current.length = MAX_FICHES;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    return added;
  } catch (e) {
    return -1;
  }
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
