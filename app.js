const $ = (selector) => document.querySelector(selector);
const dropzone = $('#dropzone');
const input = $('#video-input');
const filePickerButton = $('#file-picker-button');
const fileCard = $('#file-card');
const sourceVideo = $('#source-video');
const startButton = $('#start-button');
const progressPanel = $('#progress-panel');
const resultPanel = $('#result-panel');
const gallerySection = $('#gallery-section');
const gallery = $('#gallery');
const frameCountInput = $('#frame-count');
const toast = $('#toast');
const ambientVideo = $('#ambient-bg');
const ambientAudio = $('#ambient-audio');
const musicSection = $('#music-section');
const audioInput = $('#audio-input');
const playlist = $('#playlist');
const qualityInput = $('#image-quality');
const nowPlaying = $('#now-playing');

let selectedFile = null;
let frames = [];
let processing = false;
let cancelRequested = false;
let toastTimer;
let audioTracks = [];
let videoReady = false;
let videoLoadToken = 0;
let currentTrackIndex = 0;

ambientVideo.volume = 0;
ambientVideo.muted = true;
ambientAudio.volume = 0.72;
const attemptAutoplay = () => {
  ambientVideo.play().catch(() => {});
  ambientAudio.play().catch(() => {});
};
window.addEventListener('load', () => setTimeout(attemptAutoplay, 120));
document.addEventListener('visibilitychange', () => { if (!document.hidden) attemptAutoplay(); });
audioTracks = [{ file: null, url: ambientAudio.currentSrc || ambientAudio.src }];
currentTrackIndex = 0;
renderPlaylist();
$('#ambient-toggle').addEventListener('click', () => {
  if (ambientVideo.paused) {
    ambientVideo.play().catch(() => {});
    $('#ambient-toggle').setAttribute('aria-label', 'إيقاف حركة الخلفية');
    showToast('تم تشغيل حركة الخلفية — بدون صوت.');
  } else {
    ambientVideo.pause();
    $('#ambient-toggle').setAttribute('aria-label', 'تشغيل حركة الخلفية');
    showToast('تم إيقاف حركة الخلفية — الصوت مكتوم دائمًا.');
  }
});
$('#music-toggle').addEventListener('click', async () => {
  try {
    if (ambientAudio.paused) { await ambientAudio.play(); await ambientVideo.play(); showToast('تم تشغيل الخلفية والموسيقى.'); }
    else { ambientAudio.pause(); showToast('تم إيقاف الموسيقى.'); }
  } catch { showToast('اضغط مرة أخرى لتشغيل الموسيقى من جهازك.'); }
  musicSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
$('#gallery-toggle').addEventListener('click', () => {
  if (frames.length) gallerySection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  else showToast('المعرض سيظهر هنا بعد استخراج الإطارات.');
});

function trackLabel(track) { return track.file ? track.file.name : 'الصوت المحلي الحالي'; }

function playTrack(index = currentTrackIndex) {
  if (!audioTracks.length) return;
  currentTrackIndex = (index + audioTracks.length) % audioTracks.length;
  const track = audioTracks[currentTrackIndex];
  ambientAudio.src = track.url;
  ambientAudio.load();
  nowPlaying.textContent = trackLabel(track);
  ambientAudio.play().then(() => ambientVideo.play().catch(() => {})).catch(() => {
    showToast('اضغط زر الموسيقى مرة واحدة للسماح بالتشغيل التلقائي.');
  });
  renderPlaylist();
}

ambientAudio.addEventListener('ended', () => {
  if (audioTracks.length) playTrack(currentTrackIndex + 1);
});

$('#add-audio-button').addEventListener('click', () => audioInput.click());
audioInput.addEventListener('change', () => {
  const incoming = Array.from(audioInput.files || []).filter((file) => file.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac|flac)$/i.test(file.name));
  incoming.forEach((file) => audioTracks.push({ file, url: URL.createObjectURL(file) }));
  audioInput.value = '';
  renderPlaylist();
  if (incoming.length) {
    showToast(`تمت إضافة ${incoming.length} ملف صوتي — سيعمل بالتتابع.`);
    if (audioTracks.length === incoming.length) playTrack(0);
  }
});

function renderPlaylist() {
  if (!audioTracks.length) {
    playlist.innerHTML = '<div class="playlist-empty"><span class="equalizer">▂▅▇</span><span>أضف أغانيك المرخّصة</span><small>تعمل بالتتابع تلقائيًا بعد بدء التشغيل</small></div>';
    return;
  }
  playlist.innerHTML = '';
  audioTracks.forEach((track, index) => {
    const row = document.createElement('div');
    row.className = `track-row${index === currentTrackIndex ? ' is-playing' : ''}`;
    row.innerHTML = '<button class="track-play" type="button" aria-label="تشغيل المسار"></button><span class="track-index"></span><span class="track-name"></span><button class="remove-track" type="button">×</button>';
    row.querySelector('.track-play').textContent = index === currentTrackIndex && !ambientAudio.paused ? '❚❚' : '▶';
    row.querySelector('.track-play').addEventListener('click', () => {
      if (index === currentTrackIndex && !ambientAudio.paused) ambientAudio.pause();
      else playTrack(index);
      renderPlaylist();
    });
    row.querySelector('.track-index').textContent = String(index + 1).padStart(2, '0');
    row.querySelector('.track-name').textContent = trackLabel(track);
    row.querySelector('.remove-track').setAttribute('aria-label', `حذف ${trackLabel(track)}`);
    row.querySelector('.remove-track').addEventListener('click', () => {
      if (track.file) URL.revokeObjectURL(track.url);
      audioTracks.splice(index, 1);
      if (currentTrackIndex >= audioTracks.length) currentTrackIndex = 0;
      if (audioTracks.length) playTrack(currentTrackIndex); else { ambientAudio.pause(); renderPlaylist(); }
    });
    playlist.appendChild(row);
  });
}

const formatBytes = (bytes) => {
  if (!bytes) return '0 بايت';
  const units = ['بايت', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
};

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds)) return 'المدة غير متاحة';
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const secs = String(total % 60).padStart(2, '0');
  return `${minutes}:${secs} دقيقة`;
};

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 4200);
}

function setFile(file) {
  if (!file) return;
  const supportedType = ['video/mp4', 'video/quicktime', 'video/webm'].includes(file.type);
  const supportedExtension = /\.(mp4|mov|webm)$/i.test(file.name);
  if (!supportedType && !supportedExtension) {
    showToast('هذا الملف ليس فيديو مدعومًا. اختر MP4 أو MOV أو WEBM.');
    input.value = '';
    return;
  }
  if (file.size > 500 * 1024 * 1024) {
    showToast('حجم الفيديو أكبر من 500MB. اختر ملفًا أصغر.');
    input.value = '';
    return;
  }

  const token = ++videoLoadToken;
  videoReady = false;
  startButton.disabled = true;
  releaseFrames();
  if (sourceVideo.src) URL.revokeObjectURL(sourceVideo.src);
  const objectUrl = URL.createObjectURL(file);
  selectedFile = file;
  sourceVideo.onloadedmetadata = () => {
    if (token !== videoLoadToken) return;
    if (!Number.isFinite(sourceVideo.duration) || sourceVideo.duration <= 0 || !sourceVideo.videoWidth || !sourceVideo.videoHeight) {
      sourceVideo.onerror();
      return;
    }
    videoReady = true;
    $('#file-details').textContent = `${formatBytes(file.size)} · ${formatDuration(sourceVideo.duration)} · ${sourceVideo.videoWidth}×${sourceVideo.videoHeight}`;
    const suggested = Math.max(6, Math.min(120, Math.ceil(sourceVideo.duration) || 12));
    frameCountInput.value = suggested;
    startButton.disabled = false;
  };
  sourceVideo.onerror = () => {
    if (token !== videoLoadToken) return;
    videoReady = false;
    selectedFile = null;
    startButton.disabled = true;
    fileCard.classList.add('is-hidden');
    dropzone.classList.remove('is-hidden');
    input.value = '';
    URL.revokeObjectURL(objectUrl);
    sourceVideo.removeAttribute('src');
    sourceVideo.load();
    showToast('تعذر قراءة الفيديو. جرّب MP4 بترميز H.264 أو ملفًا أصغر.');
  };
  sourceVideo.preload = 'auto';
  sourceVideo.src = objectUrl;
  sourceVideo.load();
  $('#file-name').textContent = file.name;
  $('#file-details').textContent = `${formatBytes(file.size)} · جارٍ فحص الفيديو…`;
  fileCard.classList.remove('is-hidden');
  dropzone.classList.add('is-hidden');
  resultPanel.classList.add('is-hidden');
  gallerySection.classList.add('is-hidden');
}

function clearFile() {
  if (processing) cancelRequested = true;
  videoLoadToken += 1;
  videoReady = false;
  if (sourceVideo.src) URL.revokeObjectURL(sourceVideo.src);
  sourceVideo.removeAttribute('src');
  sourceVideo.load();
  selectedFile = null;
  releaseFrames();
  input.value = '';
  fileCard.classList.add('is-hidden');
  dropzone.classList.remove('is-hidden');
  progressPanel.classList.add('is-hidden');
  resultPanel.classList.add('is-hidden');
  gallerySection.classList.add('is-hidden');
  gallery.innerHTML = '';
  startButton.disabled = true;
}

const openFilePicker = (event) => { if (event) event.stopPropagation(); input.click(); };
filePickerButton.addEventListener('click', openFilePicker);
dropzone.addEventListener('click', () => input.click());
dropzone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); }
});
input.addEventListener('change', () => {
  const file = input.files && input.files[0];
  if (file) setFile(file);
});
input.addEventListener('input', () => {
  const file = input.files && input.files[0];
  if (file) setFile(file);
});
['dragenter', 'dragover'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
  event.preventDefault(); dropzone.classList.add('is-dragover');
}));
['dragleave', 'drop'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
  event.preventDefault(); dropzone.classList.remove('is-dragover');
}));
dropzone.addEventListener('drop', (event) => setFile(event.dataTransfer.files[0]));
$('#remove-file').addEventListener('click', clearFile);
$('#restart-button').addEventListener('click', clearFile);
$('#cancel-button').addEventListener('click', () => { cancelRequested = true; });
$('#decrease-count').addEventListener('click', () => { frameCountInput.value = Math.max(2, Number(frameCountInput.value || 12) - 1); });
$('#increase-count').addEventListener('click', () => { frameCountInput.value = Math.min(120, Number(frameCountInput.value || 12) + 1); });
frameCountInput.addEventListener('change', () => { frameCountInput.value = Math.max(2, Math.min(120, Number(frameCountInput.value || 12))); });

function waitForVideoEvent(eventName) {
  return new Promise((resolve, reject) => {
    const onEvent = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error('تعذر قراءة الفيديو')); };
    const cleanup = () => { sourceVideo.removeEventListener(eventName, onEvent); sourceVideo.removeEventListener('error', onError); };
    sourceVideo.addEventListener(eventName, onEvent, { once: true });
    sourceVideo.addEventListener('error', onError, { once: true });
  });
}

function seekTo(time) {
  return new Promise((resolve, reject) => {
    const onSeeked = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error('تعذر الوصول إلى إحدى لقطات الفيديو')); };
    const cleanup = () => { sourceVideo.removeEventListener('seeked', onSeeked); sourceVideo.removeEventListener('error', onError); };
    sourceVideo.addEventListener('seeked', onSeeked, { once: true });
    sourceVideo.addEventListener('error', onError, { once: true });
    try { sourceVideo.currentTime = time; } catch { cleanup(); reject(new Error('تعذر الوصول إلى إحدى لقطات الفيديو')); }
  });
}

function drawFrame() {
  const maxWidth = 3840;
  const scale = Math.min(1, maxWidth / sourceVideo.videoWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceVideo.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceVideo.videoHeight * scale));
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx || !canvas.width || !canvas.height) return Promise.resolve(null);
  ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
  const quality = Number(qualityInput?.value || 0.92);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

function updateProgress(done, total) {
  const percent = Math.round((done / total) * 100);
  $('#progress-percent').textContent = `${percent}%`;
  $('#progress-bar').style.width = `${percent}%`;
  $('#progress-detail').textContent = `${done} من ${total} صورة`;
  $('#progress-label').textContent = done === total ? 'نرتّب الصور داخل ZIP…' : `نلتقط الإطار رقم ${done + 1}…`;
}

async function extractFrames() {
  if (!selectedFile || !videoReady || processing) return;
  processing = true;
  cancelRequested = false;
  releaseFrames();
  const count = Math.max(2, Math.min(120, Number(frameCountInput.value) || 12));
  frameCountInput.value = count;
  startButton.classList.add('is-hidden');
  progressPanel.classList.remove('is-hidden');
  resultPanel.classList.add('is-hidden');
  gallerySection.classList.add('is-hidden');
  try {
    if (!videoReady || !sourceVideo.videoWidth || !sourceVideo.videoHeight) {
      if (sourceVideo.readyState >= 1 && Number.isFinite(sourceVideo.duration)) videoReady = true;
      else await waitForVideoEvent('loadedmetadata');
    }
    for (let index = 0; index < count; index += 1) {
      if (cancelRequested) throw new DOMException('تم إلغاء العملية', 'AbortError');
      const time = count === 1 ? 0 : (sourceVideo.duration * index) / (count - 1);
      await seekTo(Math.min(time, Math.max(0, sourceVideo.duration - 0.05)));
      const blob = await drawFrame();
      if (!blob) throw new Error('تعذر تحويل إحدى اللقطات إلى صورة');
      frames.push({ name: `frame-${String(index + 1).padStart(3, '0')}.jpg`, blob, url: URL.createObjectURL(blob) });
      updateProgress(index + 1, count);
    }
    renderGallery();
    $('#result-label').textContent = `${frames.length} صورة جاهزة`;
    progressPanel.classList.add('is-hidden');
    resultPanel.classList.remove('is-hidden');
    showToast('اكتملت العملية — الصور جاهزة للتنزيل.');
  } catch (error) {
    progressPanel.classList.add('is-hidden');
    releaseFrames();
    if (error.name === 'AbortError') showToast('تم إلغاء العملية. يمكنك البدء من جديد.');
    else showToast(error.message || 'حدث خطأ أثناء معالجة الفيديو.');
  } finally {
    processing = false;
    startButton.classList.remove('is-hidden');
    startButton.disabled = !selectedFile || !videoReady;
  }
}

function renderGallery() {
  gallery.innerHTML = '';
  frames.forEach((frame, index) => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.style.animationDelay = `${Math.min(index * 35, 500)}ms`;
    item.innerHTML = `<img src="${frame.url}" alt="الإطار رقم ${index + 1}" loading="lazy">`;
    gallery.appendChild(item);
  });
  $('#gallery-count').textContent = `${frames.length} صورة`;
  gallerySection.classList.remove('is-hidden');
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) { return new Uint8Array([value & 255, (value >>> 8) & 255]); }
function u32(value) { return new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]); }
function concatBytes(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => { output.set(part, offset); offset += part.length; });
  return output;
}

async function createZip(fileEntries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const entry of fileEntries) {
    const name = encoder.encode(entry.name);
    const data = new Uint8Array(await entry.blob.arrayBuffer());
    const crc = crc32(data);
    const local = concatBytes(new Uint8Array([0x50,0x4b,0x03,0x04]), u16(20), u16(0), u16(0), u16(dosTime), u16(dosDate), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data);
    localParts.push(local);
    const central = concatBytes(new Uint8Array([0x50,0x4b,0x01,0x02]), u16(20), u16(20), u16(0), u16(0), u16(dosTime), u16(dosDate), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name);
    centralParts.push(central);
    offset += local.length;
  }
  const centralDirectory = concatBytes(...centralParts);
  const end = concatBytes(new Uint8Array([0x50,0x4b,0x05,0x06]), u16(0), u16(0), u16(fileEntries.length), u16(fileEntries.length), u32(centralDirectory.length), u32(offset), u16(0));
  return new Blob([...localParts, centralDirectory, end], { type: 'application/zip' });
}

$('#download-button').addEventListener('click', async () => {
  if (!frames.length) return;
  const button = $('#download-button');
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span>…</span> نجهّز الملف';
  try {
    const zip = await createZip(frames);
    const url = URL.createObjectURL(zip);
    const link = document.createElement('a');
    link.href = url;
    link.download = `framezip-${new Date().toISOString().slice(0, 10)}.zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    showToast('تعذر إنشاء ملف ZIP. جرّب عددًا أقل من الصور.');
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
});

startButton.addEventListener('click', extractFrames);
window.addEventListener('beforeunload', () => { releaseFrames(); audioTracks.forEach((track) => URL.revokeObjectURL(track.url)); });
