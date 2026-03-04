import React, { useState, useEffect, useRef } from 'react';

const InteractivePlantCanvas = ({
  imageUrl, segments = [], leaves = [], stems = [], settings, metrics, onToggleLayers,
  externalScale, externalPosition, externalFilters, onViewChange
}) => {
  const [viewBox, setViewBox] = useState('0 0 1000 1000');
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  const [_scale, _setScale] = useState(1);
  const [_position, _setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const [_imgFilters, _setImgFilters] = useState({ brightness: 100, contrast: 100, saturate: 100 });
  const [showFilters, setShowFilters] = useState(false);

  // Если переданы external-пропсы — используем их, иначе локальные
  const scale = externalScale ?? _scale;
  const position = externalPosition ?? _position;
  const imgFilters = externalFilters ?? _imgFilters;

  const setScale = (v) => {
    const next = typeof v === 'function' ? v(scale) : v;
    _setScale(next);
    if (onViewChange) onViewChange({ scale: next, position, imgFilters });
  };
  const setPosition = (v) => {
    const next = typeof v === 'function' ? v(position) : v;
    _setPosition(next);
    if (onViewChange) onViewChange({ scale, position: next, imgFilters });
  };
  const setImgFilters = (v) => {
    const next = typeof v === 'function' ? v(imgFilters) : v;
    _setImgFilters(next);
    if (onViewChange) onViewChange({ scale, position, imgFilters: next });
  };

  const overlayEnabled = settings?.show_leaf !== false || settings?.show_root !== false || settings?.show_stem !== false;

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

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    setScale(prev => Math.min(Math.max(0.5, prev * Math.exp(delta)), 10));
  };

  const handleMouseDown = (e) => {
    if (e.button === 0 && !e.target.closest('.filter-panel') && !e.target.closest('.smart-panel')) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };
  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      const preventScroll = (e) => e.preventDefault();
      el.addEventListener('wheel', preventScroll, { passive: false });
      return () => el.removeEventListener('wheel', preventScroll);
    }
  }, []);

  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  let inspectorData = null;
  if (hoveredSegment && overlayEnabled) {
    if (hoveredSegment.category === 'root') {
      if (isCtrlPressed) {
        const groupSegments = segments.filter(s => s.type === hoveredSegment.type);
        const totalLength = groupSegments.reduce((sum, s) => sum + s.length_mm, 0);
        const totalVolume = groupSegments.reduce((sum, s) => sum + s.volume_mm3, 0);
        const avgThickness = groupSegments.reduce((sum, s) => sum + s.thickness_mm, 0) / groupSegments.length;

        inspectorData = {
          title: hoveredSegment.type.includes("Первичный") ? "Стержневая система" : "Латеральная сеть",
          isGroup: true, type: hoveredSegment.type,
          length: totalLength.toFixed(2), thickness: avgThickness.toFixed(3),
          volume: totalVolume.toFixed(2), count: groupSegments.length, color: '#fbbf24'
        };
      } else {
        inspectorData = {
          title: `Сегмент корня #${hoveredSegment.id}`,
          isGroup: false, type: hoveredSegment.type,
          length: hoveredSegment.length_mm.toFixed(2), thickness: hoveredSegment.thickness_mm.toFixed(3),
          volume: hoveredSegment.volume_mm3.toFixed(2), count: 1, color: '#fbbf24'
        };
      }
    } else {
      inspectorData = {
        title: hoveredSegment.category === 'leaf' ? `Лист #${hoveredSegment.id}` : `Стебель #${hoveredSegment.id}`,
        isGroup: false, type: hoveredSegment.category === 'leaf' ? 'Органическая масса' : 'Несущий каркас',
        length: '—', thickness: '—', volume: '—', count: 1,
        color: hoveredSegment.category === 'leaf' ? '#4ade80' : '#60a5fa'
      };
    }
  }

  const totalRootLen = segments.reduce((sum, s) => sum + s.length_mm, 0).toFixed(1);
  const totalRootVol = segments.reduce((sum, s) => sum + s.volume_mm3, 0).toFixed(1);

  // --- HEATMAP: Ищем максимальную толщину корня для нормализации ---
  const maxThickness = segments.reduce((max, s) => Math.max(max, s.thickness_mm), 0.001);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-[#0a0a0a] flex items-center justify-center ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={() => {
        const reset = { scale: 1, position: { x: 0, y: 0 }, imgFilters: { brightness: 100, contrast: 100, saturate: 100 } };
        _setScale(1); _setPosition({ x: 0, y: 0 }); _setImgFilters({ brightness: 100, contrast: 100, saturate: 100 });
        if (onViewChange) onViewChange(reset);
      }}
    >
      <div className="filter-panel absolute top-4 right-4 z-30 flex flex-col items-end gap-2 pointer-events-auto">
        <div className="flex gap-2">
          <button
            onClick={() => onToggleLayers && onToggleLayers(!overlayEnabled)}
            className={`h-10 px-3 rounded-full backdrop-blur-md border flex items-center gap-2 shadow-lg transition-all text-xs font-bold ${overlayEnabled ? 'bg-green-600/80 hover:bg-green-600 border-green-400/30 text-white' : 'bg-black/70 hover:bg-black/90 border-white/10 text-gray-400'}`}
            title={overlayEnabled ? 'Выключить интерактивную разметку' : 'Включить интерактивную разметку'}
          >
            <span className="text-base">{overlayEnabled ? '🧬' : '🖼'}</span>
            <span>{overlayEnabled ? 'Разметка' : 'Фото'}</span>
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-10 h-10 bg-black/70 hover:bg-black/90 text-white rounded-full backdrop-blur-md border border-white/10 flex items-center justify-center shadow-lg transition-all text-lg"
            title="Настройка изображения"
          >
            {showFilters ? '✕' : '🎛'}
          </button>
        </div>

        {showFilters && (
          <div className="bg-black/85 backdrop-blur-md border border-white/10 rounded-xl p-4 text-white text-xs w-56 shadow-2xl animate-fade-in-down origin-top-right">
            <div className="space-y-4">
              <div><div className="flex justify-between mb-1 text-gray-400"><span>☀️ Яркость</span><span>{imgFilters.brightness}%</span></div><input type="range" min="50" max="200" value={imgFilters.brightness} onChange={e => setImgFilters({...imgFilters, brightness: e.target.value})} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white" /></div>
              <div><div className="flex justify-between mb-1 text-gray-400"><span>🌓 Контраст</span><span>{imgFilters.contrast}%</span></div><input type="range" min="50" max="200" value={imgFilters.contrast} onChange={e => setImgFilters({...imgFilters, contrast: e.target.value})} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white" /></div>
              <div><div className="flex justify-between mb-1 text-gray-400"><span>💧 Насыщенность</span><span>{imgFilters.saturate}%</span></div><input type="range" min="0" max="300" value={imgFilters.saturate} onChange={e => setImgFilters({...imgFilters, saturate: e.target.value})} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white" /></div>
              <button onClick={() => setImgFilters({ brightness: 100, contrast: 100, saturate: 100 })} className="w-full py-1.5 mt-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-gray-300">Сбросить</button>
            </div>
          </div>
        )}
      </div>

      <div className="relative transition-transform duration-75 ease-out inline-block" style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}>
        <img
          src={imageUrl}
          alt="Plant Analysis"
          className="max-w-[85vw] max-h-[85vh] object-contain block rounded-lg shadow-2xl pointer-events-none transition-all duration-200"
          style={{ filter: `brightness(${imgFilters.brightness}%) contrast(${imgFilters.contrast}%) saturate(${imgFilters.saturate}%)` }}
          onLoad={handleImageLoad}
          onDragStart={(e) => e.preventDefault()}
        />

        {overlayEnabled && (
          <>
            <div className="absolute inset-0 bg-black transition-opacity duration-300 pointer-events-none rounded-lg" style={{ opacity: hoveredSegment ? 0.75 : 0 }} />

            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" viewBox={viewBox} preserveAspectRatio="none">
              {settings?.show_leaf !== false && leaves.map((leaf) => {
                const pointsStr = leaf.path.map(p => `${p[0]},${p[1]}`).join(' ');
                const leafColor = settings?.color_leaf || '#16A34A';
                const isHovered = hoveredSegment?.id === leaf.id && hoveredSegment?.category === 'leaf';
                const opacity = hoveredSegment ? (isHovered ? 1 : 0.1) : 1;

                return (
                  <polygon
                    key={`leaf-${leaf.id}`} points={pointsStr} fill={hexToRgba(leafColor, isHovered ? 0.6 : 0.3)}
                    stroke={isHovered ? '#4ade80' : leafColor} strokeWidth={isHovered ? 4 : 2} style={{ opacity }}
                    className="transition-all duration-300 pointer-events-auto cursor-help"
                    onMouseEnter={() => setHoveredSegment({ ...leaf, category: 'leaf' })} onMouseLeave={() => setHoveredSegment(null)}
                  />
                );
              })}

              {settings?.show_stem !== false && stems.map((stem) => {
                const pointsStr = stem.path.map(p => `${p[0]},${p[1]}`).join(' ');
                const stemColor = settings?.color_stem || '#2563EB';
                const isHovered = hoveredSegment?.id === stem.id && hoveredSegment?.category === 'stem';
                const opacity = hoveredSegment ? (isHovered ? 1 : 0.1) : 1;

                return (
                  <polygon
                    key={`stem-${stem.id}`} points={pointsStr} fill={hexToRgba(stemColor, isHovered ? 0.7 : 0.4)}
                    stroke={isHovered ? '#60a5fa' : stemColor} strokeWidth={isHovered ? 5 : 3} style={{ opacity }}
                    className="transition-all duration-300 pointer-events-auto cursor-help"
                    onMouseEnter={() => setHoveredSegment({ ...stem, category: 'stem' })} onMouseLeave={() => setHoveredSegment(null)}
                  />
                );
              })}

              {settings?.show_root !== false && segments.map((seg) => {
                const pointsStr = seg.path.map(p => `${p[0]},${p[1]}`).join(' ');
                const isPrimary = seg.type.includes("Первичный");
                const baseColor = isPrimary ? (settings?.color_root || '#9333EA') : '#06b6d4';

                const isHovered = hoveredSegment && hoveredSegment.category === 'root' && ((!isCtrlPressed && hoveredSegment.id === seg.id) || (isCtrlPressed && hoveredSegment.type === seg.type));

                const thicknessRatio = seg.thickness_mm / maxThickness;
                const heatAlpha = 0.3 + (0.7 * thicknessRatio);
                const opacity = hoveredSegment ? (isHovered ? 1 : 0.1) : heatAlpha;

                return (
                  <g key={`group-${seg.id}`}>
                    <polyline
                      points={pointsStr} fill="none"
                      stroke={isHovered ? '#fbbf24' : baseColor}
                      strokeWidth={isHovered ? (isCtrlPressed ? 6 : 8) : (isPrimary ? 5 : 3)}
                      className="pointer-events-none transition-all duration-150"
                      strokeLinecap="round" strokeLinejoin="round"
                      style={{ opacity }}
                    />
                    <polyline
                      points={pointsStr} fill="none" stroke="transparent" strokeWidth={30 / scale}
                      className="pointer-events-auto cursor-help"
                      onMouseEnter={() => setHoveredSegment({ ...seg, category: 'root' })}
                      onMouseLeave={() => setHoveredSegment(null)}
                    />
                  </g>
                );
              })}
            </svg>
          </>
        )}
      </div>

      <div className="smart-panel absolute bottom-4 left-4 z-20 pointer-events-auto transition-all duration-300">
        {inspectorData ? (
          <div className="bg-black/95 text-white text-sm p-4 rounded-xl shadow-2xl border backdrop-blur-md w-72" style={{ borderColor: `${inspectorData.color}50` }}>
            <div className="font-black mb-3 border-b pb-2 tracking-wide flex justify-between items-center gap-2" style={{ color: inspectorData.color, borderColor: `${inspectorData.color}30` }}>
              <span className="uppercase truncate">{inspectorData.title}</span>
              {inspectorData.isGroup && <span className="text-[10px] font-bold px-2 py-0.5 rounded border" style={{ backgroundColor: `${inspectorData.color}20`, borderColor: `${inspectorData.color}50`, color: inspectorData.color }}>CTRL</span>}
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-4"><span className="text-gray-400">Тип:</span><span className="font-medium text-right">{inspectorData.type}</span></div>
              {inspectorData.isGroup && <div className="flex justify-between gap-4"><span className="text-gray-400">Склеено:</span><span className="font-medium">{inspectorData.count} шт.</span></div>}
              <div className="flex justify-between gap-4"><span className="text-gray-400">{inspectorData.isGroup ? "Общая длина:" : "Длина:"}</span><span className="font-mono">{inspectorData.length} мм</span></div>
              <div className="flex justify-between gap-4"><span className="text-gray-400">{inspectorData.isGroup ? "Ср. Толщина:" : "Толщина (Ø):"}</span><span className="font-mono">{inspectorData.thickness} мм</span></div>
              <div className="flex justify-between gap-4 pt-2 border-t mt-2" style={{ borderColor: `${inspectorData.color}20`, color: inspectorData.color }}><span>{inspectorData.isGroup ? "Сумм. Объем:" : "3D Объем:"}</span><span className="font-mono font-bold text-sm">{inspectorData.volume} mm³</span></div>
            </div>
          </div>
        ) : (
          <div className="bg-black/85 backdrop-blur-md border border-white/10 rounded-xl p-4 text-white text-xs w-72 shadow-2xl">
            <h4 className="font-bold text-green-400 mb-3 uppercase tracking-wider border-b border-white/20 pb-2">Фито-Метрики</h4>
            <div className="space-y-2">
              {settings?.show_leaf !== false && <div className="flex justify-between text-green-200"><span>Площадь листьев:</span><span className="font-mono font-bold">{metrics?.leaf_area_cm2 || 0} см²</span></div>}
              {settings?.show_stem !== false && <div className="flex justify-between text-blue-200 border-b border-white/10 pb-2"><span>Длина стебля:</span><span className="font-mono font-bold">{metrics?.stem_length_mm || 0} мм</span></div>}
              <div className="flex justify-between pt-1"><span className="text-gray-400">Длина корней:</span><span className="font-mono">{totalRootLen} мм</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Объем биомассы:</span><span className="font-mono font-bold text-yellow-300">{totalRootVol} мм³</span></div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 text-[10px] text-gray-500 flex justify-between">
              <span>🖱 Скролл: Зум</span>
              <span>✋ Клик: Перемещение</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InteractivePlantCanvas;