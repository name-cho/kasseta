'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtN = n => String(n ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const fmtDur = s => { s = Math.max(0, Math.round(+s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const fmtDate = t => new Date(t).toLocaleDateString('ru-RU');
const fmtSize = b => !b ? '—' : b >= 1073741824 ? (b / 1073741824).toFixed(1) + ' ГБ' : (b / 1048576).toFixed(0) + ' МБ';
const hue = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; };

let ME = null;

const badges = (u) => {
  if (!u) return '';
  const out = [];
  const name = esc(u.name);
  if (u.founder)     out.push(`<span class="badge b-founder" title="${name} — основатель этого инстанса">🥖</span>`);
  if (u.admin)       out.push(`<span class="badge b-admin" title="${name} — администратор этого инстанса!">🛠️</span>`);
  if (u.supporter)   out.push(`<span class="badge b-supporter" title="${name} поддержал(а) этот инстанс!">💜</span>`);
  return out.join('');
};

const md = (text) => {
  const inline = s => esc(s)
    .replace(/`([^`]*?)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+?)\*\*/g, '<b>$1</b>')
    .replace(/__([^_]+?)__/g, '<b>$1</b>')
    .replace(/!\[([^\]]*)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/~~([^~]+?)~~/g, '<del>$1</del>')
    .replace(/\*([^*]+?)\*/g, '<i>$1</i>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');

  const lines = String(text || '').split('\n');
  let html = '', list = null, table = null, codeStart = null;
  const flushTable = () => {
    if (!table) return;
    html += '<table>';
    if (table.length){
      html += '<thead><tr>' + table[0].map(c => '<th>' + c + '</th>').join('') + '</tr></thead>';
      html += '<tbody>' + table.slice(1).map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody>';
    }
    html += '</table>'; table = null;
  };
  const closeAll = () => {
    flushTable();
    if (list){ html += list === 'ul' ? '</ul>' : '</ol>'; list = null; }
  };
  for (const raw of lines){
    const line = raw.replace(/\s+$/, '');
    if (/^```/.test(line)){
      if (codeStart == null){ closeAll(); codeStart = html.length; html += '<pre><code>'; }
      else { html += '</code></pre>'; codeStart = null; }
      continue;
    }
    if (codeStart != null){ html += esc(line) + '\n'; continue; }
    const trimmed = line.trim();
    if (!trimmed){ closeAll(); continue; }
    if (/^\|.*\|\s*$/.test(trimmed)){
      if (/^\|?[\s:|-]+\|?\s*$/.test(trimmed)) continue;
      if (!table) closeAll(), table = [];
      table.push(trimmed.replace(/^\||\|$/g, '').split('|').map(c => inline(c.trim())));
      continue;
    }
    if (/^[-*+]\s+/.test(trimmed)){
      if (list !== 'ul'){ closeAll(); html += '<ul>'; list = 'ul'; }
      html += '<li>' + inline(trimmed.replace(/^[-*+]\s+/, '')) + '</li>';
      continue;
    }
    if (/^\d+[.)]\s+/.test(trimmed)){
      if (list !== 'ol'){ closeAll(); html += '<ol>'; list = 'ol'; }
      html += '<li>' + inline(trimmed.replace(/^\d+[.)]\s+/, '')) + '</li>';
      continue;
    }
    closeAll();
    if (/^#{1,6}\s+/.test(line)){
      const lvl = line.match(/^#{1,6}/)[0].length;
      html += '<h' + lvl + '>' + inline(line.slice(lvl + 1).replace(/\s+#+\s*$/, '')) + '</h' + lvl + '>';
    }
    else if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) html += '<hr>';
    else if (/^>\s?/.test(trimmed)) html += '<blockquote><p>' + inline(trimmed.replace(/^>\s?/, '')) + '</p></blockquote>';
    else html += '<p>' + inline(line) + '</p>';
  }
  closeAll();
  if (codeStart != null) html += '</code></pre>';
  return html;
};

const avaTag = (name, avatar, cls = 'ava') =>
  avatar ? `<img class="${cls}" src="${avatar}" alt="">`
         : `<span class="${cls}">${esc((name[0] || '?').toUpperCase())}</span>`;

const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  const v = e.target; v.src = v.dataset.src; v.removeAttribute('data-src'); io.unobserve(v);
}), { rootMargin: '400px' });
const hydrate = root => root.querySelectorAll('video[data-src]').forEach(v => io.observe(v));

function loadStart(){ $('#loadbar').style.width = '72%'; }
function loadDone(){ const b = $('#loadbar'); b.style.width = '100%';
  setTimeout(() => { b.style.transition = 'none'; b.style.width = '0'; void b.offsetWidth; b.style.transition = ''; }, 280); }

function toast(msg, icon = '[i]'){
  const t = document.createElement('div');
  t.className = 'toast win';
  t.innerHTML = `<div class="titlebar"><b>СООБЩЕНИЕ</b><button class="tbb x">✕</button></div>
    <div class="tbody"><span class="tico">${icon}</span><p>${esc(msg)}</p></div>
    <div class="tfoot"><button class="btn95 ok">OK</button></div>`;
  $('#toasts').append(t);
  const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 220); };
  t.querySelector('.ok').onclick = kill;
  t.querySelector('.tbb').onclick = kill;
  setTimeout(kill, 4500);
}
document.addEventListener('click', e => {
  const b = e.target.closest('.tbb');
  if (!b || e.target.closest('.toast') || e.target.closest('.modal')) return;
  const jokes = ['Окна в 1998-м не закрывались просто так.',
                 'Кнопка декоративная. Как и Wi-Fi в 98-м.',
                 'Ошибка Win98: действие недоступно из ностальгии.'];
  toast(jokes[Math.floor(Math.random() * jokes.length)], '[!]');
});

function odo(el, n){ el.innerHTML = [...String(Math.max(0, n)).padStart(5, '0')].map(d => `<i>${d}</i>`).join(''); }
let MAX_MB = 5000;
async function pullStats(){
  try {
    const s = await fetch('/api/stats').then(r => r.json());
    odo($('#odVids'), s.videos); odo($('#odViews'), s.views);
    odo($('#odLikes'), s.likes); odo($('#odUsers'), s.users);
    MAX_MB = s.maxMb || MAX_MB;
    const line = `*** АРХИВ: ${fmtN(s.videos)} КАССЕТ *** ПРОСМОТРОВ: ${fmtN(s.views)} *** ЛАЙКОВ: ${fmtN(s.likes)} *** ПОЛЬЗОВАТЕЛЕЙ: ${fmtN(s.users)} *** ЗАГРУЗИ СВОЮ КАССЕТУ — ЭФИР СВОБОДЕН *** ЛИМИТ ${fmtSize(MAX_MB * 1024 * 1024)} *** `;
    $('#ticker').innerHTML = `<span>${line}</span><span>${line}</span>`;
  } catch {}
}

(function(){ const f = () => { const d = new Date();
  $('#clock').textContent = [d.getHours(), d.getMinutes(), d.getSeconds()].map(x => String(x).padStart(2, '0')).join(':'); };
  f(); setInterval(f, 1000); })();

function renderAuth(){
  const box = $('#authbox');
  if (ME){
    box.innerHTML = `<span class="uchip">${ME.avatar ? `<img src="${ME.avatar}" alt="">` : ''}${badges(ME)}@${esc(ME.name)}</span>
      <a class="btn95 accent" href="#/upload">+ ЗАГРУЗИТЬ</a>
      <a class="btn95" href="#/studio">КАБИНЕТ</a>
      <a class="btn95" href="#/settings">НАСТРОЙКИ</a>
      ${ME.role === 'admin' ? '<a class="btn95" href="#/admin">АДМИНКА</a>' : ''}
      <button class="btn95" id="logout">ВЫХОД</button>`;
    $('#logout').onclick = async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      ME = null; renderAuth();
      toast('Вы вышли из системы', '[*]');
      if (location.hash !== '#/' && location.hash !== '') location.hash = '#/'; else route();
    };
  } else {
    box.innerHTML = `<span class="uchip guest">ГОСТЬ</span><a class="btn95 accent" href="#/login">ВОЙТИ</a>`;
  }
}

const tbBtns = () => `<span class="tb-btns"><button class="tbb">—</button><button class="tbb">□</button><button class="tbb x">✕</button></span>`;

const card = (v, i) => `
<a class="tape" href="#/watch/${v.id}" style="--acc:hsl(${hue(v.id)} 70% 50%)">
  <div class="spine"><span class="lbl">VHS-${String(v.label ?? i + 1).padStart(4, '0')}</span><span class="sp">&gt; ${fmtN(v.views)}</span></div>
  <div class="thumb"><video muted playsinline preload="metadata" data-src="${v.url}#t=2.2"></video><span class="dur">${fmtDur(v.duration)}</span></div>
  <div class="tinfo"><h3>${esc(v.title)}</h3>
    <p class="by">${v.uavatar ? `<img class="bava" src="${v.uavatar}" alt="">` : ''}${badges({ founder: v.ufounded, admin: v.uadmin, supporter: v.usupporter, name: v.author })}@${esc(v.author)}</p>
    <p class="meta">просм. ${fmtN(v.views)} · лайков ${fmtN(v.likes)} · ${fmtDate(v.at)}</p></div>
</a>`;

const emptyState = (txt, btn) => `<div class="empty"><p>${txt}</p>${btn || ''}</div>`;

const userItem = u => `
<a class="rel" href="#/user/${encodeURIComponent(u.name)}">
  ${avaTag(u.name, u.avatar, 'uava')}
  <span>${badges(u)}<b>@${esc(u.name)}</b></span>
</a>`;

async function renderList({ sort = '', q = '', tab = 'new' } = {}){
  const vids = await fetch('/api/videos?' + new URLSearchParams({ ...(sort && { sort }), ...(q && { q }) })).then(r => r.json());
  const titles = { new: 'СВЕЖИЕ КАССЕТЫ', top: 'ПОПУЛЯРНОЕ', best: 'ТОП ПО ЛАЙКАМ', search: 'РЕЗУЛЬТАТЫ ПОИСКА' };
  $('#view').innerHTML = `
  <div class="win">
    <div class="titlebar"><b>${titles[tab] || 'АРХИВ'}</b>${tbBtns()}</div>
    <div class="toolbar">
      <a class="btn95 tab ${tab === 'new' ? 'on' : ''}" href="#/">НОВОЕ</a>
      <a class="btn95 tab ${tab === 'top' ? 'on' : ''}" href="#/top">ПОПУЛЯР</a>
      <a class="btn95 tab ${tab === 'best' ? 'on' : ''}" href="#/best">ЛАЙКИ</a>
      ${q ? `<span class="qinfo">по запросу: ${esc(q)}<a class="qx" href="#/">x</a></span>` : ''}
      <span class="spacer"></span><span class="count">НАЙДЕНО: ${vids.length}</span>
    </div>
    <div class="grid">${vids.length ? vids.map(card).join('') :
      emptyState('На полке ни одной кассеты.', ME ? '<a class="btn95 accent" href="#/upload">+ ЗАГРУЗИТЬ ПЕРВУЮ</a>' : '<a class="btn95 accent" href="#/login">ВОЙТИ И ЗАГРУЗИТЬ</a>')}</div>
  </div>`;
  hydrate($('#view'));
}

async function renderWatch(id){
  const r = await fetch('/api/videos/' + encodeURIComponent(id));
  if (!r.ok) return bsod();
  const v = await r.json();
  document.title = v.title + ' — КАССЕТА.TUBE';
  const rel = (await fetch('/api/videos?sort=views').then(r => r.json())).filter(x => x.id !== v.id).slice(0, 8);

  $('#view').innerHTML = `
  <div class="watch">
    <div class="wmain">
      <div class="win">
        <div class="titlebar"><b>ПЛЕЕР — ${esc(v.title)}</b>${tbBtns()}</div>
        <div class="screen"><video id="player" controls preload="metadata" src="${v.url}"></video></div>
      </div>
      <div class="win vinfo">
        <h1>${esc(v.title)}</h1>
        <div class="vrow">
          <span class="vlabel">ПРОСМОТРЫ</span><span class="odo" id="odoViews"></span>
          <span class="vlabel">ЛАЙКИ</span><span class="odo amber" id="odoLikes"></span>
          <span class="date">кассета от ${fmtDate(v.at)} · VHS-${String(v.label ?? '?').padStart(4, '0')}</span>
          <span class="spacer"></span>
          <button id="likeBtn" class="btn95"></button>
          <button id="shareBtn" class="btn95">ССЫЛКА</button>
        </div>
        <div class="abox">
          <a href="#/user/${encodeURIComponent(v.author)}">${avaTag(v.author, v.uavatar, 'ava')}</a>
          <div>
            <div class="uname-row">${badges({ founder: v.ufounded, admin: v.uadmin, supporter: v.usupporter, name: v.author })}<a class="ulink" href="#/user/${encodeURIComponent(v.author)}">@${esc(v.author)}</a></div>
            <small>хранитель кассеты</small>
          </div>
        </div>
        <div class="desc">${v.desc ? md(v.desc) : '<i>описание отсутствует...</i>'}</div>
      </div>
    </div>
    <aside>
      <div class="win">
        <div class="titlebar"><b>ДАЛЕЕ В АРХИВЕ</b>${tbBtns()}</div>
        <div class="rels">${rel.length ? rel.map(x => `
          <a class="rel" href="#/watch/${x.id}">
            <span class="rthumb"><video muted playsinline preload="metadata" data-src="${x.url}#t=2.2"></video></span>
            <span><b>${esc(x.title)}</b><small>@${esc(x.author)} · просм. ${fmtN(x.views)}</small></span>
          </a>`).join('') : '<div class="tip">больше ничего нет — загрузите своё.</div>'}</div>
      </div>
    </aside>
  </div>`;
  hydrate($('#view'));
  odo($('#odoViews'), v.views); odo($('#odoLikes'), v.likes);

  const lb = $('#likeBtn');
  const likeLabel = () => { lb.textContent = (v.liked ? '[-] УБРАТЬ (' : '[+] ЛАЙК (') + fmtN(v.likes) + ')'; lb.classList.toggle('on', !!v.liked); };
  likeLabel();
  lb.onclick = async () => {
    if (!ME){ toast('Войдите, чтобы ставить лайки', '[!]'); location.hash = '#/login'; return; }
    const j = await fetch(`/api/videos/${v.id}/like${v.liked ? '?undo=1' : ''}`, { method: 'POST' }).then(r => r.json());
    if (j.error) return toast(j.error, '[!]');
    v.likes = j.likes; v.liked = j.liked; likeLabel(); odo($('#odoLikes'), v.likes);
  };
  $('#shareBtn').onclick = async () => {
    const link = location.origin + '/#/watch/' + v.id;
    try { await navigator.clipboard.writeText(link); toast('Ссылка скопирована', '[*]'); }
    catch { prompt('Скопируйте ссылку:', link); }
  };

  if (!sessionStorage.getItem('seen_' + v.id)){
    sessionStorage.setItem('seen_' + v.id, '1');
    fetch(`/api/videos/${v.id}/view`, { method: 'POST' }).then(r => r.json())
      .then(x => odo($('#odoViews'), x.views)).catch(() => {});
  }
}

function bsod(){
  document.title = '404 — КАССЕТА.TUBE';
  $('#view').innerHTML = `<div class="bsod" id="bsod"><div>
    <span class="bsod-chip">КАССЕТА НЕ НАЙДЕНА</span>
    <p>Фатальная ошибка 0x00000404.</p>
    <p>Кассета была перемотана, размагничена или никогда не существовала.</p>
    <p class="blink">&gt; нажмите в любом месте, чтобы вернуться в архив _</p>
  </div></div>`;
  $('#bsod').onclick = () => location.hash = '#/';
}

function renderLogin(){
  if (ME){
    $('#view').innerHTML = `<div class="win authwin"><div class="titlebar"><b>ДОСТУП</b>${tbBtns()}</div>
      <div class="empty"><p>Вы уже вошли как ${badges(ME)}@${esc(ME.name)}</p>
      <a class="btn95" href="#/studio">В КАБИНЕТ</a></div></div>`;
    return;
  }
  $('#view').innerHTML = `
  <div class="win authwin">
    <div class="titlebar"><b>ДОСТУП К АРХИВУ</b>${tbBtns()}</div>
    <div class="toolbar">
      <button class="btn95 tab on" id="tabIn">ВХОД</button>
      <button class="btn95 tab" id="tabUp">РЕГИСТРАЦИЯ</button>
    </div>

    <div id="stepIn" class="form pad10">
      <div class="field"><label>E-MAIL</label><input id="aEmail" type="email" autocomplete="email"></div>
      <div class="field"><label>ПАРОЛЬ</label><input id="aPass" type="password"></div>
      <div class="acts"><button class="btn95 accent" id="aGo">ВОЙТИ</button></div>
    </div>

    <div id="stepUp" class="form pad10 hidden">
      <div id="reg1">
        <div class="field"><label>E-MAIL</label><input id="rEmail" type="email"></div>
        <div class="field"><label>НИК (уникальный, виден всем)</label><input id="rName" maxlength="20" placeholder="латиница, цифры, _ или -"></div>
        <div class="field"><label>ПАРОЛЬ</label><input id="rPass" type="password"></div>
        <div class="acts"><button class="btn95 accent" id="rGo">ВЫСЛАТЬ КОД</button></div>
      </div>
      <div id="reg2" class="hidden">
        <div class="hint" id="codeHint"></div>
        <div class="field"><label>КОД ИЗ ПИСЬМА</label><input id="rCode" maxlength="6" inputmode="numeric" placeholder="6 цифр"></div>
        <div class="acts">
          <button class="btn95 accent" id="rVerify">ПОДТВЕРДИТЬ</button>
          <button class="btn95" id="rResend">ЕЩЁ РАЗ</button>
          <button class="btn95" id="rBack">НАЗАД</button>
        </div>
      </div>
    </div>

    <div class="hint">Регистрация в два шага: данные, затем код на почту. Первый подтверждённый пользователь получает статус основателя инстанса. Повторные e-mail и ники не принимаются.</div>
  </div>`;

  const show = which => {
    $('#stepIn').classList.toggle('hidden', which !== 'in');
    $('#stepUp').classList.toggle('hidden', which !== 'up');
    $('#tabIn').classList.toggle('on', which === 'in');
    $('#tabUp').classList.toggle('on', which === 'up');
  };
  $('#tabIn').onclick = () => show('in');
  $('#tabUp').onclick = () => show('up');

  const login = async () => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('#aEmail').value.trim(), pass: $('#aPass').value }) });
    const j = await r.json();
    if (!r.ok) return toast(j.error || 'Ошибка', '[!]');
    ME = j; renderAuth(); pullStats();
    toast('С возвращением, @' + j.name, '[*]');
    location.hash = j.role === 'admin' ? '#/admin' : '#/studio';
  };
  $('#aGo').onclick = login;
  ['#aEmail', '#aPass'].forEach(s => $(s).addEventListener('keydown', e => { if (e.key === 'Enter') login(); }));

  let regEmail = null;
  $('#rGo').onclick = async () => {
    const r = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('#rEmail').value.trim(), pass: $('#rPass').value, name: $('#rName').value.trim() }) });
    const j = await r.json();
    if (!r.ok) return toast(j.error || 'Ошибка', '[!]');
    regEmail = j.email;
    $('#reg1').classList.add('hidden');
    $('#reg2').classList.remove('hidden');
    $('#codeHint').textContent = j.noSmtp
      ? 'Почта на сервере не настроена, код выведен в консоль сервера: ' + j.devCode
      : 'Код отправлен на ' + j.email + '. Действует 10 минут.';
    $('#rCode').focus();
  };
  $('#rVerify').onclick = async () => {
    const r = await fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: regEmail, code: $('#rCode').value }) });
    const j = await r.json();
    if (!r.ok) return toast(j.error || 'Ошибка', '[!]');
    ME = j; renderAuth(); pullStats();
    const roleMsg = j.founder ? 'Вы стали основателем инстанса!' : 'Аватарку можно загрузить в настройках.';
    toast('Почта подтверждена. Добро пожаловать, @' + j.name + '! ' + roleMsg, '[*]');
    location.hash = j.role === 'admin' ? '#/admin' : '#/studio';
  };
  $('#rCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('#rVerify').click(); });
  $('#rResend').onclick = async () => {
    const r = await fetch('/api/auth/resend', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: regEmail }) });
    const j = await r.json();
    toast(j.error || 'Код отправлен ещё раз', j.error ? '[!]' : '[*]');
  };
  $('#rBack').onclick = () => { $('#reg2').classList.add('hidden'); $('#reg1').classList.remove('hidden'); };
}

async function renderStudio(){
  if (!ME){ toast('Сначала войдите', '[!]'); location.hash = '#/login'; return; }
  const [vids, prof] = await Promise.all([
    fetch('/api/videos?mine=1').then(r => r.json()),
    fetch('/api/user/' + encodeURIComponent(ME.name)).then(r => r.json()),
  ]);
  const totV = vids.reduce((s, v) => s + v.views, 0), totL = vids.reduce((s, v) => s + v.likes, 0);
  $('#view').innerHTML = `
  <div class="win">
    <div class="titlebar"><b>КАБИНЕТ АВТОРА — ${badges(ME)}@${esc(ME.name)}</b>${tbBtns()}</div>
    <div class="toolbar">
      <span class="count">КАССЕТ: ${vids.length} · ПРОСМОТРОВ: ${fmtN(totV)} · ЛАЙКОВ: ${fmtN(totL)} · ПОДПИСЧИКОВ: ${prof.followers.length}</span>
      <span class="spacer"></span>
      <a class="btn95" href="#/user/${encodeURIComponent(ME.name)}">МОЯ СТРАНИЦА</a>
      <a class="btn95 accent" href="#/upload">+ ЗАГРУЗИТЬ</a>
    </div>
    ${vids.length ? `<div class="tblwrap"><table class="tbl">
      <tr><th>КАССЕТА</th><th>ПРОСМ.</th><th>ЛАЙКИ</th><th>РАЗМЕР</th><th>ДАТА</th><th></th></tr>
      ${vids.map(v => `<tr>
        <td><a href="#/watch/${v.id}">${esc(v.title)}</a></td>
        <td class="num">${fmtN(v.views)}</td><td class="num">${fmtN(v.likes)}</td>
        <td class="num">${fmtSize(v.size)}</td><td>${fmtDate(v.at)}</td>
        <td class="acts-cell">
          <button class="btn95 mini" data-edit="${v.id}">ИЗМЕНИТЬ</button>
          <button class="btn95 mini" data-del="${v.id}">УДАЛИТЬ</button>
        </td></tr>`).join('')}
    </table></div>`
    : emptyState('У вас пока нет кассет.', '<a class="btn95 accent" href="#/upload">+ ЗАГРУЗИТЬ ПЕРВУЮ</a>')}
  </div>`;
  $('#view').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    const v = vids.find(x => x.id === b.dataset.del);
    if (!confirm(`Удалить кассету "${v.title}"? Файл будет стёрт с диска безвозвратно.`)) return;
    await fetch('/api/videos/' + v.id, { method: 'DELETE' });
    toast('Кассета удалена', '[*]'); pullStats(); renderStudio();
  });
  $('#view').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
    openEdit(vids.find(x => x.id === b.dataset.edit));
  });
}

function openEdit(v){
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="win"><div class="titlebar"><b>ПРАВКА — VHS-${String(v.label ?? '').padStart(4, '0')}</b>${tbBtns()}</div>
    <div class="form pad10">
      <div class="field"><label>НАЗВАНИЕ</label><input id="eTitle" maxlength="120" value="${esc(v.title)}"></div>
      <div class="field"><label>ОПИСАНИЕ</label><textarea id="eDesc" maxlength="2000">${esc(v.desc || '')}</textarea></div>
      <div class="acts"><button class="btn95 accent" id="eSave">СОХРАНИТЬ</button><button class="btn95" id="eCancel">ОТМЕНА</button></div>
    </div></div>`;
  document.body.append(m);
  const close = () => m.remove();
  m.querySelectorAll('.tbb').forEach(x => x.addEventListener('click', e => { e.stopPropagation(); close(); }));
  $('#eCancel').onclick = close;
  $('#eSave').onclick = async () => {
    const r = await fetch('/api/videos/' + v.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: $('#eTitle').value, desc: $('#eDesc').value }) });
    const j = await r.json();
    if (!r.ok) return toast(j.error || 'Ошибка', '[!]');
    close(); toast('Сохранено', '[*]'); renderStudio();
  };
}

function renderSettings(){
  if (!ME){ toast('Сначала войдите', '[!]'); location.hash = '#/login'; return; }
  $('#view').innerHTML = `
  <div class="win authwin">
    <div class="titlebar"><b>НАСТРОЙКИ — ${badges(ME)}@${esc(ME.name)}</b>${tbBtns()}</div>
    <div class="form pad10">
      <div class="avaprev">${avaTag(ME.name, ME.avatar, 'ava big')}</div>
      <div class="acts">
        <button class="btn95" id="avaBtn">ЗАГРУЗИТЬ АВАТАР</button>
        <button class="btn95" id="avaDel" ${ME.avatar ? '' : 'disabled'}>УБРАТЬ</button>
      </div>
      <input type="file" id="avaPick" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
      <div class="field"><label>E-MAIL (НЕ МЕНЯЕТСЯ)</label><input value="${esc(ME.email)}" disabled></div>
      <div class="field"><label>НОВЫЙ НИК</label><input id="sName" maxlength="20" placeholder="текущий: ${esc(ME.name)}"></div>
      <div class="acts"><button class="btn95" id="sNameGo">СМЕНИТЬ НИК</button></div>
      <div class="field"><label>ТЕКУЩИЙ ПАРОЛЬ</label><input id="sOld" type="password"></div>
      <div class="field"><label>НОВЫЙ ПАРОЛЬ</label><input id="sNew" type="password"></div>
      <div class="acts"><button class="btn95" id="sPassGo">СМЕНИТЬ ПАРОЛЬ</button></div>
      <div class="field"><label>О СЕБЕ (видно на вашей странице)</label><textarea id="sBio" maxlength="1000" placeholder="Пара слов о себе, ссылки на соцсети...">${esc(ME.bio || '')}</textarea></div>
      <div class="acts"><button class="btn95" id="sBioGo">СОХРАНИТЬ БИО</button></div>
    </div>
    <div class="hint">Аватар: png/jpg/webp/gif до 5 МБ. Смена ника переподпишет все ваши кассеты. После смены пароля остальные сессии сбрасываются. Био видно только на вашей странице.</div>
  </div>`;

  $('#avaBtn').onclick = () => $('#avaPick').click();
  $('#avaPick').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    const fd = new FormData(); fd.append('avatar', f);
    const r = await fetch('/api/settings/avatar', { method: 'POST', body: fd });
    const j = await r.json();
    if (!r.ok) return toast(j.error || 'Ошибка', '[!]');
    ME.avatar = j.avatar; renderAuth();
    toast('Аватар обновлён', '[*]');
    renderSettings();
  };
  $('#avaDel').onclick = async () => {
    const r = await fetch('/api/settings/avatar/del', { method: 'POST' });
    const j = await r.json();
    ME.avatar = null; renderAuth();
    toast('Аватар убран', '[*]');
    renderSettings();
  };
  $('#sNameGo').onclick = async () => {
    const r = await fetch('/api/settings/name', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: $('#sName').value }) });
    const j = await r.json();
    if (!r.ok) return toast(j.error || 'Ошибка', '[!]');
    ME.name = j.name; renderAuth();
    toast('Ник обновлён: @' + j.name, '[*]');
    renderSettings();
  };
  $('#sPassGo').onclick = async () => {
    const r = await fetch('/api/settings/pass', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old: $('#sOld').value, pass: $('#sNew').value }) });
    const j = await r.json();
    if (!r.ok) return toast(j.error || 'Ошибка', '[!]');
    $('#sOld').value = ''; $('#sNew').value = '';
    toast('Пароль изменён', '[*]');
  };
  $('#sBioGo').onclick = async () => {
    const r = await fetch('/api/settings/bio', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio: $('#sBio').value }) });
    if (!r.ok) return toast('Ошибка', '[!]');
    ME.bio = $('#sBio').value;
    toast('Био сохранено', '[*]');
  };
}

async function renderUser(name){
  const r = await fetch('/api/user/' + encodeURIComponent(name));
  if (!r.ok) return bsod();
  const p = await r.json();
  document.title = '@' + p.name + ' — КАССЕТА.TUBE';
  const canSub = ME && ME.id !== p.id;
  $('#view').innerHTML = `
  <div class="watch">
    <div class="wmain">
      <div class="win">
        <div class="titlebar"><b>КАНАЛ — ${badges(p)}@${esc(p.name)}</b>${tbBtns()}</div>
        <div class="chan">
          ${avaTag(p.name, p.avatar, 'ava big')}
          <div class="chaninfo">
            <div class="uname-row">${badges(p)}<b>@${esc(p.name)}</b></div>
            <small>в архиве с ${fmtDate(p.at)} · кассет: ${p.videos.length} · подписки: ${p.following.length} · подписчики: ${p.followers.length}</small>
          </div>
          <span class="spacer"></span>
          ${canSub ? `<button class="btn95 ${p.subbed ? 'on' : ''}" id="subBtn">${p.subbed ? '[x] ВЫ ПОДПИСАНЫ' : '[+] ПОДПИСАТЬСЯ'}</button>` : ''}
        </div>
        ${p.bio ? `<div class="bio">${md(p.bio)}</div>` : ''}
        <div class="grid">${p.videos.length ? p.videos.map(card).join('') : emptyState('У канала пока нет кассет.')}</div>
      </div>
    </div>
    <aside>
      <div class="win"><div class="titlebar"><b>ПОДПИСКИ</b>${tbBtns()}</div>
        <div class="rels">${p.following.length ? p.following.map(userItem).join('') : '<div class="tip">ни на кого не подписан</div>'}</div></div>
      <div class="win"><div class="titlebar"><b>ПОДПИСЧИКИ</b>${tbBtns()}</div>
        <div class="rels">${p.followers.length ? p.followers.map(userItem).join('') : '<div class="tip">подписчиков пока нет</div>'}</div></div>
    </aside>
  </div>`;
  hydrate($('#view'));
  const sb = $('#subBtn');
  if (sb) sb.onclick = async () => {
    const j = await fetch(`/api/user/${p.id}/sub`, { method: 'POST' }).then(r => r.json());
    if (j.error) return toast(j.error, '[!]');
    toast(j.subbed ? 'Вы подписаны на @' + p.name : 'Вы отписались от @' + p.name, '[*]');
    renderUser(name);
  };
}

async function renderAdmin(){
  if (!ME || ME.role !== 'admin'){ toast('Доступ только для администратора', '[!]'); location.hash = '#/'; return; }
  const [st, users, vids, pgRules, pgAbout] = await Promise.all([
    fetch('/api/admin/stats').then(r => r.json()),
    fetch('/api/admin/users').then(r => r.json()),
    fetch('/api/videos').then(r => r.json()),
    fetch('/api/page/rules.md').then(r => r.json()).catch(() => ({ text: '' })),
    fetch('/api/page/about.md').then(r => r.json()).catch(() => ({ text: '' })),
  ]);
  $('#view').innerHTML = `
  <div class="win">
    <div class="titlebar"><b>АДМИНКА — ХОЗЯЙСТВО</b>${tbBtns()}</div>
    <div class="toolbar"><span class="count">ПОЛЬЗОВАТЕЛЕЙ: ${st.users} (БАН: ${st.banned}, САППОРТ: ${st.supporters}) · КАССЕТ: ${st.videos} (${fmtSize(st.bytes)}) · ПРОСМОТРОВ: ${fmtN(st.views)} · ЛАЙКОВ: ${fmtN(st.likes)}</span></div>
  </div>
  <div class="win">
    <div class="titlebar"><b>ПОЛЬЗОВАТЕЛИ</b>${tbBtns()}</div>
    <div class="tblwrap"><table class="tbl">
      <tr><th>НИК</th><th>E-MAIL</th><th>РОЛЬ</th><th>КАССЕТ</th><th>СЕССИЙ</th><th>РЕГИСТРАЦИЯ</th><th>СТАТУС</th><th></th></tr>
      ${users.map(u => {
        const isMe = u.id === ME.id;
        const uObj = { founder: u.founder, admin: u.role === 'admin' && !u.founder, supporter: u.supporter, name: u.name };
        return `<tr>
        <td>${u.avatar ? `<img class="tava" src="${u.avatar}">` : ''}${badges(uObj)}<a href="#/user/${encodeURIComponent(u.name)}">@${esc(u.name)}</a></td>
        <td>${esc(u.email)}</td>
        <td>
          <select class="select95" data-role="${u.id}" ${u.founder || isMe ? 'disabled' : ''}>
            <option value="user" ${u.role !== 'admin' ? 'selected' : ''}>юзер</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>админ</option>
          </select>
        </td>
        <td class="num">${u.videos}</td><td class="num">${u.sessions}</td><td>${fmtDate(u.at)}</td>
        <td>${u.banned ? '<span class="banned">БАН</span>' : 'активен'}</td>
        <td class="acts-cell">
          <button class="btn95 mini" data-sup="${u.id}">${u.supporter ? 'УБРАТЬ 💜' : 'САППОРТ 💜'}</button>
          <button class="btn95 mini" data-ban="${u.id}" ${u.founder ? 'disabled' : ''}>${u.banned ? 'РАЗБАНИТЬ' : 'БАН'}</button>
          <button class="btn95 mini" data-kick="${u.id}">СЕССИИ</button>
          <button class="btn95 mini" data-pass="${u.id}">ПАРОЛЬ</button>
          <button class="btn95 mini" data-delvids="${u.id}" ${u.videos === 0 ? 'disabled' : ''}>ОЧИСТИТЬ ВИДЕО</button>
          <button class="btn95 mini" data-deluser="${u.id}" ${u.founder || isMe ? 'disabled' : ''}>УДАЛИТЬ</button>
        </td></tr>`;
      }).join('')}
    </table></div>
  </div>
  <div class="win">
    <div class="titlebar"><b>ВСЕ КАССЕТЫ</b>${tbBtns()}</div>
    <div class="tblwrap"><table class="tbl">
      <tr><th>КАССЕТА</th><th>АВТОР</th><th>ПРОСМ.</th><th>ЛАЙКИ</th><th>РАЗМЕР</th><th></th></tr>
      ${vids.map(v => `<tr>
        <td><a href="#/watch/${v.id}">${esc(v.title)}</a></td>
        <td>${v.uowner ? badges({ founder: v.ufounded, admin: v.uadmin, supporter: v.usupporter, name: v.author }) + '<a href="#/user/' + encodeURIComponent(v.author) + '">@' + esc(v.author) + '</a>' : '<span class="banned">ничья</span>'}</td>
        <td class="num">${fmtN(v.views)}</td><td class="num">${fmtN(v.likes)}</td><td class="num">${fmtSize(v.size)}</td>
        <td class="acts-cell">
          ${v.uowner ? '' : `<button class="btn95 mini" data-claim="${v.id}">ЗАБРАТЬ</button>`}
          <button class="btn95 mini" data-delvideo="${v.id}">УДАЛИТЬ</button>
        </td></tr>`).join('')}
    </table></div>
  </div>
  <div class="win">
    <div class="titlebar"><b>СТРАНИЦЫ — ПРАВИЛА / О ИНСТАНСЕ</b>${tbBtns()}</div>
    <div class="form pad10">
      <div class="field"><label>ПРАВИЛА (markdown)</label><textarea id="pgRules" style="min-height:150px">${esc(pgRules.text)}</textarea></div>
      <div class="acts"><button class="btn95" id="pgRulesSave">СОХРАНИТЬ ПРАВИЛА</button></div>
      <div class="field"><label>О ИНСТАНСЕ</label><textarea id="pgAbout" style="min-height:150px">${esc(pgAbout.text)}</textarea></div>
      <div class="acts"><button class="btn95" id="pgAboutSave">СОХРАНИТЬ О ИНСТАНСЕ</button></div>
    </div>
  </div>`;

  $('#view').querySelectorAll('[data-role]').forEach(sel => {
    sel.onchange = async () => {
      const r = await fetch('/api/admin/users/' + sel.dataset.role + '/role',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: sel.value }) });
      const j = await r.json();
      if (!r.ok){ toast(j.error || 'Ошибка', '[!]'); renderAdmin(); return; }
      toast('Роль @' + users.find(u => u.id === sel.dataset.role).name + ' изменена на ' + (j.role === 'admin' ? 'админ' : 'юзер'), '[*]');
      renderAdmin();
    };
  });

  $('#view').querySelectorAll('[data-sup]').forEach(b => b.onclick = async () => {
    const r = await fetch('/api/admin/users/' + b.dataset.sup + '/supporter', { method: 'POST' });
    const j = await r.json();
    if (!r.ok){ toast(j.error || 'Ошибка', '[!]'); return; }
    const u = users.find(x => x.id === b.dataset.sup);
    toast(j.supporter ? '@' + u.name + ' теперь саппортер' : '@' + u.name + ' больше не саппортер', '[*]');
    renderAdmin();
  });

  $('#view').querySelectorAll('[data-ban]').forEach(b => b.onclick = async () => {
    const r = await fetch('/api/admin/users/' + b.dataset.ban + '/ban', { method: 'POST' }).then(r => r.json());
    if (r.error) return toast(r.error, '[!]');
    toast(r.banned ? 'Пользователь заблокирован' : 'Пользователь разблокирован', '[*]');
    renderAdmin();
  });
  $('#view').querySelectorAll('[data-kick]').forEach(b => b.onclick = async () => {
    const j = await fetch('/api/admin/users/' + b.dataset.kick + '/kick', { method: 'POST' }).then(r => r.json());
    if (j.error) return toast(j.error, '[!]');
    toast('Сессий сброшено: ' + j.kicked, '[*]');
    renderAdmin();
  });
  $('#view').querySelectorAll('[data-pass]').forEach(b => b.onclick = async () => {
    const u = users.find(x => x.id === b.dataset.pass);
    const p = prompt('Новый пароль для @' + u.name + ' (минимум 6 символов):');
    if (!p) return;
    if (p.length < 6) return toast('Минимум 6 символов', '[!]');
    const r = await fetch('/api/admin/users/' + u.id + '/passreset',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pass: p }) });
    const j = await r.json();
    if (!r.ok) return toast(j.error || 'Ошибка', '[!]');
    toast('Пароль для @' + u.name + ' установлен: ' + p, '[*]');
    renderAdmin();
  });
  $('#view').querySelectorAll('[data-delvids]').forEach(b => b.onclick = async () => {
    const u = users.find(x => x.id === b.dataset.delvids);
    if (u.videos === 0) return;
    if (!confirm(`Удалить все кассеты @${u.name} (${u.videos} шт.)? Файлы будут стёрты с диска безвозвратно.`)) return;
    const r = await fetch('/api/admin/users/' + u.id + '/videos', { method: 'POST' });
    const j = await r.json();
    if (!r.ok) return toast(j.error || 'Ошибка', '[!]');
    toast('Удалено кассет: ' + j.deleted, '[*]'); pullStats(); renderAdmin();
  });
  $('#view').querySelectorAll('[data-deluser]').forEach(b => b.onclick = async () => {
    const u = users.find(x => x.id === b.dataset.deluser);
    if (!confirm(`Удалить пользователя @${u.name}? Кассеты останутся в архиве как ничьи.`)) return;
    await fetch('/api/admin/users/' + u.id, { method: 'DELETE' });
    toast('Пользователь удалён', '[*]'); pullStats(); renderAdmin();
  });
  $('#view').querySelectorAll('[data-delvideo]').forEach(b => b.onclick = async () => {
    const v = vids.find(x => x.id === b.dataset.delvideo);
    if (!confirm(`Удалить кассету "${v.title}" (@${v.author})?`)) return;
    await fetch('/api/videos/' + v.id, { method: 'DELETE' });
    toast('Кассета удалена', '[*]'); pullStats(); renderAdmin();
  });
  $('#view').querySelectorAll('[data-claim]').forEach(b => b.onclick = async () => {
    await fetch('/api/admin/videos/' + b.dataset.claim + '/claim', { method: 'POST' });
    toast('Кассета привязана к вам и появилась в кабинете', '[*]');
    pullStats(); renderAdmin();
  });

  $('#pgRulesSave').onclick = async () => {
    const r = await fetch('/api/admin/page/rules.md', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: $('#pgRules').value }) });
    if (!r.ok) return toast('Ошибка', '[!]');
    toast('Правила сохранены', '[*]');
  };
  $('#pgAboutSave').onclick = async () => {
    const r = await fetch('/api/admin/page/about.md', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: $('#pgAbout').value }) });
    if (!r.ok) return toast('Ошибка', '[!]');
    toast('«Об инстансе» сохранено', '[*]');
  };
}

async function renderSupport(){
  document.title = 'Поддержка — КАССЕТА.TUBE';
  const d = await fetch('/api/donate').then(r => r.json()).catch(() => ({ card: '', name: '' }));
  $('#view').innerHTML = `
  <div class="win authwin">
    <div class="titlebar"><b>ПОДДЕРЖКА ПРОЕКТА</b>${tbBtns()}</div>
    <div class="pad10">
      <p style="margin-bottom:12px">КАССЕТА.TUBE — домашний проект одного человека. Здесь нет рекламы и трекеров. Всё держится на энтузиазме и небольшой оплате за домен и хостинг.</p>
      <p style="margin-bottom:14px">Если сайт вам нравится и хочется, чтобы он жил — можно кинуть сколько не жалко. Саппортеры получают 💜 рядом с ником.</p>
      ${d.card ? `
      <div class="field"><label>НОМЕР КАРТЫ</label>
        <input id="cardNum" value="${esc(d.card)}" readonly style="font-family:'Courier New',monospace;font-size:14px;letter-spacing:1px"></div>
      ${d.name ? `<div class="field"><label>ПОЛУЧАТЕЛЬ</label><input value="${esc(d.name)}" readonly></div>` : ''}
      <div class="acts">
        <button class="btn95" id="copyCard">СКОПИРОВАТЬ НОМЕР</button>
      </div>
      ` : `
      <div class="empty"><p>Автор пока не настроил реквизиты. Напишите ему лично.</p></div>
      `}
      <p style="margin-top:14px;font-size:11px;color:#555">
        После перевода напишите овнеру (контакты на странице <a href="#/about">«Об инстансе»</a>) и приложите скриншот перевода и ваш ник — вам выдадут бейдж.</p>
    </div>
  </div>`;
  const btn = $('#copyCard');
  if (btn) btn.onclick = async () => {
    const num = $('#cardNum').value;
    try { await navigator.clipboard.writeText(num); toast('Номер карты скопирован', '[*]'); }
    catch { prompt('Скопируйте номер:', num); }
  };
}

async function renderPage(file, title){
  document.title = title + ' — КАССЕТА.TUBE';
  const j = await fetch('/api/page/' + file).then(r => r.json()).catch(() => ({ text: '' }));
  $('#view').innerHTML = `
  <div class="win upwrap">
    <div class="titlebar"><b>${esc(title).toUpperCase()}</b>${tbBtns()}</div>
    <div class="md">${md(j.text)}</div>
  </div>`;
}

let statusEl = null;
function status(line){ if (statusEl){ statusEl.textContent += line + '\n'; statusEl.scrollTop = 1e9; } }

function renderUpload(){
  if (!ME){ toast('Загрузка доступна после входа', '[!]'); location.hash = '#/login'; return; }
  document.title = 'Загрузка — КАССЕТА.TUBE';
  $('#view').innerHTML = `
  <div class="win upwrap">
    <div class="titlebar"><b>ЗАГРУЗКА — новая кассета</b>${tbBtns()}</div>
    <div class="drop" id="drop" title="Кликните или перетащите файл">
      <div class="reels"><span class="reel"></span><span class="reel"></span></div>
      <div class="big">ВСТАВЬТЕ КАССЕТУ</div>
      <div class="sub">перетащите видеофайл сюда или кликните по лотку<br>
        mp4 / webm играют везде, остальное — как повезёт · лимит ${fmtSize(MAX_MB * 1024 * 1024)}<br>
        кассета будет привязана к ${badges(ME)}@${esc(ME.name)}</div>
      <input type="file" id="filepick" accept="video/*" hidden>
    </div>
    <div class="fileinfo hidden" id="fileinfo">
      <b id="fname"></b><span id="fsize"></span><span>длина: <span id="fdur">...</span></span>
      <button class="btn95 x" id="eject">ИЗВЛЕЧЬ</button>
    </div>
    <div class="form">
      <div class="field"><label>НАЗВАНИЕ *</label><input id="vtitle" maxlength="120" placeholder="Подпишите кассету..."></div>
      <div class="field"><label>ОПИСАНИЕ</label><textarea id="vdesc" maxlength="2000" placeholder="О чём эта плёнка?"></textarea></div>
    </div>
    <div class="terminal" id="status"></div>
    <div class="prog"><i id="pfill"></i><span id="ptext">0%</span></div>
    <div class="acts">
      <button class="btn95 accent" id="upbtn" disabled>+ ЗАГРУЗИТЬ В АРХИВ</button>
      <button class="btn95" id="cancelbtn" disabled>ОТМЕНА</button>
    </div>
  </div>`;
  statusEl = $('#status');
  status('> ожидание кассеты...');

  const drop = $('#drop'), inp = $('#filepick');
  let file = null, dur = 0;

  const setFile = f => {
    if (!f) return;
    if (!f.type.startsWith('video/') && !/\.(mp4|webm|mkv|avi|mov|m4v)$/i.test(f.name))
      return toast('Это не похоже на видео', '[!]');
    file = f; dur = 0;
    $('#fileinfo').classList.remove('hidden');
    $('#fname').textContent = f.name;
    $('#fsize').textContent = fmtSize(f.size);
    $('#fdur').textContent = '...';
    const u = URL.createObjectURL(f), t = document.createElement('video');
    t.preload = 'metadata'; t.src = u;
    t.onloadedmetadata = () => { dur = t.duration || 0; $('#fdur').textContent = fmtDur(dur); URL.revokeObjectURL(u); };
    status('> кассета заряжена. можно записывать.');
    $('#upbtn').disabled = false;
  };

  drop.onclick = () => inp.click();
  inp.onchange = e => setFile(e.target.files[0]);
  ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('hot'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('hot'); }));
  drop.addEventListener('drop', e => setFile(e.dataTransfer.files[0]));
  $('#eject').onclick = () => { file = null; inp.value = ''; $('#fileinfo').classList.add('hidden');
    $('#upbtn').disabled = true; status('> кассета извлечена.'); };

  $('#upbtn').onclick = () => {
    if (!file) return toast('Сначала вставьте кассету', '[!]');
    const title = $('#vtitle').value.trim();
    if (!title){ toast('Нужно название — подпишите кассету', '[!]'); $('#vtitle').focus(); return; }

    const fd = new FormData();
    fd.append('video', file);
    fd.append('title', title);
    fd.append('desc', $('#vdesc').value.trim());
    fd.append('duration', dur);

    const xhr = new XMLHttpRequest(); xhr.open('POST', '/api/videos');
    const btn = $('#upbtn'), fill = $('#pfill'), cancel = $('#cancelbtn');
    btn.disabled = true; btn.textContent = 'ЗАПИСЬ...'; cancel.disabled = false;
    cancel.onclick = () => xhr.abort();
    status('> соединение с сервером... ok');
    let lastP = -1;
    xhr.upload.onprogress = e => {
      if (!e.lengthComputable) return;
      const p = Math.round(e.loaded / e.total * 100);
      fill.style.width = p + '%'; $('#ptext').textContent = p + '%';
      if (p % 10 === 0 && p !== lastP){ status('> передача: ' + p + '%'); lastP = p; }
    };
    xhr.onload = () => {
      if (xhr.status === 200){
        const v = JSON.parse(xhr.responseText);
        fill.style.width = '100%';
        status('> кассета принята в архив. ok');
        toast('Кассета "' + v.title + '" загружена', '[*]');
        pullStats();
        setTimeout(() => location.hash = '#/watch/' + v.id, 600);
      } else {
        let msg = 'Сервер зажевал плёнку.';
        try { msg = JSON.parse(xhr.responseText).error || msg; } catch {}
        status('> ошибка: ' + msg); toast(msg, '[!]');
        btn.disabled = false; btn.textContent = '+ ЗАГРУЗИТЬ В АРХИВ'; cancel.disabled = true;
      }
    };
    xhr.onerror = () => { status('> ошибка связи с сервером'); toast('Сервер не отвечает', '[!]');
      btn.disabled = false; btn.textContent = '+ ЗАГРУЗИТЬ В АРХИВ'; cancel.disabled = true; };
    xhr.send(fd);
  };
}

async function random(){
  const list = await fetch('/api/videos').then(r => r.json());
  if (!list.length){ toast('Архив пуст — нечего перематывать', '[!]'); location.hash = '#/'; return; }
  location.replace('#/watch/' + list[Math.floor(Math.random() * list.length)].id);
}

async function route(){
  const p = $('#player'); if (p) p.pause();
  window.scrollTo(0, 0);
  loadStart();
  document.title = 'КАССЕТА.TUBE — домашний видеоархив';
  const h = location.hash.slice(1) || '/';
  try {
    if (h === '/' || h === '')          await renderList({ tab: 'new' });
    else if (h === '/top')              await renderList({ sort: 'views', tab: 'top' });
    else if (h === '/best')             await renderList({ sort: 'likes', tab: 'best' });
    else if (h.startsWith('/search/'))  await renderList({ q: decodeURIComponent(h.slice(8)), tab: 'search' });
    else if (h.startsWith('/watch/'))   await renderWatch(h.slice(7));
    else if (h.startsWith('/user/'))    await renderUser(decodeURIComponent(h.slice(6)));
    else if (h === '/upload')           renderUpload();
    else if (h === '/login')            renderLogin();
    else if (h === '/studio')           await renderStudio();
    else if (h === '/settings')         renderSettings();
    else if (h === '/admin')            await renderAdmin();
    else if (h === '/support')          await renderSupport();
    else if (h === '/rules')            await renderPage('rules.md', 'Правила');
    else if (h === '/about')            await renderPage('about.md', 'Об инстансе');
    else if (h === '/random')           await random();
    else                                bsod();
  } catch (e){ console.error(e); toast('Сбой: ' + e.message, '[!]'); }
  loadDone();
}

const doSearch = () => { const q = $('#search').value.trim(); if (q) location.hash = '#/search/' + encodeURIComponent(q); };
$('#goSearch').onclick = doSearch;
$('#search').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
addEventListener('keydown', e => {
  if (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName)){ e.preventDefault(); $('#search').focus(); }
});

addEventListener('hashchange', route);

(async function(){
  ME = await fetch('/api/me').then(r => r.json()).catch(() => null);
  renderAuth();
  route();
  pullStats();
  setInterval(pullStats, 30000);
  $('#year').textContent = new Date().getFullYear();
})();