import React, { useState, useEffect } from 'react';
import { getAnnotatedImage } from '../../services/apiClient';

const Message = ({ id, role, content, image, annotations = [] }) => {
  const isUser = role === 'user';

  // Состояния
  const [localAnnotations, setLocalAnnotations] = useState(annotations);
  const [showModal, setShowModal] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0); // Индекс текущей открытой разметки
  const [error, setError] = useState(null);

  // Обновляем локальный стейт, если пропсы с бэкенда изменились (например, при загрузке истории)
  useEffect(() => {
    setLocalAnnotations(annotations);
  }, [annotations]);

  // Основная функция запроса новой разметки (или получения существующей)
  const handleGenerate = async () => {
    setIsAnnotating(true);
    setError(null);
    try {
      const response = await getAnnotatedImage(id);
      const newAnn = {
        id: response.data.id,
        image: response.data.annotated_image_url,
        conf: response.data.conf,
        iou: response.data.iou,
        imgsz: response.data.imgsz
      };

      setLocalAnnotations(prev => {
        // Проверяем, нет ли уже этой разметки в нашем списке
        const existsIndex = prev.findIndex(a => a.id === newAnn.id);
        if (existsIndex !== -1) {
          setActiveIndex(existsIndex); // Просто переключаемся на нее
          return prev;
        }
        // Если новая - добавляем в начало списка
        setActiveIndex(0);
        return [newAnn, ...prev];
      });

      setShowModal(true);
    } catch (err) {
      console.error("Ошибка при генерации разметки:", err);
      setError("Не удалось загрузить разметку");
    } finally {
      setIsAnnotating(false);
    }
  };

  // Открытие модалки по кнопке на фото в чате
  const handleOpenModal = () => {
    if (localAnnotations.length > 0) {
      setActiveIndex(0);
      setShowModal(true);
    } else {
      handleGenerate(); // Если разметок еще нет - сразу генерируем
    }
  };

  const activeAnn = localAnnotations[activeIndex];

  return (
    <>
      <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-[70%] rounded-2xl p-4 ${
          isUser ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800'
        }`}>

          {/* Картинка в самом чате */}
          {image && (
            <div className="relative mb-2 group">
              <img
                src={image}
                alt="Attachment"
                className="w-full h-auto rounded-lg object-cover"
              />
              <button
                onClick={handleOpenModal}
                disabled={isAnnotating}
                className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white text-xs px-3 py-1.5 rounded-lg backdrop-blur-sm transition-all disabled:opacity-50"
              >
                {isAnnotating
                  ? 'Рисуем контуры...'
                  : localAnnotations.length > 0
                    ? `Разметки ИИ (${localAnnotations.length})`
                    : 'Показать разметку ИИ'}
              </button>
            </div>
          )}

          {/* Текст и ошибки */}
          {content && <p className="whitespace-pre-wrap">{content}</p>}
          {error && <span className="text-red-200 text-xs mt-1 block">{error}</span>}
        </div>
      </div>

      {/* МОДАЛЬНОЕ ОКНО С ИСТОРИЕЙ */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="relative flex flex-col md:flex-row max-w-6xl w-full bg-white rounded-xl overflow-hidden shadow-2xl h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Кнопка закрытия */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 bg-white/50 hover:bg-white text-gray-800 rounded-full w-8 h-8 flex items-center justify-center z-50 transition-colors shadow"
            >
              ✕
            </button>

            {/* ЛЕВАЯ ЧАСТЬ: Основная картинка */}
            <div className="w-full md:w-3/4 bg-gray-900 flex items-center justify-center relative">
              {isAnnotating && !activeAnn ? (
                <div className="text-white flex flex-col items-center">
                  <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p>Генерация контуров...</p>
                </div>
              ) : (
                <>
                  <img
                    src={activeAnn?.image}
                    alt="Annotated"
                    className="w-full h-full object-contain"
                  />

                  {/* Бейджики с параметрами поверх фото */}
                  <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
                    <span className="bg-black/70 text-white px-2 py-1 rounded text-xs backdrop-blur-md">
                      Conf: {activeAnn?.conf}
                    </span>
                    <span className="bg-black/70 text-white px-2 py-1 rounded text-xs backdrop-blur-md">
                      IoU: {activeAnn?.iou}
                    </span>
                    <span className="bg-black/70 text-white px-2 py-1 rounded text-xs backdrop-blur-md">
                      Size: {activeAnn?.imgsz}px
                    </span>
                  </div>

                  {/* Лоадер поверх картинки, если запросили новую */}
                  {isAnnotating && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                       <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ПРАВАЯ ЧАСТЬ: Панель истории (Sidebar) */}
            <div className="w-full md:w-1/4 bg-gray-50 flex flex-col border-l border-gray-200">
              <div className="p-4 border-b border-gray-200 bg-white">
                <h3 className="font-bold text-gray-800 text-lg">Версии разметки</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Измените настройки профиля и нажмите кнопку ниже, чтобы применить их.
                </p>
              </div>

              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <button
                  onClick={handleGenerate}
                  disabled={isAnnotating}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 flex justify-center items-center"
                >
                  {isAnnotating ? 'Обработка...' : 'Сгенерировать новую'}
                </button>
              </div>

              {/* Список превьюшек */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {localAnnotations.map((ann, idx) => (
                  <div
                    key={ann.id}
                    onClick={() => !isAnnotating && setActiveIndex(idx)}
                    className={`cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                      activeIndex === idx
                        ? 'border-green-500 shadow-md ring-2 ring-green-500/20'
                        : 'border-transparent bg-white shadow-sm hover:border-gray-300'
                    } ${isAnnotating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="h-24 w-full bg-gray-200 relative">
                      <img src={ann.image} className="w-full h-full object-cover" alt="preview" />
                      {activeIndex === idx && <div className="absolute inset-0 bg-green-500/10"></div>}
                    </div>
                    <div className="p-2 flex justify-between items-center bg-white text-xs">
                      <div className="text-gray-600 font-medium">
                        C:{ann.conf} | I:{ann.iou}
                      </div>
                      <div className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                        {ann.imgsz}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Message;