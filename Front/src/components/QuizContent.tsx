import React, { useState } from 'react';
import { Clock } from 'lucide-react';

interface QuestionData {
  question: string;
  type: string;
  timeLimit: number;
  options: string[];
  points: number;
}

interface QuizContentProps {
  questionData: QuestionData;
  timeLeft: number;
  onSubmitAnswer: (answer: number[]) => void;
  isHost?: boolean;
}

const QuizContent: React.FC<QuizContentProps> = ({ questionData, timeLeft, onSubmitAnswer, isHost = false }) => {
  const { question, type, options, points } = questionData;
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);

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
          <span className="text-sm opacity-90">Тип: {type === 'multiple' ? 'Множественный выбор' : 'Одиночный выбор'}</span>
          <span className="text-sm opacity-90">{points} балл{points === 1 ? '' : points < 5 ? 'а' : 'ов'}</span>
        </div>
      </div>

      {/* Question Content */}
      <div className="bg-white p-8 rounded-b-lg shadow-lg">
        <h3 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          {isHost ? question : 'Выберите правильный ответ'}
        </h3>

        {/* Options */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {options.map((option, index) => (
            <button
              key={index}
              onClick={() => !isHost && handleAnswerSelect(index)}
              disabled={isHost}
              className={`border-2 rounded-lg p-6 transition-all duration-200 ${
                isHost 
                  ? 'border-gray-300 bg-gray-100 cursor-default'
                  : selectedAnswers.includes(index)
                  ? 'border-blue-600 bg-blue-100 shadow-lg transform scale-105 cursor-pointer'
                  : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
              }`}
            >
              <div className="flex flex-col items-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl mb-2 ${
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
          ))}
        </div>

        {/* Submit Button - Only show for students */}
        {!isHost && (
          <div className="text-center">
            <button
              onClick={handleSubmit}
              disabled={selectedAnswers.length === 0}
              className={`px-8 py-3 rounded-lg font-bold text-lg transition-all duration-200 ${
                selectedAnswers.length > 0
                  ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg hover:shadow-xl cursor-pointer'
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
