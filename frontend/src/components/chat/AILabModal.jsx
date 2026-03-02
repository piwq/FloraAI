import React, { useState, useEffect } from 'react';
import { getAnnotatedImage, getUserProfile, updateUserProfile } from '../../services/apiClient';
import InteractivePlantCanvas from './InteractivePlantCanvas';

const AILabModal = ({ isOpen, onClose, messageId, initialImage, initialAnnotations = [] }) => {
  if (!isOpen) return null;

  const [localAnnotations, setLocalAnnotations] = useState(initialAnnotations);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('settings');

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

  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    getUserProfile().then(res => {
      const data = res.data;
      setSettings({
        yolo_conf: data.yolo_conf ? String(data.yolo_conf) : "0.25",
        yolo_iou: data.yolo_iou ? String(data.yolo_iou) : "0.7",
        yolo_imgsz: data.yolo_imgsz ? String(data.yolo_imgsz) : "1024",
        color_leaf: data.color_leaf || '#16A34A',
        color_root: data.color_root || '#9333EA',
        color_stem: data.color_stem || '#2563EB',
        show_leaf: true, show_root: true, show_stem: true
      });
      if (initialAnnotations.length > 0) setActiveTab('history');
    }).catch(err => console.error(err));
  }, [initialAnnotations]);

  const handleGenerate = async () => {
    setIsAnnotating(true);
    setActiveTab('history');
    try {
      const payload = { ...settings, yolo_conf: parseFloat(settings.yolo_conf), yolo_iou: parseFloat(settings.yolo_iou), yolo_imgsz: parseInt(settings.yolo_imgsz, 10) };
      await updateUserProfile(payload);
      const response = await getAnnotatedImage(messageId);
      const newAnn = {
        id: response.data.id, image: response.data.annotated_image_url,
        conf: response.data.conf, iou: response.data.iou, imgsz: response.data.imgsz,
        segments: response.data.segments, leaves: response.data.leaves, stems: response.data.stems
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

  // --- ЛОГИКА ПРЕСЕТОВ ---
  const determineMode = (conf, iou) => {
    if (conf === '0.1' && iou === '0.5') return 'scout';
    if (conf === '0.25' && iou === '0.6') return 'lab';
    if (conf === '0.4' && iou === '0.7') return 'expert';
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
              <img src={initialImage} alt="Original" className={`max-w-full max-h-full object-contain rounded-lg ${isAnnotating ? 'opacity-20' : 'opacity-80'}`} />
              {isAnnotating && (
                <div className="absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm z-10">
                  <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-white font-medium text-lg bg-black/50 px-4 py-2 rounded-lg">Нейросеть анализирует биомассу...</p>
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

            {activeTab === 'history' && (
              <div className="p-4 space-y-3">
                {localAnnotations.length === 0 ? (
                  <div className="text-center text-gray-400 mt-10 text-sm">Сначала сгенерируйте разметку</div>
                ) : (
                  localAnnotations.map((ann, idx) => (
                    <div key={ann.id} onClick={() => !isAnnotating && setActiveIndex(idx)} className={`flex items-center gap-3 p-3 cursor-pointer rounded-xl border-2 transition-all ${activeIndex === idx ? 'border-green-500 bg-green-50 shadow-md' : 'border-transparent bg-white shadow-sm hover:border-gray-200'}`}>
                      <img src={ann.image} className="w-16 h-16 rounded-lg object-cover bg-black" alt="preview" />
                      <div className="flex flex-col flex-1">
                        <span className="font-bold text-gray-800 text-sm mb-1">Версия v{localAnnotations.length - idx}</span>
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

            {activeTab === 'settings' && (
              <div className="p-5 space-y-6">

                {/* 1. БЛОК ПРЕСЕТОВ */}
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 block">Режим сканирования</label>
                  <div className="grid grid-cols-1 gap-2 mb-3">
                    <div onClick={() => setSettings({...settings, yolo_conf: '0.1', yolo_iou: '0.5'})} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${currentMode === 'scout' ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-green-300'}`}>
                      <div className="text-2xl">🌱</div>
                      <div>
                        <div className={`font-bold text-sm ${currentMode === 'scout' ? 'text-green-700' : 'text-gray-800'}`}>Скаутинг (Агрессивный)</div>
                        <div className="text-[10px] text-gray-500 leading-tight mt-0.5">Ищет даже тени и тончайшие волоски.</div>
                      </div>
                    </div>
                    <div onClick={() => setSettings({...settings, yolo_conf: '0.25', yolo_iou: '0.6'})} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${currentMode === 'lab' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
                      <div className="text-2xl">🔬</div>
                      <div>
                        <div className={`font-bold text-sm ${currentMode === 'lab' ? 'text-blue-700' : 'text-gray-800'}`}>Лаборатория (Баланс)</div>
                        <div className="text-[10px] text-gray-500 leading-tight mt-0.5">Оптимально для большинства снимков.</div>
                      </div>
                    </div>
                    <div onClick={() => setSettings({...settings, yolo_conf: '0.4', yolo_iou: '0.7'})} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${currentMode === 'expert' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white hover:border-purple-300'}`}>
                      <div className="text-2xl">🎓</div>
                      <div>
                        <div className={`font-bold text-sm ${currentMode === 'expert' ? 'text-purple-700' : 'text-gray-800'}`}>Эксперт (Строгий)</div>
                        <div className="text-[10px] text-gray-500 leading-tight mt-0.5">Выделяет только 100% уверенные корни.</div>
                      </div>
                    </div>
                  </div>

                  <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-gray-400 hover:text-gray-600 border-b border-dashed border-gray-300">
                    {showAdvanced ? 'Скрыть ручные параметры' : 'Настроить Conf/IoU вручную'}
                  </button>

                  {showAdvanced && (
                    <div className="mt-4 p-4 bg-white rounded-xl border border-gray-200 shadow-inner space-y-4">
                      <div>
                        <div className="flex justify-between mb-1"><span className="text-[10px] font-bold text-gray-500 uppercase">Точность (Conf)</span><span className="text-xs font-bold">{settings.yolo_conf}</span></div>
                        <input type="range" min="0.05" max="0.95" step="0.05" value={settings.yolo_conf} onChange={e => setSettings({...settings, yolo_conf: e.target.value})} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-800" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1"><span className="text-[10px] font-bold text-gray-500 uppercase">Перекрытие (IoU)</span><span className="text-xs font-bold">{settings.yolo_iou}</span></div>
                        <input type="range" min="0.1" max="0.9" step="0.05" value={settings.yolo_iou} onChange={e => setSettings({...settings, yolo_iou: e.target.value})} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-800" />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. БЛОК ОПТИКИ */}
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 block">Калибровка объектива</label>
                  <div className="bg-[#0f1115] p-3.5 rounded-xl flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-white text-xl">📷</div>
                      <div>
                        <div className="text-green-400 font-mono text-sm font-bold">1 px = 0.106 мм</div>
                        <div className="text-gray-400 text-[10px] mt-0.5">Матрица: Sony IMX • Дисторсия: Учтена</div>
                      </div>
                    </div>
                    <button className="text-[10px] bg-white/10 text-white font-bold px-3 py-1.5 rounded hover:bg-white/20 transition-colors">СЕТКА</button>
                  </div>
                </div>

                {/* 3. БЛОК IMGSZ */}
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 block">Разрешение анализа</label>
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                    {['480', '640', '1024', '2048'].map(size => (
                      <button
                        key={size}
                        onClick={() => setSettings({...settings, yolo_imgsz: size})}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${settings.yolo_imgsz === size ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. БЛОК ЦВЕТОВ */}
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 block">Визуализация слоев</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['leaf', 'root', 'stem'].map(layer => {
                      const names = { leaf: 'Листья', root: 'Корни', stem: 'Стебли' };
                      const isVisible = settings[`show_${layer}`];
                      return (
                        <div key={layer} className={`flex flex-col items-center p-2.5 bg-white rounded-xl border shadow-sm transition-all ${!isVisible ? 'opacity-50 grayscale border-dashed' : 'border-gray-200'}`}>
                          <div className="flex justify-between w-full mb-2 px-1">
                            <span className="text-[10px] text-gray-500 uppercase font-bold">{names[layer]}</span>
                            <button onClick={() => setSettings({...settings, [`show_${layer}`]: !isVisible})} className="text-gray-400 hover:text-gray-800">{isVisible ? '👁️' : '🚫'}</button>
                          </div>
                          <input type="color" disabled={!isVisible} value={settings[`color_${layer}`]} onChange={e => setSettings({...settings, [`color_${layer}`]: e.target.value})} className="w-8 h-8 rounded cursor-pointer border-0" />
                        </div>
                      )
                    })}
                  </div>
                </div>

              </div>
            )}
          </div>

          <div className="p-4 bg-white border-t border-gray-200">
            <button onClick={handleGenerate} disabled={isAnnotating} className="w-full bg-gray-900 hover:bg-black text-white py-4 rounded-xl text-sm font-bold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2">
              {isAnnotating ? 'СКАНИРОВАНИЕ...' : 'ЗАПУСТИТЬ АНАЛИЗ'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AILabModal;