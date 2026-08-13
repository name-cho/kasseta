'use strict';
const express    = require('express');
const multer     = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const fs   = require('fs');
const crypto = require('crypto');

const PORT   = process.env.PORT || 3000;
const ROOT   = __dirname;
const UPLOADS  = path.join(ROOT, 'uploads');
const AVATARS  = path.join(ROOT, 'avatars');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE  = path.join(DATA_DIR, 'db.json');
const MAX_MB   = parseInt(process.env.MAX_MB || '5000', 10);

const DONATE_CARD = process.env.DONATE_CARD || '';
const DONATE_NAME = process.env.DONATE_NAME || '';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.mail.ru';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || ('KASSETA.TUBE <' + SMTP_USER + '>');
let transporter = null;
if (SMTP_USER && SMTP_PASS){
  transporter = nodemailer.createTransport({
    host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

for (const d of [UPLOADS, AVATARS, DATA_DIR]) fs.mkdirSync(d, { recursive: true });

let db = { users: [], sessions: {}, videos: [], seq: 0, pending: {} };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); } catch {}
if (!db.pending) db.pending = {};
db.videos.forEach(v => {
  if (!('uid' in v)) v.uid = null;
  if (!Array.isArray(v.likedBy)) v.likedBy = [];
});
db.users.forEach(u => {
  if (!Array.isArray(u.following)) u.following = [];
  if (!('avatar' in u)) u.avatar = null;
  if (!('supporter' in u)) u.supporter = false;
  if (!('founder' in u)) u.founder = false;
  if (!('bio' in u)) u.bio = '';
});
if (db.users.length > 0 && !db.users.some(u => u.founder)){
  const first = [...db.users].sort((a, b) => (a.at || 0) - (b.at || 0))[0];
  if (first) first.founder = true;
}

let saveT = null;
function save(){
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { fs.writeFileSync(DB_FILE, JSON.stringify(db)); }
    catch (e) { console.error('save error:', e.message); }
  }, 150);
}
process.on('exit', () => { try { fs.writeFileSync(DB_FILE, JSON.stringify(db)); } catch {} });

const PAGE_FILES = ['rules.md', 'about.md'];
const DEFAULT_PAGES = {
  'rules.md': `# Правила инстанса

Коротко: ведите себя как в гостях.

## Общие

- Уважайте других пользователей и админов.
- Запрещены спам, флуд и реклама без согласия админов.
- Запрещён контент, нарушающий закон страны, где стоит инстанс.
- Подписывайте кассеты понятно: название и описание помогают поиску.

## Аккаунты

- Один человек — один аккаунт, если админы не разрешили иное.
- Ник не должен выдавать вас за админа или другого пользователя.

## Наказания

- Предупреждение, бан, удаление кассет — на усмотрение админов.
- Спорные ситуации обсуждайте с админами лично, контакты — на странице «Об инстансе».

---
*Этот шаблон редактируется в админке (раздел «Страницы») или в файле data/rules.md.*`,
  'about.md': `# Об инстансе

Это независимый инстанс КАССЕТА.TUBE — ретро-видеохостинга с открытым кодом.

## Команда

- Овнер: @zoyuki
- Админы: пока только овнер

## Саппортерам

Хотите получить сердечко рядом с ником? Переведите сколько не жалко на странице «Поддержать проект», затем напишите овнеру и приложите **скриншот перевода и ваш ник** — вам выдадут бейдж.

## Технич

- Код проекта: https://github.com/zoyuki/kasseta
- Поднять свой инстанс может любой, инструкция в README.

---
*Редактируется в админке (раздел «Страницы») или в файле data/about.md.*`,
};
for (const [name, text] of Object.entries(DEFAULT_PAGES)){
  const f = path.join(DATA_DIR, name);
  if (!fs.existsSync(f)) fs.writeFileSync(f, text);
}

const app = express();
app.disable('x-powered-by');
app.use(express.json());

function readCookie(req, name){
  const c = req.headers.cookie; if (!c) return null;
  for (const part of c.split(';')){
    const i = part.indexOf('=');
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

const hashPass = (pass, salt) => crypto.scryptSync(pass, salt, 32).toString('hex');

function currentUser(req){
  const token = readCookie(req, 'kasseta');
  if (!token) return null;
  const s = db.sessions[token];
  if (!s || s.exp < Date.now()){ if (s){ delete db.sessions[token]; save(); } return null; }
  const u = db.users.find(x => x.id === s.uid);
  return (u && !u.banned) ? u : null;
}
function requireUser(req, res, next){
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: 'Нужно войти' });
  req.user = u; next();
}
function setSession(res, uid){
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[token] = { uid, exp: Date.now() + 30 * 24 * 3600 * 1000 };
  save();
  res.setHeader('Set-Cookie', `kasseta=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30*24*3600}`);
}
function clearSession(req, res){
  const token = readCookie(req, 'kasseta');
  if (token){ delete db.sessions[token]; save(); }
  res.setHeader('Set-Cookie', 'kasseta=; Path=/; Max-Age=0');
}
function killSessions(uid, exceptToken){
  for (const [t, s] of Object.entries(db.sessions))
    if (s.uid === uid && t !== exceptToken) delete db.sessions[t];
}

const byId = id => db.videos.find(v => v.id === id);
const pub  = v => {
  const u = v.uid ? db.users.find(x => x.id === v.uid) : null;
  return {
    ...v, url: '/uploads/' + v.file,
    uavatar: u ? u.avatar : null,
    ufounded: u ? !!u.founder : false,
    usupporter: u ? !!u.supporter : false,
    uadmin: u ? (u.role === 'admin' && !u.founder) : false,
  };
};
const shortUser = u => ({
  id: u.id, name: u.name, avatar: u.avatar,
  founder: !!u.founder,
  supporter: !!u.supporter,
  admin: u.role === 'admin' && !u.founder,
});

async function sendCode(email, code){
  if (!transporter) return false;
  await transporter.sendMail({
    from: SMTP_FROM, to: email,
    subject: 'Код подтверждения — КАССЕТА.TUBE',
    text: `Ваш код подтверждения: ${code}\n\nЕсли вы не регистрировались на КАССЕТА.TUBE, просто удалите это письмо.`,
  });
  return true;
}

app.use('/uploads', express.static(UPLOADS, { maxAge: '7d', immutable: true }));
app.use('/avatars', express.static(AVATARS));
app.use(express.static(path.join(ROOT, 'public')));

app.get('/api/donate', (req, res) => {
  res.json({ card: DONATE_CARD, name: DONATE_NAME });
});

app.get('/api/page/:name', (req, res) => {
  if (!PAGE_FILES.includes(req.params.name)) return res.status(404).json({ error: 'Нет такой страницы' });
  res.json({ text: fs.readFileSync(path.join(DATA_DIR, req.params.name), 'utf8') });
});

app.post('/api/auth/register', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const pass  = String(req.body.pass  || '');
  const name  = String(req.body.name  || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'Похоже, это не e-mail' });
  if (pass.length < 6) return res.status(400).json({ error: 'Пароль короче 6 символов' });
  if (!/^[a-z0-9_-]{3,20}$/i.test(name)) return res.status(400).json({ error: 'Ник: 3-20 символов, латиница, цифры, _ или -' });
  if (db.users.some(u => u.email === email)) return res.status(400).json({ error: 'Этот e-mail уже зарегистрирован' });
  if (db.users.some(u => u.name.toLowerCase() === name.toLowerCase())) return res.status(400).json({ error: 'Ник уже занят, придумайте другой' });

  const salt = crypto.randomBytes(8).toString('hex');
  const code = String(Math.floor(100000 + Math.random() * 900000));
  db.pending[email] = {
    name, salt, pass: hashPass(pass, salt), code,
    exp: Date.now() + 10 * 60 * 1000, tries: 0, lastSend: Date.now(),
  };
  save();

  let sent = false;
  try { sent = await sendCode(email, code); }
  catch (e){ console.error('SMTP: ' + e.message); }

  if (!sent){
    console.log('[!] SMTP not configured. Code for ' + email + ': ' + code);
    return res.json({ pending: true, email, noSmtp: true, devCode: code });
  }
  console.log('[*] code sent to ' + email);
  res.json({ pending: true, email });
});

app.post('/api/auth/resend', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const p = db.pending[email];
  if (!p || p.exp < Date.now()){ delete db.pending[email]; save();
    return res.status(400).json({ error: 'Заявка просрочена, начните регистрацию заново' }); }
  if (Date.now() - p.lastSend < 60 * 1000)
    return res.status(429).json({ error: 'Подождите минуту перед повторной отправкой' });
  p.code = String(Math.floor(100000 + Math.random() * 900000));
  p.lastSend = Date.now(); p.exp = Date.now() + 10 * 60 * 1000;
  save();
  try { await sendCode(email, p.code); }
  catch (e){ return res.status(500).json({ error: 'Почта не отправилась: ' + e.message }); }
  res.json({ ok: true });
});

app.post('/api/auth/verify', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code  = String(req.body.code  || '').trim();
  const p = db.pending[email];
  if (!p || p.exp < Date.now()){ delete db.pending[email]; save();
    return res.status(400).json({ error: 'Код просрочен, начните заново' }); }
  if (p.tries >= 5){ delete db.pending[email]; save();
    return res.status(403).json({ error: 'Слишком много попыток, начните заново' }); }
  if (p.code !== code){ p.tries++; save(); return res.status(403).json({ error: 'Неверный код' }); }
  if (db.users.some(u => u.email === email)){ delete db.pending[email]; save();
    return res.status(400).json({ error: 'Этот e-mail уже зарегистрирован' }); }
  if (db.users.some(u => u.name.toLowerCase() === p.name.toLowerCase())){ delete db.pending[email]; save();
    return res.status(400).json({ error: 'Ник уже занят, придумайте другой' }); }

  const isFounder = db.users.length === 0;
  const u = {
    id: crypto.randomBytes(6).toString('hex'),
    email, name: p.name, pass: p.pass, salt: p.salt,
    role: isFounder ? 'admin' : 'user',
    founder: isFounder,
    supporter: false,
    bio: '',
    banned: false, following: [], avatar: null, at: Date.now(),
  };
  db.users.push(u);
  delete db.pending[email];
  save();
  setSession(res, u.id);
  console.log('[*] @' + u.name + ' verified' + (isFounder ? ' (FOUNDER)' : ''));
  res.json({ id: u.id, name: u.name, role: u.role, founder: u.founder, supporter: u.supporter, bio: '' });
});

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const u = db.users.find(x => x.email === email);
  if (!u || hashPass(String(req.body.pass || ''), u.salt) !== u.pass)
    return res.status(403).json({ error: 'Неверный e-mail или пароль' });
  if (u.banned) return res.status(403).json({ error: 'Аккаунт заблокирован администратором' });
  setSession(res, u.id);
  res.json({
    id: u.id, name: u.name, role: u.role, avatar: u.avatar,
    founder: !!u.founder, supporter: !!u.supporter, bio: u.bio || '',
  });
});

app.post('/api/auth/logout', (req, res) => { clearSession(req, res); res.json({ ok: true }); });

app.get('/api/me', (req, res) => {
  const u = currentUser(req);
  res.json(u ? {
    id: u.id, name: u.name, role: u.role, email: u.email, avatar: u.avatar, at: u.at,
    founder: !!u.founder, supporter: !!u.supporter, bio: u.bio || '',
  } : null);
});

app.post('/api/settings/name', requireUser, (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!/^[a-z0-9_-]{3,20}$/i.test(name)) return res.status(400).json({ error: 'Ник: 3-20 символов, латиница, цифры, _ или -' });
  if (name.toLowerCase() !== req.user.name.toLowerCase() &&
      db.users.some(u => u.name.toLowerCase() === name.toLowerCase()))
    return res.status(400).json({ error: 'Ник уже занят' });
  req.user.name = name;
  db.videos.forEach(v => { if (v.uid === req.user.id){ v.author = name; v.uname = name; } });
  save(); res.json({ name });
});

app.post('/api/settings/pass', requireUser, (req, res) => {
  const me = req.user;
  if (hashPass(String(req.body.old || ''), me.salt) !== me.pass)
    return res.status(403).json({ error: 'Текущий пароль неверен' });
  const nw = String(req.body.pass || '');
  if (nw.length < 6) return res.status(400).json({ error: 'Новый пароль короче 6 символов' });
  me.salt = crypto.randomBytes(8).toString('hex');
  me.pass = hashPass(nw, me.salt);
  killSessions(me.id, readCookie(req, 'kasseta'));
  save(); res.json({ ok: true });
});

app.post('/api/settings/bio', requireUser, (req, res) => {
  req.user.bio = String(req.body.bio || '').trim().slice(0, 1000);
  save(); res.json({ ok: true });
});

const AVA_TYPES = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };
const avaUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, AVATARS),
    filename: (req, file, cb) => {
      const ext = AVA_TYPES[file.mimetype];
      if (!ext) return cb(new Error('Аватар: только png, jpg, webp или gif'));
      cb(null, req.user.id + ext);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.post('/api/settings/avatar', requireUser, avaUpload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
  const old = req.user.avatar;
  req.user.avatar = '/avatars/' + req.file.filename;
  save();
  if (old && old !== req.user.avatar)
    fs.unlink(path.join(ROOT, old.replace(/^\//, '')), () => {});
  res.json({ avatar: req.user.avatar });
});

app.post('/api/settings/avatar/del', requireUser, (req, res) => {
  const old = req.user.avatar;
  req.user.avatar = null;
  save();
  if (old) fs.unlink(path.join(ROOT, old.replace(/^\//, '')), () => {});
  res.json({ avatar: null });
});

app.get('/api/stats', (req, res) => {
  res.json({
    videos: db.videos.length,
    views:  db.videos.reduce((s, v) => s + (v.views || 0), 0),
    likes:  db.videos.reduce((s, v) => s + (v.likes || 0), 0),
    users:  db.users.length,
  });
});

app.get('/api/videos', (req, res) => {
  const u = currentUser(req);
  if (req.query.mine){
    if (!u) return res.status(401).json({ error: 'Нужно войти' });
    return res.json(db.videos.filter(v => v.uid === u.id).sort((a, b) => b.at - a.at).map(pub));
  }
  let list = db.videos.slice();
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q) list = list.filter(v => (v.title + ' ' + v.author + ' ' + (v.desc || '')).toLowerCase().includes(q));
  const sort = req.query.sort;
  list.sort(sort === 'views' ? (a, b) => b.views - a.views
          : sort === 'likes' ? (a, b) => b.likes - a.likes
          : (a, b) => b.at - a.at);
  res.json(list.map(v => {
    const o = pub(v);
    if (u) o.liked = v.likedBy.includes(u.id);
    return o;
  }));
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename: (req, file, cb) => {
    const id = Date.now().toString(36) + crypto.randomBytes(2).toString('hex');
    let ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    if (!ext) ext = '.mp4';
    req.videoId = id; req.videoFile = id + ext;
    cb(null, id + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith('video/') || /\.(mp4|webm|mkv|avi|mov|m4v)$/i.test(file.originalname)
      ? cb(null, true)
      : cb(new Error('Можно загружать только видеофайлы')),
});

app.post('/api/videos', requireUser, upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
  const v = {
    id: req.videoId, label: ++db.seq,
    uid: req.user.id, uname: req.user.name,
    title: String(req.body.title || '').trim().slice(0, 120) || 'БЕЗ НАЗВАНИЯ',
    author: req.user.name,
    desc:  String(req.body.desc  || '').trim().slice(0, 2000),
    file: req.videoFile, size: req.file.size,
    duration: Math.max(0, Math.round(+req.body.duration || 0)),
    views: 0, likes: 0, likedBy: [], at: Date.now(),
  };
  db.videos.push(v); save();
  console.log('[+] VHS-' + String(v.label).padStart(4, '0') + ' by @' + v.uname);
  res.json(pub(v));
});

app.get('/api/videos/:id', (req, res) => {
  const v = byId(req.params.id);
  if (!v) return res.status(404).json({ error: 'Кассета не найдена' });
  const u = currentUser(req);
  const o = pub(v);
  if (u) o.liked = v.likedBy.includes(u.id);
  o.mine = !!u && (u.id === v.uid || u.role === 'admin');
  res.json(o);
});

app.post('/api/videos/:id/view', (req, res) => {
  const v = byId(req.params.id);
  if (!v) return res.status(404).json({ error: 'Не найдена' });
  v.views++; save(); res.json({ views: v.views });
});

app.post('/api/videos/:id/like', requireUser, (req, res) => {
  const v = byId(req.params.id);
  if (!v) return res.status(404).json({ error: 'Не найдена' });
  const i = v.likedBy.indexOf(req.user.id);
  if (req.query.undo){ if (i >= 0){ v.likedBy.splice(i, 1); v.likes = Math.max(0, (v.likes || 0) - 1); } }
  else if (i < 0){ v.likedBy.push(req.user.id); v.likes = (v.likes || 0) + 1; }
  save();
  res.json({ likes: v.likes, liked: v.likedBy.includes(req.user.id) });
});

app.patch('/api/videos/:id', requireUser, (req, res) => {
  const v = byId(req.params.id);
  if (!v) return res.status(404).json({ error: 'Не найдена' });
  if (v.uid !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Чужая кассета' });
  if (req.body.title != null) v.title = String(req.body.title).trim().slice(0, 120) || v.title;
  if (req.body.desc  != null) v.desc  = String(req.body.desc).trim().slice(0, 2000);
  save(); res.json(pub(v));
});

app.delete('/api/videos/:id', requireUser, (req, res) => {
  const i = db.videos.findIndex(v => v.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Не найдена' });
  const v = db.videos[i];
  if (v.uid !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Чужая кассета' });
  db.videos.splice(i, 1);
  fs.unlink(path.join(UPLOADS, v.file), () => {});
  save(); res.json({ ok: true });
});

app.get('/api/user/:name', (req, res) => {
  const u = db.users.find(x => x.name.toLowerCase() === String(req.params.name).toLowerCase());
  if (!u) return res.status(404).json({ error: 'Пользователь не найден' });
  const me = currentUser(req);
  res.json({
    id: u.id, name: u.name, avatar: u.avatar, at: u.at,
    bio: u.bio || '',
    founder: !!u.founder, supporter: !!u.supporter,
    admin: u.role === 'admin' && !u.founder,
    videos: db.videos.filter(v => v.uid === u.id).sort((a, b) => b.at - a.at).map(pub),
    following: u.following.map(id => db.users.find(x => x.id === id)).filter(Boolean).map(shortUser),
    followers: db.users.filter(x => x.following.includes(u.id)).map(shortUser),
    subbed: me ? me.following.includes(u.id) : false,
  });
});

app.post('/api/user/:id/sub', requireUser, (req, res) => {
  const t = db.users.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Не найден' });
  if (t.id === req.user.id) return res.status(400).json({ error: 'На себя подписаться нельзя' });
  const i = req.user.following.indexOf(t.id);
  if (i >= 0) req.user.following.splice(i, 1); else req.user.following.push(t.id);
  save();
  res.json({ subbed: i < 0, followers: db.users.filter(x => x.following.includes(t.id)).length });
});

function adminOnly(req, res, next){
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Только для администратора' });
  next();
}

app.get('/api/admin/stats', requireUser, adminOnly, (req, res) => {
  res.json({
    users: db.users.length,
    banned: db.users.filter(u => u.banned).length,
    supporters: db.users.filter(u => u.supporter).length,
    videos: db.videos.length,
    views: db.videos.reduce((s, v) => s + (v.views || 0), 0),
    likes: db.videos.reduce((s, v) => s + (v.likes || 0), 0),
    bytes: db.videos.reduce((s, v) => s + (v.size || 0), 0),
  });
});

app.get('/api/admin/users', requireUser, adminOnly, (req, res) => {
  res.json(db.users.map(u => ({
    id: u.id, name: u.name, email: u.email,
    role: u.role, banned: u.banned, at: u.at, avatar: u.avatar,
    founder: !!u.founder, supporter: !!u.supporter,
    videos: db.videos.filter(v => v.uid === u.id).length,
    sessions: Object.values(db.sessions).filter(s => s.uid === u.id).length,
  })));
});

app.post('/api/admin/users/:id/ban', requireUser, adminOnly, (req, res) => {
  const u = db.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'Не найден' });
  if (u.id === req.user.id) return res.status(400).json({ error: 'Себя блокировать нельзя' });
  if (u.founder) return res.status(400).json({ error: 'Основателя заблокировать нельзя' });
  u.banned = !u.banned;
  if (u.banned) killSessions(u.id);
  save(); res.json({ banned: u.banned });
});

app.post('/api/admin/users/:id/kick', requireUser, adminOnly, (req, res) => {
  const u = db.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'Не найден' });
  let n = 0;
  for (const [t, s] of Object.entries(db.sessions)) if (s.uid === u.id){ delete db.sessions[t]; n++; }
  save(); res.json({ kicked: n });
});

app.post('/api/admin/users/:id/passreset', requireUser, adminOnly, (req, res) => {
  const u = db.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'Не найден' });
  const nw = String(req.body.pass || '');
  if (nw.length < 6) return res.status(400).json({ error: 'Минимум 6 символов' });
  u.salt = crypto.randomBytes(8).toString('hex');
  u.pass = hashPass(nw, u.salt);
  u.banned = false;
  killSessions(u.id);
  save(); res.json({ ok: true });
});

app.post('/api/admin/users/:id/role', requireUser, adminOnly, (req, res) => {
  const u = db.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'Не найден' });
  if (u.founder) return res.status(400).json({ error: 'Роль основателя изменить нельзя' });
  if (u.id === req.user.id) return res.status(400).json({ error: 'Свою роль менять нельзя' });
  const role = req.body.role === 'admin' ? 'admin' : 'user';
  u.role = role;
  save(); res.json({ role });
});

app.post('/api/admin/users/:id/supporter', requireUser, adminOnly, (req, res) => {
  const u = db.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'Не найден' });
  u.supporter = !u.supporter;
  save(); res.json({ supporter: u.supporter });
});

app.post('/api/admin/page/:name', requireUser, adminOnly, (req, res) => {
  if (!PAGE_FILES.includes(req.params.name)) return res.status(404).json({ error: 'Нет такой страницы' });
  fs.writeFileSync(path.join(DATA_DIR, req.params.name), String(req.body.text || ''));
  save(); res.json({ ok: true });
});

app.delete('/api/admin/users/:id', requireUser, adminOnly, (req, res) => {
  const u = db.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'Не найден' });
  if (u.id === req.user.id) return res.status(400).json({ error: 'Себя удалять нельзя' });
  if (u.founder) return res.status(400).json({ error: 'Основателя удалить нельзя' });
  db.users = db.users.filter(x => x.id !== u.id);
  killSessions(u.id);
  const gone = db.videos.filter(v => v.uid === u.id);
  db.videos = db.videos.filter(v => v.uid !== u.id);
  gone.forEach(v => fs.unlink(path.join(UPLOADS, v.file), () => {}));
  if (u.avatar) fs.unlink(path.join(ROOT, u.avatar.replace(/^\//, '')), () => {});
  db.users.forEach(x => { x.following = x.following.filter(id => id !== u.id); });
  db.videos.forEach(v => { v.likedBy = v.likedBy.filter(x => x !== u.id); });
  save(); res.json({ ok: true });
});

app.post('/api/admin/videos/:id/claim', requireUser, adminOnly, (req, res) => {
  const v = byId(req.params.id);
  if (!v) return res.status(404).json({ error: 'Не найдена' });
  v.uid = req.user.id; v.uname = req.user.name; v.author = req.user.name;
  save(); res.json(pub(v));
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Нет такого API' }));
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE')
    return res.status(413).json({ error: 'Файл больше лимита' });
  console.error(err.message);
  res.status(400).json({ error: err.message || 'Ошибка' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  KASSETA.TUBE v7 — port ' + PORT);
  console.log('  file limit: ' + MAX_MB + ' MB');
  console.log('  smtp: ' + (transporter ? 'ok (' + SMTP_USER + ')' : 'not configured — codes in console'));
  console.log('');
});
server.requestTimeout = 0;
server.headersTimeout = 120000;
server.keepAliveTimeout = 120000;
server.setTimeout(0);