import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/app/Header'; 
import { getUserProfile, updateUserProfile, changePassword } from '@/services/apiClient';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({ name: '', birthDate: '' });
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '' });
  const [isLoading, setIsLoading] = useState(true);

  // Глобальные настройки ИИ по умолчанию
  const [yoloConf, setYoloConf] = useState("0.25");
  const [yoloIou, setYoloIou] = useState("0.7");
  const [yoloImgsz, setYoloImgsz] = useState("1024");
  const [colorLeaf, setColorLeaf] = useState('#16A34A');
  const [colorRoot, setColorRoot] = useState('#9333EA');
  const [colorStem, setColorStem] = useState('#2563EB');

  const [showAdvancedAI, setShowAdvancedAI] = useState(false);

  const todayDateStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await getUserProfile();
        const data = response.data;
        setUser(data);
        setFormData({
          name: data.name || '',
          birthDate: data.birthDate ? data.birthDate.split('T')[0] : '',
        });
        setYoloConf(data.yolo_conf !== undefined ? String(data.yolo_conf) : "0.25");
        setYoloIou(data.yolo_iou !== undefined ? String(data.yolo_iou) : "0.7");
        setYoloImgsz(data.yolo_imgsz !== undefined ? String(data.yolo_imgsz) : "1024");
        if (data.color_leaf) setColorLeaf(data.color_leaf);
        if (data.color_root) setColorRoot(data.color_root);
        if (data.color_stem) setColorStem(data.color_stem);
      } catch (error) {
        toast.error('Не удалось загрузить профиль.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, []);

  const determineMode = (conf, iou) => {
    if (conf === '0.1' && iou === '0.5') return 'scout';
    if (conf === '0.25' && iou === '0.6') return 'lab';
    if (conf === '0.4' && iou === '0.7') return 'expert';
    return 'custom';
  };
  const currentMode = determineMode(yoloConf, yoloIou);

  const savePersonalData = async (e) => {
    e.preventDefault();
    if (formData.birthDate && new Date(formData.birthDate) > new Date()) return toast.error('Дата из будущего!');

    try {
      const payload = { name: formData.name, birthDate: formData.birthDate };
      const res = await updateUserProfile(payload);
      setUser(prev => ({ ...prev, name: res.data.name }));
      toast.success('Личные данные обновлены', { style: { background: '#333', color: '#fff' } });
    } catch (err) {
      toast.error('Ошибка сохранения профиля', { style: { background: '#333', color: '#fff' } });
    }
  };

  const saveAISettings = async () => {
    try {
      const payload = {
        yolo_conf: parseFloat(yoloConf), yolo_iou: parseFloat(yoloIou), yolo_imgsz: parseInt(yoloImgsz, 10),
        color_leaf: colorLeaf, color_root: colorRoot, color_stem: colorStem
      };
      await updateUserProfile(payload);
      toast.success('Настройки нейросети обновлены!', { style: { background: '#333', color: '#fff', border: '1px solid #22c55e' } });
    } catch (err) {
      toast.error('Ошибка синхронизации с сервером', { style: { background: '#333', color: '#fff' } });
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    try {
        await changePassword(passwordData);
        toast.success('Пароль надежно изменен!', { style: { background: '#333', color: '#fff' } });
        setPasswordData({ currentPassword: '', newPassword: '' });
    } catch (error) {
        toast.error(error.response?.data?.error || 'Ошибка при смене пароля.', { style: { background: '#333', color: '#fff' } });
    }
  };

  if (isLoading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#0a0c10]">
        <div className="flex flex-col items-center gap-4"><div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div><p className="font-bold text-gray-500 animate-pulse">Инициализация ядра...</p></div>
    </div>
  );

  const isPremium = user?.subscriptionStatus === 'PREMIUM';

  return (
    <div className="min-h-screen w-screen flex flex-col font-body bg-[#0a0c10] text-gray-200 overflow-x-hidden">
      <Header />
      <main className="flex-1 overflow-y-auto p-4 sm:p-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-6">

          {/* ЗАГОЛОВОК */}
          <div className="flex items-end justify-between mb-8 border-b border-white/10 pb-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Рабочее пространство</h1>
              <p className="text-gray-400 mt-1">Управление аккаунтом и глобальными настройками ядра Flora AI</p>
            </div>
            {isPremium && <span className="hidden sm:flex items-center gap-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-3 py-1 rounded-full font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(234,179,8,0.2)]">💳 Premium</span>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* --- КОЛОНКА 1: ПРОФИЛЬ И БЕЗОПАСНОСТЬ --- */}
            <div className="lg:col-span-4 space-y-6">

              {/* Личный профиль */}
              <div className="bg-[#12141a] p-6 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                <div className="flex items-center gap-2 mb-6 text-white"><span className="text-xl">👤</span><h2 className="text-xl font-bold">Личный профиль</h2></div>
                <form onSubmit={savePersonalData} className="space-y-4">
                  <div className="p-3 bg-[#1a1d24] rounded-xl border border-white/5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Ваш логин</label>
                    <p className="text-sm font-medium text-gray-300 truncate">{user?.email || user?.phone}</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Полное имя</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-[#1a1d24] border border-white/10 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 rounded-xl p-3 text-sm outline-none transition-all text-white placeholder-gray-600" placeholder="Агроном Иванов" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Дата рождения</label>
                    <input type="date" value={formData.birthDate} max={todayDateStr} onChange={e => setFormData({...formData, birthDate: e.target.value})} className="w-full bg-[#1a1d24] border border-white/10 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 rounded-xl p-3 text-sm outline-none transition-all text-white [color-scheme:dark]" />
                  </div>
                  <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(22,163,74,0.2)] text-sm">Сохранить данные</button>
                </form>
              </div>

              {/* Безопасность */}
              <div className="bg-[#12141a] p-6 rounded-2xl border border-white/5 shadow-xl">
                <div className="flex items-center gap-2 mb-6 text-white"><span className="text-xl">🔒</span><h2 className="text-xl font-bold">Безопасность</h2></div>
                <form onSubmit={handlePasswordUpdate} className="space-y-3">
                  <input type="password" name="currentPassword" placeholder="Текущий пароль" value={passwordData.currentPassword} onChange={e => setPasswordData({...passwordData, currentPassword: e.target.value})} className="w-full bg-[#1a1d24] border border-white/10 focus:border-gray-500 focus:ring-2 focus:ring-gray-500/50 rounded-xl p-3 text-sm outline-none transition-all text-white placeholder-gray-600" />
                  <input type="password" name="newPassword" placeholder="Новый пароль" value={passwordData.newPassword} onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})} className="w-full bg-[#1a1d24] border border-white/10 focus:border-gray-500 focus:ring-2 focus:ring-gray-500/50 rounded-xl p-3 text-sm outline-none transition-all text-white placeholder-gray-600" />
                  <button type="submit" className="w-full border border-white/10 text-gray-300 font-bold py-2.5 rounded-xl hover:bg-white/5 transition-all text-sm mt-2">Обновить пароль</button>
                </form>
              </div>

            </div>

            {/* --- КОЛОНКА 2: ИИ И ИНТЕГРАЦИИ --- */}
            <div className="lg:col-span-8 space-y-6">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Интеграция Telegram */}
                <div className="bg-[#12141a] p-6 rounded-2xl border border-white/5 shadow-xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-white"><span className="text-xl">✈️</span><h2 className="text-lg font-bold">Telegram Бот</h2></div>
                      {user?.telegramTag && <span className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider border border-blue-500/20">Связан</span>}
                    </div>
                    <p className="text-sm text-gray-400 mb-4 leading-relaxed">Получайте уведомления об окончании анализа биомассы прямо в мессенджер.</p>
                  </div>
                  {user?.telegramTag ? (
                    <div className="p-3 bg-[#1a1d24] border border-white/5 rounded-xl font-mono text-sm font-bold text-gray-300 flex items-center justify-center">@{user.telegramTag}</div>
                  ) : (
                    <a href={`https://t.me/FloraAI_hackaton_bot?start=auth`} target="_blank" rel="noopener noreferrer" className="w-full bg-[#2AABEE] hover:bg-[#229ED9] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg text-sm">Подключить аккаунт</a>
                  )}
                </div>

                {/* Подписка */}
                <div className="bg-gradient-to-br from-[#1c1f26] to-[#0a0c10] p-6 rounded-2xl border border-white/5 shadow-xl flex flex-col justify-between text-white relative overflow-hidden">
                  <div className="absolute top-[-20px] right-[-10px] text-8xl opacity-[0.03] pointer-events-none">💳</div>
                  <div className="relative z-10">
                    <h2 className="text-lg font-bold text-gray-400 mb-1">Тарифный план</h2>
                    <div className="text-3xl font-black mb-4 bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-yellow-400 drop-shadow-lg">{user?.subscriptionStatus || 'BASIC'}</div>
                    <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl backdrop-blur-sm border border-white/5">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Баланс анализов</span>
                      <span className="font-mono font-bold text-green-400">{user?.remainingInterpretations} / шт</span>
                    </div>
                  </div>
                  <div className="relative z-10 mt-4">
                    {!isPremium && <Link to="/tariffs"><button className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 transition-all text-sm shadow-[0_0_15px_rgba(255,255,255,0.2)]">Перейти на Premium</button></Link>}
                  </div>
                </div>
              </div>

              {/* ЦЕНТР УПРАВЛЕНИЯ ИИ */}
              <div className="bg-[#12141a] p-6 md:p-8 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden">
                {/* Легкое фоновое свечение ядра */}
                <div className="absolute top-[-100px] right-[-100px] w-[300px] h-[300px] bg-green-500/5 blur-[120px] rounded-full pointer-events-none"></div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 border-b border-white/10 pb-4 gap-4 relative z-10">
                  <div className="flex items-center gap-3 text-white">
                    <div className="w-12 h-12 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center text-xl shadow-[0_0_15px_rgba(34,197,94,0.15)]">🧠</div>
                    <div>
                      <h2 className="text-xl font-black tracking-wide">Ядро Flora AI</h2>
                      <p className="text-xs text-gray-400 mt-0.5">Глобальные настройки анализа по умолчанию</p>
                    </div>
                  </div>
                  <button onClick={saveAISettings} className="bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-[0_0_15px_rgba(22,163,74,0.2)] transition-all border border-green-500/50">Применить глобально</button>
                </div>

                <div className="space-y-8 relative z-10">
                  {/* ПРЕСЕТЫ */}
                  <div>
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">📷 Профиль сканирования</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div onClick={() => {setYoloConf('0.1'); setYoloIou('0.5')}} className={`p-4 rounded-xl border cursor-pointer transition-all ${currentMode === 'scout' ? 'border-green-500 bg-green-500/10 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'border-white/5 bg-[#1a1d24] hover:border-white/20'}`}>
                        <div className="text-2xl mb-2 opacity-90">🌱</div>
                        <div className={`font-bold text-sm ${currentMode === 'scout' ? 'text-green-400' : 'text-gray-300'}`}>Скаутинг</div>
                        <div className="text-[10px] text-gray-500 mt-1 leading-tight">Максимальная чувствительность. Ищет мельчайшие тени корней.</div>
                      </div>
                      <div onClick={() => {setYoloConf('0.25'); setYoloIou('0.6')}} className={`p-4 rounded-xl border cursor-pointer transition-all ${currentMode === 'lab' ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'border-white/5 bg-[#1a1d24] hover:border-white/20'}`}>
                        <div className="text-2xl mb-2 opacity-90">🔬</div>
                        <div className={`font-bold text-sm ${currentMode === 'lab' ? 'text-blue-400' : 'text-gray-300'}`}>Лаборатория</div>
                        <div className="text-[10px] text-gray-500 mt-1 leading-tight">Сбалансированный режим для качественных снимков.</div>
                      </div>
                      <div onClick={() => {setYoloConf('0.4'); setYoloIou('0.7')}} className={`p-4 rounded-xl border cursor-pointer transition-all ${currentMode === 'expert' ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'border-white/5 bg-[#1a1d24] hover:border-white/20'}`}>
                        <div className="text-2xl mb-2 opacity-90">🎓</div>
                        <div className={`font-bold text-sm ${currentMode === 'expert' ? 'text-purple-400' : 'text-gray-300'}`}>Эксперт</div>
                        <div className="text-[10px] text-gray-500 mt-1 leading-tight">Строгий поиск. Отбрасывает любой шум и грязь.</div>
                      </div>
                    </div>
                  </div>

                  {/* РУЧНЫЕ НАСТРОЙКИ */}
                  <div className="border border-white/5 rounded-xl overflow-hidden bg-[#1a1d24]">
                    <button type="button" onClick={() => setShowAdvancedAI(!showAdvancedAI)} className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-widest hover:bg-white/5 transition-colors">
                      Инженерные параметры <span className="text-[10px]">{showAdvancedAI ? '▲' : '▼'}</span>
                    </button>
                    {showAdvancedAI && (
                      <div className="p-5 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#0f1115]">
                        <div>
                          <div className="flex justify-between items-center mb-2"><span className="text-[10px] font-bold text-gray-500 uppercase">Порог уверенности (Conf)</span><span className="text-xs font-bold bg-white/10 text-gray-300 px-2 py-1 rounded">{yoloConf}</span></div>
                          <input type="range" min="0.05" max="0.95" step="0.05" value={yoloConf} onChange={e => setYoloConf(e.target.value)} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500" />
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-2"><span className="text-[10px] font-bold text-gray-500 uppercase">Радиус склейки (IoU)</span><span className="text-xs font-bold bg-white/10 text-gray-300 px-2 py-1 rounded">{yoloIou}</span></div>
                          <input type="range" min="0.1" max="0.9" step="0.05" value={yoloIou} onChange={e => setYoloIou(e.target.value)} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500" />
                        </div>
                        <div className="md:col-span-2 pt-2 border-t border-white/5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Разрешение матрицы (IMGSZ)</label>
                          <div className="flex bg-black/50 p-1 rounded-lg border border-white/5">
                            {['480', '640', '1024', '2048'].map(size => (
                              <button type="button" key={size} onClick={() => setYoloImgsz(size)} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${yoloImgsz === size ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>{size}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ВИЗУАЛИЗАЦИЯ */}
                  <div>
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">🎨 Палитра слоев</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[{key: 'colorLeaf', val: colorLeaf, set: setColorLeaf, label: 'Листья'}, {key: 'colorRoot', val: colorRoot, set: setColorRoot, label: 'Корни'}, {key: 'colorStem', val: colorStem, set: setColorStem, label: 'Стебли'}].map(layer => (
                        <div key={layer.key} className="flex items-center gap-3 p-3 border border-white/5 rounded-xl bg-[#1a1d24] shadow-inner hover:border-white/20 transition-colors">
                          <input type="color" value={layer.val} onChange={(e) => layer.set(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{layer.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button onClick={saveAISettings} className="sm:hidden w-full bg-green-600 hover:bg-green-500 text-white py-3.5 rounded-xl font-bold text-sm shadow-[0_0_15px_rgba(22,163,74,0.2)] transition-all mt-6">Применить глобально</button>
                </div>
              </div>

            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default ProfilePage;