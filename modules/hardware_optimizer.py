"""
Hardware Optimizer - Detección y optimización automática de hardware
"""
import torch
import psutil
import os
from multiprocessing import cpu_count


class HardwareOptimizer:
    """Detecta y optimiza según el hardware disponible"""
    
    def __init__(self):
        self.device = self._detect_device()
        self.cpu_cores = cpu_count()
        self.ram_gb = psutil.virtual_memory().total / (1024 ** 3)
        self.vram_gb = self._get_vram()
        self.profile = self._get_profile()
    
    def _detect_device(self):
        """Detecta si hay GPU disponible"""
        if torch.cuda.is_available():
            return torch.device('cuda')
        return torch.device('cpu')
    
    def _get_vram(self):
        """Obtiene VRAM disponible en GB"""
        if torch.cuda.is_available():
            return torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
        return 0
    
    def _get_profile(self):
        """Define el perfil de optimización según hardware"""
        is_gpu = self.device.type == 'cuda'
        
        if is_gpu:
            if self.vram_gb >= 8:
                return {
                    'name': 'GPU_HIGH',
                    'batch_size': 32,
                    'workers': min(8, self.cpu_cores - 2),
                    'device': 'cuda',
                    'frame_skip': 1,
                    'confidence': 0.5
                }
            else:
                return {
                    'name': 'GPU_LOW',
                    'batch_size': 16,
                    'workers': min(4, self.cpu_cores - 2),
                    'device': 'cuda',
                    'frame_skip': 2,
                    'confidence': 0.6
                }
        else:
            if self.cpu_cores >= 8:
                return {
                    'name': 'CPU_HIGH',
                    'batch_size': 8,
                    'workers': self.cpu_cores - 2,
                    'device': 'cpu',
                    'frame_skip': 3,
                    'confidence': 0.65
                }
            else:
                return {
                    'name': 'CPU_LOW',
                    'batch_size': 4,
                    'workers': max(1, self.cpu_cores - 1),
                    'device': 'cpu',
                    'frame_skip': 5,
                    'confidence': 0.7
                }
    
    def get_info(self):
        """Retorna información del hardware"""
        return {
            'device': str(self.device),
            'cpu_cores': self.cpu_cores,
            'ram_gb': round(self.ram_gb, 2),
            'vram_gb': round(self.vram_gb, 2),
            'profile': self.profile['name'],
            'batch_size': self.profile['batch_size'],
            'workers': self.profile['workers'],
            'frame_skip': self.profile['frame_skip']
        }
