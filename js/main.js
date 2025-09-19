// main.js
const input = document.getElementById('files');
const dropZone = document.getElementById('dropZone');
const gallery = document.getElementById('gallery');
const downloadBtn = document.getElementById('downloadAll');
const processBtn = document.getElementById('processBtn');
const commonNameInput = document.getElementById('commonName');
const zipNameInput = document.getElementById('zipName');
const qualityRange = document.getElementById('qualityRange');
const progressBar = document.getElementById('progressBar');
const toast = document.getElementById('toast');

// new: quality value span
const qualityValue = document.getElementById('qualityValue');

// Custom Select
const customSelectBtn = document.getElementById('customSelectBtn');
const customOptions = document.getElementById('customOptions');
const options = customOptions.querySelectorAll('.option');
let selectedFormat = 'jpeg';

// Persist settings
window.addEventListener('load', () => {
    const savedQuality = localStorage.getItem('quality');
    if (savedQuality) {
        qualityRange.value = savedQuality;
        if (qualityValue) qualityValue.textContent = savedQuality + '%';
    }
    const savedFormat = localStorage.getItem('format');
    if (savedFormat) {
        selectedFormat = savedFormat;
        customSelectBtn.textContent = savedFormat.toUpperCase();
        options.forEach(o => {
            o.classList.toggle('active', o.dataset.value === savedFormat);
        });
    }
    const savedZipName = localStorage.getItem('zipName');
    if (savedZipName) zipNameInput.value = savedZipName;
    const savedCommon = localStorage.getItem('commonName');
    if (savedCommon) commonNameInput.value = savedCommon;
});

qualityRange.addEventListener('input', () => {
    qualityValue.textContent = qualityRange.value + '%';
    localStorage.setItem('quality', qualityRange.value);
});

customSelectBtn.addEventListener('click', () => {
    customOptions.style.display = customOptions.style.display === 'flex' ? 'none' : 'flex';
});
options.forEach(option => {
    option.addEventListener('click', () => {
        options.forEach(o => o.classList.remove('active'));
        option.classList.add('active');
        selectedFormat = option.dataset.value;
        customSelectBtn.textContent = option.textContent;
        customOptions.style.display = 'none';
        localStorage.setItem('format', selectedFormat);
    });
});
document.addEventListener('click', (e) => {
    if (!customSelectBtn.contains(e.target) && !customOptions.contains(e.target)) {
        customOptions.style.display = 'none';
    }
});

zipNameInput.addEventListener('input', () => {
    localStorage.setItem('zipName', zipNameInput.value.trim());
});
commonNameInput.addEventListener('input', () => {
    localStorage.setItem('commonName', commonNameInput.value.trim());
});

let filesList = [];
let processedImages = [];

// Helpers
function truncate(v) { return v < 0 ? 0 : (v > 255 ? 255 : v); }
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Create gallery card with raw preview and mini progress
function createGalleryItem(file, rawSrc) {
    const baseName = file.name.replace(/\.[^/.]+$/, '');

    const item = document.createElement('div');
    item.className = 'item';

    const details = document.createElement('div');
    details.className = 'item-details';
    details.textContent = baseName;

    const pair = document.createElement('div');
    pair.className = 'preview-pair';

    const rawWrap = document.createElement('div');
    const rawLabel = document.createElement('div'); rawLabel.className = 'label'; rawLabel.textContent = 'قبل';
    const rawImg = document.createElement('img'); rawImg.src = rawSrc;
    rawWrap.appendChild(rawLabel); rawWrap.appendChild(rawImg);

    const outWrap = document.createElement('div');
    const outLabel = document.createElement('div'); outLabel.className = 'label'; outLabel.textContent = 'بعد';
    const outImg = document.createElement('img'); outImg.src = ''; outImg.alt = 'پردازش‌نشده';
    outWrap.appendChild(outLabel); outWrap.appendChild(outImg);

    pair.appendChild(rawWrap); pair.appendChild(outWrap);

    const mini = document.createElement('div'); mini.className = 'mini-progress';
    const miniBar = document.createElement('div'); miniBar.className = 'mini-bar'; mini.appendChild(miniBar);

    const itemActions = document.createElement('div'); itemActions.className = 'actions';
    const dlBtn = document.createElement('button'); dlBtn.className = 'download-btn';
    dlBtn.innerHTML = '<i class="fa-solid fa-download"></i> دانلود';
    dlBtn.disabled = true;

    itemActions.appendChild(dlBtn);

    item.appendChild(pair);
    item.appendChild(mini);
    item.appendChild(details);
    item.appendChild(itemActions);

    gallery.appendChild(item);

    return { item, outImg, miniBar, dlBtn };
}

// Drag & Drop
dropZone.addEventListener('click', () => input.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('hover'); });
dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('hover'); });
dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('hover');
    filesList = Array.from(e.dataTransfer.files);
    gallery.innerHTML = ''; processedImages = [];
    previewFiles(filesList);
});

input.addEventListener('change', e => {
    filesList = Array.from(e.target.files);
    gallery.innerHTML = ''; processedImages = [];
    previewFiles(filesList);
});

function previewFiles(list) {
    if (!list.length) return;
    list.forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
            createGalleryItem(file, ev.target.result);
        };
        reader.readAsDataURL(file);
    });
    showToast('پیش‌نمایش تصاویر نمایش داده شد!');
}

// Process Images
processBtn.addEventListener('click', async () => {
    if (filesList.length === 0) return alert('ابتدا تصاویر را انتخاب کن');
    const commonName = commonNameInput.value.trim();
    const quality = parseInt(qualityRange.value);
    let completed = 0;
    progressBar.style.width = '0%';
    processedImages = [];

    // iterate synchronously (can later use web workers)
    for (let idx = 0; idx < filesList.length; idx++) {
        const file = filesList[idx];
        await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = ev => {
                const img = new Image();
                img.onload = () => {
                    // find corresponding gallery item (created during preview)
                    // it's the idx-th .item
                    const item = gallery.children[idx];
                    const outImg = item.querySelector('.preview-pair div:nth-child(2) img');
                    const miniBar = item.querySelector('.mini-bar');
                    const dlBtn = item.querySelector('.download-btn');

                    // Stage 1
                    miniBar.style.width = '20%';
                    // draw to canvas
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const maxW = 800;
                    const ratio = Math.min(1, maxW / img.width);
                    canvas.width = Math.round(img.width * ratio);
                    canvas.height = Math.round(img.height * ratio);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    // Stage 2 - enhance
                    miniBar.style.width = '55%';
                    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    let data = imageData.data;
                    const brightness = 20, contrast = 1.3, saturation = 1.15;
                    for (let i = 0; i < data.length; i += 4) {
                        let r = data[i], g = data[i + 1], b = data[i + 2];
                        r = truncate((r - 128) * contrast + 128 + brightness);
                        g = truncate((g - 128) * contrast + 128 + brightness);
                        b = truncate((b - 128) * contrast + 128 + brightness);
                        const avg = (r + g + b) / 3;
                        r = truncate(avg + (r - avg) * saturation);
                        g = truncate(avg + (g - avg) * saturation);
                        b = truncate(avg + (b - avg) * saturation);
                        data[i] = r; data[i + 1] = g; data[i + 2] = b;
                    }
                    imageData.data.set(data);
                    ctx.putImageData(imageData, 0, 0);

                    // Stage 3 - export
                    miniBar.style.width = '80%';
                    const baseName = file.name.replace(/\.[^/.]+$/, '');
                    const outName = commonName ? `${commonName}_${baseName}.${selectedFormat}` : `${baseName}.${selectedFormat}`;
                    const mime = 'image/' + (selectedFormat === 'jpg' ? 'jpeg' : selectedFormat);
                    const dataURL = canvas.toDataURL(mime, (selectedFormat === 'jpeg' || selectedFormat === 'jpg') ? quality / 100 : undefined);

                    // set output preview
                    outImg.src = dataURL;
                    miniBar.style.width = '100%'; // done

                    processedImages.push({ name: outName, data: dataURL });

                    // enable single download
                    dlBtn.disabled = false;
                    dlBtn.onclick = () => {
                        const a = document.createElement('a');
                        a.href = dataURL;
                        a.download = outName;
                        a.click();
                    };

                    // overall progress
                    completed++;
                    progressBar.style.width = ((completed / filesList.length) * 100) + '%';
                    resolve();
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
    showToast('پردازش تصاویر تکمیل شد!');
});

// Download ZIP
downloadBtn.addEventListener('click', () => {
    if (processedImages.length === 0) return alert('ابتدا تصاویر را پردازش کن');
    const zipName = (zipNameInput.value.trim() || 'enhanced_images').replace(/\s+/g, '_');
    const zip = new JSZip();
    processedImages.forEach(img => {
        const base64 = img.data.split(',')[1];
        zip.file(img.name, base64, { base64: true });
    });
    zip.generateAsync({ type: 'blob' }).then(content => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        a.download = zipName + '.zip';
        a.click();
        showToast('دانلود ZIP شروع شد');
    });
});
