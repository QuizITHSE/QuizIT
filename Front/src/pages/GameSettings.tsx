import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ArrowLeft, Play, Users } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  students: string[];
}

type GameMode = 'normal' | 'lockdown' | 'tab_tracking';

const GameSettings: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [quizTitle, setQuizTitle] = useState<string>('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [gameMode, setGameMode] = useState<GameMode>('normal');
  
  const quizId = searchParams.get('id');

  useEffect(() => {
    let isMounted = true;
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      
      if (!isMounted) return;
      
      if (!user) {
        setLoading(false);
        navigate('/auth');
        return;
      }

      try {
        if (!quizId) {
          alert('ID квиза не указан');
          setLoading(false);
          navigate('/');
          return;
        }

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (!isMounted) return;
        
        if (!userDoc.exists()) {
          alert('Ошибка: данные пользователя не найдены');
          setLoading(false);
          navigate('/');
          return;
        }
        

        const quizDocument = await getDoc(doc(db, 'quizes', quizId));
        
        if (!isMounted) return;
        
        if (quizDocument.exists()) {
          const quizData = quizDocument.data();
          setQuizTitle(quizData.title || 'Квиз без названия');
        } else {
          alert('Квиз не найден');
          setLoading(false);
          navigate('/');
          return;
        }

        const groupsQuery = query(
          collection(db, 'groups'),
          where('admin', '==', user.uid) 
        );
        const groupsSnapshot = await getDocs(groupsQuery);
        
        if (!isMounted) return;
        
        const groupsData: Group[] = [];
        
        groupsSnapshot.forEach((doc) => {
          const data = doc.data();
          groupsData.push({
            id: doc.id,
            name: data.name || 'Без названия',
            students: Array.isArray(data.students) ? data.students : []
          });
        });

        setGroups(groupsData);
        setLoading(false);
      } catch (error) {
        if (isMounted) {
          alert('Произошла ошибка при загрузке данных: ' + (error as Error).message);
          setLoading(false);
          navigate('/');
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [navigate, quizId]);

  const handleStartGame = () => {
    if (!selectedGroup) {
      alert('Пожалуйста, выберите класс');
      return;
    }
    
    navigate(`/host?id=${quizId}&group=${selectedGroup}&gameMode=${gameMode}`);
  };

  const handleBack = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-lg">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-purple-50 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Настройки игры</h1>
            <Button
              onClick={handleBack}
              variant="outline"
              className="cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h2 className="text-xl font-semibold text-blue-900 mb-2">
              {quizTitle}
            </h2>
            <p className="text-blue-700 text-sm">
              Выберите класс для игры
            </p>
          </div>

          {/* Group Selection */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="group" className="text-lg font-semibold mb-2 block">
                Выберите класс
              </Label>
              
              {groups.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800">
                    У вас пока нет созданных классов. Создайте класс, чтобы начать игру.
                  </p>
                  <Button
                    onClick={() => navigate('/create-group')}
                    className="mt-4 bg-yellow-600 hover:bg-yellow-700 cursor-pointer"
                  >
                    Создать класс
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      onClick={() => setSelectedGroup(group.id)}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                        selectedGroup === group.id
                          ? 'border-blue-600 bg-blue-50 shadow-md'
                          : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div
                            className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                              selectedGroup === group.id
                                ? 'border-blue-600 bg-blue-600'
                                : 'border-gray-300'
                            }`}
                          >
                            {selectedGroup === group.id && (
                              <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{group.name}</h3>
                            <div className="flex items-center text-sm text-gray-600 mt-1">
                              <Users className="h-4 w-4 mr-1" />
                              <span>{Array.isArray(group.students) ? group.students.length : 0} студентов</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Game Mode Selection */}
            {groups.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">Режим игры</h3>
                <div className="space-y-3">
                  {/* Normal Mode */}
                  <div 
                    onClick={() => setGameMode('normal')}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      gameMode === 'normal'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <div className="flex items-center">
                      <div
                        className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                          gameMode === 'normal'
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-gray-300'
                        }`}
                      >
                        {gameMode === 'normal' && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">Обычный режим</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Стандартная игра без дополнительных ограничений
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Lockdown Mode */}
                  <div 
                    onClick={() => setGameMode('lockdown')}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      gameMode === 'lockdown'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <div className="flex items-center">
                      <div
                        className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                          gameMode === 'lockdown'
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-gray-300'
                        }`}
                      >
                        {gameMode === 'lockdown' && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">Режим блокировки (Lockdown)</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Студенты должны оставаться в полноэкранном режиме
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Tab Tracking Mode */}
                  <div 
                    onClick={() => setGameMode('tab_tracking')}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      gameMode === 'tab_tracking'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <div className="flex items-center">
                      <div
                        className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                          gameMode === 'tab_tracking'
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-gray-300'
                        }`}
                      >
                        {gameMode === 'tab_tracking' && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">Отслеживание вкладок</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Отслеживание переключений на другие вкладки/приложения
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Start Button */}
            {groups.length > 0 && (
              <div className="pt-6 border-t border-gray-200">
                <Button
                  onClick={handleStartGame}
                  disabled={!selectedGroup}
                  className={`w-full py-6 text-lg font-bold ${
                    selectedGroup
                      ? 'bg-green-600 hover:bg-green-700 cursor-pointer'
                      : 'bg-gray-300 cursor-not-allowed'
                  }`}
                >
                  <Play className="h-5 w-5 mr-2" />
                  Начать игру
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            ℹ️ Информация
          </h3>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Выберите класс, для которого будет проводиться игра</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Студенты смогут присоединиться к игре по коду</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Вы сможете отслеживать прогресс всех участников</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GameSettings;
