import React from 'react';

const Message = ({ role, content, image }) => {
  const isUser = role === 'user';

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-4 ${isUser ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800'}`}>

        {/* Просто отображаем фото, если оно есть */}
        {image && (
          <img
            src={image}
            alt="Uploaded Plant"
            className="w-full max-w-md h-auto object-cover rounded-xl shadow-sm mb-2 border border-black/10"
          />
        )}

        {content && <p className="whitespace-pre-wrap text-sm">{content}</p>}
      </div>
    </div>
  );
};

export default Message;