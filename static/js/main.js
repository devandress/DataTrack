/**
 * DataTrack - Sistema de Conteo de Vehiculos con YOLO11
 */
class DataTrackApp {
    constructor() {
        this.videoFile = null;
        this.serverFilename = null;   // filename already on server (no re-upload needed)
        this.serverVideoName = null;  // display name for server video
        this.polygons = [];
        this.polygonNames = [];
        this.isDrawing = false;
        this.drawMode = null;
        this.currentPolygon = [];
        this.drawStart = null;
        this.jobId = null;
        this.currentResults = null;
        this.typeChart = null;
        this.videoWidth = 0;
        this.videoHeight = 0;
        this.canvasWidth = 0;
        this.canvasHeight = 0;
        this.currentTab = 'process';
        this._allVideos = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadHardwareInfo();
        this.loadModelStatus();
    }

    // --- Tabs ---

    switchTab(tab) {
        this.currentTab = tab;
        const tabs = { process: 'panelProcess', history: 'panelHistory', storage: 'panelStorage' };
        const tabBtns = { process: 'tabProcess', history: 'tabHistory', storage: 'tabStorage' };

        Object.entries(tabs).forEach(([key, id]) => {
            document.getElementById(id).classList.toggle('hidden', key !== tab);
            if (key === tab) document.getElementById(id).classList.add('flex-1');
        });
        Object.entries(tabBtns).forEach(([key, id]) => {
            const el = document.getElementById(id);
            el.className = el.className.replace(/tab-\w+/, key === tab ? 'tab-active' : 'tab-inactive');
        });

        if (tab === 'history') this.loadRecords();
        if (tab === 'storage') this.loadStorage();
    }

    // --- Event Listeners ---

    setupEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const videoInput = document.getElementById('videoInput');

        uploadArea.addEventListener('click', () => videoInput.click());
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = '#3b82f6'; });
        uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = ''; });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '';
            if (e.dataTransfer.files.length > 0) this.handleVideoUpload(e.dataTransfer.files[0]);
        });
        videoInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) this.handleVideoUpload(e.target.files[0]);
        });

        document.getElementById('confidenceSlider').addEventListener('input', (e) => {
            document.getElementById('confValue').textContent = (e.target.value / 100).toFixed(2);
        });
        document.getElementById('frameSkipSlider').addEventListener('input', (e) => {
            document.getElementById('skipValue').textContent = e.target.value;
        });
        document.getElementById('modelSelector').addEventListener('change', (e) => {
            this.updateModelInfo(e.target.value, null);
            this.loadModelStatus();
        });
        document.getElementById('downloadModelBtn').addEventListener('click', () => this.downloadModel());

        document.getElementById('drawRectBtn').addEventListener('click', () => this.startRectDrawing());
        document.getElementById('drawPolyBtn').addEventListener('click', () => this.startPolyDrawing());
        document.getElementById('clearPolygonBtn').addEventListener('click', () => this.clearPolygons());

        document.getElementById('processBtn').addEventListener('click', () => this.processVideo());
        document.getElementById('generateVideoBtn').addEventListener('click', () => this.generateAnnotatedVideo());
        document.getElementById('exportCsvBtn').addEventListener('click', () => this.exportCSV());
        document.getElementById('exportJsonBtn').addEventListener('click', () => this.exportJSON());
        document.getElementById('clearResultsBtn').addEventListener('click', () => this.clearResults());

        const canvas = document.getElementById('drawingCanvas');
        canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.handleCanvasMouseUp(e));
        canvas.addEventListener('mouseleave', () => {
            if (this.isDrawing && this.drawStart && this.drawMode === 'rect') {
                this.redrawCanvas();
                this.drawStart = null;
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.isDrawing && this.drawMode === 'poly') {
                e.preventDefault();
                document.getElementById('drawPolyBtn').click();
            }
        });

        // History
        document.getElementById('refreshRecords').addEventListener('click', () => this.loadRecords());
        document.getElementById('searchRecords').addEventListener('input', (e) => this.loadRecords(e.target.value));

        // Storage
        document.getElementById('refreshStorage').addEventListener('click', () => this.loadStorage());
        document.getElementById('cleanOrphansBtn').addEventListener('click', () => this.cleanOrphans());
        document.getElementById('showOrphansOnly').addEventListener('change', () => this.renderStorageTable());
    }

    // --- Hardware ---

    async loadHardwareInfo() {
        try {
            const data = await (await fetch('/api/hardware-info')).json();
            document.getElementById('hardwareInfo').innerHTML = `
                <p class="font-bold">${data.device.toUpperCase()}</p>
                <p class="text-xs">RAM: ${data.ram_gb}GB | VRAM: ${data.vram_gb}GB | CPU: ${data.cpu_cores} nucleos</p>
                <p class="text-xs opacity-70">Perfil: ${data.profile}</p>
            `;
        } catch (e) {
            console.error('Hardware info error:', e);
        }
    }

    async loadModelStatus() {
        try {
            const data = await (await fetch('/api/models')).json();
            if (!data.success) return;
            const models = data.available_models;
            const selector = document.getElementById('modelSelector');
            // Update option labels to show download status
            Array.from(selector.options).forEach(opt => {
                const key = opt.value;
                if (models[key]) {
                    const downloaded = models[key].downloaded;
                    const labels = {
                        'yolo11n': 'Nano (Rapido)',
                        'yolo11s': 'Small (Balanceado)',
                        'yolo11m': 'Medium (Preciso)',
                        'yolo11l': 'Large (Muy preciso)'
                    };
                    opt.textContent = (downloaded ? '' : '[Descargar] ') + (labels[key] || key);
                }
            });
            this.updateModelInfo(selector.value, models);
        } catch (e) { /* silent */ }
    }

    updateModelInfo(model, models) {
        const info = {
            'yolo11n': '49MB - Muy rapido, menos preciso',
            'yolo11s': '105MB - Rapido y preciso (Recomendado)',
            'yolo11m': '219MB - Mas preciso, requiere 3.5GB VRAM',
            'yolo11l': '464MB - Muy preciso, requiere 5.2GB VRAM'
        };
        const downloaded = models && models[model] ? models[model].downloaded : null;
        const status = downloaded === false ? ' (necesita descarga)' : downloaded === true ? ' (listo)' : '';
        document.getElementById('modelInfo').textContent = (info[model] || '') + status;
    }

    async downloadModel() {
        const model = document.getElementById('modelSelector').value;
        const btn = document.getElementById('downloadModelBtn');
        btn.disabled = true;
        btn.textContent = 'Iniciando...';

        try {
            const data = await (await fetch(`/api/download-model/${model}`, { method: 'POST' })).json();

            if (!data.success) {
                btn.textContent = 'Error al iniciar';
                setTimeout(() => { btn.disabled = false; btn.textContent = 'Descargar Modelo'; }, 3000);
                return;
            }

            if (data.already_exists) {
                btn.textContent = 'Ya descargado';
                btn.disabled = false;
                setTimeout(() => { btn.textContent = 'Descargar Modelo'; }, 2000);
                return;
            }

            // Polling de estado
            btn.textContent = 'Descargando...';
            await this.pollDownloadStatus(data.job_id, btn, model);

        } catch (e) {
            btn.textContent = 'Error de conexion';
            btn.disabled = false;
            setTimeout(() => { btn.textContent = 'Descargar Modelo'; }, 3000);
        }
    }

    async pollDownloadStatus(jobId, btn, modelName) {
        let dots = 0;
        const poll = async () => {
            try {
                const data = await (await fetch(`/api/download-model-status/${jobId}`)).json();

                if (data.status === 'done') {
                    btn.textContent = 'Descargado';
                    btn.disabled = false;
                    setTimeout(() => { btn.textContent = 'Descargar Modelo'; }, 3000);
                    // Actualizar info del modelo
                    this.updateModelInfo(modelName);
                } else if (data.status === 'error') {
                    btn.textContent = 'Error: ' + (data.error || 'Fallo la descarga');
                    btn.disabled = false;
                    setTimeout(() => { btn.textContent = 'Descargar Modelo'; }, 5000);
                } else {
                    dots = (dots + 1) % 4;
                    btn.textContent = 'Descargando' + '.'.repeat(dots + 1);
                    setTimeout(poll, 1500);
                }
            } catch (e) {
                btn.textContent = 'Error de conexion';
                btn.disabled = false;
                setTimeout(() => { btn.textContent = 'Descargar Modelo'; }, 3000);
            }
        };
        poll();
    }

    // --- Video Upload ---

    handleVideoUpload(file) {
        if (!file.type.startsWith('video/')) return alert('Selecciona un archivo de video');
        this.videoFile = file;
        this.serverFilename = null;
        this.serverVideoName = null;

        const videoElement = document.getElementById('videoElement');
        videoElement.src = URL.createObjectURL(file);

        document.getElementById('uploadArea').classList.add('hidden');
        document.getElementById('videoDisplay').classList.remove('hidden');
        document.getElementById('videoInfoBar').classList.remove('hidden');
        document.getElementById('videoInfoName').textContent = file.name;
        document.getElementById('videoControls').classList.remove('hidden');

        const canvas = document.getElementById('drawingCanvas');
        const container = document.getElementById('videoDisplay');

        videoElement.addEventListener('loadedmetadata', () => {
            this.videoWidth = videoElement.videoWidth;
            this.videoHeight = videoElement.videoHeight;
            requestAnimationFrame(() => {
                const rect = container.getBoundingClientRect();
                this.canvasWidth = rect.width || container.offsetWidth || 640;
                this.canvasHeight = rect.height || container.offsetHeight || 360;
                canvas.width = this.canvasWidth;
                canvas.height = this.canvasHeight;
                this.redrawCanvas();
            });
        }, { once: true });
    }

    // --- Drawing ---

    startRectDrawing() {
        if (!this.videoFile && !this.serverFilename) return alert('Carga un video primero');
        const btn = document.getElementById('drawRectBtn');
        const polyBtn = document.getElementById('drawPolyBtn');
        const canvas = document.getElementById('drawingCanvas');

        if (this.isDrawing && this.drawMode === 'rect') {
            this.isDrawing = false;
            this.drawMode = null;
            btn.textContent = 'Rectangulo';
            polyBtn.disabled = false;
            polyBtn.style.opacity = '1';
            canvas.style.cursor = 'default';
        } else {
            this.isDrawing = true;
            this.drawMode = 'rect';
            this.currentPolygon = [];
            btn.textContent = 'Arrastra para dibujar';
            polyBtn.disabled = true;
            polyBtn.style.opacity = '0.5';
            canvas.classList.remove('hidden');
            canvas.style.cursor = 'crosshair';
        }
    }

    startPolyDrawing() {
        if (!this.videoFile && !this.serverFilename) return alert('Carga un video primero');
        const btn = document.getElementById('drawPolyBtn');
        const rectBtn = document.getElementById('drawRectBtn');
        const canvas = document.getElementById('drawingCanvas');

        if (this.isDrawing && this.drawMode === 'poly') {
            if (this.currentPolygon.length >= 3) {
                this.polygons.push([...this.currentPolygon]);
                this.polygonNames.push(`Area ${this.polygons.length}`);
                this.currentPolygon = [];
                this.redrawCanvas();
                this.updatePolygonsList();
                this.isDrawing = false;
                this.drawMode = null;
                btn.textContent = 'Poligono';
                rectBtn.disabled = false;
                rectBtn.style.opacity = '1';
                canvas.style.cursor = 'default';
            } else {
                alert('Minimo 3 puntos');
            }
        } else if (!this.isDrawing) {
            this.isDrawing = true;
            this.drawMode = 'poly';
            this.currentPolygon = [];
            btn.textContent = 'Click puntos, Enter terminar';
            rectBtn.disabled = true;
            rectBtn.style.opacity = '0.5';
            canvas.classList.remove('hidden');
            canvas.style.cursor = 'crosshair';
        }
    }

    handleCanvasMouseDown(e) {
        if (!this.isDrawing) return;
        if (this.drawMode === 'rect') {
            this.drawStart = { x: e.offsetX, y: e.offsetY };
        } else if (this.drawMode === 'poly') {
            this.currentPolygon.push([e.offsetX, e.offsetY]);
            this.redrawCanvas();
            this.drawPreview();
        }
    }

    handleCanvasMouseMove(e) {
        if (!this.isDrawing) return;
        const canvas = document.getElementById('drawingCanvas');
        const ctx = canvas.getContext('2d');

        if (this.drawMode === 'rect' && this.drawStart) {
            this.redrawCanvas();
            const x1 = Math.min(this.drawStart.x, e.offsetX);
            const y1 = Math.min(this.drawStart.y, e.offsetY);
            const x2 = Math.max(this.drawStart.x, e.offsetX);
            const y2 = Math.max(this.drawStart.y, e.offsetY);

            ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.rect(x1, y1, x2 - x1, y2 - y1);
            ctx.fill();
            ctx.stroke();
        } else if (this.drawMode === 'poly' && this.currentPolygon.length > 0) {
            this.redrawCanvas();
            this.drawPreview();
            const last = this.currentPolygon[this.currentPolygon.length - 1];
            ctx.strokeStyle = '#a78bfa';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(last[0], last[1]);
            ctx.lineTo(e.offsetX, e.offsetY);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    handleCanvasMouseUp(e) {
        if (!this.isDrawing || !this.drawStart || this.drawMode !== 'rect') return;
        const x1 = Math.min(this.drawStart.x, e.offsetX);
        const y1 = Math.min(this.drawStart.y, e.offsetY);
        const x2 = Math.max(this.drawStart.x, e.offsetX);
        const y2 = Math.max(this.drawStart.y, e.offsetY);

        if (Math.abs(x2 - x1) < 20 || Math.abs(y2 - y1) < 20) return;

        this.polygons.push([[x1, y1], [x2, y1], [x2, y2], [x1, y2]]);
        this.polygonNames.push(`Area ${this.polygons.length}`);
        this.drawStart = null;
        this.redrawCanvas();
        this.updatePolygonsList();
    }

    drawPreview() {
        if (this.currentPolygon.length === 0) return;
        const ctx = document.getElementById('drawingCanvas').getContext('2d');
        ctx.fillStyle = 'rgba(167, 139, 250, 0.1)';
        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        this.currentPolygon.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
        if (this.currentPolygon.length >= 3) { ctx.closePath(); ctx.fill(); }
        ctx.stroke();

        ctx.fillStyle = '#a78bfa';
        this.currentPolygon.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, Math.PI * 2); ctx.fill(); });
    }

    redrawCanvas() {
        const canvas = document.getElementById('drawingCanvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        this.polygons.forEach((polygon, idx) => {
            ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            polygon.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#3b82f6';
            polygon.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, Math.PI * 2); ctx.fill(); });

            const label = this.polygonNames[idx] || `Area ${idx + 1}`;
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px sans-serif';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.strokeText(label, polygon[0][0] + 8, polygon[0][1] - 6);
            ctx.fillText(label, polygon[0][0] + 8, polygon[0][1] - 6);
        });

        if (this.drawMode === 'poly') this.drawPreview();
    }

    clearPolygons() {
        this.polygons = [];
        this.polygonNames = [];
        this.currentPolygon = [];
        this.isDrawing = false;
        this.drawMode = null;
        this.drawStart = null;

        const canvas = document.getElementById('drawingCanvas');
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        canvas.classList.add('hidden');
        canvas.style.cursor = 'default';

        document.getElementById('drawRectBtn').textContent = 'Rectangulo';
        document.getElementById('drawPolyBtn').textContent = 'Poligono';
        document.getElementById('drawRectBtn').style.opacity = '1';
        document.getElementById('drawPolyBtn').style.opacity = '1';

        this.updatePolygonsList();
    }

    updatePolygonsList() {
        const list = document.getElementById('polygonsList');
        document.getElementById('polygonCount').textContent = this.polygons.length;

        if (this.polygons.length === 0) {
            list.innerHTML = '<p class="text-gray-500 text-xs">Sin areas definidas</p>';
            return;
        }
        list.innerHTML = this.polygons.map((polygon, idx) => {
            const w = Math.round(Math.max(...polygon.map(p => p[0])) - Math.min(...polygon.map(p => p[0])));
            const h = Math.round(Math.max(...polygon.map(p => p[1])) - Math.min(...polygon.map(p => p[1])));
            const name = this.polygonNames[idx] || `Area ${idx + 1}`;
            return `<div class="bg-blue-900/50 p-1.5 rounded text-xs flex items-center gap-1.5">
                <input type="text" value="${this.escapeHtml(name)}"
                    onchange="app.renamePolygon(${idx}, this.value)"
                    class="bg-blue-950/70 border border-blue-700 rounded px-1.5 py-0.5 text-xs text-white w-24 min-w-0 flex-1" />
                <span class="text-gray-400 whitespace-nowrap">${w}x${h}px</span>
                <button onclick="app.removePolygon(${idx})" class="text-red-400 hover:text-red-300 font-bold ml-1 flex-shrink-0">&times;</button>
            </div>`;
        }).join('');
    }

    removePolygon(idx) {
        this.polygons.splice(idx, 1);
        this.polygonNames.splice(idx, 1);
        this.redrawCanvas();
        this.updatePolygonsList();
    }

    renamePolygon(idx, name) {
        this.polygonNames[idx] = name.trim() || `Area ${idx + 1}`;
        this.redrawCanvas();
    }

    // --- Processing ---

    async processVideo() {
        const hasLocal = !!this.videoFile;
        const hasServer = !!this.serverFilename;
        if (!hasLocal && !hasServer) return alert('Carga o selecciona un video primero');
        if (this.videoWidth === 0 || this.canvasWidth === 0) return alert('Error: recarga el video');

        const scaleX = this.videoWidth / this.canvasWidth;
        const scaleY = this.videoHeight / this.canvasHeight;
        const formattedRegions = this.polygons.map(polygon => {
            const flat = [];
            polygon.forEach(p => { flat.push(Math.round(p[0] * scaleX)); flat.push(Math.round(p[1] * scaleY)); });
            return flat;
        });

        document.getElementById('processBtn').disabled = true;
        document.getElementById('progressContainer').classList.remove('hidden');

        try {
            let filename, originalName;

            if (hasServer) {
                // Video already on server - skip upload
                filename = this.serverFilename;
                originalName = this.serverVideoName;
            } else {
                // Upload local file
                const formData = new FormData();
                formData.append('video', this.videoFile);
                const uploadData = await (await fetch('/api/upload', { method: 'POST', body: formData })).json();
                if (!uploadData.success) return alert('Error al subir: ' + uploadData.error);
                filename = uploadData.filename;
                originalName = this.videoFile.name;
            }

            const processData = await (await fetch('/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename,
                    original_name: originalName,
                    regions: formattedRegions,
                    region_names: this.polygonNames,
                    conf_threshold: parseInt(document.getElementById('confidenceSlider').value) / 100,
                    frame_skip: parseInt(document.getElementById('frameSkipSlider').value),
                    model: document.getElementById('modelSelector').value + '.pt'
                })
            })).json();

            if (!processData.success) return alert('Error: ' + processData.error);

            this.jobId = processData.job_id;
            this.pollStatus();
        } catch (e) {
            alert('Error: ' + e.message);
            document.getElementById('processBtn').disabled = false;
            document.getElementById('progressContainer').classList.add('hidden');
        }
    }

    async pollStatus() {
        if (!this.jobId) return;
        try {
            const data = await (await fetch(`/api/status/${this.jobId}`)).json();
            if (data.status === 'processing') {
                const p = Math.min(data.progress, 99);
                document.getElementById('progressFill').style.width = p + '%';
                document.getElementById('progressPercent').textContent = Math.round(p) + '%';
                setTimeout(() => this.pollStatus(), 500);
            } else if (data.status === 'completed') {
                document.getElementById('progressFill').style.width = '100%';
                document.getElementById('progressPercent').textContent = '100%';
                this.loadResults();
            } else if (data.status === 'error') {
                alert('Error: ' + data.error);
                document.getElementById('progressContainer').classList.add('hidden');
                document.getElementById('processBtn').disabled = false;
            }
        } catch (e) {
            console.error('Poll error:', e);
        }
    }

    async loadResults() {
        try {
            const data = await (await fetch(`/api/results/${this.jobId}`)).json();
            if (data.success) {
                this.currentResults = data.results;
                this.displayResults();
                document.getElementById('progressContainer').classList.add('hidden');
                document.getElementById('processBtn').disabled = false;
                document.getElementById('resultsSection').classList.remove('hidden');
            } else {
                alert('Error: ' + (data.error || 'Unknown'));
                document.getElementById('progressContainer').classList.add('hidden');
                document.getElementById('processBtn').disabled = false;
            }
        } catch (e) {
            alert('Error: ' + e.message);
            document.getElementById('progressContainer').classList.add('hidden');
            document.getElementById('processBtn').disabled = false;
        }
    }

    displayResults() {
        const r = this.currentResults;
        if (!r) return;

        // Summary
        const details = document.getElementById('resultsDetails');
        details.innerHTML = `
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div class="bg-gray-700/50 rounded p-3">
                    <div class="text-2xl font-bold text-blue-400">${r.total_vehicles || 0}</div>
                    <div class="text-xs text-gray-400">Vehiculos Unicos</div>
                </div>
                <div class="bg-gray-700/50 rounded p-3">
                    <div class="text-2xl font-bold text-yellow-400">${r.total_frames || 0}</div>
                    <div class="text-xs text-gray-400">Frames</div>
                </div>
                <div class="bg-gray-700/50 rounded p-3">
                    <div class="text-2xl font-bold text-green-400">${r.fps ? r.fps.toFixed(1) : 0}</div>
                    <div class="text-xs text-gray-400">FPS</div>
                </div>
                <div class="bg-gray-700/50 rounded p-3">
                    <div class="text-2xl font-bold text-purple-400">${r.width || 0}x${r.height || 0}</div>
                    <div class="text-xs text-gray-400">Resolucion</div>
                </div>
            </div>
        `;

        // Chart
        const types = r.vehicles_by_type || {};
        if (Object.keys(types).length > 0) this.updateChart(types);

        // Regions
        this.updateRegionsSummary(r.vehicles_by_region || {});
    }

    updateChart(vehicleTypes) {
        const ctx = document.getElementById('typeChart').getContext('2d');
        if (this.typeChart) this.typeChart.destroy();
        this.typeChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(vehicleTypes).map(t => t.charAt(0).toUpperCase() + t.slice(1)),
                datasets: [{ data: Object.values(vehicleTypes), backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'] }]
            },
            options: { responsive: true, plugins: { legend: { labels: { color: '#e5e7eb' } } } }
        });
    }

    updateRegionsSummary(regions) {
        const el = document.getElementById('regionsSummary');
        if (Object.keys(regions).length === 0) {
            el.innerHTML = '<p class="text-gray-500 text-xs">Sin regiones de deteccion</p>';
            return;
        }
        el.innerHTML = Object.entries(regions).map(([region, data]) => {
            const total = Object.values(data.types || {}).reduce((s, c) => s + c, 0) || data.unique_count || data.count || 0;
            return `<div class="bg-gray-600/50 p-2.5 rounded">
                <p class="font-medium text-blue-300 text-xs">${region}</p>
                <p class="font-bold text-white">${total} vehiculos</p>
                <p class="text-xs text-gray-300 mt-1">${Object.entries(data.types || {}).map(([t, c]) => `${t}: ${c}`).join(' | ')}</p>
            </div>`;
        }).join('');
    }

    // --- Export ---

    exportCSV() {
        if (!this.currentResults || !this.jobId) return;
        window.location.href = `/api/export-csv/${this.jobId}`;
    }

    exportJSON() {
        if (!this.currentResults) return;
        const blob = new Blob([JSON.stringify(this.currentResults, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `datatrack_${this.jobId.slice(0, 8)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    async generateAnnotatedVideo() {
        if (!this.currentResults || !this.jobId) return;
        const btn = document.getElementById('generateVideoBtn');
        btn.disabled = true;
        btn.textContent = 'Generando...';
        document.getElementById('videoProgressContainer').classList.remove('hidden');

        try {
            const data = await (await fetch(`/api/generate-annotated-video/${this.jobId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    regions: this.polygons,
                    conf_threshold: parseFloat(document.getElementById('confidenceSlider').value) / 100,
                    frame_skip: parseInt(document.getElementById('frameSkipSlider').value),
                    model: document.getElementById('modelSelector').value + '.pt'
                })
            })).json();

            if (data.success) {
                setTimeout(() => { window.location.href = data.download_url; }, 500);
                btn.textContent = 'Descargado';
            } else {
                alert('Error: ' + data.error);
            }
        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            btn.disabled = false;
            document.getElementById('videoProgressContainer').classList.add('hidden');
            setTimeout(() => { btn.textContent = 'Video Anotado'; }, 2000);
        }
    }

    clearResults() {
        this.currentResults = null;
        this.jobId = null;
        document.getElementById('resultsSection').classList.add('hidden');
        if (this.typeChart) this.typeChart.destroy();
    }

    // --- History / Records ---

    async loadRecords(search = '') {
        const url = search ? `/api/records?search=${encodeURIComponent(search)}` : '/api/records';
        try {
            const data = await (await fetch(url)).json();
            this.renderRecordsTable(data.records || []);
        } catch (e) {
            console.error('Load records error:', e);
        }
    }

    renderRecordsTable(records) {
        const tbody = document.getElementById('recordsTableBody');
        const empty = document.getElementById('emptyRecords');

        if (records.length === 0) {
            tbody.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }
        empty.classList.add('hidden');

        tbody.innerHTML = records.map(r => {
            const date = new Date(r.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
            const statusBadge = r.status === 'completed'
                ? '<span class="badge badge-ok">Completo</span>'
                : r.status === 'error'
                    ? '<span class="badge badge-err">Error</span>'
                    : '<span class="badge badge-proc">Procesando</span>';
            const duration = r.duration ? this.formatDuration(r.duration) : '-';

            return `<tr class="record-row border-b border-gray-800">
                <td class="py-2.5 px-2">
                    <div class="font-medium text-sm">${this.escapeHtml(r.video_name)}</div>
                    <div class="text-xs text-gray-500">${duration}</div>
                </td>
                <td class="py-2.5 px-2 text-xs text-gray-400">${date}</td>
                <td class="py-2.5 px-2 text-xs">${(r.model || '').replace('.pt', '')}</td>
                <td class="py-2.5 px-2 text-center font-bold">${r.total_vehicles || '-'}</td>
                <td class="py-2.5 px-2 text-center">${statusBadge}</td>
                <td class="py-2.5 px-2 text-right">
                    <div class="flex gap-1 justify-end">
                        ${r.status === 'completed' ? `
                            <button onclick="app.viewRecord('${r.id}')" class="btn-primary px-2 py-1 rounded text-xs">Ver</button>
                            <button onclick="app.exportRecordCSV('${r.id}')" class="btn-gold px-2 py-1 rounded text-xs">CSV</button>
                        ` : ''}
                        <button onclick="app.deleteRecord('${r.id}')" class="btn-danger px-2 py-1 rounded text-xs">Eliminar</button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    async viewRecord(id) {
        try {
            const data = await (await fetch(`/api/records/${id}`)).json();
            if (!data.success) return;
            const r = data.record;

            document.getElementById('recordDetailTitle').textContent = r.video_name;
            const content = document.getElementById('recordDetailContent');

            const results = r.results || {};
            const types = results.vehicles_by_type || {};
            const regions = results.vehicles_by_region || {};

            content.innerHTML = `
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-4">
                    <div class="bg-gray-700/50 rounded p-3">
                        <div class="text-xl font-bold text-blue-400">${r.total_vehicles || 0}</div>
                        <div class="text-xs text-gray-400">Vehiculos</div>
                    </div>
                    <div class="bg-gray-700/50 rounded p-3">
                        <div class="text-xl font-bold text-yellow-400">${r.total_frames || 0}</div>
                        <div class="text-xs text-gray-400">Frames</div>
                    </div>
                    <div class="bg-gray-700/50 rounded p-3">
                        <div class="text-xl font-bold text-green-400">${r.fps ? Number(r.fps).toFixed(1) : 0}</div>
                        <div class="text-xs text-gray-400">FPS</div>
                    </div>
                    <div class="bg-gray-700/50 rounded p-3">
                        <div class="text-xl font-bold text-purple-400">${this.formatDuration(r.duration)}</div>
                        <div class="text-xs text-gray-400">Duracion</div>
                    </div>
                </div>
                ${Object.keys(types).length > 0 ? `
                    <div class="mb-3">
                        <p class="text-xs font-medium text-gray-400 mb-1">Por tipo:</p>
                        <div class="flex gap-2 flex-wrap">
                            ${Object.entries(types).map(([t, c]) => `<span class="bg-gray-700 px-2 py-1 rounded text-xs">${t}: <strong>${c}</strong></span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                ${Object.keys(regions).length > 0 ? `
                    <div>
                        <p class="text-xs font-medium text-gray-400 mb-1">Por region:</p>
                        ${Object.entries(regions).map(([reg, data]) => {
                            const total = Object.values(data.types || {}).reduce((s, c) => s + c, 0) || data.unique_count || 0;
                            return `<div class="bg-gray-600/50 p-2 rounded mb-1 text-xs">
                                <span class="text-blue-300">${reg}</span>: ${total} vehiculos
                                (${Object.entries(data.types || {}).map(([t, c]) => `${t}: ${c}`).join(', ')})
                            </div>`;
                        }).join('')}
                    </div>
                ` : ''}
                <div class="mt-3 flex gap-2">
                    <button onclick="app.exportRecordCSV('${id}')" class="btn-gold px-3 py-1.5 rounded text-xs">Descargar CSV</button>
                </div>
            `;

            document.getElementById('recordDetail').classList.remove('hidden');
            document.getElementById('recordDetail').scrollIntoView({ behavior: 'smooth' });
        } catch (e) {
            console.error('View record error:', e);
        }
    }

    closeRecordDetail() {
        document.getElementById('recordDetail').classList.add('hidden');
    }

    exportRecordCSV(id) {
        window.location.href = `/api/export-csv/${id}`;
    }

    async deleteRecord(id) {
        if (!confirm('Eliminar este registro y sus archivos?')) return;
        try {
            await fetch(`/api/records/${id}`, { method: 'DELETE' });
            this.loadRecords(document.getElementById('searchRecords').value);
            this.closeRecordDetail();
        } catch (e) {
            alert('Error al eliminar');
        }
    }

    // --- Video Picker ---

    async openVideoPicker() {
        document.getElementById('videoPickerModal').classList.remove('hidden');
        document.getElementById('videoPickerSearch').value = '';
        await this.loadVideoPicker();
        document.getElementById('videoPickerSearch').oninput = (e) => this.filterVideoPicker(e.target.value);
    }

    closeVideoPicker() {
        document.getElementById('videoPickerModal').classList.add('hidden');
    }

    async loadVideoPicker() {
        try {
            const data = await (await fetch('/api/videos')).json();
            this._allVideos = data.videos || [];
            this.renderVideoPickerList(this._allVideos);
        } catch (e) {
            document.getElementById('videoPickerList').innerHTML =
                '<tr><td colspan="4" class="text-center py-6 text-red-400">Error al cargar videos</td></tr>';
        }
    }

    filterVideoPicker(query) {
        const q = query.toLowerCase();
        const filtered = q
            ? this._allVideos.filter(v => v.display_name.toLowerCase().includes(q))
            : this._allVideos;
        this.renderVideoPickerList(filtered);
    }

    renderVideoPickerList(videos) {
        const tbody = document.getElementById('videoPickerList');
        if (videos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500">Sin videos subidos</td></tr>';
            return;
        }
        tbody.innerHTML = videos.map(v => {
            const date = new Date(v.modified).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
            const badge = v.registered
                ? '<span class="badge badge-ok">Registrado</span>'
                : '<span class="badge" style="background:#374151;color:#9ca3af;">Sin registro</span>';
            return `<tr class="record-row border-b border-gray-800">
                <td class="py-2.5 px-3">
                    <div class="font-medium text-sm truncate max-w-xs" title="${this.escapeHtml(v.display_name)}">${this.escapeHtml(v.display_name)}</div>
                    <div class="text-xs mt-0.5">${badge}</div>
                </td>
                <td class="py-2.5 px-3 text-center text-yellow-400 text-xs">${v.size_mb} MB</td>
                <td class="py-2.5 px-3 text-center text-gray-400 text-xs">${date}</td>
                <td class="py-2.5 px-3 text-right">
                    <button onclick="app.selectExistingVideo('${this.escapeHtml(v.filename)}', '${this.escapeHtml(v.display_name)}')"
                        class="btn-primary px-3 py-1.5 rounded text-xs">Seleccionar</button>
                </td>
            </tr>`;
        }).join('');
    }

    async selectExistingVideo(filename, displayName) {
        this.closeVideoPicker();

        // Set server video state - no local file needed
        this.videoFile = null;
        this.serverFilename = filename;
        this.serverVideoName = displayName;

        // Fetch video info from server
        try {
            const data = await (await fetch(`/api/videos/${encodeURIComponent(filename)}/info`)).json();
            if (!data.success) return alert('Error al cargar video');

            const info = data.video_info;
            this.videoWidth = info.width;
            this.videoHeight = info.height;

            // Show video from server URL
            const videoElement = document.getElementById('videoElement');
            videoElement.src = `/api/videos/${encodeURIComponent(filename)}`;

            document.getElementById('uploadArea').classList.add('hidden');
            document.getElementById('videoDisplay').classList.remove('hidden');
            document.getElementById('videoInfoBar').classList.remove('hidden');
            document.getElementById('videoInfoName').textContent = displayName;
            document.getElementById('videoControls').classList.remove('hidden');

            // Wait for metadata to set canvas dimensions
            const canvas = document.getElementById('drawingCanvas');
            const container = document.getElementById('videoDisplay');
            videoElement.addEventListener('loadedmetadata', () => {
                requestAnimationFrame(() => {
                    const rect = container.getBoundingClientRect();
                    this.canvasWidth = rect.width || container.offsetWidth || 640;
                    this.canvasHeight = rect.height || container.offsetHeight || 360;
                    canvas.width = this.canvasWidth;
                    canvas.height = this.canvasHeight;
                    this.redrawCanvas();
                });
            }, { once: true });

        } catch (e) {
            alert('Error: ' + e.message);
        }
    }

    resetVideoArea() {
        this.videoFile = null;
        this.serverFilename = null;
        this.serverVideoName = null;
        this.videoWidth = 0;
        this.videoHeight = 0;
        this.clearPolygons();

        const videoElement = document.getElementById('videoElement');
        videoElement.src = '';

        document.getElementById('uploadArea').classList.remove('hidden');
        document.getElementById('videoDisplay').classList.add('hidden');
        document.getElementById('videoInfoBar').classList.add('hidden');
        document.getElementById('videoControls').classList.add('hidden');
        document.getElementById('resultsSection').classList.add('hidden');
    }

    // --- Storage ---

    async loadStorage() {
        try {
            const data = await (await fetch('/api/storage')).json();
            if (!data.success) return;
            this._storageData = data;
            const u = data.uploads;

            document.getElementById('storTotalMb').textContent = u.total_mb + ' MB';
            document.getElementById('storOrphanMb').textContent = u.orphan_mb + ' MB';
            document.getElementById('storResultsMb').textContent = data.results_mb + ' MB';
            document.getElementById('storFileCount').textContent = u.count;

            const cleanBtn = document.getElementById('cleanOrphansBtn');
            cleanBtn.textContent = `Limpiar huerfanos (${u.orphan_count} archivos, ${u.orphan_mb} MB)`;
            cleanBtn.disabled = u.orphan_count === 0;

            this.renderStorageTable();
        } catch (e) {
            console.error('Storage load error:', e);
        }
    }

    renderStorageTable() {
        if (!this._storageData) return;
        const files = this._storageData.uploads.files;
        const orphansOnly = document.getElementById('showOrphansOnly').checked;
        const filtered = orphansOnly ? files.filter(f => f.orphan) : files;
        const tbody = document.getElementById('storageTableBody');

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-gray-500">${orphansOnly ? 'Sin archivos huerfanos' : 'Sin archivos'}</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(f => {
            const date = new Date(f.modified).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
            const nameParts = f.name.split('_');
            const displayName = nameParts.length > 1 ? nameParts.slice(1).join('_') : f.name;
            const statusBadge = f.orphan
                ? '<span class="badge badge-err">Sin registro</span>'
                : '<span class="badge badge-ok">Registrado</span>';

            return `<tr class="record-row border-b border-gray-800">
                <td class="py-2 px-2">
                    <div class="font-medium truncate max-w-xs" title="${this.escapeHtml(f.name)}">${this.escapeHtml(displayName)}</div>
                </td>
                <td class="py-2 px-2 text-center text-yellow-400 font-medium">${f.size_mb} MB</td>
                <td class="py-2 px-2 text-center text-gray-400">${date}</td>
                <td class="py-2 px-2 text-center">${statusBadge}</td>
                <td class="py-2 px-2 text-right">
                    <button onclick="app.deleteUploadFile('${this.escapeHtml(f.name)}')" class="btn-danger px-2 py-1 rounded text-xs">Eliminar</button>
                </td>
            </tr>`;
        }).join('');
    }

    async cleanOrphans() {
        const data = this._storageData;
        if (!data || data.uploads.orphan_count === 0) return;
        if (!confirm(`Eliminar ${data.uploads.orphan_count} archivos huerfanos (${data.uploads.orphan_mb} MB)?\nEsta accion no se puede deshacer.`)) return;

        try {
            const res = await (await fetch('/api/storage/cleanup-orphans', { method: 'DELETE' })).json();
            const msg = document.getElementById('storageMsg');
            msg.textContent = `Limpieza completa: ${res.deleted} archivos eliminados, ${res.freed_mb} MB liberados.`;
            msg.classList.remove('hidden');
            setTimeout(() => msg.classList.add('hidden'), 5000);
            this.loadStorage();
        } catch (e) {
            alert('Error al limpiar: ' + e.message);
        }
    }

    async deleteUploadFile(filename) {
        if (!confirm(`Eliminar "${filename}"?`)) return;
        try {
            const res = await (await fetch('/api/storage/delete-file', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            })).json();
            if (res.success) {
                this.loadStorage();
            } else {
                alert('Error: ' + res.error);
            }
        } catch (e) {
            alert('Error: ' + e.message);
        }
    }

    // --- Helpers ---

    formatDuration(seconds) {
        if (!seconds || seconds <= 0) return '-';
        const m = Math.floor(seconds / 60);
        const s = Math.round(seconds % 60);
        return m > 0 ? `${m}m ${s}s` : `${s}s`;
    }

    escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text || '';
        return d.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new DataTrackApp();
});
