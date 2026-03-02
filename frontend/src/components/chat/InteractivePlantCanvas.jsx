import React, { useState, useRef } from 'react';

const InteractivePlantCanvas = ({ imageUrl, segments = [] }) => {
  const [viewBox, setViewBox] = useState('0 0 1000 1000');
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const containerRef = useRef(null);

  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    setViewBox(`0 0 ${naturalWidth} ${naturalHeight}`);
  };

  // Вычисляем позицию мыши относительно экрана для красивого тултипа
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  return (
    // relative и inline-block заставляют div плотно облегать картинку
    <div ref={containerRef} className="relative inline-block max-w-full max-h-full">

      <img
        src={imageUrl}
        alt="Plant Analysis"
        className="max-w-full max-h-[85vh] object-contain block rounded-lg"
        onLoad={handleImageLoad}
      />

      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        viewBox={viewBox}
        preserveAspectRatio="none"
      >
        {segments.map((seg) => {
          const pointsStr = seg.path.map(p => `${p[0]},${p[1]}`).join(' ');
          const isPrimary = seg.type.includes("Первичный");
          const baseColor = isPrimary ? '#ef4444' : '#06b6d4'; // Красный или Циановый
          const isHovered = hoveredSegment?.id === seg.id;

          return (
            <g key={`group-${seg.id}`}>
              {/* 1. ВИДИМАЯ ЛИНИЯ */}
              <polyline
                points={pointsStr}
                fill="none"
                stroke={isHovered ? '#fbbf24' : baseColor}
                strokeWidth={isHovered ? 8 : (isPrimary ? 5 : 3)}
                className="pointer-events-none transition-all duration-200"
                strokeLinecap="round" strokeLinejoin="round"
              />

              {/* 2. НЕВИДИМАЯ ЗОНА ЗАХВАТА МЫШИ (Толщина 30px) */}
              <polyline
                points={pointsStr}
                fill="none"
                stroke="transparent"
                strokeWidth="30"
                className="pointer-events-auto cursor-crosshair"
                onMouseEnter={(e) => {
                  setHoveredSegment(seg);
                  setMousePos({ x: e.clientX, y: e.clientY });
                }}
                onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHoveredSegment(null)}
              />
            </g>
          );
        })}
      </svg>

      {/* ТУЛТИП (Всплывающая плашка) */}
      {hoveredSegment && (
        <div
          className="fixed z-[9999] bg-black/90 text-white text-sm p-4 rounded-xl shadow-2xl pointer-events-none border border-white/20 backdrop-blur-md transform -translate-x-1/2 -translate-y-full mt-[-20px] min-w-[200px]"
          style={{ left: mousePos.x, top: mousePos.y }}
        >
          <div className="font-black mb-2 text-green-400 border-b border-white/20 pb-1 uppercase tracking-wide">
            Корень #{hoveredSegment.id}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Тип:</span>
              <span className="font-medium text-right">{hoveredSegment.type}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Длина:</span>
              <span className="font-mono">{hoveredSegment.length_mm} мм</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Толщина (Ø):</span>
              <span className="font-mono">{hoveredSegment.thickness_mm} мм</span>
            </div>
            <div className="flex justify-between gap-4 text-yellow-300 pt-1">
              <span>3D Объем:</span>
              <span className="font-mono font-bold">{hoveredSegment.volume_mm3} мм³</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractivePlantCanvas;