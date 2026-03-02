import React, { useState, useEffect } from 'react';

const InteractivePlantCanvas = ({ imageUrl, segments = [], settings, metrics }) => {
  const [viewBox, setViewBox] = useState('0 0 1000 1000');
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

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

  let tooltipData = null;
  if (hoveredSegment) {
    if (isCtrlPressed) {
      const groupSegments = segments.filter(s => s.type === hoveredSegment.type);
      const totalLength = groupSegments.reduce((sum, s) => sum + s.length_mm, 0);
      const totalVolume = groupSegments.reduce((sum, s) => sum + s.volume_mm3, 0);
      const avgThickness = groupSegments.reduce((sum, s) => sum + s.thickness_mm, 0) / groupSegments.length;

      tooltipData = {
        title: hoveredSegment.type.includes("Первичный") ? "Стержневая система" : "Латеральная сеть",
        isGroup: true, type: hoveredSegment.type,
        length: totalLength.toFixed(2), thickness: avgThickness.toFixed(3),
        volume: totalVolume.toFixed(2), count: groupSegments.length
      };
    } else {
      tooltipData = {
        title: `Сегмент #${hoveredSegment.id}`,
        isGroup: false, type: hoveredSegment.type,
        length: hoveredSegment.length_mm.toFixed(2), thickness: hoveredSegment.thickness_mm.toFixed(3),
        volume: hoveredSegment.volume_mm3.toFixed(2), count: 1
      };
    }
  }

  // Считаем суммы для Легенды (пока бэкенд не пришлет полные метрики)
  const totalRootLen = segments.reduce((sum, s) => sum + s.length_mm, 0).toFixed(1);
  const totalRootVol = segments.reduce((sum, s) => sum + s.volume_mm3, 0).toFixed(1);

  return (
    <div className="relative inline-block max-w-full max-h-full cursor-crosshair group">

      <div className="absolute top-4 right-4 z-10 bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md pointer-events-none border border-white/10">
        Удерживайте <kbd className="bg-white/20 px-1.5 py-0.5 rounded text-green-300 font-mono">CTRL</kbd> для выделения группы
      </div>

      <img
        src={imageUrl}
        alt="Plant Analysis"
        className="max-w-full max-h-full object-contain block rounded-lg shadow-2xl"
        onLoad={handleImageLoad}
      />

      {/* Отрисовка корней (Мгновенно скрывается при settings.show_root === false) */}
      {settings?.show_root !== false && (
        <svg
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          viewBox={viewBox}
          preserveAspectRatio="none"
        >
          {segments.map((seg) => {
            const pointsStr = seg.path.map(p => `${p[0]},${p[1]}`).join(' ');
            const isPrimary = seg.type.includes("Первичный");
            const baseColor = isPrimary ? (settings?.color_root || '#9333EA') : '#06b6d4';

            const isHovered = hoveredSegment && (
              (!isCtrlPressed && hoveredSegment.id === seg.id) ||
              (isCtrlPressed && hoveredSegment.type === seg.type)
            );
            const opacity = (hoveredSegment && !isHovered) ? 0.2 : 1;

            return (
              <g key={`group-${seg.id}`}>
                <polyline
                  points={pointsStr} fill="none"
                  stroke={isHovered ? '#fbbf24' : baseColor}
                  strokeWidth={isHovered ? (isCtrlPressed ? 6 : 8) : (isPrimary ? 5 : 3)}
                  className="pointer-events-none transition-all duration-200"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{ opacity: opacity }}
                />
                <polyline
                  points={pointsStr} fill="none" stroke="transparent" strokeWidth="30"
                  className="pointer-events-auto"
                  onMouseEnter={(e) => { setHoveredSegment(seg); setMousePos({ x: e.clientX, y: e.clientY }); }}
                  onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredSegment(null)}
                />
              </g>
            );
          })}
        </svg>
      )}

      {/* 🔥 ВОЗВРАЩЕННАЯ ЛЕГЕНДА (HUD) 🔥 */}
      <div className="absolute bottom-4 left-4 bg-black/85 backdrop-blur-md border border-white/10 rounded-xl p-4 text-white text-xs w-64 pointer-events-none shadow-2xl">
        <h4 className="font-bold text-green-400 mb-2 uppercase tracking-wider border-b border-white/20 pb-1">Фито-Метрики</h4>
        <div className="space-y-2">
          {/* Пока мы берем данные корней из SVG, а листья/стебли добавим позже */}
          <div className="flex justify-between">
            <span className="text-gray-400">Длина корней:</span>
            <span className="font-mono">{totalRootLen} мм</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Объем биомассы:</span>
            <span className="font-mono font-bold text-yellow-300">{totalRootVol} мм³</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Кол-во сегментов:</span>
            <span className="font-mono">{segments.length} шт</span>
          </div>
        </div>
      </div>

      {/* ВСПЛЫВАЮЩИЙ ТУЛТИП */}
      {tooltipData && (
        <div
          className="fixed z-[9999] bg-black/90 text-white text-sm p-4 rounded-xl shadow-2xl pointer-events-none border border-white/20 backdrop-blur-md transform -translate-x-1/2 -translate-y-full mt-[-20px] min-w-[240px]"
          style={{ left: mousePos.x, top: mousePos.y }}
        >
          <div className="font-black mb-2 text-green-400 border-b border-white/20 pb-1 tracking-wide flex justify-between items-center gap-4">
            <span className="uppercase">{tooltipData.title}</span>
            {tooltipData.isGroup && <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border border-green-500/30">CTRL MODE</span>}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between gap-4"><span className="text-gray-400">Тип:</span><span className="font-medium text-right text-xs pt-0.5">{tooltipData.type}</span></div>
            {tooltipData.isGroup && <div className="flex justify-between gap-4"><span className="text-gray-400">Склеено:</span><span className="font-medium">{tooltipData.count} шт.</span></div>}
            <div className="flex justify-between gap-4"><span className="text-gray-400">{tooltipData.isGroup ? "Общая длина:" : "Длина:"}</span><span className="font-mono">{tooltipData.length} мм</span></div>
            <div className="flex justify-between gap-4"><span className="text-gray-400">{tooltipData.isGroup ? "Ср. Толщина:" : "Толщина (Ø):"}</span><span className="font-mono">{tooltipData.thickness} мм</span></div>
            <div className="flex justify-between gap-4 text-yellow-300 pt-1 border-t border-white/10 mt-1"><span>{tooltipData.isGroup ? "Сумм. Объем:" : "3D Объем:"}</span><span className="font-mono font-bold">{tooltipData.volume} мм³</span></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractivePlantCanvas;