import React from 'react';
import { Trophy, Users, Target, Award, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RoundResultsData {
  right: number;
  wrong: number;
  by_answer: { [key: string]: number };
  question_points: number;
  total_possible_points: number;
  total_earned_points: number;
}

interface RoundResultsProps {
  results: RoundResultsData;
  onNextQuestion: () => void;
  isLastQuestion: boolean;
}

const RoundResults: React.FC<RoundResultsProps> = ({ results, onNextQuestion, isLastQuestion }) => {
  const { right, wrong, by_answer, question_points, total_possible_points, total_earned_points } = results;
  const totalAnswers = right + wrong;
  const correctPercentage = totalAnswers > 0 ? Math.round((right / totalAnswers) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Results Header */}
      <div className="bg-gradient-to-r from-green-600 to-blue-700 text-white p-6 rounded-t-lg">
        <div className="flex items-center justify-center mb-4">
          <Trophy className="h-8 w-8 mr-3" />
          <h2 className="text-3xl font-bold">Результаты раунда</h2>
        </div>
        <div className="text-center">
          <div className="text-6xl font-bold mb-2">{correctPercentage}%</div>
          <div className="text-lg opacity-90">правильных ответов</div>
        </div>
      </div>

      {/* Results Content */}
      <div className="bg-white p-8 rounded-b-lg shadow-lg">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center">
            <div className="flex items-center justify-center mb-3">
              <Target className="h-6 w-6 text-green-600 mr-2" />
              <span className="text-lg font-semibold text-green-800">Правильные</span>
            </div>
            <div className="text-3xl font-bold text-green-600">{right}</div>
            <div className="text-sm text-green-600">ответов</div>
          </div>

          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
            <div className="flex items-center justify-center mb-3">
              <Users className="h-6 w-6 text-red-600 mr-2" />
              <span className="text-lg font-semibold text-red-800">Неправильные</span>
            </div>
            <div className="text-3xl font-bold text-red-600">{wrong}</div>
            <div className="text-sm text-red-600">ответов</div>
          </div>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 text-center">
            <div className="flex items-center justify-center mb-3">
              <Award className="h-6 w-6 text-blue-600 mr-2" />
              <span className="text-lg font-semibold text-blue-800">Всего</span>
            </div>
            <div className="text-3xl font-bold text-blue-600">{totalAnswers}</div>
            <div className="text-sm text-blue-600">ответов</div>
          </div>
        </div>

        {/* Answer Distribution */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">Распределение ответов</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(by_answer).map(([answerIndex, count]) => {
              const letter = String.fromCharCode(65 + parseInt(answerIndex));
              const percentage = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0;
              
              return (
                <div key={answerIndex} className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-800 mb-2">{letter}</div>
                  <div className="text-3xl font-bold text-blue-600 mb-1">{count}</div>
                  <div className="text-sm text-gray-600">{percentage}%</div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Points Information */}
        <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">Информация о баллах</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-600 mb-1">Баллы за вопрос</div>
              <div className="text-2xl font-bold text-gray-800">{question_points}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Максимум баллов</div>
              <div className="text-2xl font-bold text-gray-800">{total_possible_points}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Заработано баллов</div>
              <div className="text-2xl font-bold text-green-600">{total_earned_points}</div>
            </div>
          </div>
        </div>

        {/* Next Question Button */}
        <div className="mt-8 text-center">
          <Button
            onClick={onNextQuestion}
            className={`px-8 py-3 text-lg cursor-pointer ${
              isLastQuestion 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <ArrowRight className="h-5 w-5 mr-2" />
            {isLastQuestion ? 'Показать результаты' : 'Следующий вопрос'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RoundResults;
