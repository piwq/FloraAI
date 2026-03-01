import React from 'react';

const Message = ({ role, content, image }) => {
  const isUser = role === 'user';

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[70%] rounded-2xl p-4 ${
        isUser ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800'
      }`}>

        {/* Если есть картинка - показываем её */}
        {image && (
          <img
            src={image}
            alt="Attachment"
            className="w-full h-auto rounded-lg mb-2 object-cover"
          />
        )}

        {/* Текст сообщения */}
        {content && <p className="whitespace-pre-wrap">{content}</p>}
      </div>
    </div>
  );
};

export default Message;