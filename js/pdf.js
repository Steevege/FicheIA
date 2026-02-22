/* ============================================
   FicheIA — Export PDF via print
   ============================================ */

/** Exporte en PDF via un nouvel onglet print */
function exportPDF(html) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Le navigateur a bloqué l\'ouverture du PDF. Autorisez les pop-ups pour ce site.');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  // Déclencher le dialogue d'impression (= Save to PDF sur iOS)
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

/** Impression directe de l'iframe */
function printFiche(iframe) {
  try {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  } catch (e) {
    // Fallback : ouvrir dans un nouvel onglet
    const html = iframe.contentDocument.documentElement.outerHTML;
    exportPDF(html);
  }
}
