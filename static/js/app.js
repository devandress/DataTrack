class DataTrackApp {
    constructor() {
        this.currentVideo = null;
        this.boundingBoxes = [];
        this.isDrawing = false;
        this.startPoint = null;
        this.canvas = null;
        this.ctx = null;
        this.videoElement = null;
        this.currentDrawingArea = null;
        this.colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
        this.colorIndex = 0;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupCanvas();
    }
    
    setupEventListeners() {
        // Upload de video
        const uploadArea = document.getElementById('uploadArea');
        const videoInput = document.getElementById('videoInput');
        
        uploadArea.addEventListener('click', () => videoInput.click());
        uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        
        videoInput.addEventListener('change', this.handleVideoUpload.bind(this));
        
        // Controles de video
        document.getElementById('playPauseBtn').addEventListener('click', this.togglePlayPause.bind(this));
        document.getElementById('addAreaBtn').addEventListener('click', this.startDrawingArea.bind(this));
        document.getElementById('clearAreasBtn').addEventListener('click', this.clearAreas.bind(this));
        document.getElementById('analyzeBtn').addEventListener('click', this.analyzeVideo.bind(this));
        
        // Modal
        document.getElementById('confirmAreaName').addEventListener('click', this.confirmAreaName.bind(this));
        document.getElementById('cancelAreaName').addEventListener('click', this.cancelAreaName.bind(this));
        
        // Enter key en modal
        document.getElementById('areaNameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.confirmAreaName();
        });
    }
    
    setupCanvas() {
        this.canvas = document.getElementById('videoCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.videoElement = document.getElementById('videoPlayer');
        
        // Eventos del canvas para dibujar
        this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.canvas.addEventListener('mousemove', this.draw.bind(this));
        this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        
        // Actualizar canvas cuando el video cambie
        this.videoElement.addEventListener('loadedmetadata', this.updateCanvasSize.bind(this));
        this.videoElement.addEventListener('timeupdate', this.updateCanvas.bind(this));
    }
    
    // Manejo de drag & drop
    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }
    
    handleDragLeave(e) {
        e.currentTarget.classList.remove('dragover');
    }
    
    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processVideoFile(files[0]);
        }
    }
    
    handleVideoUpload(e) {
        const file = e.target.files[0];
        if (file) {
            this.processVideoFile(file);
        }
    }
    
    async processVideoFile(file) {
        this.showLoading('Subiendo video...');
        
        const formData = new FormData();
        formData.append('video', file);
        
        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.currentVideo = result.video_info;
                this.displayVideoInfo(result.video_info);
                this.loadVideo(result.video_info.filename);
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            this.showError('Error al subir el video: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }
    
    displayVideoInfo(info) {
        document.getElementById('videoResolution').textContent = `${info.width}x${info.height}`;
        document.getElementById('videoDuration').textContent = `${Math.round(info.duration)}s`;
        document.getElementById('videoFPS').textContent = `${Math.round(info.fps)}`;
        document.getElementById('videoFrames').textContent = info.frame_count;
        
        document.getElementById('videoInfo').style.display = 'block';
    }
    
    loadVideo(filename) {
        const videoSource = document.getElementById('videoSource');
        videoSource.src = `/video/${filename}`;
        this.videoElement.load();
        
        document.getElementById('videoSection').style.display = 'block';
        this.videoElement.style.display = 'block';
    }
    
    updateCanvasSize() {
        const video = this.videoElement;
        this.canvas.width = video.videoWidth;
        this.canvas.height = video.videoHeight;
        this.canvas.style.width = video.offsetWidth + 'px';
        this.canvas.style.height = video.offsetHeight + 'px';
        this.updateCanvas();
    }
    
    updateCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawBoundingBoxes();
    }
    
    drawBoundingBoxes() {
        this.boundingBoxes.forEach((area, index) => {
            this.ctx.strokeStyle = area.color;
            this.ctx.fillStyle = area.color + '40'; // 25% opacity
            this.ctx.lineWidth = 3;
            
            // Dibujar rectángulo
            const rect = area.rect;
            this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
            
            // Dibujar etiqueta
            this.ctx.fillStyle = area.color;
            this.ctx.font = '16px Arial';
            this.ctx.fillText(area.name, rect.x + 5, rect.y - 5);
        });
    }
    
    togglePlayPause() {
        const btn = document.getElementById('playPauseBtn');
        if (this.videoElement.paused) {
            this.videoElement.play();
            btn.textContent = '⏸️ Pausar';
        } else {
            this.videoElement.pause();
            btn.textContent = '▶️ Reproducir';
        }
    }
    
    startDrawingArea() {
        if (!this.currentVideo) {
            this.showError('Primero carga un video');
            return;
        }
        
        this.canvas.style.cursor = 'crosshair';
        this.currentDrawingArea = {
            isActive: true,
            color: this.colors[this.colorIndex % this.colors.length]
        };
        this.colorIndex++;
        
        this.showInfo('Haz clic y arrastra para dibujar el área de análisis');
    }
    
    startDrawing(e) {
        if (!this.currentDrawingArea || !this.currentDrawingArea.isActive) return;
        
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        this.startPoint = {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }
    
    draw(e) {
        if (!this.isDrawing || !this.currentDrawingArea) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const currentPoint = {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
        
        // Redibujar todo
        this.updateCanvas();
        
        // Dibujar área actual
        this.ctx.strokeStyle = this.currentDrawingArea.color;
        this.ctx.fillStyle = this.currentDrawingArea.color + '40';
        this.ctx.lineWidth = 3;
        
        const width = currentPoint.x - this.startPoint.x;
        const height = currentPoint.y - this.startPoint.y;
        
        this.ctx.fillRect(this.startPoint.x, this.startPoint.y, width, height);
        this.ctx.strokeRect(this.startPoint.x, this.startPoint.y, width, height);
    }
    
    stopDrawing(e) {
        if (!this.isDrawing || !this.currentDrawingArea) return;
        
        this.isDrawing = false;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const endPoint = {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
        
        const width = endPoint.x - this.startPoint.x;
        const height = endPoint.y - this.startPoint.y;
        
        // Solo crear área si es suficientemente grande
        if (Math.abs(width) > 20 && Math.abs(height) > 20) {
            this.currentDrawingArea.rect = {
                x: Math.min(this.startPoint.x, endPoint.x),
                y: Math.min(this.startPoint.y, endPoint.y),
                width: Math.abs(width),
                height: Math.abs(height)
            };
            
            // Mostrar modal para nombrar el área
            this.showAreaNameModal();
        } else {
            this.currentDrawingArea = null;
            this.canvas.style.cursor = 'default';
            this.updateCanvas();
        }
    }
    
    showAreaNameModal() {
        document.getElementById('areaNameModal').style.display = 'flex';
        document.getElementById('areaNameInput').focus();
    }
    
    confirmAreaName() {
        const name = document.getElementById('areaNameInput').value.trim();
        if (!name) {
            this.showError('El nombre del área es requerido');
            return;
        }
        
        this.currentDrawingArea.name = name;
        this.currentDrawingArea.id = Date.now();
        
        // Convertir rectángulo a puntos de polígono
        const rect = this.currentDrawingArea.rect;
        this.currentDrawingArea.points = [
            [rect.x, rect.y],
            [rect.x + rect.width, rect.y],
            [rect.x + rect.width, rect.y + rect.height],
            [rect.x, rect.y + rect.height]
        ];
        
        this.boundingBoxes.push(this.currentDrawingArea);
        this.updateAreasList();
        this.saveAreas();
        
        // Limpiar
        this.currentDrawingArea = null;
        this.canvas.style.cursor = 'default';
        document.getElementById('areaNameModal').style.display = 'none';
        document.getElementById('areaNameInput').value = '';
        
        this.updateCanvas();
    }
    
    cancelAreaName() {
        this.currentDrawingArea = null;
        this.canvas.style.cursor = 'default';
        document.getElementById('areaNameModal').style.display = 'none';
        document.getElementById('areaNameInput').value = '';
        this.updateCanvas();
    }
    
    updateAreasList() {
        const areasList = document.getElementById('areasList');
        
        if (this.boundingBoxes.length === 0) {
            areasList.innerHTML = '<p class="no-areas">No hay áreas definidas. Haz clic en "Agregar Área" para comenzar.</p>';
            return;
        }
        
        areasList.innerHTML = this.boundingBoxes.map((area, index) => `
            <div class="area-card">
                <h4>
                    <span class="area-color" style="background-color: ${area.color}"></span>
                    ${area.name}
                </h4>
                <button class="area-delete" onclick="app.deleteArea(${index})">🗑️</button>
                <p>Posición: ${Math.round(area.rect.x)}, ${Math.round(area.rect.y)}</p>
                <p>Tamaño: ${Math.round(area.rect.width)}x${Math.round(area.rect.height)}</p>
            </div>
        `).join('');
    }
    
    deleteArea(index) {
        this.boundingBoxes.splice(index, 1);
        this.updateAreasList();
        this.updateCanvas();
        this.saveAreas();
    }
    
    clearAreas() {
        if (confirm('¿Estás seguro de que quieres eliminar todas las áreas?')) {
            this.boundingBoxes = [];
            this.updateAreasList();
            this.updateCanvas();
            this.saveAreas();
        }
    }
    
    async saveAreas() {
        try {
            await fetch('/save_areas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ areas: this.boundingBoxes })
            });
        } catch (error) {
            console.error('Error saving areas:', error);
        }
    }
    
    async analyzeVideo() {
        if (!this.currentVideo) {
            this.showError('Primero carga un video');
            return;
        }
        
        if (this.boundingBoxes.length === 0) {
            this.showError('Define al menos un área para analizar');
            return;
        }
        
        this.showLoading('Analizando video...');
        document.getElementById('resultsSection').style.display = 'block';
        document.getElementById('analysisProgress').style.display = 'block';
        
        // Simular progreso
        this.simulateProgress();
        
        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.displayResults(result.results);
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            this.showError('Error en el análisis: ' + error.message);
        } finally {
            this.hideLoading();
            document.getElementById('analysisProgress').style.display = 'none';
        }
    }
    
    simulateProgress() {
        let progress = 0;
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        const interval = setInterval(() => {
            progress += Math.random() * 10;
            if (progress > 90) progress = 90;
            
            progressFill.style.width = progress + '%';
            progressText.textContent = `Analizando video... ${Math.round(progress)}%`;
            
            if (progress >= 90) {
                clearInterval(interval);
            }
        }, 500);
    }
    
    displayResults(results) {
        const resultsGrid = document.getElementById('resultsGrid');
        
        let html = `
            <div class="result-card">
                <h3>📊 Resumen General</h3>
                <div class="result-number">${results.total_frames}</div>
                <p>Frames analizados</p>
                <p><strong>FPS:</strong> ${Math.round(results.fps)}</p>
            </div>
        `;
        
        // Resultados por área
        Object.entries(results.areas).forEach(([areaName, areaData]) => {
            html += `
                <div class="result-card">
                    <h3>🚗 ${areaName}</h3>
                    <div class="result-number">${areaData.count}</div>
                    <p>Vehículos detectados</p>
                    <p><strong>Detecciones:</strong> ${areaData.detections.length}</p>
                </div>
            `;
        });
        
        resultsGrid.innerHTML = html;
        
        // Mostrar detalles adicionales
        this.displayResultsDetails(results);
    }
    
    displayResultsDetails(results) {
        const detailsContainer = document.getElementById('resultsDetails');
        
        let html = '<h3>📋 Detalle por Área</h3>';
        
        Object.entries(results.areas).forEach(([areaName, areaData]) => {
            html += `
                <div class="result-card">
                    <h4>${areaName}</h4>
                    <p><strong>Total de vehículos:</strong> ${areaData.count}</p>
                    <p><strong>Detecciones únicas:</strong> ${areaData.detections.length}</p>
                    <p><strong>Promedio por frame:</strong> ${(areaData.count / results.total_frames * 10).toFixed(2)}</p>
                </div>
            `;
        });
        
        detailsContainer.innerHTML = html;
    }
    
    // Utilidades
    showLoading(text) {
        document.getElementById('loadingText').textContent = text;
        document.getElementById('loadingOverlay').style.display = 'flex';
    }
    
    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
    
    showError(message) {
        alert('Error: ' + message);
    }
    
    showInfo(message) {
        // Podrías implementar un sistema de notificaciones más elegante
        console.log('Info:', message);
    }
}

// Inicializar la aplicación
const app = new DataTrackApp();