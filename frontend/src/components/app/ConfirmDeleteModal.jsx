import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

export const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, isLoading, title, message }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative z-10 w-full max-w-md bg-surface-2 p-6 rounded-2xl border border-border-color shadow-xl"
        >
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-500/20">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <div className="ml-4 text-left">
              <h3 className="text-lg font-bold text-text-primary">{title}</h3>
              <p className="text-sm text-text-secondary mt-1">{message}</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-surface-1 text-text-primary hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:bg-red-800"
            >
              {isLoading ? 'Удаление...' : 'Удалить'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};