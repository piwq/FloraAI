import React, { useState, useEffect } from 'react';
import { getAnnotatedImage, getUserProfile, updateUserProfile } from '../../services/apiClient';
import InteractivePlantCanvas from './InteractivePlantCanvas';

const AILabModal = ({ isOpen, onClose, messageId, initialImage, initialAnnotations = [] }) => {
  if (!isOpen) return null;

  const [localAnnotations, setLocalAnnotations] = useState(initialAnnotations);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('history');

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

  const [isManualSize, setIsManualSize] = useState(false);

  useEffect(() => {
    getUserProfile().then(res => {
      const data = res.data;
      const fetchedSizeStr = data.yolo_imgsz ? String(data.yolo_imgsz) : "1024";

      setSettings({
        yolo_conf: data.yolo_conf ? String(data.yolo_conf) : "0.25",
        yolo_iou: data.yolo_iou ? String(data.yolo_iou) : "0.7",
        yolo_imgsz: fetchedSizeStr,
        color_leaf: data.color_leaf || '#16A34A',
        color_root: data.color_root || '#9333EA',
        color_stem: data.color_stem || '#2563EB',
        show_leaf: true,
        show_root: true,
        show_stem: true
      });

      if (!["480", "640", "1024", "2048"].includes(fetchedSizeStr)) {
        setIsManualSize(true);
      } else {
        setIsManualSize(false);
      }
    }).catch(err => console.error("Ошибка загрузки профиля:", err));
  }, []);

  const handleGenerate = async () => {
    setIsAnnotating(true);
    setActiveTab('history');

    try {
      const finalSize = settings.yolo_imgsz.trim() === '' ? 1024 : parseInt(settings.yolo_imgsz, 10);
      const payload = {
        ...settings,
        yolo_conf: parseFloat(settings.yolo_conf),
        yolo_iou: parseFloat(settings.yolo_iou),
        yolo_imgsz: finalSize
      };

      setSettings(prev => ({ ...prev, yolo_imgsz: String(finalSize) }));
      await updateUserProfile(payload);

      const response = await getAnnotatedImage(messageId);
      const newAnn = {
        id: response.data.id,
        image: response.data.annotated_image_url,
        conf: response.data.conf,
        iou: response.data.iou,
        imgsz: response.data.imgsz,
        segments: response.data.segments // пробрасываем сегменты корней
      };

      setLocalAnnotations(prev => [newAnn, ...prev.filter(a => a.id !== newAnn.id)]);
      setActiveIndex(0);
    } catch (err) {
      console.error("Ошибка генерации:", err);
    } finally {
      setIsAnnotating(false);
    }
  };

  const handleSizeSelectChange = (e) => {
    const val = e.target.value;
    if (val === 'manual') {
      setIsManualSize(true);
    } else {
      setIsManualSize(false);
      setSettings({ ...settings, yolo_imgsz: val });
    }
  };

  const activeAnn = localAnnotations[activeIndex];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-md" onClick={onClose}>
      <div className="relative flex flex-col md:flex-row max-w-[1200px] w-full bg-white rounded-2xl overflow-hidden shadow-2xl h-[95vh] sm:h-[85vh]" onClick={e => e.stopPropagation()}>

        {/* --- ЛЕВАЯ ЧАСТЬ --- */}
        <div className="w-full md:w-[70%] bg-[#0f1115] flex items-center justify-center relative overflow-hidden p-4">
          {activeAnn && !isAnnotating ? (
            <>
              <InteractivePlantCanvas
                imageUrl={activeAnn.image}
                segments={activeAnn.segments || []}
                settings={settings}
              />
              <div className="absolute top-4 left-4 flex gap-2 pointer-events-none z-50">
                <span className="bg-black/50 border border-white/10 text-white px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md">Conf: {activeAnn.conf}</span>
                <span className="bg-black/50 border border-white/10 text-white px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md">IoU: {activeAnn.iou}</span>
                <span className="bg-black/50 border border-white/10 text-white px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md">{activeAnn.imgsz}px</span>
              </div>
            </>
          ) : (
            <img src={initialImage} alt="Original" className={`max-w-full max-h-full object-contain rounded-lg ${isAnnotating ? 'opacity-20' : 'opacity-80'}`} />
          )}

          {isAnnotating && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm z-10">
              <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-white font-medium text-lg">Нейросеть рисует...</p>
            </div>
          )}
        </div>

        {/* --- ПРАВАЯ ЧАСТЬ --- */}
        <div className="w-full md:w-[30%] bg-gray-50 flex flex-col min-w-[320px]">
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
            <h3 className="font-bold text-gray-800 flex items-center gap-2"><span className="text-xl">🔬</span> Лаборатория</h3>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors">✕</button>
          </div>

          <div className="flex bg-white border-b border-gray-200">
            <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'history' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500'}`}>Версии</button>
            <button onClick={() => setActiveTab('settings')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'settings' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500'}`}>Настройки</button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* ВКЛАДКА ИСТОРИИ */}
            {activeTab === 'history' && (
              <div className="p-4 space-y-3">
                {localAnnotations.length === 0 ? (
                  <div className="text-center text-gray-400 mt-10 text-sm">Нет разметок. Перейдите в настройки.</div>
                ) : (
                  localAnnotations.map((ann, idx) => (
                    <div key={ann.id} onClick={() => !isAnnotating && setActiveIndex(idx)} className={`flex items-center gap-3 p-2 cursor-pointer rounded-xl border-2 transition-all ${activeIndex === idx ? 'border-green-500 bg-green-50' : 'border-transparent bg-white shadow-sm hover:border-gray-200'}`}>
                      <img src={ann.image} className="w-16 h-16 rounded-lg object-cover bg-black" alt="preview" />
                      <div className="flex flex-col flex-1">
                        <span className="font-bold text-gray-800 text-sm mb-1">Версия {localAnnotations.length - idx}</span>
                        <div className="flex gap-2 text-[10px] text-gray-500 uppercase font-bold">
                          <span className="bg-gray-100 px-1.5 py-0.5 rounded">C: {ann.conf}</span>
                          <span className="bg-gray-100 px-1.5 py-0.5 rounded">I: {ann.iou}</span>
                          <span className="bg-gray-100 px-1.5 py-0.5 rounded">{ann.imgsz}</span>
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
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Точность (Conf)</label>
                    <span className="text-sm font-bold text-green-600">{settings.yolo_conf}</span>
                  </div>
                  <input type="range" min="0.05" max="0.95" step="0.05" value={settings.yolo_conf} onChange={e => setSettings({...settings, yolo_conf: e.target.value})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600" />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Перекрытие (IoU)</label>
                    <span className="text-sm font-bold text-green-600">{settings.yolo_iou}</span>
                  </div>
                  <input type="range" min="0.1" max="0.9" step="0.05" value={settings.yolo_iou} onChange={e => setSettings({...settings, yolo_iou: e.target.value})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600" />
                </div>

                <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">Размер (IMGSZ)</label>
                  <select
                    value={isManualSize ? 'manual' : settings.yolo_imgsz}
                    onChange={handleSizeSelectChange}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 font-medium outline-none focus:ring-2 focus:border-green-500 cursor-pointer"
                  >
                    <option value="480">480px (Быстро)</option>
                    <option value="640">640px (Оптимально)</option>
                    <option value="1024">1024px (Детально)</option>
                    <option value="2048">2048px (Максимум)</option>
                    <option value="manual">Свой размер...</option>
                  </select>
                  {isManualSize && (
                    <input
                      type="number" min="320" step="32" placeholder="Впишите число (напр. 1536)"
                      value={settings.yolo_imgsz}
                      onChange={e => setSettings({...settings, yolo_imgsz: e.target.value})}
                      className="w-full p-2.5 bg-gray-50 text-gray-900 font-bold border border-green-500 rounded-lg text-sm outline-none ring-4 ring-green-500/10 mt-3 placeholder-gray-400"
                    />
                  )}
                </div>

                {/* ЦВЕТА И СЛОИ С ГЛАЗИКАМИ */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">Цвета и Слои</label>
                  <div className="grid grid-cols-3 gap-3">
                    {/* ЛИСТЬЯ */}
                    <div className={`flex flex-col items-center p-3 bg-white rounded-xl border shadow-sm transition-all ${!settings.show_leaf ? 'opacity-50 grayscale border-dashed' : 'border-gray-200'}`}>
                      <div className="flex justify-between w-full mb-2 px-1">
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Листья</span>
                        <button onClick={() => setSettings({...settings, show_leaf: !settings.show_leaf})} className="text-gray-400 hover:text-gray-800">
                          {settings.show_leaf ? '👁️' : '🚫'}
                        </button>
                      </div>
                      <input type="color" disabled={!settings.show_leaf} value={settings.color_leaf} onChange={e => setSettings({...settings, color_leaf: e.target.value})} className="w-8 h-8 rounded cursor-pointer border-0" />
                    </div>
                    {/* КОРНИ */}
                    <div className={`flex flex-col items-center p-3 bg-white rounded-xl border shadow-sm transition-all ${!settings.show_root ? 'opacity-50 grayscale border-dashed' : 'border-gray-200'}`}>
                      <div className="flex justify-between w-full mb-2 px-1">
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Корни</span>
                        <button onClick={() => setSettings({...settings, show_root: !settings.show_root})} className="text-gray-400 hover:text-gray-800">
                          {settings.show_root ? '👁️' : '🚫'}
                        </button>
                      </div>
                      <input type="color" disabled={!settings.show_root} value={settings.color_root} onChange={e => setSettings({...settings, color_root: e.target.value})} className="w-8 h-8 rounded cursor-pointer border-0" />
                    </div>
                    {/* СТЕБЛИ */}
                    <div className={`flex flex-col items-center p-3 bg-white rounded-xl border shadow-sm transition-all ${!settings.show_stem ? 'opacity-50 grayscale border-dashed' : 'border-gray-200'}`}>
                      <div className="flex justify-between w-full mb-2 px-1">
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Стебли</span>
                        <button onClick={() => setSettings({...settings, show_stem: !settings.show_stem})} className="text-gray-400 hover:text-gray-800">
                          {settings.show_stem ? '👁️' : '🚫'}
                        </button>
                      </div>
                      <input type="color" disabled={!settings.show_stem} value={settings.color_stem} onChange={e => setSettings({...settings, color_stem: e.target.value})} className="w-8 h-8 rounded cursor-pointer border-0" />
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          <div className="p-4 bg-white border-t border-gray-200">
            <button onClick={handleGenerate} disabled={isAnnotating} className="w-full bg-green-600 hover:bg-green-700 text-white py-3.5 rounded-xl text-sm font-bold transition-all shadow-md disabled:opacity-50">
              {isAnnotating ? 'Генерация...' : 'Сгенерировать разметку'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AILabModal;