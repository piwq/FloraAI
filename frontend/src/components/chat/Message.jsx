import React, { useState, useEffect } from 'react';
import { getAnnotatedImage, getUserProfile, updateUserProfile } from '../../services/apiClient';

const Message = ({ id, role, content, image, annotations = [] }) => {
  const isUser = role === 'user';

  const [localAnnotations, setLocalAnnotations] = useState(annotations);
  const [showModal, setShowModal] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('history');

  const [settings, setSettings] = useState({
    yolo_conf: 0.25,
    yolo_iou: 0.7,
    yolo_imgsz: 1024,
    color_leaf: '#16A34A',
    color_root: '#9333EA',
    color_stem: '#2563EB'
  });
  const [isManualSize, setIsManualSize] = useState(false);

  useEffect(() => {
    setLocalAnnotations(annotations);
  }, [annotations]);

  useEffect(() => {
    if (showModal) {
      getUserProfile().then(res => {
        const data = res.data;
        const currentSize = parseInt(data.yolo_imgsz, 10) || 1024;

        setSettings({
          yolo_conf: parseFloat(data.yolo_conf) || 0.25,
          yolo_iou: parseFloat(data.yolo_iou) || 0.7,
          yolo_imgsz: currentSize,
          color_leaf: data.color_leaf || '#16A34A',
          color_root: data.color_root || '#9333EA',
          color_stem: data.color_stem || '#2563EB'
        });

        if (![480, 640, 1024, 2048].includes(currentSize)) {
          setIsManualSize(true);
        } else {
          setIsManualSize(false);
        }
      }).catch(err => console.error("Ошибка загрузки профиля", err));
    }
  }, [showModal]);

  const handleOpenModal = () => {
    setShowModal(true);
    if (localAnnotations.length > 0) setActiveIndex(0);
  };

  const handleGenerate = async () => {
    setIsAnnotating(true);
    setError(null);
    setActiveTab('history');

    try {
      await updateUserProfile(settings);
      const response = await getAnnotatedImage(id);

      const newAnn = {
        id: response.data.id,
        image: response.data.annotated_image_url,
        conf: response.data.conf,
        iou: response.data.iou,
        imgsz: response.data.imgsz
      };

      setLocalAnnotations(prev => {
        const existsIndex = prev.findIndex(a => a.id === newAnn.id);
        if (existsIndex !== -1) {
          setActiveIndex(existsIndex);
          return prev;
        }
        setActiveIndex(0);
        return [newAnn, ...prev];
      });
    } catch (err) {
      console.error("Ошибка генерации:", err);
      setError("Не удалось сгенерировать разметку");
    } finally {
      setIsAnnotating(false);
    }
  };

  const handleSizeChange = (e) => {
    const val = e.target.value;
    if (val === 'manual') {
      setIsManualSize(true);
    } else {
      setIsManualSize(false);
      setSettings({ ...settings, yolo_imgsz: parseInt(val) });
    }
  };

  const activeAnn = localAnnotations[activeIndex];

  return (
    <>
      <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-4 ${isUser ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800'}`}>

          {/* КОМПАКТНАЯ КАРТОЧКА ФОТО В ЧАТЕ */}
          {image && (
            <div
              onClick={handleOpenModal}
              className="flex items-center gap-3 bg-white/10 hover:bg-white/20 border border-white/20 p-2 rounded-xl cursor-pointer transition-all mb-2"
            >
              <img src={image} alt="Thumbnail" className="w-16 h-16 object-cover rounded-lg shadow-sm" />
              <div className="flex-1 pr-2">
                <p className={`text-sm font-bold ${isUser ? 'text-white' : 'text-gray-800'}`}>Фотография растения</p>
                <p className={`text-xs mt-1 ${isUser ? 'text-green-100' : 'text-gray-500'}`}>
                  {localAnnotations.length > 0 ? `Версий разметки: ${localAnnotations.length}` : 'Настроить ИИ-анализ'}
                </p>
              </div>
              <div className="bg-white/20 p-2 rounded-lg mr-1">
                 <span className="text-xl">🔬</span>
              </div>
            </div>
          )}

          {content && <p className="whitespace-pre-wrap text-sm">{content}</p>}
          {error && <span className="text-red-200 text-xs mt-1 block">{error}</span>}
        </div>
      </div>

      {/* МОДАЛЬНОЕ ОКНО */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-md" onClick={() => setShowModal(false)}>
          <div className="relative flex flex-col md:flex-row max-w-[1200px] w-full bg-white rounded-2xl overflow-hidden shadow-2xl h-[95vh] sm:h-[85vh]" onClick={e => e.stopPropagation()}>

            {/* ЛЕВАЯ ЧАСТЬ: Изображение */}
            <div className="w-full md:w-[70%] bg-[#0f1115] flex items-center justify-center relative">
              {isAnnotating && !activeAnn ? (
                <div className="text-white flex flex-col items-center">
                  <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="font-medium tracking-wide">Анализ изображения...</p>
                </div>
              ) : activeAnn ? (
                <>
                  <img src={activeAnn.image} alt="Annotated" className="w-full h-full object-contain" />
                  <div className="absolute top-4 left-4 flex gap-2 flex-wrap pointer-events-none">
                    <span className="bg-black/50 border border-white/10 text-white px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md shadow-lg">Conf: {activeAnn.conf}</span>
                    <span className="bg-black/50 border border-white/10 text-white px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md shadow-lg">IoU: {activeAnn.iou}</span>
                    <span className="bg-black/50 border border-white/10 text-white px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md shadow-lg">{activeAnn.imgsz}px</span>
                  </div>
                </>
              ) : (
                <img src={image} alt="Original" className="w-full h-full object-contain opacity-50" />
              )}

              {isAnnotating && activeAnn && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm z-10">
                  <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-white font-medium text-lg">Применяем параметры...</p>
                </div>
              )}
            </div>

            {/* ПРАВАЯ ЧАСТЬ: Сайдбар */}
            <div className="w-full md:w-[30%] bg-gray-50 flex flex-col border-l border-gray-200 min-w-[320px]">

              {/* Шапка сайдбара с крестиком */}
              <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
                <h3 className="font-bold text-gray-800">Лаборатория ИИ</h3>
                <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors">✕</button>
              </div>

              {/* Вкладки */}
              <div className="flex bg-white border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'history' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
                >
                  Версии
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'settings' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
                >
                  Настройки
                </button>
              </div>

              {/* Контент сайдбара */}
              <div className="flex-1 overflow-y-auto">

                {/* ВКЛАДКА: ИСТОРИЯ */}
                {activeTab === 'history' && (
                  <div className="p-4 space-y-3">
                    {localAnnotations.length === 0 ? (
                      <div className="text-center text-gray-400 mt-10 text-sm">Нет разметок. Перейдите в настройки.</div>
                    ) : (
                      localAnnotations.map((ann, idx) => (
                        <div
                          key={ann.id}
                          onClick={() => !isAnnotating && setActiveIndex(idx)}
                          className={`flex items-center gap-3 p-2 cursor-pointer rounded-xl border-2 transition-all ${
                            activeIndex === idx ? 'border-green-500 bg-green-50 shadow-sm' : 'border-transparent bg-white shadow-sm hover:border-gray-200'
                          } ${isAnnotating ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          <img src={ann.image} className="w-16 h-16 rounded-lg object-cover bg-black" alt="preview" />
                          <div className="flex flex-col flex-1">
                            <span className="font-bold text-gray-800 text-sm mb-1">Версия {localAnnotations.length - idx}</span>
                            <div className="flex gap-2 text-xs text-gray-500">
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

                {/* ВКЛАДКА: НАСТРОЙКИ */}
                {activeTab === 'settings' && (
                  <div className="p-5 space-y-6">
                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Точность (Conf)</label>
                        <span className="text-sm font-bold text-green-600">{settings.yolo_conf}</span>
                      </div>
                      <input type="range" min="0.05" max="0.95" step="0.05" value={settings.yolo_conf} onChange={e => setSettings({...settings, yolo_conf: parseFloat(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600" />
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Перекрытие (IoU)</label>
                        <span className="text-sm font-bold text-green-600">{settings.yolo_iou}</span>
                      </div>
                      <input type="range" min="0.1" max="0.9" step="0.05" value={settings.yolo_iou} onChange={e => setSettings({...settings, yolo_iou: parseFloat(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600" />
                    </div>

                    <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">Размер (IMGSZ)</label>
                      <select value={isManualSize ? 'manual' : settings.yolo_imgsz} onChange={handleSizeChange} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm mb-2 outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500">
                        <option value={480}>480px (Быстро)</option>
                        <option value={640}>640px (Оптимально)</option>
                        <option value={1024}>1024px (Детально)</option>
                        <option value={2048}>2048px (Максимум)</option>
                        <option value="manual">Свой размер...</option>
                      </select>
                      {isManualSize && (
                        <input type="number" min="320" step="32" placeholder="Например, 1536" value={settings.yolo_imgsz} onChange={e => setSettings({...settings, yolo_imgsz: parseInt(e.target.value) || 1024})} className="w-full p-2.5 bg-gray-50 border border-green-500 rounded-lg text-sm outline-none ring-4 ring-green-500/10 mt-2" />
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">Цвета заливки</label>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col items-center p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                          <input type="color" value={settings.color_leaf} onChange={e => setSettings({...settings, color_leaf: e.target.value})} className="w-8 h-8 rounded cursor-pointer mb-2 border-0" />
                          <span className="text-[10px] text-gray-500 uppercase font-bold">Листья</span>
                        </div>
                        <div className="flex flex-col items-center p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                          <input type="color" value={settings.color_root} onChange={e => setSettings({...settings, color_root: e.target.value})} className="w-8 h-8 rounded cursor-pointer mb-2 border-0" />
                          <span className="text-[10px] text-gray-500 uppercase font-bold">Корни</span>
                        </div>
                        <div className="flex flex-col items-center p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                          <input type="color" value={settings.color_stem} onChange={e => setSettings({...settings, color_stem: e.target.value})} className="w-8 h-8 rounded cursor-pointer mb-2 border-0" />
                          <span className="text-[10px] text-gray-500 uppercase font-bold">Стебли</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Кнопка генерации в самом низу */}
              <div className="p-4 bg-white border-t border-gray-200">
                <button
                  onClick={handleGenerate}
                  disabled={isAnnotating}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                >
                  {isAnnotating ? 'Генерация...' : 'Сгенерировать разметку'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Message;