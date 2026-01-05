/**
 * DataTrack - Sistema de Conteo de Vehículos con YOLO11
 * Frontend Application
 */

class DataTrackApp {
    constructor() {
        this.videoFile = null;
        this.polygons = [];
        this.isDrawing = false;
        this.currentPolygon = [];
        this.jobId = null;
        this.currentResults = null;
        this.typeChart = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadHardwareInfo();
    }
    
    setupEventListeners() {
        // Upload area
        const uploadArea = document.getElementById('uploadArea');
        const videoInput = document.getElementById('videoInput');
        
        uploadArea.addEventListener('click', () => videoInput.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('border-blue-400');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('border-blue-400');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('border-blue-400');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleVideoUpload(files[0]);
            }
        });
        
        videoInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleVideoUpload(e.target.files[0]);
            }
        });
        
        // Sliders
        document.getElementById('confidenceSlider').addEventListener('input', (e) => {
            document.getElementById('confValue').textContent = (e.target.value / 100).toFixed(2);
        });
        
        document.getElementById('frameSkipSlider').addEventListener('input', (e) => {
            document.getElementById('skipValue').textContent = e.target.value;
        });
        
        // Drawing tools
        document.getElementById('drawPolygonBtn').addEventListener('click', () => this.startDrawing());
        document.getElementById('clearPolygonBtn').addEventListener('click', () => this.clearPolygons());
        
        // Process button
        document.getElementById('processBtn').addEventListener('click', () => this.processVideo());
        
        // Export buttons
        document.getElementById('exportCsvBtn').addEventListener('click', () => this.exportCSV());
        document.getElementById('exportJsonBtn').addEventListener('click', () => this.exportJSON());
        document.getElementById('clearResultsBtn').addEventListener('click', () => this.clearResults());
        
        // Canvas for polygon drawing
        const canvas = document.getElementById('polygonCanvas');
        canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.completePolygon();
        });
    }
    
    async loadHardwareInfo() {
        try {
            const response = await fetch('/api/hardware-info');
            const data = await response.json();
            
            const info = `
                <p><strong>${data.device.toUpperCase()}</strong></p>
                <p class="text-xs">RAM: ${data.ram_gb}GB | VRAM: ${data.vram_gb}GB</p>
                <p class="text-xs">CPU: ${data.cpu_cores} núcleos</p>
                <p class="text-xs text-blue-400">Perfil: ${data.profile}</p>
            `;
            document.getElementById('hardwareInfo').innerHTML = info;
        } catch (e) {
            console.error('Error loading hardware info:', e);
        }
    }
    
    async handleVideoUpload(file) {
        if (!file.type.startsWith('video/')) {
            alert('Por favor selecciona un archivo de video');
            return;
        }
        
        this.videoFile = file;
        
        // Show video
        const videoElement = document.getElementById('videoElement');
        videoElement.src = URL.createObjectURL(file);
        
        document.getElementById('uploadArea').classList.add('hidden');
        document.getElementById('videoDisplay').classList.remove('hidden');
        document.getElementById('videoControls').classList.remove('hidden');
        document.getElementById('processBtn').disabled = false;
        
        // Setup canvas for drawing
        const canvas = document.getElementById('polygonCanvas');
        const container = document.getElementById('videoDisplay');
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
    }
    
    startDrawing() {
        if (!this.videoFile) {
            alert('Carga un video primero');
            return;
        }
        
        this.isDrawing = true;
        this.currentPolygon = [];
        const canvas = document.getElementById('polygonCanvas');
        canvas.classList.remove('hidden');
        
        alert('Haz clic en el video para marcar los puntos del polígono. Haz clic derecho cuando termines.');
    }
    
    handleCanvasClick(e) {
        if (!this.isDrawing) return;
        
        const canvas = document.getElementById('polygonCanvas');
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.currentPolygon.push([x, y]);
        this.drawCanvas();
    }
    
    completePolygon() {
        if (this.currentPolygon.length < 3) {
            alert('Un polígono necesita al menos 3 puntos');
            return;
        }
        
        this.polygons.push([...this.currentPolygon]);
        this.currentPolygon = [];
        this.isDrawing = false;
        this.drawCanvas();
        this.updatePolygonsList();
        
        document.getElementById('polygonCanvas').classList.add('hidden');
    }
    
    drawCanvas() {
        const canvas = document.getElementById('polygonCanvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw completed polygons
        this.polygons.forEach((polygon, idx) => {
            ctx.fillStyle = `rgba(59, 130, 246, 0.1)`;
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            
            ctx.beginPath();
            polygon.forEach((point, i) => {
                if (i === 0) ctx.moveTo(point[0], point[1]);
                else ctx.lineTo(point[0], point[1]);
            });
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // Draw points
            polygon.forEach(point => {
                ctx.fillStyle = '#3b82f6';
                ctx.beginPath();
                ctx.arc(point[0], point[1], 4, 0, Math.PI * 2);
                ctx.fill();
            });
            
            // Label
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Arial';
            ctx.fillText(`Región ${idx + 1}`, polygon[0][0], polygon[0][1] - 10);
        });
        
        // Draw current polygon
        if (this.currentPolygon.length > 0) {
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.beginPath();
            this.currentPolygon.forEach((point, i) => {
                if (i === 0) ctx.moveTo(point[0], point[1]);
                else ctx.lineTo(point[0], point[1]);
            });
            ctx.stroke();
            
            // Draw points
            this.currentPolygon.forEach(point => {
                ctx.fillStyle = '#10b981';
                ctx.beginPath();
                ctx.arc(point[0], point[1], 5, 0, Math.PI * 2);
                ctx.fill();
            });
        }
    }
    
    clearPolygons() {
        this.polygons = [];
        this.currentPolygon = [];
        this.isDrawing = false;
        
        const canvas = document.getElementById('polygonCanvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.classList.add('hidden');
        
        this.updatePolygonsList();
    }
    
    updatePolygonsList() {
        const list = document.getElementById('polygonsList');
        const count = document.getElementById('polygonCount');
        
        count.textContent = this.polygons.length;
        
        if (this.polygons.length === 0) {
            list.innerHTML = '<p class="text-gray-400 text-sm">No hay polígonos dibujados</p>';
            return;
        }
        
        list.innerHTML = this.polygons.map((polygon, idx) => `
            <div class="bg-gray-600 p-2 rounded text-sm flex justify-between items-center">
                <span>📍 Región ${idx + 1}</span>
                <button onclick="app.removePolygon(${idx})" class="text-red-400 hover:text-red-300">✕</button>
            </div>
        `).join('');
    }
    
    removePolygon(idx) {
        this.polygons.splice(idx, 1);
        this.drawCanvas();
        this.updatePolygonsList();
    }
    
    async processVideo() {
        if (!this.videoFile) {
            alert('Carga un video primero');
            return;
        }
        
        // Upload video
        const formData = new FormData();
        formData.append('video', this.videoFile);
        
        document.getElementById('processBtn').disabled = true;
        document.getElementById('progressContainer').classList.remove('hidden');
        
        try {
            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            const uploadData = await uploadResponse.json();
            if (!uploadData.success) {
                alert('Error al subir video: ' + uploadData.error);
                return;
            }
            
            // Process video
            const conf = parseInt(document.getElementById('confidenceSlider').value) / 100;
            const frameSkip = parseInt(document.getElementById('frameSkipSlider').value);
            
            const processResponse = await fetch('/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: uploadData.filename,
                    regions: this.polygons,
                    conf_threshold: conf,
                    frame_skip: frameSkip
                })
            });
            
            const processData = await processResponse.json();
            if (!processData.success) {
                alert('Error al procesar: ' + processData.error);
                return;
            }
            
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
            const response = await fetch(`/api/status/${this.jobId}`);
            const data = await response.json();
            
            if (data.status === 'processing') {
                const progress = Math.min(data.progress, 99);
                document.getElementById('progressFill').style.width = progress + '%';
                document.getElementById('progressPercent').textContent = Math.round(progress) + '%';
                
                setTimeout(() => this.pollStatus(), 500);
            } else if (data.status === 'completed') {
                document.getElementById('progressFill').style.width = '100%';
                document.getElementById('progressPercent').textContent = '100%';
                
                this.loadResults();
            } else if (data.status === 'error') {
                alert('Error en procesamiento: ' + data.error);
                document.getElementById('progressContainer').classList.add('hidden');
                document.getElementById('processBtn').disabled = false;
            }
        } catch (e) {
            console.error('Error polling status:', e);
        }
    }
    
    async loadResults() {
        try {
            const response = await fetch(`/api/results/${this.jobId}`);
            const data = await response.json();
            
            if (data.success) {
                this.currentResults = data.results;
                this.displayResults();
                
                document.getElementById('progressContainer').classList.add('hidden');
                document.getElementById('processBtn').disabled = false;
                document.getElementById('resultsSection').classList.remove('hidden');
            }
        } catch (e) {
            console.error('Error loading results:', e);
        }
    }
    
    displayResults() {
        const results = this.currentResults;
        
        // Update summary - Mostrar ÚNICOS
        document.getElementById('totalVehicles').textContent = results.total_vehicles;
        document.getElementById('carCount').textContent = results.vehicles_by_type_unique.car || 0;
        document.getElementById('motoCount').textContent = results.vehicles_by_type_unique.motorcycle || 0;
        
        const otherCount = (results.vehicles_by_type_unique.bus || 0) + (results.vehicles_by_type_unique.truck || 0);
        document.getElementById('otherCount').textContent = otherCount;
        
        // Update chart con datos ÚNICOS
        this.updateChart(results.vehicles_by_type_unique);
        
        // Update regions
        this.updateRegionsSummary(results.vehicles_by_region);
        
        // Mostrar información adicional sobre detecciones vs únicos
        this.showDetectionStats(results);
    }
    
    showDetectionStats(results) {
        //Mostrar estadísticas de detecciones vs vehículos únicos
        const detailsContainer = document.getElementById('resultsDetails');
        if (!detailsContainer) return;
        
        let statsHtml = '<div class="bg-yellow-900 border border-yellow-600 rounded-lg p-4 mb-4">';
        statsHtml += '<h4 class="font-bold text-yellow-200 mb-2">📊 Aclaración sobre los Números</h4>';
        statsHtml += '<div class="text-sm text-yellow-100 space-y-2">';
        statsHtml += '<p><strong>Vehículos Únicos:</strong> Cantidad real de vehículos diferentes detectados</p>';
        statsHtml += '<table class="w-full text-left mt-2 border-collapse">';
        statsHtml += '<tr class="border-b border-yellow-700">';
        statsHtml += '<td class="py-1">• Carros únicos:</td>';
        statsHtml += '<td class="font-bold">' + (results.vehicles_by_type_unique.car || 0) + '</td>';
        statsHtml += '</tr>';
        statsHtml += '<tr class="border-b border-yellow-700">';
        statsHtml += '<td class="py-1">• Motos únicas:</td>';
        statsHtml += '<td class="font-bold">' + (results.vehicles_by_type_unique.motorcycle || 0) + '</td>';
        statsHtml += '</tr>';
        statsHtml += '<tr class="border-b border-yellow-700">';
        statsHtml += '<td class="py-1">• Buses únicos:</td>';
        statsHtml += '<td class="font-bold">' + (results.vehicles_by_type_unique.bus || 0) + '</td>';
        statsHtml += '</tr>';
        statsHtml += '<tr class="border-b border-yellow-700">';
        statsHtml += '<td class="py-1">• Camiones únicos:</td>';
        statsHtml += '<td class="font-bold">' + (results.vehicles_by_type_unique.truck || 0) + '</td>';
        statsHtml += '</tr>';
        statsHtml += '</table>';
        
        statsHtml += '<p class="mt-4 pt-2 border-t border-yellow-700"><strong>Detecciones (instancias):</strong> Número de veces que se detectó cada tipo (puede contar el mismo vehículo en múltiples frames)</p>';
        statsHtml += '<table class="w-full text-left mt-2 border-collapse">';
        statsHtml += '<tr class="border-b border-yellow-700">';
        statsHtml += '<td class="py-1">• Detecciones de carros:</td>';
        statsHtml += '<td class="font-bold">' + (results.vehicles_by_type.car || 0) + '</td>';
        statsHtml += '</tr>';
        statsHtml += '<tr class="border-b border-yellow-700">';
        statsHtml += '<td class="py-1">• Detecciones de motos:</td>';
        statsHtml += '<td class="font-bold">' + (results.vehicles_by_type.motorcycle || 0) + '</td>';
        statsHtml += '</tr>';
        statsHtml += '</table>';
        
        // Calcular promedio
        const carDetections = results.vehicles_by_type.car || 0;
        const carUnique = results.vehicles_by_type_unique.car || 1;
        const avgFrames = Math.round(carDetections / carUnique);
        
        statsHtml += '<p class="mt-4 pt-2 border-t border-yellow-700 text-xs">';
        statsHtml += '📌 En promedio, cada carro fue detectado en ~' + avgFrames + ' frames diferentes';
        statsHtml += '</p>';
        
        statsHtml += '</div></div>';
        
        // Insertar antes de otros detalles
        detailsContainer.insertAdjacentHTML('beforeend', statsHtml);
    }
    
    updateChart(vehicleTypes) {
        const ctx = document.getElementById('typeChart').getContext('2d');
        
        if (this.typeChart) {
            this.typeChart.destroy();
        }
        
        this.typeChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(vehicleTypes).map(t => t.charAt(0).toUpperCase() + t.slice(1)),
                datasets: [{
                    data: Object.values(vehicleTypes),
                    backgroundColor: [
                        '#3b82f6',
                        '#10b981',
                        '#f59e0b',
                        '#ef4444'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: { color: '#e5e7eb' }
                    }
                }
            }
        });
    }
    
    updateRegionsSummary(regions) {
        const summary = document.getElementById('regionsSummary');
        
        if (Object.keys(regions).length === 0) {
            summary.innerHTML = '<p class="text-gray-400 text-sm">No se definieron regiones</p>';
            return;
        }
        
        summary.innerHTML = Object.entries(regions).map(([region, data]) => `
            <div class="bg-gray-600 p-3 rounded">
                <p class="font-semibold text-blue-400">${region}</p>
                <p class="text-sm">Total: ${data.count}</p>
                <p class="text-xs text-gray-300">
                    ${Object.entries(data.types || {})
                        .map(([type, count]) => `${type}: ${count}`)
                        .join(', ')}
                </p>
            </div>
        `).join('');
    }
    
    exportCSV() {
        if (!this.currentResults) {
            alert('No hay resultados para exportar');
            return;
        }
        
        if (!this.jobId) return;
        
        window.location.href = `/api/export-csv/${this.jobId}`;
    }
    
    exportJSON() {
        if (!this.currentResults) {
            alert('No hay resultados para exportar');
            return;
        }
        
        const dataStr = JSON.stringify(this.currentResults, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `results_${this.jobId}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }
    
    clearResults() {
        this.currentResults = null;
        this.jobId = null;
        document.getElementById('resultsSection').classList.add('hidden');
        
        if (this.typeChart) {
            this.typeChart.destroy();
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DataTrackApp();
    console.log('🚗 DataTrack Iniciado');
});
