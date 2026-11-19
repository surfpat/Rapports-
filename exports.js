/* =====================================================================
   FIREWISE EQUIPMENT CARE — exports.js
   Exports : PDF (html2pdf.js) et Word .docx (docx.js)
   Inclut : pièces, matériel testé, mesures batteries, signatures
===================================================================== */

/* ---------- 13. Exports (PDF / Word) ---------- */
function exportPDF(reportId){
  const r = state.reports.find(x => x.id === reportId);
  if(!r) return;
  if(typeof html2pdf === 'undefined'){ return toast('Bibliothèque PDF non chargée : vérifiez votre connexion réseau.'); }
  const pa = document.getElementById('printArea');
  pa.innerHTML = `<div class="rp-wrap" style="background:#fff;padding:26px 30px">${reportSheetHTML(r)}</div>`;
  html2pdf().set({
    margin:[8,8,8,8],
    filename:`${r.no}-${slug(REPORT_TYPES[r.type]||'rapport')}.pdf`,
    image:{ type:'jpeg', quality:0.96 },
    html2canvas:{ scale:2, useCORS:true, backgroundColor:'#ffffff' },
    jsPDF:{ unit:'mm', format:'a4', orientation:'portrait' },
    pagebreak:{ mode:['css','legacy'] },
  }).from(pa.firstChild).save()
    .then(() => { pa.innerHTML = ''; toast('PDF généré.', true); })
    .catch(() => { pa.innerHTML = ''; toast('Échec de la génération PDF.'); });
}

function b64ToU8(b64){
  const bin = atob(String(b64).split(',')[1] || '');
  const u = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

function exportDOCX(reportId){
  const r = state.reports.find(x => x.id === reportId);
  if(!r) return;
  const D = window.docx;
  if(!D || !D.Document){ return toast('Bibliothèque Word non chargée : vérifiez votre connexion réseau.'); }

  const border = { style: D.BorderStyle.SINGLE, size: 4, color: '444444' };
  const cellBorders = { top:border, bottom:border, left:border, right:border };
  const cell = (text, opts = {}) => new D.TableCell({
    borders: cellBorders,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    width: opts.w ? { size: opts.w, type: D.WidthType.PERCENTAGE } : undefined,
    shading: opts.head ? { fill: 'EFECEB' } : undefined,
    children: [new D.Paragraph({ children: [new D.TextRun({ text: text || '—', bold: !!opts.head, size: opts.head ? 19 : 20 })] })],
  });
  const sec = title => new D.Paragraph({
    spacing: { before: 220, after: 90 },
    border: { bottom: { style: D.BorderStyle.SINGLE, size: 4, color: '555555' } },
    children: [new D.TextRun({ text: title.toUpperCase(), bold: true, size: 19, color: '444444' })],
  });
  const para = (t, opts = {}) => new D.Paragraph({
    spacing: { after: 60 },
    children: [new D.TextRun({ text: t || '—', size: 20, italics: !!opts.i })],
  });
  const img = data => new D.Paragraph({
    children: [new D.ImageRun({ data: b64ToU8(data), transformation: { width: 220, height: 68 } })],
  });

  const pieces = (r.pieces || []);
  const tests = (r.tests || []);
  const batteries = (r.batteries || []);

  const piecesTable = new D.Table({
    width: { size: 100, type: D.WidthType.PERCENTAGE },
    rows: [
      new D.TableRow({ tableHeader: true, children: [cell('Désignation', { head:true }), cell('Référence', { head:true }), cell('Qté', { head:true, w:12 })] }),
      ...(pieces.length ? pieces.map(p => new D.TableRow({ children: [cell(p.d), cell(p.r), cell(p.q)] }))
        : [new D.TableRow({ children: [cell('Aucune pièce remplacée'), cell(''), cell('')] })]),
    ],
  });

  const testedTable = new D.Table({
    width: { size: 100, type: D.WidthType.PERCENTAGE },
    rows: [
      new D.TableRow({ tableHeader: true, children: [cell('Matériel testé', { head:true }), cell('Résultat', { head:true, w:18 }), cell('Observation', { head:true })] }),
      ...(tests.length ? tests.map(t => new D.TableRow({ children: [cell(t.label), cell(TEST_RESULTS[t.res]||'—'), cell(t.note)] }))
        : [new D.TableRow({ children: [cell('Aucun matériel testé'), cell(''), cell('')] })]),
    ],
  });

    const batteriesTable = new D.Table({
    width: { size: 100, type: D.WidthType.PERCENTAGE },
    rows: [
      new D.TableRow({ tableHeader: true, children: [
        cell('Matériel', { head:true }), cell('Batteries', { head:true }),
        cell('Charge (U / I)', { head:true, w:12 }),
        cell('Test (I absorbée · U t0→t1h)', { head:true, w:16 }),
        cell('Capacité restante / autonomie', { head:true, w:16 }),
        cell('Résultat', { head:true, w:13 }),
        cell('Observation', { head:true }),
      ]}),
      ...(batteries.length ? batteries.map(b => {
        const chargeTxt = [b.vch ? b.vch + ' V' : '', b.ich ? b.ich + ' A' : ''].filter(Boolean).join(' / ') || '—';
        const batTxt = [b.bat, b.cnom ? b.cnom + ' Ah' : '', b.unom ? b.unom + ' V' : ''].filter(Boolean).join(' · ') || '—';
        const testTxt = [b.iabs ? 'I ' + b.iabs + ' A' : '', (b.ut0 || b.ut1) ? (b.ut0||'?') + ' → ' + (b.ut1||'?') + ' V' : ''].filter(Boolean).join(' · ') || '—';
        const capTxt = [b.cmes ? b.cmes + ' % restant' : '', b.aut ? b.aut + ' h autonomie' : '', b.q1h ? b.q1h + ' Ah consommés (1 h)' : ''].filter(Boolean).join(' · ') || '—';
        return new D.TableRow({ children: [
          cell(b.mat), cell(batTxt), cell(chargeTxt), cell(testTxt), cell(capTxt),
          cell(BATTERY_RESULTS[b.res]||'Non testé'), cell(b.note),
        ]});
      }) : [new D.TableRow({ children: [cell('Aucune mesure relevée'), cell(''), cell(''), cell(''), cell(''), cell(''), cell('')] })]),
    ],
  });

  const children = [
    new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing:{ after: 40 },
      children: [new D.TextRun({ text: "RAPPORT D'INTERVENTION SSI", bold: true, size: 34 })] }),
    new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing:{ after: 240 },
      children: [new D.TextRun({ text: `${r.no} — ${REPORT_TYPES[r.type]||''}`, bold: true, size: 22, color: 'C1272D' })] }),
    sec('Informations'),
    new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, rows: [
      new D.TableRow({ children: [cell('Date', { head:true, w:16 }), cell(fmtDate(r.date), { w:34 }), cell('Technicien', { head:true, w:16 }), cell(r.tech, { w:34 })] }),
      new D.TableRow({ children: [cell('Objet', { head:true, w:16 }), cell(reportObjet(r))] }),
    ]}),
    sec('Observations / constat'), para(r.obs),
    sec('Anomalies constatées'), para(r.anomalies || 'Aucune anomalie relevée.'),
    sec('Actions réalisées'), para(r.actions),
    sec('Pièces remplacées'), piecesTable,
    sec('Matériel testé'), testedTable,
    sec('Mesures batteries'), batteriesTable,
    sec('Recommandations'), para(r.reco),
    sec('Prochaine visite'), para(r.nextVisit ? fmtDate(r.nextVisit) : 'Non planifiée.'),
    sec('Signatures'),
    new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, rows: [
      new D.TableRow({ children: [
        new D.TableCell({ borders: cellBorders, margins:{ top:60,bottom:60,left:100,right:100 },
          children: [new D.Paragraph({ children:[new D.TextRun({ text:'Technicien', bold:true, size:18, color:'555555' })] }),
                     ...(r.sigTech ? [img(r.sigTech)] : [para('Non signé', { i:true })])] }),
        new D.TableCell({ borders: cellBorders, margins:{ top:60,bottom:60,left:100,right:100 },
          children: [new D.Paragraph({ children:[new D.TextRun({ text:'Client / représentant', bold:true, size:18, color:'555555' })] }),
                     ...(r.sigClient ? [img(r.sigClient)] : [para('Non signé', { i:true })])] }),
      ]}),
    ]}),
    new D.Paragraph({ spacing:{ before: 200 }, children: [new D.TextRun({
      text: `Document généré le ${fmtDate(todayISO())} par Firewise Equipment Care — ${r.no}`,
      size: 16, color: '888888' })] }),
  ];

  try{
    const doc = new D.Document({ sections: [{ properties: {}, children }] });
    D.Packer.toBlob(doc).then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${r.no}-${slug(REPORT_TYPES[r.type]||'rapport')}.docx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Document Word généré.', true);
    }).catch(() => toast('Échec de la génération Word.'));
  }catch(e){
    toast('Échec de la génération Word : ' + e.message);
  }
}

/* ===== FIN DE exports.js ===== */