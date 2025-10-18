import React, { useState, useEffect } from 'react';

interface QuestionData {
  question: string;
  type: string;
  options: string[];
}

interface QuizHomeworkContentProps {
  questionData: QuestionData;
  onSubmitAnswer: (answer: number[]) => void;
  isHost?: boolean;
  initialAnswers?: number[];
}

const QuizHomeworkContent: React.FC<QuizHomeworkContentProps> = ({ 
  questionData, 
  onSubmitAnswer, 
  isHost = false,
  initialAnswers = []
}) => {
  const { question, type, options } = questionData;
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>(initialAnswers);

  // Сбрасываем выбранные ответы только при смене вопроса
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setSelectedAnswers(initialAnswers);
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
    if (selectedAnswers.length > 0) {
      onSubmitAnswer(selectedAnswers);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Question Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white p-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Вопрос</h2>
          <span className="text-xs opacity-90">
            {type === 'multiple' ? 'Множественный выбор' : 'Одиночный выбор'}
          </span>
        </div>
      </div>

      {/* Question Content */}
      <div className="bg-white p-5 rounded-b-lg shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-5 text-center">
          {question}
        </h3>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {options && Array.isArray(options) ? options.map((option, index) => (
            <button
              key={index}
              onClick={() => !isHost && handleAnswerSelect(index)}
              disabled={isHost}
              className={`border-2 rounded-lg p-4 transition-all duration-200 ${
                isHost 
                  ? 'border-gray-300 bg-gray-100 cursor-default'
                  : selectedAnswers.includes(index)
                  ? 'border-blue-600 bg-blue-100 shadow-md transform scale-105 cursor-pointer'
                  : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
              }`}
            >
              <div className="flex flex-col items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mb-2 ${
                  isHost
                    ? 'bg-gray-400 text-white'
                    : selectedAnswers.includes(index)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-700'
                }`}>
                  {index + 1}
                </div>
                <span className="text-sm font-medium text-gray-800 text-center">{option}</span>
              </div>
            </button>
          )) : (
            <div className="col-span-2 text-center text-gray-500 p-6">
              Нет доступных вариантов ответа
            </div>
          )}
        </div>

        {/* Submit Button - Only show for students */}
        {!isHost && (
          <div className="text-center">
            <button
              onClick={handleSubmit}
              disabled={selectedAnswers.length === 0}
              className={`px-6 py-2 rounded-lg font-bold text-base transition-all duration-200 ${
                selectedAnswers.length > 0
                  ? 'bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg cursor-pointer'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {selectedAnswers.length > 0 
                ? `Отправить ответ${selectedAnswers.length > 1 ? 'ы' : ''} (${selectedAnswers.map(i => i + 1).join(', ')})`
                : 'Выберите ответ'
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizHomeworkContent;

