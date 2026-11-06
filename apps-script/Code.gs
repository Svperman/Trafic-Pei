/**
 * Trafic Péi — serveur des SIGNALEMENTS PARTAGÉS
 * Google Apps Script + Google Sheet. Gratuit, sans clé.
 *
 * Installation (une seule fois) :
 *  1. Crée un Google Sheet vide nommé « Trafic Péi – Signalements ».
 *  2. Extensions → Apps Script. Remplace tout le contenu de Code.gs par ce fichier.
 *  3. Choisis la fonction « installer » puis ▶ Exécuter (accepte les autorisations).
 *  4. Déployer → Nouveau déploiement → Application Web
 *       - Exécuter en tant que : Moi
 *       - Qui a accès : Tout le monde
 *  5. Copie l'URL qui finit par /exec et colle-la dans index.html (CONFIG.REPORTS_URL).
 *
 * API (tout en GET, pour éviter les blocages du navigateur) :
 *   ?action=list                                   → signalements actifs
 *   ?action=add&type=accident&lat=..&lon=..&note=..&dev=..
 *   ?action=vote&id=..&v=up|down&dev=..
 */

var FEUILLE = 'Signalements';
var ENTETES = ['id', 'type', 'lat', 'lon', 'note', 'cree', 'expire', 'confirme', 'plusla', 'appareil'];

// Durée de vie de chaque type de signalement (minutes)
var DUREES = {
  bouchon: 60,
  accident: 120,
  danger: 120,
  travaux: 1440,
  fermee: 720,
  eboulement: 720,
  inondation: 360
};

// La Réunion (avec une petite marge)
var ZONE = { latMin: -21.45, latMax: -20.80, lonMin: 55.15, lonMax: 55.90 };

function installer() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(FEUILLE) || ss.insertSheet(FEUILLE);
  sh.getRange(1, 1, 1, ENTETES.length).setValues([ENTETES]).setFontWeight('bold');
  sh.setFrozenRows(1);
  console.log('Feuille « ' + FEUILLE + ' » prête. Déploie maintenant en Application Web.');
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var res;
  try {
    if (p.action === 'add') res = ajouter_(p);
    else if (p.action === 'vote') res = voter_(p);
    else res = lister_();
  } catch (err) {
    res = { ok: false, msg: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

function feuille_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(FEUILLE);
  if (!sh) { installer(); sh = ss.getSheetByName(FEUILLE); }
  return sh;
}

function lignes_(sh) {
  var n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, ENTETES.length).getValues();
}

function versObjet_(r) {
  return {
    id: String(r[0]), type: r[1], lat: Number(r[2]), lon: Number(r[3]), note: r[4],
    cree: new Date(r[5]).getTime(), expire: new Date(r[6]).getTime(),
    confirme: Number(r[7]) || 0, plusla: Number(r[8]) || 0
  };
}

function lister_() {
  var cache = CacheService.getScriptCache();
  var c = cache.get('liste');
  if (c) return JSON.parse(c);

  var sh = feuille_(), maintenant = Date.now();
  var actifs = lignes_(sh).map(versObjet_).filter(function (o) {
    return o.expire > maintenant && o.plusla < 3;
  });
  var res = { ok: true, reports: actifs, now: maintenant };
  cache.put('liste', JSON.stringify(res), 20);
  var lock = LockService.getScriptLock();
  if (lock.tryLock(0)) { try { nettoyer_(sh); } finally { lock.releaseLock(); } }
  return res;
}

function ajouter_(p) {
  var type = String(p.type || '');
  if (!DUREES[type]) return { ok: false, msg: 'Type inconnu' };
  var lat = Number(p.lat), lon = Number(p.lon);
  if (!(lat >= ZONE.latMin && lat <= ZONE.latMax && lon >= ZONE.lonMin && lon <= ZONE.lonMax)) {
    return { ok: false, msg: 'Position hors de La Réunion' };
  }
  var dev = String(p.dev || '').slice(0, 40);
  var cache = CacheService.getScriptCache();
  if (dev && cache.get('anti_' + dev)) return { ok: false, msg: 'Attends 30 secondes entre deux signalements' };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = feuille_(), maintenant = new Date();
    // Fusionne avec un signalement identique à moins de 200 m : on le confirme au lieu d'en créer un autre
    var rows = lignes_(sh);
    for (var i = 0; i < rows.length; i++) {
      var o = versObjet_(rows[i]);
      if (o.type === type && o.expire > maintenant.getTime() && distance_(lat, lon, o.lat, o.lon) < 200) {
        prolonger_(sh, i + 2, o, type);
        cache.remove('liste');
        if (dev) cache.put('anti_' + dev, '1', 30);
        return { ok: true, id: o.id, merged: true };
      }
    }
    var id = Utilities.getUuid().slice(0, 8);
    var expire = new Date(maintenant.getTime() + DUREES[type] * 60000);
    var note = String(p.note || '').replace(/[<>]/g, '').slice(0, 140);
    sh.appendRow([id, type, lat, lon, note, maintenant, expire, 0, 0, dev]);
    cache.remove('liste');
    if (dev) cache.put('anti_' + dev, '1', 30);
    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

function voter_(p) {
  var id = String(p.id || ''), v = p.v === 'down' ? 'down' : 'up';
  var dev = String(p.dev || '').slice(0, 40);
  var cache = CacheService.getScriptCache();
  if (dev && cache.get('vote_' + dev + '_' + id)) return { ok: false, msg: 'Déjà voté' };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = feuille_(), rows = lignes_(sh);
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) !== id) continue;
      var o = versObjet_(rows[i]);
      if (v === 'up') prolonger_(sh, i + 2, o, o.type);
      else sh.getRange(i + 2, 9).setValue(o.plusla + 1);
      cache.remove('liste');
      if (dev) cache.put('vote_' + dev + '_' + id, '1', 21600);
      return { ok: true };
    }
    return { ok: false, msg: 'Signalement introuvable' };
  } finally {
    lock.releaseLock();
  }
}

/** Confirmation : +1 et prolonge de la moitié de la durée normale */
function prolonger_(sh, ligne, o, type) {
  var expire = new Date(Math.max(o.expire, Date.now()) + DUREES[type] * 30000);
  sh.getRange(ligne, 7, 1, 2).setValues([[expire, o.confirme + 1]]);
}

/** Supprime les signalements expirés depuis plus d'un jour (garde la feuille légère) */
function nettoyer_(sh) {
  var rows = lignes_(sh), limite = Date.now() - 86400000;
  for (var i = rows.length - 1; i >= 0; i--) {
    if (new Date(rows[i][6]).getTime() < limite) sh.deleteRow(i + 2);
  }
}

function distance_(a, b, c, d) {
  var R = 6371000, k = Math.PI / 180, dLat = (c - a) * k, dLon = (d - b) * k;
  var x = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(a * k) * Math.cos(c * k) * Math.pow(Math.sin(dLon / 2), 2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Test manuel : ajoute un faux bouchon à Saint-Denis puis affiche la liste */
function tester() {
  console.log(JSON.stringify(ajouter_({ type: 'bouchon', lat: -20.882, lon: 55.45, note: 'Test', dev: 'test' })));
  CacheService.getScriptCache().remove('liste');
  console.log(JSON.stringify(lister_()));
}
