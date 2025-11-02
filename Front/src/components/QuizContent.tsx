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
  onSubmitAnswer: (answer: number[] | string) => void;
  isHost?: boolean;
  disableCopy?: boolean;
}

const QuizContent: React.FC<QuizContentProps> = ({ questionData, timeLeft, onSubmitAnswer, isHost = false, disableCopy = false }) => {
  const { question, type, options, points } = questionData;
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [textAnswer, setTextAnswer] = useState<string>('');

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

  const handleAnswerSelect = (index: number) => {
    if (type === 'multiple') {
      // Multiple selection - toggle answer
      setSelectedAnswers(prev => 
        prev.includes(index) 
          ? prev.filter(i => i !== index)
          : [...prev, index]
      );
    } else {
      // Single selection - replace answer
      setSelectedAnswers([index]);
    }
  };

  const handleSubmit = () => {
    if (type === 'text') {
      if (textAnswer.trim()) {
        onSubmitAnswer(textAnswer.trim());
      }
    } else {
      if (selectedAnswers.length > 0) {
        onSubmitAnswer(selectedAnswers);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Question Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white p-6 rounded-t-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Вопрос</h2>
          <div className="flex items-center bg-white bg-opacity-20 px-4 py-2 rounded-full">
            <Clock className="h-5 w-5 mr-2" />
            <span className="text-xl font-bold">{timeLeft}s</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm opacity-90">
            Тип: {
              type === 'text' ? 'Текстовый ответ' :
              type === 'multiple' ? 'Множественный выбор' : 
              'Одиночный выбор'
            }
          </span>
          <span className="text-sm opacity-90">{points} балл{points === 1 ? '' : points < 5 ? 'а' : 'ов'}</span>
        </div>
      </div>

      {/* Question Content */}
      <div className="bg-white p-8 rounded-b-lg shadow-lg">
        <h3 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          {isHost ? question : (type === 'text' ? 'Введите ответ' : 'Выберите правильный ответ')}
        </h3>

        {/* Text Input for text type questions */}
        {type === 'text' && (
          <div className="mb-8">
            <input
              type="text"
              value={textAnswer}
              onChange={(e) => !isHost && setTextAnswer(e.target.value)}
              disabled={isHost}
              placeholder="Введите ваш ответ..."
              className="w-full px-4 py-4 text-xl border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        )}

        {/* Options for single/multiple choice questions */}
        {type !== 'text' && (
          <div className="grid grid-cols-2 gap-2 mb-8">
          {options && Array.isArray(options) ? options.map((option, index) => {
            const colorMap = ['#540D6E', '#EE4266', '#FFD23F', '#3BCEAC'];
            const icons = ['star.svg', 'sq.svg', 'trig.svg', 'circ.svg'];
            const bgColor = colorMap[index] || '#540D6E';
            const icon = icons[index] || 'star.svg';
            
            return (
              <button
                key={index}
                onClick={() => !isHost && handleAnswerSelect(index)}
                disabled={isHost}
                className={`rounded-lg p-4 text-white h-20 flex items-center drop-shadow-none transition-all duration-300 ${
                  isHost ? 'bg-gray-300 cursor-default' : 'cursor-pointer'
                } ${selectedAnswers.includes(index) ? 'transform scale-105' : ''}`}
                style={{
                  backgroundColor: option ? bgColor : isHost ? '#d1d5db' : 'white'
                }}
              >
                <div className={`flex items-center justify-center rounded-lg px-2 py-4`} style={{ backgroundColor: bgColor }}>
                  <img src={icon} alt="icon" className='w-8 h-8'/>
                </div>
                <span className="text-sm font-medium ml-2 flex-1 text-left overflow-hidden text-ellipsis"
                      style={{ color: option && !isHost ? 'white' : 'grey' }}>
                  {option || `Вариант ${index + 1}`}
                </span>
                <div className={`ml-2 w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                  selectedAnswers.includes(index)
                    ? 'bg-green-500 border-green-500'
                    : 'bg-transparent border-white opacity-50'
                }`}>
                  {selectedAnswers.includes(index) && (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="text-center">
            <button
              onClick={handleSubmit}
              disabled={type === 'text' ? !textAnswer.trim() : selectedAnswers.length === 0}
              className={`px-8 py-3 rounded-lg font-bold text-lg transition-all duration-200 ${
                (type === 'text' ? textAnswer.trim() : selectedAnswers.length > 0)
                  ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg hover:shadow-xl cursor-pointer'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {type === 'text' 
                ? (textAnswer.trim() ? 'Отправить ответ' : 'Введите ответ')
                : (selectedAnswers.length > 0 
                  ? `Отправить ответ${selectedAnswers.length > 1 ? 'ы' : ''} (${selectedAnswers.map(i => i + 1).join(', ')})`
                  : 'Выберите ответ')
              }
            </button>
          </div>
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
