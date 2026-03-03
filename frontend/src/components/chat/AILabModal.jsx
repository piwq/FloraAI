import React, { useState, useEffect } from 'react';
import { getAnnotatedImage, getUserProfile, updateUserProfile } from '../../services/apiClient';
import InteractivePlantCanvas from './InteractivePlantCanvas';

const AILabModal = ({ isOpen, onClose, messageId, initialImage, initialAnnotations = [] }) => {
  if (!isOpen) return null;

  const [localAnnotations, setLocalAnnotations] = useState(initialAnnotations);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('settings');

  // --- РЕЖИМЫ СКАНИРОВАНИЯ ---
  const [scanMode, setScanMode] = useState('express'); // 'express' | 'deep_scan' | 'ultra_scan'
  const [scanStep, setScanStep] = useState(0);

  const [settings, setSettings] = useState({
    yolo_conf: "0.25",
    yolo_iou: "0.7",
    yolo_imgsz: "1024",
    color_leaf: '#16A34A',
    color_root: '#9333EA',
    color_stem: '#2563EB',
    show_leaf: true,
    show_root: true,
    show_stem: true
  });

  const [showAdvancedAI, setShowAdvancedAI] = useState(false);

useEffect(() => {
    let interval;
    if (isAnnotating) {
      setScanStep(0);

      // УСКОРЕННАЯ АНИМАЦИЯ: меняем текст каждые 600 мс, т.к. сервер работает очень быстро!
      const stepDuration = 600;
      const maxSteps = scanMode === 'ultra_scan' ? ultraScanSteps.length - 1 : deepScanSteps.length - 1;

      if (scanMode !== 'express') {
        interval = setInterval(() => {
          setScanStep((prev) => (prev < maxSteps ? prev + 1 : prev));
        }, stepDuration);
      }
    }
    return () => clearInterval(interval);
  }, [isAnnotating, scanMode]);

  // Тексты для динамических лоадеров
  const deepScanSteps = [
    "Генерация оптических мутаций (1/5)...",
    "Анализ в глубоких тенях (CLAHE)...",
    "Голосование слоев нейросети...",
    "Построение 3D-топологии..."
  ];

  const ultraScanSteps = [
    "Нарезка сетки скользящего окна (SAHI)...",
    "Анализ микро-секторов (1-3/9)...",
    "Анализ микро-секторов (4-6/9)...",
    "Анализ микро-секторов (7-9/9)...",
    "Глобальный макро-прогон (CLAHE)...",
    "Синтез масок и NMS-сплавление...",
    "Хирургическое сращивание корней..."
  ];

  // Эффект для динамического лоадера
  useEffect(() => {
    let interval;
    if (isAnnotating) {
      setScanStep(0);
      const stepDuration = scanMode === 'ultra_scan' ? 5000 : 3000; // UltraScan идет дольше
      const maxSteps = scanMode === 'ultra_scan' ? ultraScanSteps.length - 1 : deepScanSteps.length - 1;

      if (scanMode !== 'express') {
        interval = setInterval(() => {
          setScanStep((prev) => (prev < maxSteps ? prev + 1 : prev));
        }, stepDuration);
      }
    }
    return () => clearInterval(interval);
  }, [isAnnotating, scanMode]);

  const handleGenerate = async () => {
    setIsAnnotating(true);
    setActiveTab('history');
    try {
      const payload = { ...settings, yolo_conf: parseFloat(settings.yolo_conf), yolo_iou: parseFloat(settings.yolo_iou), yolo_imgsz: parseInt(settings.yolo_imgsz, 10) };
      await updateUserProfile(payload);

      // Передаем выбранный режим в API
      const response = await getAnnotatedImage(messageId, scanMode);

      const newAnn = {
        id: response.data.id, image: response.data.annotated_image_url,
        conf: response.data.conf, iou: response.data.iou, imgsz: response.data.imgsz,
        segments: response.data.segments, leaves: response.data.leaves, stems: response.data.stems,
        scan_mode: response.data.scan_mode
      };
      setLocalAnnotations(prev => [newAnn, ...prev.filter(a => a.id !== newAnn.id)]);
      setActiveIndex(0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnnotating(false);
    }
  };

  const activeAnn = localAnnotations[activeIndex];

  const determineMode = (conf, iou) => {
    if (String(conf) === '0.1' && String(iou) === '0.5') return 'scout';
    if (String(conf) === '0.25' && String(iou) === '0.6') return 'lab';
    if (String(conf) === '0.4' && String(iou) === '0.7') return 'expert';
    return 'custom';
  };
  const currentMode = determineMode(settings.yolo_conf, settings.yolo_iou);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-md" onClick={onClose}>
      <div className="relative flex flex-col md:flex-row w-[95vw] max-w-[1600px] bg-white rounded-2xl overflow-hidden shadow-2xl h-[95vh] sm:h-[90vh]" onClick={e => e.stopPropagation()}>

        {/* ЛЕВАЯ ЧАСТЬ (КАНВАС) */}
        <div className="w-full md:w-[70%] bg-[#0f1115] flex items-center justify-center relative overflow-hidden">
          {activeAnn && !isAnnotating ? (
            <InteractivePlantCanvas
              imageUrl={activeAnn.image} segments={activeAnn.segments || []}
              leaves={activeAnn.leaves || []} stems={activeAnn.stems || []}
              settings={settings} metrics={activeAnn}
            />
          ) : (
            <div className="relative w-full h-full flex items-center justify-center p-8">
              <img src={initialImage} alt="Original" className={`max-w-full max-h-full object-contain rounded-lg ${isAnnotating ? 'opacity-20 blur-sm' : 'opacity-80'}`} />

              {/* --- ДИНАМИЧЕСКИЙ ЛОАДЕР --- */}
              {isAnnotating && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10 transition-all">
                  <div className="relative w-24 h-24 mb-6">
                    <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
                    <div className={`absolute inset-0 border-4 rounded-full animate-spin
                      ${scanMode === 'ultra_scan' ? 'border-red-500 border-t-transparent' :
                        scanMode === 'deep_scan' ? 'border-purple-500 border-t-transparent' : 'border-green-500 border-t-transparent'}`}>
                    </div>
                    {scanMode !== 'express' && (
                      <div className="absolute inset-0 flex items-center justify-center text-4xl animate-pulse">
                        {scanMode === 'ultra_scan' ? '🧬' : '🧠'}
                      </div>
                    )}
                  </div>

                  <p className="text-white font-bold text-xl tracking-wide text-center px-4">
                    {scanMode === 'ultra_scan' ? ultraScanSteps[scanStep] :
                     scanMode === 'deep_scan' ? deepScanSteps[scanStep] :
                     "Нейросеть анализирует биомассу..."}
                  </p>

                  {scanMode !== 'express' && (
                    <div className="w-72 bg-gray-800 h-2 rounded-full mt-6 overflow-hidden shadow-inner border border-white/10">
                      <div
                        className={`h-full transition-all duration-1000 ease-out ${scanMode === 'ultra_scan' ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-purple-500 to-blue-500'}`}
                        style={{ width: `${(scanStep + 1) * (100 / (scanMode === 'ultra_scan' ? ultraScanSteps.length : deepScanSteps.length))}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ПРАВАЯ ЧАСТЬ (НАСТРОЙКИ) */}
        <div className="w-full md:w-[30%] bg-gray-50 flex flex-col min-w-[340px] border-l border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-gray-100">
            <h3 className="font-black text-gray-800 text-lg flex items-center gap-2"><span className="text-2xl">🔬</span> Flora AI Lab</h3>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-red-100 hover:text-red-600 rounded-full text-gray-500 transition-colors">✕</button>
          </div>

          <div className="flex bg-white border-b border-gray-200">
            <button onClick={() => setActiveTab('settings')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'settings' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>Управление ИИ</button>
            <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'history' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>Версии ({localAnnotations.length})</button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* ВКЛАДКА ИСТОРИИ */}
            {activeTab === 'history' && (
              <div className="p-4 space-y-3">
                {localAnnotations.length === 0 ? (
                  <div className="text-center text-gray-400 mt-10 text-sm">Сначала сгенерируйте разметку</div>
                ) : (
                  localAnnotations.map((ann, idx) => (
                    <div key={ann.id} onClick={() => !isAnnotating && setActiveIndex(idx)} className={`flex items-center gap-3 p-3 cursor-pointer rounded-xl border-2 transition-all ${activeIndex === idx ? 'border-green-500 bg-green-50 shadow-md' : 'border-transparent bg-white shadow-sm hover:border-gray-200'}`}>
                      <img src={ann.image} className="w-16 h-16 rounded-lg object-cover bg-black" alt="preview" />
                      <div className="flex flex-col flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-gray-800 text-sm">Версия v{localAnnotations.length - idx}</span>
                          {ann.scan_mode === 'ultra_scan' && <span className="bg-red-100 text-red-700 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">UltraScan</span>}
                          {ann.scan_mode === 'deep_scan' && <span className="bg-purple-100 text-purple-700 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">DeepScan</span>}
                        </div>
                        <div className="flex gap-2 text-[10px] text-gray-500 uppercase font-bold">
                          <span className="bg-white border border-gray-200 px-1.5 py-0.5 rounded shadow-sm">Conf: {ann.conf}</span>
                          <span className="bg-white border border-gray-200 px-1.5 py-0.5 rounded shadow-sm">IoU: {ann.iou}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ВКЛАДКА НАСТРОЕК */}
            {activeTab === 'settings' && (
              <div className="p-5 space-y-6">

                {/* ПРЕСЕТЫ */}
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 block flex items-center gap-2">📷 Профиль сканирования</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div onClick={() => setSettings({ ...settings, yolo_conf: '0.1', yolo_iou: '0.5' })} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${currentMode === 'scout' ? 'border-green-500 bg-green-50 shadow-sm' : 'border-gray-100 hover:border-green-200'}`}>
                      <div className="text-2xl mb-2">🌱</div>
                      <div className={`font-bold text-sm ${currentMode === 'scout' ? 'text-green-800' : 'text-gray-800'}`}>Скаутинг</div>
                    </div>
                    <div onClick={() => setSettings({ ...settings, yolo_conf: '0.25', yolo_iou: '0.6' })} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${currentMode === 'lab' ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-100 hover:border-blue-200'}`}>
                      <div className="text-2xl mb-2">🔬</div>
                      <div className={`font-bold text-sm ${currentMode === 'lab' ? 'text-blue-800' : 'text-gray-800'}`}>Баланс</div>
                    </div>
                    <div onClick={() => setSettings({ ...settings, yolo_conf: '0.4', yolo_iou: '0.7' })} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${currentMode === 'expert' ? 'border-purple-500 bg-purple-50 shadow-sm' : 'border-gray-100 hover:border-purple-200'}`}>
                      <div className="text-2xl mb-2">🎓</div>
                      <div className={`font-bold text-sm ${currentMode === 'expert' ? 'text-purple-800' : 'text-gray-800'}`}>Эксперт</div>
                    </div>
                  </div>
                </div>

                {/* РУЧНЫЕ НАСТРОЙКИ (СКРЫТЫЕ) */}
                <div className="border border-gray-100 rounded-xl overflow-hidden bg-gray-50">
                  <button type="button" onClick={() => setShowAdvancedAI(!showAdvancedAI)} className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-widest hover:bg-gray-100 transition-colors">
                    Инженерные параметры <span>{showAdvancedAI ? '▲' : '▼'}</span>
                  </button>
                  {showAdvancedAI && (
                    <div className="p-5 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white animate-fade-in-up">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Порог уверенности (Conf)</span>
                          <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded shadow-sm">{settings.yolo_conf}</span>
                        </div>
                        <input
                          type="range" min="0.05" max="0.95" step="0.05"
                          value={settings.yolo_conf}
                          onChange={e => setSettings({...settings, yolo_conf: e.target.value})}
                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Радиус (IoU)</span>
                          <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded shadow-sm">{settings.yolo_iou}</span>
                        </div>
                        <input
                          type="range" min="0.1" max="0.9" step="0.05"
                          value={settings.yolo_iou}
                          onChange={e => setSettings({...settings, yolo_iou: e.target.value})}
                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                        />
                      </div>
                      <div className="md:col-span-2 pt-2 border-t border-gray-100">
                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-2 tracking-wider">Разрешение матрицы (IMGSZ)</label>
                        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                          {['480', '640', '1024', '2048'].map(size => (
                            <button
                              type="button" key={size}
                              onClick={() => setSettings({...settings, yolo_imgsz: size})}
                              className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${settings.yolo_imgsz === size ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ВИЗУАЛИЗАЦИЯ */}
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 block flex items-center gap-2">🎨 Палитра слоев</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['leaf', 'root', 'stem'].map(layer => {
                      const names = { leaf: 'Листья', root: 'Корни', stem: 'Стебли' };
                      const isVisible = settings[`show_${layer}`];
                      return (
                        <div key={layer} className={`flex flex-col items-center p-2.5 bg-white rounded-xl border shadow-sm transition-all ${!isVisible ? 'opacity-50 grayscale border-dashed' : 'border-gray-200'}`}>
                          <div className="flex justify-between w-full mb-2 px-1">
                            <span className="text-[10px] text-gray-500 uppercase font-bold">{names[layer]}</span>
                            <button type="button" onClick={() => setSettings({...settings, [`show_${layer}`]: !isVisible})} className="text-gray-400 hover:text-gray-800">{isVisible ? '👁️' : '🚫'}</button>
                          </div>
                          <input type="color" disabled={!isVisible} value={settings[`color_${layer}`]} onChange={e => setSettings({...settings, [`color_${layer}`]: e.target.value})} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                        </div>
                      )
                    })}
                  </div>
                </div>

              </div>
            )}
          </div>

          <div className="p-4 bg-white border-t border-gray-200">
            {/* ТУМБЛЕР РЕЖИМА СКАНИРОВАНИЯ (3 ПЕРЕДАЧИ) */}
            <div className="mb-4 bg-gray-50 p-1 rounded-xl flex border border-gray-200 shadow-inner">
              <button
                onClick={() => setScanMode('express')}
                className={`flex-1 py-2.5 rounded-lg text-[10px] uppercase tracking-wider font-black transition-all flex flex-col items-center justify-center gap-1 ${scanMode === 'express' ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <span className="text-xl">⚡</span> Express
              </button>
              <button
                onClick={() => setScanMode('deep_scan')}
                className={`flex-1 py-2.5 rounded-lg text-[10px] uppercase tracking-wider font-black transition-all flex flex-col items-center justify-center gap-1 ${scanMode === 'deep_scan' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <span className="text-xl">🧠</span> DeepScan
              </button>
              <button
                onClick={() => setScanMode('ultra_scan')}
                className={`flex-1 py-2.5 rounded-lg text-[10px] uppercase tracking-wider font-black transition-all flex flex-col items-center justify-center gap-1 ${scanMode === 'ultra_scan' ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <span className="text-xl">🧬</span> UltraScan
              </button>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isAnnotating}
              className={`w-full text-white py-4 rounded-xl text-sm font-bold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2
                ${scanMode === 'ultra_scan' ? 'bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600' :
                  scanMode === 'deep_scan' ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700' :
                  'bg-gray-900 hover:bg-black'}`}
            >
              {isAnnotating ? 'СКАНИРОВАНИЕ...' : 'ЗАПУСТИТЬ АНАЛИЗ'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AILabModal;