/* ============================================
   FicheIA — Génération et affichage des fiches
   ============================================ */

/** Ajuste la hauteur de l'iframe selon son contenu */
function resizeIframe(iframe) {
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    const body = doc.body;
    if (body) {
      const pages = doc.querySelectorAll('.page-landscape');
      if (pages.length > 0) {
        const lastPage = pages[pages.length - 1];
        const totalHeight = lastPage.offsetTop + lastPage.offsetHeight + 40;
        iframe.style.height = totalHeight + 'px';
      } else {
        iframe.style.height = body.scrollHeight + 60 + 'px';
      }
    }
  } catch (e) {
    iframe.style.height = '800px';
  }
}

/** Affiche le HTML dans l'iframe */
function renderFicheInIframe(iframe, html) {
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  // Ajuster la hauteur après le rendu initial + second passage pour les images/fonts
  setTimeout(() => resizeIframe(iframe), 150);
  setTimeout(() => resizeIframe(iframe), 500);
}

/** Met à jour la taille de police dans l'iframe */
function updateIframeFontSize(iframe, fontSize) {
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    if (doc && doc.body) {
      doc.body.style.fontSize = fontSize + 'px';
      // Recalculer la hauteur après changement de taille
      setTimeout(() => resizeIframe(iframe), 100);
    }
  } catch (e) {
    // Ignorer les erreurs cross-origin
  }
}

/** Messages de progression */
const PROGRESS_MESSAGES = [
  { text: 'Analyse des photos...', delay: 0 },
  { text: 'Transcription du contenu...', delay: 3000 },
  { text: 'Génération de la fiche...', delay: 7000 },
  { text: 'Mise en page finale...', delay: 12000 }
];

/** Lance les messages de progression */
function startProgressMessages(messageEl) {
  const timers = [];
  PROGRESS_MESSAGES.forEach(msg => {
    const timer = setTimeout(() => {
      messageEl.textContent = msg.text;
    }, msg.delay);
    timers.push(timer);
  });
  return timers;
}

/** Arrête les messages de progression */
function stopProgressMessages(timers) {
  timers.forEach(t => clearTimeout(t));
}
