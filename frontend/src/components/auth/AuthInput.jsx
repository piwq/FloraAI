import React from 'react';
import { motion } from 'framer-motion';
import InputMask from 'react-input-mask';

const inputContainerVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  exit: { opacity: 0, x: -10, transition: { duration: 0.3 } }
};

const handlePhonePrefix = ({ nextState }) => {
  let { value } = nextState;
  if (value.startsWith('8')) {
    value = '7' + value.slice(1);
  } else if (value.startsWith('7')) {
    value = '7' + value.slice(1);
  }
  return { ...nextState, value };
};

export const AuthInput = ({ name, type = 'text', placeholder, value, onChange, required, disabled, mask, ...props }) => {
  const [isFocused, setIsFocused] = React.useState(false);
  const isFilled = value && value.length > 0;

  const isLabelRaised = isFocused || isFilled || type === 'date' || (mask && isFilled);

  const commonInputProps = {
    name: name,
    type: type,
    value: value,
    onChange: onChange,
    onFocus: () => setIsFocused(true),
    onBlur: () => setIsFocused(false),
    required: required,
    disabled: disabled,
    className: `w-full bg-transparent border-b-2 text-white text-lg py-2
               focus:outline-none transition-colors duration-300
               ${isFocused ? 'border-accent-ai' : 'border-white/20'}
               ${type === 'date' && !isFilled ? 'text-text-secondary' : 'text-white'}
               disabled:opacity-50`,
  };

  return (
    <motion.div variants={inputContainerVariants} initial="hidden" animate="visible" exit="exit" {...props}>
      <div className="relative">
        {mask ? (
          <InputMask
            mask={mask}
            alwaysShowMask={false}
            beforeMaskedStateChange={handlePhonePrefix}
            {...commonInputProps}
          />
        ) : (
          <input {...commonInputProps} />
        )}
        <label
          htmlFor={name}
          className={`absolute left-0 transition-all duration-300 pointer-events-none
                     ${isLabelRaised 
                       ? '-top-5 text-sm text-accent-ai' 
                       : 'top-2 text-lg text-text-secondary'
                     }`}
        >
          {placeholder}
        </label>
      </div>
    </motion.div>
  );
}