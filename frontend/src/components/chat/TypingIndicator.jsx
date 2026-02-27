import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export const TypingIndicator = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-start gap-3 w-full justify-start"
  >
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center">
      <Sparkles className="text-accent-ai" size={18} />
    </div>
    <div className="max-w-xl rounded-2xl px-4 py-3 shadow-md bg-surface-2 flex items-center gap-2">
        <motion.span
          className="w-2 h-2 bg-accent-ai rounded-full"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          className="w-2 h-2 bg-accent-ai rounded-full"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.8, delay: 0.1, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          className="w-2 h-2 bg-accent-ai rounded-full"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.8, delay: 0.2, repeat: Infinity, ease: 'easeInOut' }}
        />
    </div>
  </motion.div>
);