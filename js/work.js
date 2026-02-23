/* ============================================
   FicheIA — Mode Travailler
   ============================================ */

// --- État du mode travail ---
const workState = {
  sourceFiche: null,    // { html, subject, title, id }
  sourceText: '',       // texte brut extrait de la fiche
  chatMessages: [],     // [{ role: 'user'|'assistant', content: '' }]
  isChatLoading: false
};

/** Point d'entrée du mode Travailler */
function initWorkMode(sourceFiche) {
  workState.sourceFiche = sourceFiche;
  workState.sourceText = extractTextFromHtml(sourceFiche.html, 6000);
  workState.chatMessages = [];
  workState.isChatLoading = false;

  // Afficher le titre source
  const titleEl = document.getElementById('work-source-title');
  if (titleEl) titleEl.textContent = sourceFiche.title || 'Sans titre';

  navigateTo('work');
  showWorkPanel('menu');
}

/** Navigation interne entre panneaux */
function showWorkPanel(panelId) {
  document.querySelectorAll('#screen-work .work-panel').forEach(p => {
    p.hidden = true;
  });
  const target = document.getElementById('work-panel-' + panelId);
  if (target) target.hidden = false;
}

/** Extrait le texte brut depuis du HTML */
function extractTextFromHtml(html, max = 6000) {
  const div = document.createElement('div');
  div.innerHTML = html;
  // Retirer les balises style et script
  div.querySelectorAll('style, script').forEach(el => el.remove());
  let text = div.textContent || div.innerText || '';
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > max) text = text.substring(0, max);
  return text;
}

/** Génère du contenu via l'API et l'affiche dans le Viewer */
async function startWorkGeneration(mode, options) {
  const promptBuilders = {
    questions: buildQuestionsPrompt,
    exercices: buildExercicesPrompt,
    redaction: buildRedactionPrompt,
    methode: buildMethodePrompt,
    libre: buildFreePrompt
  };

  const builder = promptBuilders[mode];
  if (!builder) return;

  const { system, user } = builder(options);

  // Naviguer vers le viewer avec progression
  navigateTo('viewer');
  const progressEl = document.getElementById('generation-progress');
  const messageEl = document.getElementById('generation-message');
  const containerEl = document.getElementById('fiche-container');
  const viewerTitle = document.getElementById('viewer-title');

  progressEl.hidden = false;
  containerEl.hidden = true;
  document.querySelector('#generation-progress .spinner').hidden = false;

  const modeLabels = {
    questions: 'Questions',
    exercices: 'Exercices',
    redaction: 'Rédaction',
    methode: 'Fiche méthode',
    libre: 'Question libre'
  };
  viewerTitle.textContent = modeLabels[mode] || 'Travail';

  // Messages de progression
  state.progressTimers = startProgressMessages(messageEl);
  state.isGenerating = true;

  try {
    const settings = getSettings();
    const modelChoice = settings.model || 'sonnet';
    const generationModel = modelChoice === 'haiku' ? MODEL_DETECTION : MODEL_GENERATION;

    const data = await callAnthropic({
      model: generationModel,
      max_tokens: modelChoice === 'haiku' ? 8000 : 12000,
      system: system,
      messages: [{ role: 'user', content: user }]
    });

    stopProgressMessages(state.progressTimers);

    let html = data.content[0].text;
    html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();

    // Envelopper si pas un document complet
    if (!html.startsWith('<!DOCTYPE') && !html.startsWith('<html')) {
      html = wrapWorkHtml(html, mode);
    }

    // Stocker la fiche courante
    const extracted = extractTitleFromHtml(html);
    const title = (extracted && extracted !== 'Sans titre') ? extracted : modeLabels[mode];
    state.currentFiche = {
      html,
      subject: workState.sourceFiche.subject,
      mainColor: workState.sourceFiche.mainColor || '#2980b9',
      accentColor: '#e67e22',
      fontSize: 14,
      title,
      type: mode,
      parentId: workState.sourceFiche.id || null
    };

    const iframe = document.getElementById('fiche-iframe');
    renderFicheInIframe(iframe, html);

    progressEl.hidden = true;
    containerEl.hidden = false;
    state.isGenerating = false;

    notifyGenerationDone(title);

  } catch (e) {
    state.isGenerating = false;
    stopProgressMessages(state.progressTimers);
    console.error('Erreur génération travail:', e);
    messageEl.textContent = getErrorMessage(e);
    document.querySelector('#generation-progress .spinner').hidden = true;
  }
}

/** Enveloppe le HTML généré avec les styles */
function wrapWorkHtml(content, mode) {
  const mainColor = workState.sourceFiche.mainColor || '#2980b9';
  const accentColor = '#e67e22';
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
:root {
    --main-color: ${mainColor};
    --accent-color: ${accentColor};
    --text-color: #1a1a1a;
}
@page { size: A4 landscape; margin: 0; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI',Arial,sans-serif; background:#444; color:var(--text-color); font-size:14px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.page-landscape { width:29.7cm; height:21cm; margin:20px auto; background:white; display:flex; box-shadow:0 4px 20px rgba(0,0,0,0.2); }
.col-a5 { width:50%; height:100%; padding:1cm 1.2cm; border-right:1px dashed #ccc; overflow:hidden; }
.col-a5:last-child { border-right:none; }
h1 { font-size:1.4em; text-align:center; color:var(--main-color); border-bottom:3px solid var(--main-color); margin-bottom:20px; padding-bottom:5px; }
h2 { background:var(--main-color); color:white; padding:6px 12px; border-radius:4px; font-size:1.1em; margin:15px 0 8px 0; }
h3 { color:var(--main-color); border-bottom:1px solid #ddd; font-size:1em; margin-bottom:8px; padding-bottom:4px; }
p { margin-bottom:8px; line-height:1.5; }
ul, ol { padding-left:20px; margin-bottom:10px; }
li { margin-bottom:6px; line-height:1.4; }
.box { border:1px solid #ddd; border-radius:8px; padding:12px; margin-bottom:12px; }
.important { border-left:5px solid var(--main-color); background:#f0f7fb; padding:10px; margin-bottom:12px; }
.formula-box { background:#f4f4f4; text-align:center; padding:15px; font-weight:bold; border-radius:5px; margin:10px 0; border:1px solid #ccc; font-size:1.2em; }
.correction { background:#e8f8e8; border:1px solid #27ae60; border-radius:8px; padding:12px; margin-top:10px; }
.correction h3 { color:#27ae60; }
.question-block { background:#f9f9f9; border:1px solid #ddd; border-radius:8px; padding:12px; margin-bottom:12px; }
.question-block .question-num { font-weight:bold; color:var(--main-color); }
.synthesis-full { background:#fff4e5; border:1.5px solid var(--accent-color); padding:12px; border-radius:8px; margin-top:15px; }
@media print { body{background:none;} .page-landscape{box-shadow:none;margin:0;page-break-after:always;} .page-landscape:last-child{page-break-after:auto;} }
</style>
</head>
<body>
${content}
</body>
</html>`;
}

// --- Prompts ---

function buildQuestionsPrompt(opts) {
  const { format, count, difficulty } = opts;
  const formatLabels = {
    qcm: 'QCM (questions à choix multiples avec 4 options, 1 bonne réponse)',
    ouvertes: 'Questions ouvertes (réponses rédigées attendues)',
    vf: 'Vrai/Faux (avec justification de la réponse)',
    mix: 'Mix de QCM, questions ouvertes et Vrai/Faux'
  };
  const diffLabels = {
    facile: 'Facile (mémorisation, restitution directe)',
    moyen: 'Moyen (compréhension, application)',
    difficile: 'Difficile (analyse, synthèse, esprit critique)'
  };

  return {
    system: `Tu es un professeur qui crée des questions de révision à partir du contenu d'une fiche de cours.

## CONTENU DE LA FICHE SOURCE
${workState.sourceText}

## RÈGLES
- Matière : ${workState.sourceFiche.subject}
- Créer exactement ${count} questions
- Format : ${formatLabels[format] || formatLabels.mix}
- Difficulté : ${diffLabels[difficulty] || diffLabels.moyen}
- TOUJOURS inclure les réponses/corrections après chaque question dans un bloc .correction
- Les questions doivent couvrir les points clés du cours
- Retourner UNIQUEMENT du HTML brut au format A4 paysage (div.page-landscape > div.col-a5)
- Pas de markdown, pas de backticks`,
    user: `Génère ${count} questions de type "${format}" en difficulté "${difficulty}" à partir du cours ci-dessus.

IMPORTANT : Retourne UNIQUEMENT le code HTML (div.page-landscape avec col-a5), sans markdown ni backticks.`
  };
}

function buildExercicesPrompt(opts) {
  const { type, count, withCorrection } = opts;
  const typeLabels = {
    application: 'Exercices d\'application directe (appliquer une formule, une règle)',
    analyse: 'Exercices d\'analyse (interpréter un document, un graphique, un texte)',
    synthese: 'Exercices de synthèse (croiser plusieurs notions)',
    probleme: 'Problèmes complets (mise en situation réaliste)'
  };

  return {
    system: `Tu es un professeur qui crée des exercices à partir du contenu d'une fiche de cours.

## CONTENU DE LA FICHE SOURCE
${workState.sourceText}

## RÈGLES
- Matière : ${workState.sourceFiche.subject}
- Créer exactement ${count} exercice(s)
- Type : ${typeLabels[type] || typeLabels.application}
- ${withCorrection ? 'Inclure un corrigé détaillé pour chaque exercice dans un bloc .correction' : 'NE PAS inclure de corrigé'}
- Exercices progressifs en difficulté
- Retourner UNIQUEMENT du HTML brut au format A4 paysage (div.page-landscape > div.col-a5)
- Pas de markdown, pas de backticks`,
    user: `Génère ${count} exercice(s) de type "${type}" à partir du cours ci-dessus.${withCorrection ? ' Inclus le corrigé détaillé.' : ''}

IMPORTANT : Retourne UNIQUEMENT le code HTML (div.page-landscape avec col-a5), sans markdown ni backticks.`
  };
}

function buildRedactionPrompt(opts) {
  const { subject, type } = opts;
  const typeLabels = {
    dissertation: 'Dissertation : introduction, développement en parties, conclusion',
    commentaire: 'Commentaire de texte : analyse linéaire ou thématique',
    explication: 'Explication détaillée du sujet/thème',
    plan: 'Plan détaillé : structure argumentaire sans rédiger intégralement'
  };

  return {
    system: `Tu es un professeur qui aide à la rédaction académique à partir du contenu d'une fiche de cours.

## CONTENU DE LA FICHE SOURCE
${workState.sourceText}

## RÈGLES
- Matière : ${workState.sourceFiche.subject}
- Type de travail : ${typeLabels[type] || typeLabels.explication}
- Utiliser les connaissances du cours comme base
- Structure claire avec titres et sous-titres
- Retourner UNIQUEMENT du HTML brut au format A4 paysage (div.page-landscape > div.col-a5)
- Pas de markdown, pas de backticks`,
    user: `Sujet : "${subject}"
Type : ${type}

Rédige ce travail en utilisant les connaissances du cours ci-dessus.

IMPORTANT : Retourne UNIQUEMENT le code HTML (div.page-landscape avec col-a5), sans markdown ni backticks.`
  };
}

function buildMethodePrompt(opts) {
  const { subject } = opts;

  return {
    system: `Tu es un professeur qui crée des fiches méthode à partir du contenu d'un cours.

## CONTENU DE LA FICHE SOURCE
${workState.sourceText}

## RÈGLES
- Matière : ${workState.sourceFiche.subject}
- Créer une fiche méthode claire et pratique
- Structure : étapes numérotées, conseils, pièges à éviter, exemples tirés du cours
- Focus sur le "comment faire" (pas sur le contenu théorique)
- Retourner UNIQUEMENT du HTML brut au format A4 paysage (div.page-landscape > div.col-a5)
- Pas de markdown, pas de backticks`,
    user: `Crée une fiche méthode sur le thème : "${subject}"

Utilise le contenu du cours comme base pour les exemples et les applications.

IMPORTANT : Retourne UNIQUEMENT le code HTML (div.page-landscape avec col-a5), sans markdown ni backticks.`
  };
}

function buildFreePrompt(question) {
  return {
    system: `Tu es un assistant scolaire. Tu as accès au contenu d'une fiche de cours et tu dois répondre à la question de l'élève de manière complète et structurée.

## CONTENU DE LA FICHE SOURCE
${workState.sourceText}

## RÈGLES
- Matière : ${workState.sourceFiche.subject}
- Répondre de façon claire, pédagogique et structurée
- Utiliser les connaissances du cours quand c'est pertinent
- Retourner UNIQUEMENT du HTML brut au format A4 paysage (div.page-landscape > div.col-a5)
- Pas de markdown, pas de backticks`,
    user: `Question de l'élève : "${question}"

Réponds en utilisant le contenu du cours ci-dessus comme contexte.

IMPORTANT : Retourne UNIQUEMENT le code HTML (div.page-landscape avec col-a5), sans markdown ni backticks.`
  };
}

// --- Mode Chat ---

async function sendChatMessage(text) {
  if (!text.trim() || workState.isChatLoading) return;

  // Ajouter le message utilisateur
  workState.chatMessages.push({ role: 'user', content: text.trim() });
  renderChatMessages();

  // Limiter l'historique à 20 messages
  if (workState.chatMessages.length > 20) {
    workState.chatMessages = workState.chatMessages.slice(-20);
  }

  workState.isChatLoading = true;
  renderChatLoading(true);

  try {
    const settings = getSettings();
    const modelChoice = settings.model || 'sonnet';
    const chatModel = modelChoice === 'haiku' ? MODEL_DETECTION : MODEL_GENERATION;

    const systemPrompt = `Tu es un assistant scolaire bienveillant et pédagogue. Tu discutes avec un(e) élève à propos d'une fiche de cours.

## CONTENU DE LA FICHE SOURCE
${workState.sourceText}

## RÈGLES
- Matière : ${workState.sourceFiche.subject}
- Réponds de façon claire, concise et adaptée au niveau lycée
- Utilise le contenu du cours comme référence
- Tu peux expliquer, donner des exemples, poser des questions pour vérifier la compréhension
- Réponds en texte simple (pas de HTML), utilise du markdown léger si besoin (gras, listes)
- Sois encourageant et bienveillant`;

    const data = await callAnthropic({
      model: chatModel,
      max_tokens: 2000,
      system: systemPrompt,
      messages: workState.chatMessages
    });

    const response = data.content[0].text;
    workState.chatMessages.push({ role: 'assistant', content: response });

  } catch (e) {
    console.error('Erreur chat:', e);
    workState.chatMessages.push({
      role: 'assistant',
      content: 'Désolé, une erreur est survenue. ' + getErrorMessage(e)
    });
  }

  workState.isChatLoading = false;
  renderChatLoading(false);
  renderChatMessages();
}

function renderChatMessages() {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  container.innerHTML = '';
  workState.chatMessages.forEach(msg => {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-' + msg.role;
    bubble.innerHTML = formatChatContent(msg.content);
    container.appendChild(bubble);
  });

  // Scroll en bas
  container.scrollTop = container.scrollHeight;
}

function renderChatLoading(show) {
  const indicator = document.getElementById('chat-loading');
  if (indicator) indicator.hidden = !show;
}

/** Formate le contenu chat (markdown léger → HTML) */
function formatChatContent(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n- /g, '\n• ')
    .replace(/\n/g, '<br>');
}

/** Convertit la conversation chat en fiche HTML */
async function convertChatToFiche() {
  if (workState.chatMessages.length === 0) {
    alert('Aucune conversation à convertir.');
    return;
  }

  const conversation = workState.chatMessages
    .map(m => (m.role === 'user' ? 'Élève' : 'Prof') + ' : ' + m.content)
    .join('\n\n');

  navigateTo('viewer');
  const progressEl = document.getElementById('generation-progress');
  const messageEl = document.getElementById('generation-message');
  const containerEl = document.getElementById('fiche-container');
  const viewerTitle = document.getElementById('viewer-title');

  progressEl.hidden = false;
  containerEl.hidden = true;
  document.querySelector('#generation-progress .spinner').hidden = false;
  viewerTitle.textContent = 'Fiche depuis conversation';

  state.progressTimers = startProgressMessages(messageEl);
  state.isGenerating = true;

  try {
    const settings = getSettings();
    const modelChoice = settings.model || 'sonnet';
    const generationModel = modelChoice === 'haiku' ? MODEL_DETECTION : MODEL_GENERATION;

    const data = await callAnthropic({
      model: generationModel,
      max_tokens: modelChoice === 'haiku' ? 8000 : 12000,
      system: `Tu transformes une conversation pédagogique en fiche de révision HTML imprimable au format A4 paysage.

## RÈGLES
- Matière : ${workState.sourceFiche.subject}
- Extraire les points clés, explications et exemples de la conversation
- Structurer en fiche claire avec titres, sous-titres, encadrés
- Format : div.page-landscape > div.col-a5
- Retourner UNIQUEMENT du HTML brut, sans markdown ni backticks`,
      messages: [{
        role: 'user',
        content: `Voici la conversation à transformer en fiche :\n\n${conversation}\n\nIMPORTANT : Retourne UNIQUEMENT le code HTML (div.page-landscape avec col-a5), sans markdown ni backticks.`
      }]
    });

    stopProgressMessages(state.progressTimers);

    let html = data.content[0].text;
    html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();

    if (!html.startsWith('<!DOCTYPE') && !html.startsWith('<html')) {
      html = wrapWorkHtml(html, 'chat');
    }

    const extracted2 = extractTitleFromHtml(html);
    const title = (extracted2 && extracted2 !== 'Sans titre') ? extracted2 : 'Fiche conversation';
    state.currentFiche = {
      html,
      subject: workState.sourceFiche.subject,
      mainColor: workState.sourceFiche.mainColor || '#2980b9',
      accentColor: '#e67e22',
      fontSize: 14,
      title,
      type: 'chat',
      parentId: workState.sourceFiche.id || null
    };

    const iframe = document.getElementById('fiche-iframe');
    renderFicheInIframe(iframe, html);

    progressEl.hidden = true;
    containerEl.hidden = false;
    state.isGenerating = false;

  } catch (e) {
    state.isGenerating = false;
    stopProgressMessages(state.progressTimers);
    console.error('Erreur conversion chat:', e);
    messageEl.textContent = getErrorMessage(e);
    document.querySelector('#generation-progress .spinner').hidden = true;
  }
}

// --- Listeners ---

function initWorkListeners() {
  // Bouton retour menu depuis les sous-panneaux
  document.querySelectorAll('.btn-work-back').forEach(btn => {
    btn.addEventListener('click', () => showWorkPanel('menu'));
  });

  // Menu : boutons de mode
  document.querySelectorAll('.work-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.dataset.panel;
      if (panel) showWorkPanel(panel);
    });
  });

  // Pill pickers dans les panneaux work
  document.querySelectorAll('#screen-work .pill-picker').forEach(picker => {
    picker.addEventListener('click', (e) => {
      const pill = e.target.closest('.pill');
      if (!pill) return;
      picker.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });

  // --- Questions ---
  const btnGenQuestions = document.getElementById('btn-gen-questions');
  if (btnGenQuestions) {
    btnGenQuestions.addEventListener('click', () => {
      const format = getWorkPickerValue('work-questions-format') || 'mix';
      const count = parseInt(document.getElementById('work-questions-count').value) || 5;
      const difficulty = getWorkPickerValue('work-questions-difficulty') || 'moyen';
      startWorkGeneration('questions', { format, count, difficulty });
    });
  }

  // --- Exercices ---
  const btnGenExercices = document.getElementById('btn-gen-exercices');
  if (btnGenExercices) {
    btnGenExercices.addEventListener('click', () => {
      const type = getWorkPickerValue('work-exercices-type') || 'application';
      const count = parseInt(document.getElementById('work-exercices-count').value) || 3;
      const withCorrection = document.getElementById('work-exercices-correction').checked;
      startWorkGeneration('exercices', { type, count, withCorrection });
    });
  }

  // --- Rédaction ---
  const btnGenRedaction = document.getElementById('btn-gen-redaction');
  if (btnGenRedaction) {
    btnGenRedaction.addEventListener('click', () => {
      const subject = document.getElementById('work-redaction-subject').value.trim();
      const type = getWorkPickerValue('work-redaction-type') || 'explication';
      if (!subject) {
        alert('Entre un sujet ou une question.');
        return;
      }
      startWorkGeneration('redaction', { subject, type });
    });
  }

  // --- Méthode ---
  const btnGenMethode = document.getElementById('btn-gen-methode');
  if (btnGenMethode) {
    btnGenMethode.addEventListener('click', () => {
      const subject = document.getElementById('work-methode-subject').value.trim();
      if (!subject) {
        alert('Entre un sujet pour la fiche méthode.');
        return;
      }
      startWorkGeneration('methode', { subject });
    });
  }

  // --- Question libre (menu) ---
  const btnFreeQuestion = document.getElementById('btn-free-question');
  if (btnFreeQuestion) {
    btnFreeQuestion.addEventListener('click', () => {
      const question = document.getElementById('work-free-input').value.trim();
      if (!question) {
        alert('Entre ta question.');
        return;
      }
      startWorkGeneration('libre', question);
    });
  }

  // --- Chat ---
  const btnChatSend = document.getElementById('btn-chat-send');
  const chatInput = document.getElementById('chat-input');
  if (btnChatSend && chatInput) {
    btnChatSend.addEventListener('click', () => {
      sendChatMessage(chatInput.value);
      chatInput.value = '';
    });
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage(chatInput.value);
        chatInput.value = '';
      }
    });
  }

  const btnChatToFiche = document.getElementById('btn-chat-to-fiche');
  if (btnChatToFiche) {
    btnChatToFiche.addEventListener('click', convertChatToFiche);
  }
}

/** Helper : récupérer la valeur du pill picker dans le contexte work */
function getWorkPickerValue(pickerId) {
  const active = document.querySelector(`#${pickerId} .pill.active`);
  return active ? active.dataset.value : null;
}
