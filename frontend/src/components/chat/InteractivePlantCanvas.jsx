import React, { useState, useEffect } from 'react';

const InteractivePlantCanvas = ({ imageUrl, segments = [], colorRoot = '#9333EA' }) => {
  const [viewBox, setViewBox] = useState('0 0 1000 1000');
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  // Слушаем нажатие клавиши CTRL
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Control') setIsCtrlPressed(true); };
    const handleKeyUp = (e) => { if (e.key === 'Control') setIsCtrlPressed(false); };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    setViewBox(`0 0 ${naturalWidth} ${naturalHeight}`);
  };

  // --- ЛОГИКА ГРУППИРОВКИ ДАННЫХ ДЛЯ ТУЛТИПА ---
  let tooltipData = null;
  if (hoveredSegment) {
    if (isCtrlPressed) {
      // Если нажат CTRL, собираем ВСЕ корни того же типа (Первичные или Латеральные)
      const groupSegments = segments.filter(s => s.type === hoveredSegment.type);

      const totalLength = groupSegments.reduce((sum, s) => sum + s.length_mm, 0);
      const totalVolume = groupSegments.reduce((sum, s) => sum + s.volume_mm3, 0);
      const avgThickness = groupSegments.reduce((sum, s) => sum + s.thickness_mm, 0) / groupSegments.length;

      tooltipData = {
        title: hoveredSegment.type.includes("Первичный") ? "Стержневая система" : "Латеральная сеть",
        isGroup: true,
        type: hoveredSegment.type,
        length: totalLength.toFixed(2),
        thickness: avgThickness.toFixed(3),
        volume: totalVolume.toFixed(2),
        count: groupSegments.length
      };
    } else {
      // Обычное наведение (один кусочек)
      tooltipData = {
        title: `Сегмент корня #${hoveredSegment.id}`,
        isGroup: false,
        type: hoveredSegment.type,
        length: hoveredSegment.length_mm.toFixed(2),
        thickness: hoveredSegment.thickness_mm.toFixed(3),
        volume: hoveredSegment.volume_mm3.toFixed(2),
        count: 1
      };
    }
  }

  return (
    <div className="relative inline-block max-w-full max-h-full cursor-crosshair group">

      {/* Подсказка для пользователя (видно только при наведении на картинку) */}
      <div className="absolute top-4 right-4 z-10 bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md pointer-events-none border border-white/10">
        Удерживайте <kbd className="bg-white/20 px-1.5 py-0.5 rounded text-green-300 font-mono">CTRL</kbd> для выделения всей системы
      </div>

      <img
        src={imageUrl}
        alt="Plant Analysis"
        className="max-w-full max-h-[85vh] object-contain block rounded-lg shadow-2xl"
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

          // Первичный берет цвет из твоих настроек. Латеральный - бирюзовый для контраста.
          const baseColor = isPrimary ? colorRoot : '#06b6d4';

          // Логика подсветки (один корень или вся группа при CTRL)
          const isHovered = hoveredSegment && (
            (!isCtrlPressed && hoveredSegment.id === seg.id) ||
            (isCtrlPressed && hoveredSegment.type === seg.type)
          );

          // Если мы навели мышку на что-то, все НЕ выделенные корни становятся полупрозрачными
          const opacity = (hoveredSegment && !isHovered) ? 0.2 : 1;

          return (
            <g key={`group-${seg.id}`}>
              {/* ВИДИМАЯ ЛИНИЯ */}
              <polyline
                points={pointsStr}
                fill="none"
                stroke={isHovered ? '#fbbf24' : baseColor}
                strokeWidth={isHovered ? (isCtrlPressed ? 6 : 8) : (isPrimary ? 5 : 3)}
                className="pointer-events-none transition-all duration-200"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ opacity: opacity }}
              />

              {/* НЕВИДИМАЯ ЗОНА ЗАХВАТА МЫШИ */}
              <polyline
                points={pointsStr}
                fill="none"
                stroke="transparent"
                strokeWidth="30"
                className="pointer-events-auto"
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

      {/* ВСПЛЫВАЮЩИЙ ТУЛТИП */}
      {tooltipData && (
        <div
          className="fixed z-[9999] bg-black/90 text-white text-sm p-4 rounded-xl shadow-2xl pointer-events-none border border-white/20 backdrop-blur-md transform -translate-x-1/2 -translate-y-full mt-[-20px] min-w-[240px]"
          style={{ left: mousePos.x, top: mousePos.y }}
        >
          <div className="font-black mb-2 text-green-400 border-b border-white/20 pb-1 tracking-wide flex justify-between items-center gap-4">
            <span className="uppercase">{tooltipData.title}</span>
            {tooltipData.isGroup && (
              <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border border-green-500/30">
                CTRL MODE
              </span>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Тип:</span>
              <span className="font-medium text-right text-xs pt-0.5">{tooltipData.type}</span>
            </div>

            {tooltipData.isGroup && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-400">Склеено частей:</span>
                <span className="font-medium">{tooltipData.count} шт.</span>
              </div>
            )}

            <div className="flex justify-between gap-4">
              <span className="text-gray-400">{tooltipData.isGroup ? "Общая длина:" : "Длина:"}</span>
              <span className="font-mono">{tooltipData.length} мм</span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-gray-400">{tooltipData.isGroup ? "Ср. Толщина:" : "Толщина (Ø):"}</span>
              <span className="font-mono">{tooltipData.thickness} мм</span>
            </div>

            <div className="flex justify-between gap-4 text-yellow-300 pt-1 border-t border-white/10 mt-1">
              <span>{tooltipData.isGroup ? "Суммарный Объем:" : "3D Объем:"}</span>
              <span className="font-mono font-bold">{tooltipData.volume} мм³</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractivePlantCanvas;