'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let library;
let chapterIndex = 0;
let continuous = false;
let activePrompt = '';
let activeSkill = '';
let toastTimer;
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3000);
}
async function readText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`无法载入文件 (${response.status})`);
  return response.text();
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('已复制到剪贴板');
  } catch {
    toast('浏览器未允许复制；可以选中文本复制，或下载文件。');
  }
}
function imagePreview(item) {
  const dialog = $('#image-dialog');
  $('img', dialog).src = item.src;
  $('img', dialog).alt = item.title;
  $('p', dialog).textContent = item.title;
  dialog.showModal();
}
function videoPreview(item) {
  const dialog = $('#video-dialog');
  $('#film-player').pause();
  $('h3', dialog).textContent = item.title;
  const video = $('video', dialog);
  video.src = item.src;
  video.poster = item.poster || '';
  $('a', dialog).href = item.original || item.src;
  dialog.showModal();
  video.play().catch(() => {});
}
function chooseChapter(index, play = false) {
  chapterIndex = index;
  const item = library.chapters[index];
  const player = $('#film-player');
  player.src = item.src;
  player.poster = item.poster;
  player.load();
  $('#chapter-kicker').textContent = `CHAPTER 0${index + 1}`;
  $('#chapter-title').textContent = item.title.split(' / ')[1] || item.title;
  $('#chapter-description').textContent = item.description;
  document.querySelectorAll('.chapter-button').forEach((button, i) => button.setAttribute('aria-pressed', String(index === i)));
  if (play) player.play().catch(() => toast('请点击播放器的播放按钮。'));
}
async function choosePrompt(item, button) {
  $('#prompt-text').textContent = '正在载入…';
  document.querySelectorAll('.prompt-tab').forEach(tab => tab.setAttribute('aria-selected', String(tab === button)));
  $('#prompt-text').setAttribute('aria-labelledby', button.id);
  $('#prompt-file-name').textContent = item.title;
  $('#prompt-char-count').textContent = `${item.chars} 字符`;
  $('#download-prompt').href = item.file;
  $('#copy-prompt').disabled = true;
  try {
    activePrompt = await readText(item.file);
    $('#prompt-text').textContent = activePrompt;
    $('#copy-prompt').disabled = false;
  } catch (error) {
    activePrompt = '';
    $('#prompt-text').textContent = `${error.message}。也可使用下载链接。`;
  }
}
async function skillPreview(item) {
  const dialog = $('#skill-dialog');
  $('#skill-dialog-title').textContent = item.title;
  $('pre', dialog).textContent = '正在载入…';
  $('#download-skill').href = item.file;
  $('#copy-skill').disabled = true;
  activeSkill = '';
  dialog.showModal();
  try {
    activeSkill = await readText(item.file);
    $('pre', dialog).textContent = activeSkill;
    $('#copy-skill').disabled = false;
  } catch (error) {
    $('pre', dialog).textContent = error.message;
  }
}
function renderImages(items, target, kind) {
  for (const item of items) {
    const article = document.createElement('article');
    article.className = `${kind}-card`;
    if (kind === 'sheet') {
      article.innerHTML = `<button type="button" aria-label="放大${esc(item.title)}人设图"><img src="${esc(item.src)}" alt="${esc(item.title)}角色设定图" loading="lazy"></button><div class="asset-copy"><span class="index-label">CHARACTER STUDY</span><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><a href="${esc(item.original)}" download>下载人设图 ↓</a></div>`;
    } else if (kind === 'reference') {
      article.innerHTML = `<button type="button" aria-label="放大${esc(item.title)}参考图"><img src="${esc(item.src)}" alt="${esc(item.title)}游戏美术参考" loading="lazy"></button><h4>${esc(item.title)}</h4><small>${esc(item.tag)}</small><p>${esc(item.description)}</p>`;
    } else {
      article.innerHTML = `<button type="button" aria-label="放大${esc(item.title)}"><img src="${esc(item.src)}" alt="${esc(item.title)}静态画风草稿" loading="lazy"></button><div><h4>${esc(item.title)}</h4><p>${esc(item.description)}</p><a class="text-link" href="${esc(item.original)}" download>下载原图 ↓</a></div>`;
    }
    $('button', article).addEventListener('click', () => imagePreview(item));
    $(target).append(article);
  }
}
async function initialize() {
  const response = await fetch('data.json');
  if (!response.ok) throw new Error('作品资料暂时无法载入，请刷新重试。');
  library = await response.json();
  $('#prompt-count').textContent = String(library.prompts.length).padStart(2, '0');
  library.chapters.forEach((item, index) => {
    const entry = document.createElement('article');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chapter-button';
    button.setAttribute('aria-pressed', String(index === 0));
    button.innerHTML = `<img src="${esc(item.poster)}" alt="" loading="lazy"><span><span class="chapter-number">CHAPTER 0${index + 1}</span><strong>${esc(item.title.split(' / ')[1] || item.title)}</strong><small>${item.duration.toFixed(2)}秒</small></span>`;
    const download = document.createElement('a');
    download.href = item.original;
    download.download = '';
    download.className = 'chapter-download';
    download.textContent = '下载原视频 ↓';
    button.addEventListener('click', () => { continuous = false; chooseChapter(index, true); });
    entry.append(button, download);
    $('#chapter-list').append(entry);
  });
  $('#play-all').addEventListener('click', () => { continuous = true; chooseChapter(0, true); });
  $('#film-player').addEventListener('ended', () => {
    if (continuous && chapterIndex < library.chapters.length - 1) chooseChapter(chapterIndex + 1, true);
    else continuous = false;
  });
  renderImages(library.sheets, '#sheet-gallery', 'sheet');
  renderImages(library.initialSheets, '#initial-sheet-gallery', 'sheet');
  renderImages(library.references, '#reference-gallery', 'reference');
  renderImages(library.styleTests, '#style-gallery', 'style');
  for (const item of library.materials) {
    const article = document.createElement('article');
    article.className = 'material-card';
    article.innerHTML = `<button type="button" aria-label="播放${esc(item.title)}"><img src="${esc(item.poster)}" alt="${esc(item.title)}预览帧" loading="lazy"><span class="mini-play" aria-hidden="true">▶</span></button><div><h4>${esc(item.title)}</h4><p>${esc(item.description)}</p><a href="${esc(item.original)}" download>下载参考视频 ↓</a></div>`;
    $('button', article).addEventListener('click', () => videoPreview(item));
    $('#material-gallery').append(article);
  }
  let firstPrompt;
  for (const item of library.prompts) {
    if (item.current) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'prompt-tab';
      button.id = `prompt-tab-${item.id}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', 'prompt-text');
      button.setAttribute('aria-selected', 'false');
      button.innerHTML = `${esc(item.title)}<small>${esc(item.tag)}</small>`;
      button.addEventListener('click', () => choosePrompt(item, button));
      $('#prompt-tabs').append(button);
      if (!firstPrompt || item.id === 'chase') firstPrompt = {item, button};
    }
    const link = document.createElement('a');
    link.href = item.file;
    link.download = item.source_name;
    link.innerHTML = `<span>${esc(item.title)}</span><small>${item.chars}字符 ↓</small>`;
    $('#prompt-archive').append(link);
  }
  if (firstPrompt) await choosePrompt(firstPrompt.item, firstPrompt.button);
  $('#copy-prompt').addEventListener('click', () => copyText(activePrompt));
  $('#copy-skill').addEventListener('click', () => copyText(activeSkill));
  for (const item of library.skills) {
    const article = document.createElement('article');
    article.className = 'skill-card';
    article.innerHTML = `<span class="number">${esc(item.number)}</span><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><div class="skill-name">${esc(item.id)}</div><div><button type="button">阅读 SKILL.md ↗</button><a href="${esc(item.file)}" download>下载 ↓</a></div>`;
    $('button', article).addEventListener('click', () => skillPreview(item));
    $('#skill-list').append(article);
  }
  for (const item of library.videos) {
    const article = document.createElement('article');
    article.className = 'archive-video';
    article.innerHTML = `<button type="button" aria-label="播放${esc(item.title)}"><img src="${esc(item.poster)}" alt="${esc(item.title)}视频预览帧" loading="lazy"><span class="mini-play" aria-hidden="true">▶</span></button><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><a href="${esc(item.original)}" download>下载原视频 ↓</a>`;
    $('button', article).addEventListener('click', () => videoPreview(item));
    $('#video-archive').append(article);
  }
  document.body.dataset.ready = 'true';
}
for (const dialog of document.querySelectorAll('dialog')) {
  $('.dialog-close', dialog).addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
}
$('#video-dialog').addEventListener('close', () => $('video', $('#video-dialog')).pause());
initialize().catch(error => { $('#prompt-text').textContent = error.message; toast(error.message); });
