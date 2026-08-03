const $ = id => document.getElementById(id);
const euro = n => Number(n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const feet = [
  ['PAvG', 'Antérieur gauche'],
  ['PAvD', 'Antérieur droit'],
  ['PArG', 'Postérieur gauche'],
  ['PArD', 'Postérieur droit']
];

const issues = ['Cerise', 'Abcès', 'Dermatite', 'Ulcère de sole', 'Ligne blanche', 'Fourchet', 'Limace', 'Seime', 'Double sole', 'Hémorragie', 'Décollement', 'Autre'];
const care = ['Parage', 'Pansement', 'Talonnette', 'Désinfection', 'À surveiller', 'À revoir'];
const races = ['abondance', 'angus', 'aubrac', 'autre', 'bazadaise', 'blonde', 'charolaise', 'gasconne', 'jersiaise', 'limousine', 'montbéliarde', 'prim holstein', 'salers', 'simmental', 'wagyu'];
const quickFootButtons = [
  ['PAvG', 'Ant. G (1 pied)'],
  ['PAvD', 'Ant. D (1 pied)'],
  ['PArG', 'Post. G (1 pied)'],
  ['PArD', 'Post. D (1 pied)']
];

const PAYMENT_HTML = `
<div style="margin-top:20px;border:1px solid #cfd8d4;padding:12px;border-radius:10px;background:#f8fbf9">
  <h3 style="margin:0 0 8px 0;color:#285c4d">Conditions de règlement</h3>
  <p style="margin:6px 0"><b>Paiement à 20 jours</b></p>
  <p style="margin:6px 0"><b>Par chèque</b> à l'ordre du GDS32 - 3 chemin de la caillaouère - 32000 AUCH</p>
  <p style="margin:6px 0"><b>Par espèces</b></p>
  <p style="margin:6px 0"><b>Par virement</b> au Crédit Agricole de Auch :<br>
  IBAN : <b>FR76 1690 6010 2003 4001 9914 139</b><br>
  BIC : <b>AGRIFRPP869</b></p>
</div>`;

let clients = [];
let jobs = JSON.parse(localStorage.getItem('parage.jobs') || '[]');
let current = null;
let settings = Object.assign({
  vat: 20,
  defaultFee: 60,
  pairOne: 20,
  pairMany: 15,
  footOne: 10,
  footMany: 7.5,
  bandagePrice: 5,
  blockPrice: 15,
  businessName: 'GDS Gers Hautes-Pyrénées',
  businessDetails: "GDS 32 - Gers Hautes-Pyrénées\n3 chemin de la caillaouère\n32000 AUCH"
}, JSON.parse(localStorage.getItem('parage.settings') || '{}'));
let costs = JSON.parse(localStorage.getItem('parage.costs') || '{}');

function saveAll() {
  localStorage.setItem('parage.jobs', JSON.stringify(jobs));
}

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  setTimeout(() => $('toast').classList.remove('show'), 1800);
}

function showView(viewId) {
  document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === viewId));
  document.querySelectorAll('#nav button').forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewId));
  if (viewId === 'history') renderHistory();
  if (viewId === 'exports') renderExports();
  if (viewId === 'stats') renderStats();
  if (viewId === 'home') renderHome();
}

document.querySelectorAll('#nav button').forEach(btn => btn.onclick = () => showView(btn.dataset.view));

async function init() {
  try {
    clients = await fetch('clients.json').then(r => r.json());
  } catch {
    clients = [];
  }

  $('clientsList').innerHTML = clients.slice(0, 10000).map(c => `<option value="${esc(c.cheptel)}">${esc(c.nom || '')}</option>`).join('');
  $('races').innerHTML = races.map(x => `<option value="${x}">`).join('');
  bindClient();
  loadSettings();
  $('statsMonth').value = today().slice(0, 7);
  renderHome();
  newJob();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
}

function bindClient() {
  let timer;
  $('cheptel').addEventListener('input', e => {
    clearTimeout(timer);
    const q = e.target.value.replace(/\D/g, '');
    timer = setTimeout(() => {
      const client = clients.find(x => x.cheptel === q);
      if (client) {
        $('clientName').value = client.nom || '';
        $('address').value = client.adresse || '';
        $('cpVille').value = client.cpVille || '';
        $('department').value = client.departement || '';
        renderPaymentAlert();
      }
    }, 100);
  });
}

function blankJob() {
  return {
    id: uid(),
    cheptel: '',
    clientName: '',
    address: '',
    cpVille: '',
    department: '',
    race: '',
    date: today(),
    start: nowTime(),
    end: '',
    bull: 'non',
    fee: settings.defaultFee,
    adjustment: 0,
    comment: '',
    animals: [],
    status: 'draft',
    exportedAt: null,
    paymentStatus: '',
    invoiceNo: '',
    createdAt: new Date().toISOString()
  };
}

function syncLegacyAnimal(a) {
  if (!a) return a;
  if (!Array.isArray(a.workedFeet)) a.workedFeet = [];
  if (typeof a.done !== 'boolean') a.done = false;
  if (typeof a.collapsed !== 'boolean') a.collapsed = false;
  if (!a.claws) a.claws = {};
  return a;
}

function newJob() {
  current = blankJob();
  fillJob();
}

function fillJob() {
  [
    ['cheptel', 'cheptel'], ['clientName', 'clientName'], ['address', 'address'], ['cpVille', 'cpVille'],
    ['department', 'department'], ['race', 'race'], ['jobDate', 'date'], ['startTime', 'start'],
    ['endTime', 'end'], ['bull', 'bull'], ['fee', 'fee'], ['adjustment', 'adjustment'], ['jobComment', 'comment']
  ].forEach(([id, key]) => $(id).value = current[key] ?? '');
  current.animals = (current.animals || []).map(syncLegacyAnimal);
  renderAnimals();
  renderTotals();
  renderPaymentAlert();
}

function syncJob() {
  [
    ['cheptel', 'cheptel'], ['clientName', 'clientName'], ['address', 'address'], ['cpVille', 'cpVille'],
    ['department', 'department'], ['race', 'race'], ['jobDate', 'date'], ['startTime', 'start'],
    ['endTime', 'end'], ['bull', 'bull'], ['fee', 'fee'], ['adjustment', 'adjustment'], ['jobComment', 'comment']
  ].forEach(([id, key]) => current[key] = $(id).value);
  current.fee = +current.fee || 0;
  current.adjustment = +current.adjustment || 0;
}

['fee', 'adjustment'].forEach(id => document.addEventListener('input', e => {
  if (e.target.id === id) {
    syncJob();
    renderTotals();
  }
}));

function addAnimal() {
  current.animals.forEach(a => a.collapsed = true);
  const animal = { id: uid(), number: '', category: 'V', notes: '', checkNext: false, claws: {}, workedFeet: [], collapsed: false, done: false };
  current.animals.push(animal);
  renderAnimals();
  setTimeout(() => document.querySelector(`[data-animal-number="${animal.id}"]`)?.focus(), 30);
}

function completeAnimal(id) {
  const animal = current.animals.find(x => x.id === id);
  if (!animal) return;
  if (!String(animal.number || '').trim()) return toast('Saisissez le numéro de travail');
  animal.done = true;
  animal.collapsed = true;
  saveDraftSilently();
  addAnimal();
  toast('Bovin enregistré — saisissez le suivant');
}

function toggleAnimal(id) {
  const animal = current.animals.find(x => x.id === id);
  if (animal) {
    animal.collapsed = !animal.collapsed;
    renderAnimals();
  }
}

function saveDraftSilently() {
  syncJob();
  const i = jobs.findIndex(x => x.id === current.id);
  if (i < 0) jobs.push(JSON.parse(JSON.stringify(current)));
  else jobs[i] = JSON.parse(JSON.stringify(current));
  saveAll();
}

function ensureWorkedFeet(animal) {
  if (!Array.isArray(animal.workedFeet)) animal.workedFeet = [];
  for (const code of feet.map(f => f[0])) {
    if (Object.entries(animal.claws || {}).some(([k, d]) => k.startsWith(code + '-') && d.touched) && !animal.workedFeet.includes(code)) {
      animal.workedFeet.push(code);
    }
  }
}

function setWorkedFeet(id, codes, on = true) {
  const animal = current.animals.find(x => x.id === id);
  if (!animal) return;
  ensureWorkedFeet(animal);
  codes.forEach(code => {
    const index = animal.workedFeet.indexOf(code);
    if (on && index < 0) animal.workedFeet.push(code);
    if (!on && index >= 0) animal.workedFeet.splice(index, 1);
  });
  renderAnimals();
}

function toggleFoot(id, code) {
  const animal = current.animals.find(x => x.id === id);
  if (!animal) return;
  ensureWorkedFeet(animal);
  setWorkedFeet(id, [code], !animal.workedFeet.includes(code));
}

function animalHistory(number) {
  if (!number || !current.cheptel) return [];
  return jobs
    .filter(j => j.cheptel === current.cheptel && j.id !== current.id)
    .flatMap(j => (j.animals || []).filter(a => a.number === number).map(a => ({ date: j.date, animal: syncLegacyAnimal(a) })))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function renderAnimals() {
  $('animals').innerHTML = current.animals.length ? '' : '<p>Aucun bovin saisi.</p>';
  current.animals.forEach((animal, i) => {
    syncLegacyAnimal(animal);
    ensureWorkedFeet(animal);
    const hist = animalHistory(animal.number);
    const div = document.createElement('div');
    div.className = 'animal' + (animal.collapsed ? ' collapsed' : '');
    const doneSummary = `${animal.workedFeet.length} pied(s) fait(s)${summaryAnimal(animal) !== 'aucun problème signalé' ? ' · ' + summaryAnimal(animal) : ''}`;
    div.innerHTML = `
      <div class="animalHead">
        <strong>Bovin ${i + 1}${animal.number ? ' — ' + esc(animal.number) : ''}</strong>
        ${animal.collapsed
          ? `<span class="animalSummary">${esc(doneSummary)}</span><button onclick="toggleAnimal('${animal.id}')">Modifier</button>`
          : `<input data-animal-number="${animal.id}" inputmode="numeric" autocomplete="off" placeholder="N° de travail" value="${esc(animal.number)}" oninput="updateAnimal('${animal.id}','number',this.value)">
             <select onchange="updateAnimal('${animal.id}','category',this.value)">${['V', 'Gén', 'JB', 'T', 'B'].map(x => `<option ${animal.category === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
             <label><input type="checkbox" ${animal.checkNext ? 'checked' : ''} onchange="updateAnimal('${animal.id}','checkNext',this.checked)"> À vérifier</label>
             <button onclick="removeAnimal('${animal.id}')">Supprimer</button>`}
      </div>
      ${animal.collapsed ? '' : `
        ${hist.length ? `<div class="historyAlert"><b>Historique trouvé</b> — dernier passage ${fmtDate(hist[0].date)} : ${summaryAnimal(hist[0].animal)}</div>` : ''}
        <div class="quickFeet">
          <b>Parage rapide :</b>
          <button onclick="setWorkedFeet('${animal.id}',['PAvG','PAvD'],true)">Antérieurs (1 paire)</button>
          <button onclick="setWorkedFeet('${animal.id}',['PArG','PArD'],true)">Postérieurs (1 paire)</button>
          <button onclick="setWorkedFeet('${animal.id}',['PAvG','PAvD','PArG','PArD'],true)">4 pieds (2 paires)</button>
          ${quickFootButtons.map(([code, label]) => `<button onclick="setWorkedFeet('${animal.id}',['${code}'],true)">${label}</button>`).join('')}
          <button onclick="setWorkedFeet('${animal.id}',['PAvG','PAvD','PArG','PArD'],false)">Effacer les pieds</button>
        </div>
        <p class="hint">Cliquez sur « Pied fait » pour un pied seul. Cliquez sur un onglon uniquement pour enregistrer un problème ou un soin.</p>
        <div class="feet">${feet.map(f => footHTML(animal, f[0], f[1])).join('')}</div>
        <label>Observation générale<input value="${esc(animal.notes)}" onchange="updateAnimal('${animal.id}','notes',this.value)"></label>
        <div class="animalActions"><button class="primary big" onclick="completeAnimal('${animal.id}')">✓ Bovin terminé → suivant</button></div>
      `}
    `;
    $('animals').appendChild(div);
  });
  renderTotals();
}

function footHTML(animal, code, label) {
  ensureWorkedFeet(animal);
  const worked = animal.workedFeet.includes(code);
  return `<div class="foot ${worked ? 'worked' : ''}">
    <h4>${label}</h4>
    <button class="footDone ${worked ? 'on' : ''}" onclick="toggleFoot('${animal.id}','${code}')">${worked ? '✓ Pied fait' : 'Marquer le pied fait'}</button>
    <div class="claws">${['Int', 'Ext'].map(side => {
      const key = code + '-' + side;
      const d = animal.claws[key] || {};
      const cls = (d.issues?.length || d.care?.length) ? 'problem' : '';
      return `<button class="claw ${cls}" onclick="editClaw('${animal.id}','${key}')"><b>${side === 'Int' ? 'Interne' : 'Externe'}</b><br><small>${[...(d.issues || []), ...(d.care || [])].slice(0, 2).join(', ') || 'Ajouter un problème'}</small></button>`;
    }).join('')}</div>
  </div>`;
}

function editClaw(animalId, key) {
  const animal = current.animals.find(x => x.id === animalId);
  const d = animal.claws[key] || { touched: true, issues: [], care: [], note: '' };
  const overlay = document.createElement('div');
  overlay.className = 'detailBox';
  overlay.style.position = 'fixed';
  overlay.style.inset = '10% 5%';
  overlay.style.zIndex = 20;
  overlay.style.overflow = 'auto';
  overlay.style.boxShadow = '0 0 0 9999px #0008';
  overlay.innerHTML = `
    <div class="toolbar"><h3>${key}</h3><button id="closeDetail">Fermer</button></div>
    <p class="hint">Le pied sera automatiquement marqué comme réalisé si vous enregistrez un problème ou un soin.</p>
    <h4>Problèmes</h4>
    <div class="chips">${issues.map(x => `<button class="chip ${(d.issues || []).includes(x) ? 'on' : ''}" data-type="issue" data-val="${x}">${x}</button>`).join('')}</div>
    <h4>Soins</h4>
    <div class="chips">${care.map(x => `<button class="chip ${(d.care || []).includes(x) ? 'on' : ''}" data-type="care" data-val="${x}">${x}</button>`).join('')}</div>
    <label>Commentaire<input id="clawNote" value="${esc(d.note || '')}"></label>
    <div class="actions"><button id="clearDetail">Effacer</button><button class="primary" id="saveDetail">Enregistrer</button></div>`;
  document.body.appendChild(overlay);
  overlay.querySelectorAll('.chip').forEach(b => b.onclick = () => b.classList.toggle('on'));
  overlay.querySelector('#closeDetail').onclick = () => overlay.remove();
  overlay.querySelector('#clearDetail').onclick = () => { delete animal.claws[key]; overlay.remove(); renderAnimals(); };
  overlay.querySelector('#saveDetail').onclick = () => {
    animal.claws[key] = {
      touched: true,
      issues: [...overlay.querySelectorAll('[data-type=issue].on')].map(x => x.dataset.val),
      care: [...overlay.querySelectorAll('[data-type=care].on')].map(x => x.dataset.val),
      note: overlay.querySelector('#clawNote').value
    };
    if (animal.claws[key].care.includes('À revoir')) animal.checkNext = true;
    const footCode = key.split('-')[0];
    ensureWorkedFeet(animal);
    if (!animal.workedFeet.includes(footCode)) animal.workedFeet.push(footCode);
    overlay.remove();
    renderAnimals();
  };
}

function updateAnimal(id, key, value) {
  const animal = current.animals.find(x => x.id === id);
  if (!animal) return;
  animal[key] = value;
  renderTotals();
}

function removeAnimal(id) {
  current.animals = current.animals.filter(x => x.id !== id);
  renderAnimals();
}

function hasAnimalContent(a) {
  return !!(String(a.number || '').trim() || Object.keys(a.claws || {}).length || (a.workedFeet || []).length);
}

function calc(job = current) {
  const animals = (job.animals || []).map(syncLegacyAnimal);
  const completedAnimals = animals.filter(a => hasAnimalContent(a) && a.done);
  const populatedAnimals = animals.filter(a => hasAnimalContent(a));
  const animalsForCount = completedAnimals.length ? completedAnimals : populatedAnimals;
  const n = animalsForCount.length;
  let pairs = 0, single = 0, band = 0, blocks = 0;

  for (const animal of populatedAnimals) {
    ensureWorkedFeet(animal);
    const worked = animal.workedFeet.length;
    pairs += Math.floor(worked / 2);
    single += worked % 2;
    for (const d of Object.values(animal.claws || {})) {
      if ((d.care || []).includes('Pansement')) band++;
      if ((d.care || []).includes('Talonnette')) blocks++;
    }
  }

  const pairRate = n <= 1 ? settings.pairOne : settings.pairMany;
  const footRate = n <= 1 ? settings.footOne : settings.footMany;
  const careTotal = pairs * pairRate + single * footRate + band * settings.bandagePrice + blocks * settings.blockPrice;
  const ht = (+job.fee || 0) + careTotal + (+job.adjustment || 0);
  const ttc = ht * (1 + settings.vat / 100);
  return { n, pairs, single, band, blocks, careTotal, ht, ttc, pairRate, footRate };
}

function renderTotals() {
  const c = calc();
  $('jobTotals').innerHTML = `
    <span>Animaux <b>${c.n}</b></span>
    <span>Paires <b>${c.pairs}</b></span>
    <span>Pieds seuls <b>${c.single}</b></span>
    <span>Pansements <b>${c.band}</b></span>
    <span>Talonnettes <b>${c.blocks}</b></span>
    <span>Total HT <b>${euro(c.ht)}</b></span>
    <span>TTC <b>${euro(c.ttc)}</b></span>`;
}

function saveJob() {
  syncJob();
  if (!current.cheptel) return toast('Saisissez le numéro de cheptel');
  const i = jobs.findIndex(x => x.id === current.id);
  if (i < 0) jobs.push(JSON.parse(JSON.stringify(current)));
  else jobs[i] = JSON.parse(JSON.stringify(current));
  saveAll();
  toast('Chantier enregistré');
  renderHome();
}

function finishJob() {
  syncJob();
  current.animals = current.animals.filter(a => hasAnimalContent(a));
  current.animals.forEach(a => { if (hasAnimalContent(a)) a.done = true; });
  if (!current.end) current.end = nowTime();
  current.status = 'finished';
  saveJob();
  fillJob();
  toast('Chantier terminé et prêt à transmettre');
}

function renderPaymentAlert() {
  const unpaid = jobs.filter(j => j.cheptel === current.cheptel && ['pending', 'late', 'partial'].includes(j.paymentStatus));
  $('paymentAlert').innerHTML = unpaid.length
    ? `<div class="alertRed"><b>Alerte paiement :</b> ${unpaid.length} facture(s) en attente pour cet élevage, total ${euro(unpaid.reduce((s, j) => s + calc(j).ttc, 0))}.</div>`
    : '';
}

function summaryAnimal(animal) {
  const arr = [];
  for (const [k, d] of Object.entries(animal.claws || {})) {
    if (d.issues?.length || d.care?.length) arr.push(`${k}: ${[...(d.issues || []), ...(d.care || [])].join(', ')}`);
  }
  return arr.join(' ; ') || 'aucun problème signalé';
}

function renderHome() {
  const month = today().slice(0, 7);
  const monthJobs = jobs.filter(j => j.date?.startsWith(month));
  const counts = monthJobs.reduce((s, j) => {
    const x = calc(j);
    Object.keys(x).forEach(k => typeof x[k] === 'number' && (s[k] = (s[k] || 0) + x[k]));
    return s;
  }, {});
  $('homeCards').innerHTML = card('Chantiers du mois', monthJobs.length)
    + card('Bovins', counts.n || 0)
    + card('Pieds travaillés', (counts.pairs || 0) * 2 + (counts.single || 0))
    + card('À transmettre', jobs.filter(j => j.status === 'finished' && !j.exportedAt).length);
}

function card(title, value) {
  return `<div class="card"><span>${title}</span><b>${value}</b></div>`;
}

function renderHistory() {
  const q = ($('historySearch').value || '').toLowerCase();
  const arr = jobs
    .filter(j => [j.cheptel, j.clientName, ...(j.animals || []).map(a => a.number)].join(' ').toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date));
  $('historyList').innerHTML = arr.map(j => {
    const c = calc(j);
    return `<div class="row"><div class="grow"><b>${fmtDate(j.date)} — ${esc(j.clientName || j.cheptel)}</b><br><small>${j.cheptel} · ${c.n} bovin(s) · ${c.pairs} paire(s) · ${c.band} pansement(s)</small></div><span class="status ${j.exportedAt ? 'sent' : 'pending'}">${j.exportedAt ? 'Transmis' : j.status === 'finished' ? 'À transmettre' : 'Brouillon'}</span><button onclick="openJob('${j.id}')">Ouvrir</button></div>`;
  }).join('') || '<p>Aucun chantier.</p>';
}

function openJob(id) {
  current = JSON.parse(JSON.stringify(jobs.find(x => x.id === id)));
  current.animals = (current.animals || []).map(syncLegacyAnimal);
  fillJob();
  showView('chantier');
}

function renderExports() {
  const arr = jobs.filter(j => j.status === 'finished' && !j.exportedAt);
  $('exportList').innerHTML = arr.map(j => `<div class="row"><input type="checkbox" class="expCheck" value="${j.id}"><div class="grow"><b>${fmtDate(j.date)} — ${esc(j.clientName || j.cheptel)}</b><br><small>${j.cheptel} · ${calc(j).n} bovins · ${euro(calc(j).ttc)} TTC</small></div></div>`).join('') || '<p>Aucun chantier à transmettre.</p>';
}

function selectAllExports() {
  document.querySelectorAll('.expCheck').forEach(x => x.checked = true);
}

function exportAccounting() {
  const ids = [...document.querySelectorAll('.expCheck:checked')].map(x => x.value);
  if (!ids.length) return toast('Sélectionnez au moins un chantier');
  const rows = jobs.filter(j => ids.includes(j.id));
  const headers = ['mois intervention', 'Date', 'Cheptel', 'Nom PRENOM', 'Adresse', 'CP + VILLE', 'Race', 'taureau fait  ?', 'DEPARTEMENT', 'FORFAIT + MISE EN PLACE', 'NBR Animaux totaux', 'NBR DE PAIRE', 'PIED à l\'unité', 'NBR DE PANSEMENT', 'NBR DE TALONNETTE', 'MONTANT SOIN TOTAUX', 'PRIX HT', 'PRIX TTC', 'Commentaires', 'Devis', 'FACTURE LE', 'Réglé le', 'TYPE'];
  let xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="saisie"><Table>${xmlRow(headers)}`;
  for (const j of rows) {
    const c = calc(j);
    const month = j.date.slice(0, 7) + '-01';
    const comments = [j.comment, ...(j.animals || []).filter(a => a.checkNext).map(a => `À revoir ${a.number}`)].filter(Boolean).join(' | ');
    xml += xmlRow([month, j.date, j.cheptel, j.clientName, j.address, j.cpVille, j.race, j.bull, j.department, j.fee, c.n, c.pairs, c.single, c.band, c.blocks, c.careTotal, c.ht, c.ttc, comments, j.date, '', '', '']);
  }
  xml += '</Table></Worksheet></Workbook>';
  download(new Blob([xml], { type: 'application/vnd.ms-excel' }), `Export_parage_${today()}.xls`);
  rows.forEach(j => j.exportedAt = new Date().toISOString());
  saveAll();
  renderExports();
  toast('Export comptable créé');
}

function xmlRow(arr) {
  return '<Row>' + arr.map(v => `<Cell><Data ss:Type="${typeof v === 'number' ? 'Number' : 'String'}">${xmlEsc(v ?? '')}</Data></Cell>`).join('') + '</Row>';
}

function printProforma() {
  syncJob();
  const c = calc();
  const details = current.animals.flatMap(animal => Object.entries(animal.claws || {})
    .filter(([_, d]) => d.touched || d.issues?.length || d.care?.length)
    .map(([k, d]) => `<tr><td>${esc(animal.number)}</td><td>${esc(animal.category)}</td><td>${k.split('-')[0]}</td><td>${k.split('-')[1]}</td><td>${esc((d.issues || []).join(', '))}</td><td>${esc((d.care || []).join(', '))}</td><td>${esc(d.note || '')}</td></tr>`))
    .join('');

  const logoUrl = new URL('assets/logo-gds.png', window.location.href).href;
  const w = open('', '_blank');
  w.document.write(`
    <html><head><title>Pro forma ${current.cheptel}</title>
    <style>
      body{font:14px Arial;margin:35px;color:#222}
      h1,h2,h3{color:#285c4d}
      table{width:100%;border-collapse:collapse;margin:15px 0}
      th,td{border:1px solid #aaa;padding:7px;vertical-align:top}
      th{background:#eef5f1}
      .right{text-align:right}
      .box{border:2px solid #285c4d;padding:12px;border-radius:10px}
      .top{display:flex;align-items:center;gap:18px;margin-bottom:16px}
      .top img{max-width:260px;max-height:85px;object-fit:contain}
      .muted{color:#555}
    </style></head><body>
    <div class="top"><img src="${logoUrl}" alt="Logo GDS"><div><h1>FACTURE PRO FORMA / COMPTE RENDU DE PARAGE</h1><p class="muted">Document édité sur place</p></div></div>
    <p><b>${esc(settings.businessName)}</b><br>${nl2br(settings.businessDetails)}</p>
    <div class="box"><b>Élevage :</b> ${esc(current.clientName)}<br><b>Cheptel :</b> ${esc(current.cheptel)}<br>${esc(current.address)} — ${esc(current.cpVille)}<br><b>Date :</b> ${fmtDate(current.date)} · ${current.start || ''}–${current.end || ''}</div>
    <h2>Prestations</h2>
    <table>
      <tr><th>Prestation</th><th>Quantité</th><th>Tarif HT</th><th>Total HT</th></tr>
      <tr><td>Déplacement et mise en place</td><td>1</td><td>${euro(current.fee)}</td><td>${euro(current.fee)}</td></tr>
      <tr><td>Paires de pieds</td><td>${c.pairs}</td><td>${euro(c.pairRate)}</td><td>${euro(c.pairs * c.pairRate)}</td></tr>
      <tr><td>Pieds à l'unité</td><td>${c.single}</td><td>${euro(c.footRate)}</td><td>${euro(c.single * c.footRate)}</td></tr>
      <tr><td>Pansements</td><td>${c.band}</td><td>${euro(settings.bandagePrice)}</td><td>${euro(c.band * settings.bandagePrice)}</td></tr>
      <tr><td>Talonnettes</td><td>${c.blocks}</td><td>${euro(settings.blockPrice)}</td><td>${euro(c.blocks * settings.blockPrice)}</td></tr>
      ${current.adjustment ? `<tr><td>Ajustement tarifaire</td><td>1</td><td>${euro(current.adjustment)}</td><td>${euro(current.adjustment)}</td></tr>` : ''}
      <tr><th colspan="3" class="right">Total HT</th><th>${euro(c.ht)}</th></tr>
      <tr><th colspan="3" class="right">TVA ${settings.vat}%</th><th>${euro(c.ttc - c.ht)}</th></tr>
      <tr><th colspan="3" class="right">Total TTC</th><th>${euro(c.ttc)}</th></tr>
    </table>
    <h2>Récapitulatif de l'intervention</h2>
    <p>${c.n} bovin(s), ${c.pairs} paire(s), ${c.single} pied(s) à l'unité, ${c.band} pansement(s), ${c.blocks} talonnette(s).</p>
    <table>
      <tr><th>N° bovin</th><th>Cat.</th><th>Pied</th><th>Onglon</th><th>Problème</th><th>Soin</th><th>Observation</th></tr>
      ${details || '<tr><td colspan="7">Aucun problème particulier enregistré.</td></tr>'}
    </table>
    <p><b>Commentaire :</b> ${esc(current.comment || '')}</p>
    ${PAYMENT_HTML}
    <p style="margin-top:14px"><i>Document pro forma établi sur place. La facture définitive sera émise par la comptabilité.</i></p>
    <script>window.onload=()=>window.print()<\/script>
    </body></html>`);
  w.document.close();
}

function renderStats() {
  const month = $('statsMonth').value || today().slice(0, 7);
  const arr = jobs.filter(j => j.date?.startsWith(month));
  const sum = { n: 0, pairs: 0, single: 0, band: 0, blocks: 0, ht: 0, ttc: 0 };
  arr.forEach(j => {
    const c = calc(j);
    Object.keys(sum).forEach(k => sum[k] += c[k] || 0);
  });
  const co = costs[month] || {};
  const costTotal = ['fuel', 'toll', 'material', 'meals', 'other'].reduce((s, k) => s + (+co[k] || 0), 0);
  $('statsCards').innerHTML = card('Interventions', arr.length)
    + card('Bovins', sum.n)
    + card('Pieds faits', sum.pairs * 2 + sum.single)
    + card('Pansements', sum.band)
    + card('Talonnettes', sum.blocks)
    + card('CA HT', euro(sum.ht))
    + card('Frais', euro(costTotal))
    + card('Résultat simplifié', euro(sum.ht - costTotal));
  [['costFuel', 'fuel'], ['costToll', 'toll'], ['costMaterial', 'material'], ['costMeals', 'meals'], ['costOther', 'other'], ['costComment', 'comment']].forEach(([id, key]) => $(id).value = co[key] || '');
  const deps = {}, rs = {};
  arr.forEach(j => {
    deps[j.department || 'Non renseigné'] = (deps[j.department || 'Non renseigné'] || 0) + 1;
    rs[j.race || 'Non renseignée'] = (rs[j.race || 'Non renseignée'] || 0) + calc(j).n;
  });
  $('statsTables').innerHTML = `<div class="panel"><h3>Interventions par département</h3>${objTable(deps, 'Département', 'Interventions')}</div><div class="panel"><h3>Bovins par race</h3>${objTable(rs, 'Race', 'Bovins')}</div>`;
}

function objTable(o, a, b) {
  return `<table><tr><th>${a}</th><th>${b}</th></tr>${Object.entries(o).sort((x, y) => y[1] - x[1]).map(x => `<tr><td>${esc(x[0])}</td><td>${x[1]}</td></tr>`).join('')}</table>`;
}

function saveCosts() {
  const m = $('statsMonth').value;
  costs[m] = {
    fuel: +$('costFuel').value || 0,
    toll: +$('costToll').value || 0,
    material: +$('costMaterial').value || 0,
    meals: +$('costMeals').value || 0,
    other: +$('costOther').value || 0,
    comment: $('costComment').value
  };
  localStorage.setItem('parage.costs', JSON.stringify(costs));
  renderStats();
  toast('Frais enregistrés');
}

function loadSettings() {
  Object.keys(settings).forEach(k => { const e = $(k); if (e) e.value = settings[k]; });
}

function saveSettings() {
  Object.keys(settings).forEach(k => {
    const e = $(k);
    if (e) settings[k] = e.type === 'number' ? +e.value : e.value;
  });
  localStorage.setItem('parage.settings', JSON.stringify(settings));
  toast('Paramètres enregistrés');
}

function backupData() {
  download(new Blob([JSON.stringify({ jobs, settings, costs }, null, 2)], { type: 'application/json' }), `Sauvegarde_parage_${today()}.json`);
}

function restoreData(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const x = JSON.parse(r.result);
      jobs = x.jobs || [];
      settings = Object.assign(settings, x.settings || {});
      costs = x.costs || {};
      saveAll();
      localStorage.setItem('parage.settings', JSON.stringify(settings));
      localStorage.setItem('parage.costs', JSON.stringify(costs));
      loadSettings();
      renderHome();
      toast('Sauvegarde restaurée');
    } catch {
      toast('Fichier invalide');
    }
  };
  r.readAsText(f);
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function fmtDate(d) {
  if (!d) return '';
  return d.split('-').reverse().join('/');
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function xmlEsc(s) { return esc(s); }
function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }

let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  $('installBtn').hidden = false;
});
$('installBtn').onclick = async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt = null;
    $('installBtn').hidden = true;
  }
};

init();
