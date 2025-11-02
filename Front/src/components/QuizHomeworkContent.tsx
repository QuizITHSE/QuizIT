import React, { useState, useEffect } from 'react';

interface QuestionData {
  question: string;
  type: string;
  options: string[];
  textAnswer?: string;
}

interface QuizHomeworkContentProps {
  questionData: QuestionData;
  onSubmitAnswer: (answer: number[] | string) => void;
  isHost?: boolean;
  initialAnswers?: (number[] | string);
}

const QuizHomeworkContent: React.FC<QuizHomeworkContentProps> = ({ 
  questionData, 
  onSubmitAnswer, 
  isHost = false,
  initialAnswers
}) => {
  const { question, type, options } = questionData;
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>(Array.isArray(initialAnswers) ? initialAnswers : []);
  const [textAnswer, setTextAnswer] = useState<string>(typeof initialAnswers === 'string' ? initialAnswers : '');

  // Сбрасываем выбранные ответы только при смене вопроса
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (type === 'text') {
      setTextAnswer(typeof initialAnswers === 'string' ? initialAnswers : '');
      setSelectedAnswers([]);
    } else {
      setSelectedAnswers(Array.isArray(initialAnswers) ? initialAnswers : []);
      setTextAnswer('');
    }
  }, [question]);

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
    <div className="max-w-3xl mx-auto">
      {/* Question Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white p-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Вопрос</h2>
          <span className="text-xs opacity-90">
            {
              type === 'text' ? 'Текстовый ответ' :
              type === 'multiple' ? 'Множественный выбор' : 
              'Одиночный выбор'
            }
          </span>
        </div>
      </div>

      {/* Question Content */}
      <div className="bg-white p-5 rounded-b-lg shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-5 text-center">
          {question}
        </h3>

        {/* Text Input for text type questions */}
        {type === 'text' && (
          <div className="mb-5">
            <input
              type="text"
              value={textAnswer}
              onChange={(e) => !isHost && setTextAnswer(e.target.value)}
              disabled={isHost}
              placeholder="Введите ваш ответ..."
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        )}

        {/* Options for single/multiple choice questions */}
        {type !== 'text' && (
          <div className="grid grid-cols-2 gap-2 mb-5">
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
            <div className="col-span-2 text-center text-gray-500 p-6">
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
              className={`px-6 py-2 rounded-lg font-bold text-base transition-all duration-200 ${
                (type === 'text' ? textAnswer.trim() : selectedAnswers.length > 0)
                  ? 'bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg cursor-pointer'
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
      </div>
    </div>
  );
};

export default QuizHomeworkContent;

