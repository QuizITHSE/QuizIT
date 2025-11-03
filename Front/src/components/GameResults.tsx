import React from 'react';
import { Trophy, Users, Target, Award, Medal, Crown } from 'lucide-react';

interface LeaderboardEntry {
  place: number;
  username: string;
  score: number;
  user_id: string;
}

interface GameResultsData {
  leaderboard: LeaderboardEntry[];
  total_questions: number;
  total_players: number;
}

interface GameResultsProps {
  results: GameResultsData;
}

const GameResults: React.FC<GameResultsProps> = ({ results }) => {
  const { leaderboard, total_questions, total_players } = results;
  const totalPossiblePoints = total_questions; // Assuming 1 point per question
  const averageScore = leaderboard.length > 0 
    ? Math.round(leaderboard.reduce((sum, player) => sum + player.score, 0) / leaderboard.length * 10) / 10
    : 0;

  const getPlaceIcon = (place: number) => {
    switch (place) {
      case 1:
        return <Crown className="h-6 w-6 text-yellow-200" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-200" />;
      case 3:
        return <Medal className="h-6 w-6 text-amber-200" />;
      default:
        return <span className="text-lg font-bold text-white">#{place}</span>;
    }
  };

  const getPlaceColor = (place: number) => {
    switch (place) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white';
      case 2:
        return 'bg-gradient-to-r from-gray-300 to-gray-500 text-white';
      case 3:
        return 'bg-gradient-to-r from-amber-400 to-amber-600 text-white';
      default:
        return 'bg-gray-800 text-white';
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Results Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-700 text-white p-8 rounded-t-lg">
        <div className="flex items-center justify-center mb-6">
          <Trophy className="h-12 w-12 mr-4" />
          <h1 className="text-4xl font-bold">Игра завершена!</h1>
        </div>
        
        {/* Game Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="bg-black bg-opacity-30 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center justify-center mb-2">
              <Target className="h-6 w-6 mr-2 text-white" />
              <span className="text-lg font-semibold text-white">Вопросов</span>
            </div>
            <div className="text-3xl font-bold text-white">{total_questions}</div>
          </div>
          
          <div className="bg-black bg-opacity-30 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center justify-center mb-2">
              <Users className="h-6 w-6 mr-2 text-white" />
              <span className="text-lg font-semibold text-white">Игроков</span>
            </div>
            <div className="text-3xl font-bold text-white">{total_players}</div>
          </div>
          
          <div className="bg-black bg-opacity-30 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center justify-center mb-2">
              <Award className="h-6 w-6 mr-2 text-white" />
              <span className="text-lg font-semibold text-white">Средний балл</span>
            </div>
            <div className="text-3xl font-bold text-white">{averageScore}</div>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-white p-8 rounded-b-lg shadow-lg">
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Таблица лидеров
        </h2>
        
        {leaderboard.length > 0 ? (
          <div className="space-y-4">
            {leaderboard.map((player, index) => (
              <div
                key={player.user_id}
                className={`rounded-lg p-6 transition-all duration-300 hover:shadow-lg ${getPlaceColor(player.place)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-12 h-12 mr-4">
                      {getPlaceIcon(player.place)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{player.username}</h3>
                      <p className="text-sm text-white font-medium">
                        {player.score} из {totalPossiblePoints} баллов
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">{player.score}</div>
                    <div className="text-sm text-white font-medium">баллов</div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="w-full bg-black bg-opacity-20 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all duration-1000 ${
                        player.place === 1 ? 'bg-yellow-100' :
                        player.place === 2 ? 'bg-gray-100' :
                        player.place === 3 ? 'bg-amber-100' : 'bg-white'
                      }`}
                      style={{ width: `${(player.score / totalPossiblePoints) * 100}%` }}
                    ></div>
                  </div>
                  <div className="text-xs mt-1 text-white font-semibold">
                    {Math.round((player.score / totalPossiblePoints) * 100)}% правильных ответов
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">Нет результатов</h3>
            <p className="text-gray-500">Игроки не участвовали в квизе</p>
          </div>
        )}

        {/* Summary */}
        {leaderboard.length > 0 && (
          <div className="mt-8 bg-gray-50 rounded-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">Статистика игры</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {leaderboard[0]?.score || 0}
                </div>
                <div className="text-sm text-gray-600">Лучший результат</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {totalPossiblePoints}
                </div>
                <div className="text-sm text-gray-600">Максимум баллов</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameResults;
