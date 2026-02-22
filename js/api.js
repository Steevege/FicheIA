/* ============================================
   FicheIA — Appels API Anthropic
   ============================================ */

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_VERSION = '2023-06-01';

/** Liste des matières avec leurs couleurs par défaut */
const SUBJECTS = {
  'Physique-Chimie': { main: '#2980b9', accent: '#e67e22' },
  'Mathématiques':   { main: '#2980b9', accent: '#27ae60' },
  'SVT':             { main: '#27ae60', accent: '#f39c12' },
  'Histoire-Géo':    { main: '#27ae60', accent: '#f39c12' },
  'Français':        { main: '#8e44ad', accent: '#e74c3c' },
  'Philosophie':     { main: '#8e44ad', accent: '#e74c3c' },
  'Langues':         { main: '#c0392b', accent: '#16a085' },
  'Économie':        { main: '#f39c12', accent: '#2980b9' },
  'Autre':           { main: '#555555', accent: '#e67e22' }
};

/** Compress une image en base64 JPEG */
function compressImage(file, maxSizeKB = 1000) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      // Redimensionner si > 2000px
      if (w > 2000) {
        h = h * 2000 / w;
        w = 2000;
      }
      if (h > 2000) {
        w = w * 2000 / h;
        h = 2000;
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      resolve(dataUrl.split(',')[1]);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Impossible de charger l\'image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

/** Crée un thumbnail en base64 pour l'aperçu */
function createThumbnail(file) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.onload = () => {
      const size = 200;
      let w = img.width;
      let h = img.height;
      if (w > h) {
        h = size * h / w;
        w = size;
      } else {
        w = size * w / h;
        h = size;
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Impossible de charger l\'image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

/** Appel API générique */
async function callAnthropic(body) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('API_KEY_INVALID');
    if (response.status === 429) throw new Error('RATE_LIMIT');
    if (response.status === 413) throw new Error('PAYLOAD_TOO_LARGE');
    throw new Error(`API_ERROR_${response.status}`);
  }

  return await response.json();
}

/** Teste la clé API */
async function testApiKey(key) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Test' }]
    })
  });

  if (response.status === 401) return false;
  return true;
}

/** Détecte la matière scolaire depuis la première image */
async function detectSubject(imageBase64) {
  const data = await callAnthropic({
    model: MODEL,
    max_tokens: 50,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 }
        },
        {
          type: 'text',
          text: 'Quelle est la matière scolaire de ces notes ? Réponds UNIQUEMENT par un de ces mots : Physique-Chimie, Mathématiques, SVT, Histoire-Géo, Français, Philosophie, Langues, Économie, Autre'
        }
      ]
    }]
  });

  const detected = data.content[0].text.trim();
  // Trouver la correspondance la plus proche
  for (const subject of Object.keys(SUBJECTS)) {
    if (detected.toLowerCase().includes(subject.toLowerCase())) {
      return subject;
    }
  }
  return 'Autre';
}

/** Génère la fiche HTML */
async function generateFiche(images, config) {
  const imageBlocks = images.map(img => ({
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: img }
  }));

  const systemPrompt = `Tu es un assistant spécialisé dans la transformation de notes manuscrites en fiches HTML imprimables au format A4 paysage (2 colonnes A5).

## ARCHITECTURE HTML OBLIGATOIRE

Structure de base :
<div class="page-landscape">
    <div class="col-a5">[Colonne gauche]</div>
    <div class="col-a5">[Colonne droite]</div>
</div>

Règles critiques :
- TOUJOURS utiliser display:flex sur .page-landscape
- Chaque .col-a5 = 50% width avec box-sizing:border-box
- Dimensions fixes : width:29.7cm; height:21cm
- NE JAMAIS utiliser column-count CSS
- Multi-pages : dupliquer la div.page-landscape

## CSS COMPLET À INCLURE (copier tel quel)

:root {
    --main-color: ${config.mainColor};
    --accent-color: ${config.accentColor};
    --text-color: #1a1a1a;
}
@page { size: A4 landscape; margin: 0; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI',Arial,sans-serif; background:#444; color:var(--text-color); font-size:${config.fontSize}px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.page-landscape { width:29.7cm; height:21cm; margin:20px auto; background:white; display:flex; box-shadow:0 4px 20px rgba(0,0,0,0.2); }
.col-a5 { width:50%; height:100%; padding:1cm 1.2cm; border-right:1px dashed #ccc; overflow:hidden; }
.col-a5:last-child { border-right:none; }
h1 { font-size:1.4em; text-align:center; color:var(--main-color); border-bottom:3px solid var(--main-color); margin-bottom:20px; padding-bottom:5px; }
h2 { background:var(--main-color); color:white; padding:6px 12px; border-radius:4px; font-size:1.1em; margin:15px 0 8px 0; }
h3 { color:var(--main-color); border-bottom:1px solid #ddd; font-size:1em; margin-bottom:8px; padding-bottom:4px; }
p { margin-bottom:8px; line-height:1.5; }
ul { padding-left:20px; margin-bottom:10px; }
li { margin-bottom:6px; line-height:1.4; }
.box { border:1px solid #ddd; border-radius:8px; padding:12px; margin-bottom:12px; }
.important { border-left:5px solid var(--main-color); background:#f0f7fb; padding:10px; margin-bottom:12px; }
.formula-box { background:#f4f4f4; text-align:center; padding:15px; font-weight:bold; border-radius:5px; margin:10px 0; border:1px solid #ccc; font-size:1.2em; }
.synthesis-full { background:#fff4e5; border:1.5px solid var(--accent-color); padding:12px; border-radius:8px; margin-top:15px; }
.tag { font-weight:bold; text-decoration:underline; }
.spectrum-gradient { height:25px; background:linear-gradient(to right,#8e44ad,#2980b9,#27ae60,#f1c40f,#e67e22,#e74c3c); border-radius:4px; margin:10px 0; border:1px solid #333; }
@media print { body{background:none;} .page-landscape{box-shadow:none;margin:0;page-break-after:always;} .page-landscape:last-child{page-break-after:auto;} }

## 4 BLOCS STANDARDS

.box → sections standard
.important → définitions clés (bordure gauche colorée)
.formula-box → formules mathématiques
.synthesis-full → synthèses/questions d'examen (fond orange)

## HIÉRARCHIE

h1 → titre principal (1 seul, page 1 uniquement)
h2 → chapitres (fond coloré blanc)
h3 → sous-sections
.tag → mots-clés inline

## RÈGLES ABSOLUES DE FIDÉLITÉ

- Conserver 100% du contenu manuscrit sans exception
- Conserver les abréviations exactes ("qd", "tjrs", "→", etc.)
- Conserver les fautes d'orthographe et de grammaire originales
- Ne JAMAIS reformuler, synthétiser ou ajouter du contenu
- Utiliser autant de pages (.page-landscape) que nécessaire
- Ne pas inclure de panneau UI (géré par l'app)
- Retourner UNIQUEMENT le code HTML brut, sans markdown`;

  const data = await callAnthropic({
    model: MODEL,
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: [
        ...imageBlocks,
        {
          type: 'text',
          text: `Génère la fiche HTML pour ces notes.
Matière : ${config.subject}
Couleur principale : ${config.mainColor}
Couleur accent : ${config.accentColor}
Taille de police par défaut : ${config.fontSize}px

IMPORTANT : Retourne UNIQUEMENT le code HTML complet (commençant par <!DOCTYPE html> ou <div class="page-landscape">), sans markdown, sans backticks, sans explication.`
        }
      ]
    }]
  });

  let html = data.content[0].text;

  // Nettoyer si l'IA a ajouté des backticks markdown
  html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();

  // Si ce n'est pas un document complet, l'envelopper
  if (!html.startsWith('<!DOCTYPE') && !html.startsWith('<html')) {
    html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
:root {
    --main-color: ${config.mainColor};
    --accent-color: ${config.accentColor};
    --text-color: #1a1a1a;
}
@page { size: A4 landscape; margin: 0; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI',Arial,sans-serif; background:#444; color:var(--text-color); font-size:${config.fontSize}px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.page-landscape { width:29.7cm; height:21cm; margin:20px auto; background:white; display:flex; box-shadow:0 4px 20px rgba(0,0,0,0.2); }
.col-a5 { width:50%; height:100%; padding:1cm 1.2cm; border-right:1px dashed #ccc; overflow:hidden; }
.col-a5:last-child { border-right:none; }
h1 { font-size:1.4em; text-align:center; color:var(--main-color); border-bottom:3px solid var(--main-color); margin-bottom:20px; padding-bottom:5px; }
h2 { background:var(--main-color); color:white; padding:6px 12px; border-radius:4px; font-size:1.1em; margin:15px 0 8px 0; }
h3 { color:var(--main-color); border-bottom:1px solid #ddd; font-size:1em; margin-bottom:8px; padding-bottom:4px; }
p { margin-bottom:8px; line-height:1.5; }
ul { padding-left:20px; margin-bottom:10px; }
li { margin-bottom:6px; line-height:1.4; }
.box { border:1px solid #ddd; border-radius:8px; padding:12px; margin-bottom:12px; }
.important { border-left:5px solid var(--main-color); background:#f0f7fb; padding:10px; margin-bottom:12px; }
.formula-box { background:#f4f4f4; text-align:center; padding:15px; font-weight:bold; border-radius:5px; margin:10px 0; border:1px solid #ccc; font-size:1.2em; }
.synthesis-full { background:#fff4e5; border:1.5px solid var(--accent-color); padding:12px; border-radius:8px; margin-top:15px; }
.tag { font-weight:bold; text-decoration:underline; }
@media print { body{background:none;} .page-landscape{box-shadow:none;margin:0;page-break-after:always;} .page-landscape:last-child{page-break-after:auto;} }
</style>
</head>
<body>
${html}
</body>
</html>`;
  }

  return html;
}

/** Extrait le titre depuis le HTML (contenu du h1) */
function extractTitleFromHtml(html) {
  const match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (match) {
    return match[1].replace(/<[^>]*>/g, '').trim();
  }
  return 'Sans titre';
}
