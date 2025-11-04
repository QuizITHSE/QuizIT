import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface QuestionData {
  question: string;
  type: string;
  timeLimit: number;
  options: string[];
  points: number;
  textAnswer?: string;
}

interface QuizContentProps {
  questionData: QuestionData;
  timeLeft: number;
  onSubmitAnswer: (answer: number | number[] | string) => void;
  isHost?: boolean;
  disableCopy?: boolean;
  shuffleAnswers?: boolean;
}

const QuizContent: React.FC<QuizContentProps> = ({ questionData, timeLeft, onSubmitAnswer, isHost = false, disableCopy = false, shuffleAnswers = false }) => {
  const { question, type, options, points } = questionData;
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [textAnswer, setTextAnswer] = useState<string>('');
  
  // Shuffle options and create mapping if shuffleAnswers is enabled
  const [shuffledOptions, setShuffledOptions] = useState<{option: string, originalIndex: number}[]>([]);
  const [shuffleMapping, setShuffleMapping] = useState<number[]>([]);
  
  useEffect(() => {
    if (shuffleAnswers && !isHost && options && Array.isArray(options) && type !== 'text') {
      // Create array of indices
      const indices = options.map((_, index) => index);
      
      // Fisher-Yates shuffle algorithm
      const shuffled = [...indices];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      // Create mapping: shuffledIndex -> originalIndex
      const mapping: number[] = new Array(shuffled.length);
      shuffled.forEach((originalIndex, shuffledIndex) => {
        mapping[shuffledIndex] = originalIndex;
      });
      
      // Create shuffled options array
      const shuffledOpts = shuffled.map(originalIndex => ({
        option: options[originalIndex],
        originalIndex: originalIndex
      }));
      
      setShuffledOptions(shuffledOpts);
      setShuffleMapping(mapping);
      setSelectedAnswers([]); // Reset selections when question changes
      setTextAnswer(''); // Reset text answer when question changes
    } else {
      // No shuffling - use original order
      if (options && Array.isArray(options)) {
        const originalOpts = options.map((opt, index) => ({
          option: opt,
          originalIndex: index
        }));
        setShuffledOptions(originalOpts);
        const identityMapping = options.map((_, index) => index);
        setShuffleMapping(identityMapping);
        setSelectedAnswers([]); // Reset selections when question changes
        setTextAnswer(''); // Reset text answer when question changes
      }
    }
  }, [questionData.question, shuffleAnswers, isHost, options, type]);

  // Block text copying when disableCopy is enabled
  useEffect(() => {
    if (disableCopy && !isHost) {
      // Disable text selection
      document.body.style.userSelect = 'none';
      const bodyElement = document.body as any;
      bodyElement.style.webkitUserSelect = 'none';
      bodyElement.style.mozUserSelect = 'none';
      bodyElement.style.msUserSelect = 'none';
      
      // Disable context menu (right click)
      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        return false;
      };
      document.addEventListener('contextmenu', handleContextMenu);
      
      // Disable keyboard shortcuts for copying
      const handleKeyDown = (e: KeyboardEvent) => {
        // Block Ctrl+C, Ctrl+A, Ctrl+X, Ctrl+V
        if (e.ctrlKey && (e.key === 'c' || e.key === 'a' || e.key === 'x' || e.key === 'v')) {
          e.preventDefault();
          return false;
        }
        // Block Cmd+C, Cmd+A, Cmd+X, Cmd+V (Mac)
        if (e.metaKey && (e.key === 'c' || e.key === 'a' || e.key === 'x' || e.key === 'v')) {
          e.preventDefault();
          return false;
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      
      return () => {
        document.body.style.userSelect = '';
        bodyElement.style.webkitUserSelect = '';
        bodyElement.style.mozUserSelect = '';
        bodyElement.style.msUserSelect = '';
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [disableCopy, isHost]);

  const handleAnswerSelect = (shuffledIndex: number) => {
    if (type === 'multiple') {
      // Multiple selection - toggle answer by shuffled index
      setSelectedAnswers(prev => 
        prev.includes(shuffledIndex) 
          ? prev.filter(i => i !== shuffledIndex)
          : [...prev, shuffledIndex]
      );
    } else {
      // Single selection - replace answer by shuffled index
      setSelectedAnswers([shuffledIndex]);
    }
  };

  const handleSubmit = () => {
    if (type === 'text') {
      if (textAnswer.trim()) {
        onSubmitAnswer(textAnswer.trim());
      }
    } else {
      if (selectedAnswers.length > 0) {
        // Convert shuffled indices back to original indices for submission
        const originalIndices = selectedAnswers.map(shuffledIdx => shuffleMapping[shuffledIdx]);
        onSubmitAnswer(type === 'multiple' ? originalIndices : originalIndices[0]);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Question Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white p-4 md:p-6 rounded-t-lg">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h2 className="text-xl md:text-2xl font-bold">Вопрос</h2>
          <div className="flex items-center px-3 md:px-4 py-1.5 md:py-2">
            <Clock className="h-4 w-4 md:h-5 md:w-5 mr-1.5 md:mr-2" />
            <span className="text-lg md:text-xl font-bold">{timeLeft}s</span>
          </div>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs md:text-sm opacity-90">
            Тип: {
              type === 'text' ? 'Текстовый ответ' :
              type === 'multiple' ? 'Множественный выбор' : 
              'Одиночный выбор'
            }
          </span>
          <span className="text-xs md:text-sm opacity-90">{points} балл{points === 1 ? '' : points < 5 ? 'а' : 'ов'}</span>
        </div>
      </div>

      {/* Question Content */}
      <div className="bg-white p-4 md:p-8 rounded-b-lg shadow-lg">
        <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 md:mb-8 text-center">
          {isHost ? question : (type === 'text' ? 'Введите ответ' : 'Выберите правильный ответ')}
        </h3>

        {/* Text Input for text type questions */}
        {type === 'text' && (
          <div className="mb-6 md:mb-8">
            <input
              type="text"
              value={textAnswer}
              onChange={(e) => !isHost && setTextAnswer(e.target.value)}
              disabled={isHost}
              placeholder="Введите ваш ответ..."
              className="w-full px-4 py-5 md:py-4 text-xl md:text-xl border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        )}

        {/* Options for single/multiple choice questions */}
        {type !== 'text' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-2 mb-6 md:mb-8">
          {shuffledOptions.length > 0 ? shuffledOptions.map((item, shuffledIndex) => {
            const colorMap = ['#540D6E', '#EE4266', '#FFD23F', '#3BCEAC'];
            const icons = ['star.svg', 'sq.svg', 'trig.svg', 'circ.svg'];
            // Use shuffled index for color/icon mapping so labels change with position
            const bgColor = colorMap[shuffledIndex] || '#540D6E';
            const icon = icons[shuffledIndex] || 'star.svg';
            const isSelected = selectedAnswers.includes(shuffledIndex);
            
            return (
              <button
                key={shuffledIndex}
                onClick={() => !isHost && handleAnswerSelect(shuffledIndex)}
                disabled={isHost}
                className={`rounded-lg p-4 md:p-4 text-white min-h-[100px] md:min-h-[80px] flex items-center drop-shadow-none transition-all duration-300 ${
                  isHost ? 'bg-gray-300 cursor-default' : 'cursor-pointer'
                } ${isSelected ? 'transform scale-105' : ''}`}
                style={{
                  backgroundColor: item.option ? bgColor : (isHost ? '#d1d5db' : bgColor)
                }}
              >
                <img src={icon} alt="icon" className='w-10 h-10 md:w-8 md:h-8 flex-shrink-0'/>
                <span className="text-base md:text-sm font-medium ml-3 md:ml-2 flex-1 text-left overflow-hidden text-ellipsis text-white">
                  {item.option || `Вариант ${shuffledIndex + 1}`}
                </span>
                <div className={`ml-3 md:ml-2 w-10 h-10 md:w-8 md:h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  isSelected
                    ? 'bg-green-500 border-green-500'
                    : 'bg-transparent border-white opacity-50'
                }`}>
                  {isSelected && (
                    <svg className="w-5 h-5 md:w-4 md:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            );
          }) : options && Array.isArray(options) ? options.map((option, index) => {
            const colorMap = ['#540D6E', '#EE4266', '#FFD23F', '#3BCEAC'];
            const icons = ['star.svg', 'sq.svg', 'trig.svg', 'circ.svg'];
            const bgColor = colorMap[index] || '#540D6E';
            const icon = icons[index] || 'star.svg';
            
            return (
              <button
                key={index}
                onClick={() => !isHost && handleAnswerSelect(index)}
                disabled={isHost}
                className={`rounded-lg p-4 md:p-4 text-white min-h-[100px] md:min-h-[80px] flex items-center drop-shadow-none transition-all duration-300 ${
                  isHost ? 'bg-gray-300 cursor-default' : 'cursor-pointer'
                } ${selectedAnswers.includes(index) ? 'transform scale-105' : ''}`}
                style={{
                  backgroundColor: option ? bgColor : (isHost ? '#d1d5db' : bgColor)
                }}
              >
                <img src={icon} alt="icon" className='w-10 h-10 md:w-8 md:h-8 flex-shrink-0'/>
                <span className="text-base md:text-sm font-medium ml-3 md:ml-2 flex-1 text-left overflow-hidden text-ellipsis text-white">
                  {option || `Вариант ${index + 1}`}
                </span>
                <div className={`ml-3 md:ml-2 w-10 h-10 md:w-8 md:h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selectedAnswers.includes(index)
                    ? 'bg-green-500 border-green-500'
                    : 'bg-transparent border-white opacity-50'
                }`}>
                  {selectedAnswers.includes(index) && (
                    <svg className="w-5 h-5 md:w-4 md:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            );
          }) : (
            <div className="col-span-2 text-center text-gray-500 p-8">
              Нет доступных вариантов ответа
            </div>
          )}
        </div>
        )}

        {/* Submit Button - Only show for students */}
        {!isHost && (
          <button
            onClick={handleSubmit}
            disabled={type === 'text' ? !textAnswer.trim() : selectedAnswers.length === 0}
            className={`w-full md:w-auto px-6 py-5 md:py-3 rounded-lg font-bold text-xl md:text-lg transition-all duration-200 text-center mt-4 md:mt-0 ${
              (type === 'text' ? textAnswer.trim() : selectedAnswers.length > 0)
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg hover:shadow-xl cursor-pointer active:scale-95'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {type === 'text' 
              ? (textAnswer.trim() ? 'Отправить ответ' : 'Введите ответ')
              : (selectedAnswers.length > 0 
                ? `Отправить ответ${selectedAnswers.length > 1 ? 'ы' : ''}`
                : 'Выберите ответ')
            }
          </button>
        )}

        {/* Timer Bar */}
        <div className="mt-8">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-1000 ${
                timeLeft > 30 ? 'bg-green-500' : 
                timeLeft > 10 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${(timeLeft / questionData.timeLimit) * 100}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-sm text-gray-500 mt-2">
            <span>0s</span>
            <span>{questionData.timeLimit}s</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizContent;
