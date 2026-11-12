import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ICEBREAKER_QUESTIONS } from '../data/mockData';
import { sounds } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader } from './ui/dialog';

interface IcebreakerWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerName: string;
  onSendIcebreakerToChat: (questionText: string) => void;
}

export const IcebreakerWheelModal: React.FC<IcebreakerWheelModalProps> = ({
  isOpen,
  onClose,
  partnerName,
  onSendIcebreakerToChat,
}) => {
  const { isLight } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  // Sin cleanup, cerrar el modal a mitad del giro dejaba el intervalo vivo y el
  // sonido de "monedas" sonaba con el modal ya cerrado.
  const spinTimers = useRef<{ interval?: number; timeout?: number }>({});
  useEffect(() => () => {
    if (spinTimers.current.interval !== undefined) window.clearInterval(spinTimers.current.interval);
    if (spinTimers.current.timeout !== undefined) window.clearTimeout(spinTimers.current.timeout);
  }, []);

  const filteredQuestions = selectedCategory === 'all'
    ? ICEBREAKER_QUESTIONS
    : ICEBREAKER_QUESTIONS.filter((q) => q.category === selectedCategory);

  const currentQuestion = filteredQuestions[currentIndex % filteredQuestions.length] || ICEBREAKER_QUESTIONS[0];

  const handleSpinRoulette = () => {
    if (isSpinning) return;
    setIsSpinning(true);

    let ticks = 0;
    spinTimers.current.interval = window.setInterval(() => {
      sounds.playSpinTick();
      ticks++;
      if (ticks > 8 && spinTimers.current.interval !== undefined) {
        window.clearInterval(spinTimers.current.interval);
        spinTimers.current.interval = undefined;
      }
    }, 90);

    const extraRounds = 360 * 3 + Math.floor(Math.random() * 360);
    setWheelRotation((prev) => prev + extraRounds);

    spinTimers.current.timeout = window.setTimeout(() => {
      spinTimers.current.timeout = undefined;
      setIsSpinning(false);
      const nextIdx = Math.floor(Math.random() * filteredQuestions.length);
      setCurrentIndex(nextIdx);
      sounds.playCoins();
    }, 900);
  };

  const handleSendToChat = () => {
    sounds.playStamp();
    onSendIcebreakerToChat(currentQuestion.question);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-[420px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader
          className={`px-5 py-4 border-b flex-row items-center shrink-0 space-y-0 ${
            isLight ? 'bg-[#fcf9f2] border-[#16223b]/8' : 'bg-[#131f36] border-white/8'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#ec4d86] to-[#ff6b9e] flex items-center justify-center text-white shadow-elevation-md shrink-0">
              <span className="material-symbols-outlined text-[22px]">casino</span>
            </div>
            <div className="min-w-0">
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-[#ec4d86] font-bold block">
                Romper el hielo
              </span>
              <h3 className={`text-[17px] font-bold leading-tight truncate ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>
                Ruleta de preguntas con {partnerName}
              </h3>
            </div>
          </div>
        </DialogHeader>

        {/* Roulette Animated Wheel Graphic */}
        <div className="p-5 flex flex-col items-center gap-4 text-center">
          <div className="relative mt-1">
            {/* Spinning Dial */}
            <motion.div
              animate={{ rotate: wheelRotation }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="w-32 h-32 rounded-full border-[5px] border-[#ec4d86] p-2 flex items-center justify-center bg-gradient-to-tr from-[#0a1120] via-[#131f36] to-[#1f2e4c] shadow-elevation-lg"
            >
              <div className="w-full h-full rounded-full border border-dashed border-[#ffa3c4]/40 flex items-center justify-center relative">
                <span className="material-symbols-outlined text-[40px] text-[#ffa3c4]">
                  psychology_alt
                </span>
                {/* Dial spokes */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-full h-0.5 bg-[#ec4d86]/25" />
                  <div className="h-full w-0.5 bg-[#ec4d86]/25 absolute" />
                </div>
              </div>
            </motion.div>

            {/* Pointer Indicator */}
            <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#ec4d86] rotate-45 border-2 shadow-elevation-md z-10 ${isLight ? 'border-white' : 'border-[#0f1a2e]'}`} />
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSpinRoulette}
            disabled={isSpinning}
            className="h-11 px-5 rounded-full text-[13.5px] font-bold gap-2"
          >
            <span className={`material-symbols-outlined text-[18px] ${isSpinning ? 'animate-spin' : ''}`}>autorenew</span>
            {isSpinning ? 'Girando…' : 'Girar la ruleta'}
          </Button>

          {/* Current Question Card Display */}
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-2xl text-left w-full transition-all ${
              isLight
                ? 'bg-[#fcf9f2]'
                : 'bg-[#131f36]'
            }`}
          >
            <div className="flex justify-between items-center gap-2 mb-2">
              <span className="text-[10.5px] uppercase tracking-[0.1em] font-bold text-[#ec4d86] h-6 px-2.5 inline-flex items-center rounded-full bg-[#ec4d86]/10">
                {currentQuestion.category}
              </span>
              <span className={`text-[11px] truncate ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
                {currentQuestion.context}
              </span>
            </div>

            <p className={`text-[16px] font-bold leading-snug ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>
              “{currentQuestion.question}”
            </p>

            {/* Options pills if available */}
            {currentQuestion.options && currentQuestion.options.length > 0 && (
              <div className="mt-3.5 flex flex-col gap-2">
                <span
                  className={`text-[10.5px] uppercase tracking-[0.1em] font-bold block ${
                    isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'
                  }`}
                >
                  Opciones para charlar
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {currentQuestion.options.map((opt, i) => (
                    <div
                      key={i}
                      className={`px-3 py-2.5 rounded-xl text-[12.5px] font-medium leading-snug ${
                        isLight
                          ? 'bg-white text-[#16223b] shadow-elevation-sm'
                          : 'bg-[#0f1a2e] text-[#f5f1e8]'
                      }`}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* Action Buttons */}
          <div className="flex gap-2 w-full">
            <Button
              variant="primary"
              onClick={handleSendToChat}
              className="flex-1 h-12 text-[14px] font-bold rounded-2xl gap-2 shadow-elevation-md"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              Enviar al chat
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
