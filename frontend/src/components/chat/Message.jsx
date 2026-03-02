import React, { useState } from 'react';
import { getAnnotatedImage } from '../../services/apiClient'; // Проверь правильность пути к файлу

const Message = ({ id, role, content, image }) => {
  const isUser = role === 'user';

  // Состояния для разметки
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotatedImg, setAnnotatedImg] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState(null);

  const handleShowAnnotation = async () => {
    // Если картинка уже была загружена ранее, просто показываем её
    if (annotatedImg) {
      setShowModal(true);
      return;
    }

    setIsAnnotating(true);
    setError(null);
    try {
      // Отправляем запрос на бэкенд (передаем ID этого сообщения)
      const response = await getAnnotatedImage(id);
      setAnnotatedImg(response.data.annotated_image_url);
      setShowModal(true);
    } catch (err) {
      console.error("Ошибка при получении разметки:", err);
      setError("Не удалось загрузить разметку");
    } finally {
      setIsAnnotating(false);
    }
  };

  return (
    <>
      <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-[70%] rounded-2xl p-4 ${
          isUser ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800'
        }`}>

          {/* Картинка с кнопкой поверх неё */}
          {image && (
            <div className="relative mb-2 group">
              <img
                src={image}
                alt="Attachment"
                className="w-full h-auto rounded-lg object-cover"
              />

              {/* Кнопка "Показать разметку ИИ" */}
              <button
                onClick={handleShowAnnotation}
                disabled={isAnnotating}
                className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white text-xs px-3 py-1.5 rounded-lg backdrop-blur-sm transition-all disabled:opacity-50"
              >
                {isAnnotating ? 'Рисуем контуры...' : 'Показать разметку ИИ'}
              </button>
            </div>
          )}

          {/* Текст сообщения */}
          {content && <p className="whitespace-pre-wrap">{content}</p>}

          {/* Сообщение об ошибке, если ML ничего не нашел */}
          {error && <span className="text-red-200 text-xs mt-1 block">{error}</span>}
        </div>
      </div>

      {/* Модальное окно (Попап) для отображения результата */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowModal(false)} // Закрыть при клике на фон
        >
          <div
            className="relative max-w-4xl w-full bg-white rounded-xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()} // Чтобы клик по картинке не закрывал окно
          >
            {/* Кнопка закрытия-крестик */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 bg-gray-100 hover:bg-gray-300 text-gray-800 rounded-full w-8 h-8 flex items-center justify-center z-10 transition-colors"
            >
              ✕
            </button>

            {/* Сама размеченная картинка */}
            <img
              src={annotatedImg}
              alt="Annotated Result"
              className="w-full h-auto max-h-[85vh] object-contain bg-gray-900"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Message;