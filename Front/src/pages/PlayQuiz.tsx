import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { GraduationCap, Users, Clock, Play, ArrowRight } from 'lucide-react';
import QuizContent from '@/components/QuizContent';

interface QuestionData {
  question: string;
  type: string;
  timeLimit: number;
  options: string[];
  points: number;
}

const PlayQuiz: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isStudent, setIsStudent] = useState(false);
  
  // WebSocket states
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [authSent, setAuthSent] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [gameJoined, setGameJoined] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [gameCode, setGameCode] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [codeInput, setCodeInput] = useState<string>('');
  const [roundResult, setRoundResult] = useState<{
    correct: boolean;
    placement?: number;
    questionPoints: number;
  } | null>(null);
  const [gameFinished, setGameFinished] = useState<{
    placement: number;
    score: number;
    totalPlayers: number;
  } | null>(null);

  const gameCodeParam = searchParams.get('code');

  // WebSocket connection
  useEffect(() => {
    console.log('🔌 Подключаемся к WebSocket серверу...');
    const websocket = new WebSocket('ws://localhost:8765');
    
    websocket.onopen = () => {
      console.log('✅ WebSocket подключен');
      setWsConnected(true);
      setWs(websocket);
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📥 Получено сообщение:', message);
        
        // Проверяем, есть ли ключ question в сообщении
        if (message.question !== undefined) {
          console.log('❓ Получен вопрос:', message);
          setCurrentQuestion(message);
          setTimeLeft(message.timeLimit || 60);
          setTimerActive(true);
          setRoundResult(null); // Сбрасываем результат предыдущего раунда
          return;
        }
        
        // Обрабатываем сообщения с типом
        switch (message.type) {
          case 'welcome':
            console.log('👋 Приветствие от сервера:', message.message);
            break;
            
          case 'auth_attempt':
            console.log('🔐 Попытка аутентификации:', message.message);
            break;
            
          case 'auth_success':
            console.log('✅ Аутентификация успешна:', message.message);
            setAuthSuccess(true);
            break;
            
          case 'game_joined':
            console.log('🎮 Игра присоединена:', message.message);
            setGameJoined(true);
            break;
            
          case 'game_not_found':
            console.log('❌ Игра не найдена:', message.message);
            alert('Игра с таким кодом не найдена');
            break;
            
          case 'round_ended':
            console.log('🏁 Раунд завершен:', message);
            // Находим позицию текущего игрока в scoreboard
            let placement: number | undefined;
            if (message.scoreboard) {
              const sortedPlayers = Object.entries(message.scoreboard)
                .sort(([,a], [,b]) => ((b as [string, number])[1]) - ((a as [string, number])[1]));
              
              // Находим позицию текущего игрока (предполагаем, что playerName совпадает с именем в scoreboard)
              const playerEntry = sortedPlayers.find(([, playerData]) => 
                ((playerData as [string, number])[0]) === playerName
              );
              
              if (playerEntry) {
                placement = sortedPlayers.indexOf(playerEntry) + 1;
              }
            }
            
            setRoundResult({
              correct: message.correct,
              placement,
              questionPoints: message.question_points
            });
            setCurrentQuestion(null);
            setTimerActive(false);
            break;
            
          case 'game_finished':
            console.log('🏁 Игра завершена:', message);
            setGameFinished({
              placement: message.placement,
              score: message.score,
              totalPlayers: message.total_players
            });
            setCurrentQuestion(null);
            setRoundResult(null);
            setTimerActive(false);
            break;
            
          default:
            console.log('❓ Неизвестный тип сообщения:', message.type);
        }
      } catch (error) {
        console.error('❌ Ошибка парсинга сообщения:', error);
      }
    };

    websocket.onclose = (event) => {
      console.log('❌ WebSocket отключен:', event.code, event.reason);
      setWsConnected(false);
      setWs(null);
      setAuthSent(false);
      setAuthSuccess(false);
      setGameJoined(false);
      setCurrentQuestion(null);
      setTimeLeft(0);
      setTimerActive(false);
    };

    websocket.onerror = (error) => {
      console.error('❌ Ошибка WebSocket:', error);
      setWsConnected(false);
    };

    return () => {
      console.log('🔌 Закрываем WebSocket соединение');
      websocket.close();
    };
  }, []);

  // Send auth message when connected
  useEffect(() => {
    if (wsConnected && ws && !authSent) {
      console.log('🔐 Отправляем сообщение аутентификации...');
      const authMessage = { user_id: "oT7IGQCDBYpyv2KiDV4n" };
      console.log('📤 Отправляем AUTH:', authMessage);
      ws.send(JSON.stringify(authMessage));
      setAuthSent(true);
    }
  }, [wsConnected, ws, authSent]);

  // Join game when auth is successful and game code is provided
  useEffect(() => {
    const codeToUse = gameCode || gameCodeParam;
    if (wsConnected && ws && authSuccess && codeToUse && !gameJoined) {
      console.log('🎮 Присоединяемся к игре...');
      const joinMessage = { 
        code: codeToUse
      };
      console.log('📤 Отправляем JOIN_GAME:', joinMessage);
      ws.send(JSON.stringify(joinMessage));
      setGameJoined(true);
    }
  }, [wsConnected, ws, authSuccess, gameCode, gameCodeParam, gameJoined, playerName]);

  // Timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prevTime) => prevTime - 1);
      }, 1000);
    } else if (timeLeft === 0 && timerActive) {
      console.log('⏰ Время вышло!');
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  // Check user authentication and role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/auth');
        return;
      }

      // Check if user is student (not teacher)
      try {
        const { collection: firestoreCollection, query: firestoreQuery, where: firestoreWhere, getDocs: firestoreGetDocs } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const q = firestoreQuery(firestoreCollection(db, 'users'), firestoreWhere('userId', '==', user.uid));
        const querySnapshot = await firestoreGetDocs(q);
        
        if (querySnapshot.empty) {
          navigate('/auth');
          return;
        }
        
        const userData = querySnapshot.docs[0].data();
        
        if (userData.isTeacher) {
          alert('Учителя не могут участвовать в квизах как студенты.');
          navigate('/');
          return;
        }
        
        setIsStudent(true);
        setPlayerName(user.displayName || user.email || 'Студент');
      } catch (error) {
        console.error('Ошибка при проверке роли пользователя:', error);
        navigate('/auth');
        return;
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  // Function to handle code input
  const handleCodeSubmit = () => {
    if (codeInput.trim()) {
      setGameCode(codeInput.trim());
      // Update URL with the code
      const newUrl = `/play?code=${codeInput.trim()}`;
      window.history.pushState({}, '', newUrl);
    }
  };

  // Function to reset round result
  const resetRoundResult = () => {
    setRoundResult(null);
  };

  // Function to reset game
  const resetGame = () => {
    setGameFinished(null);
    setRoundResult(null);
    setCurrentQuestion(null);
    setTimerActive(false);
  };

  // Function to submit answer
  const submitAnswer = (answerIndices: number[]) => {
    if (ws && currentQuestion) {
      console.log('📝 Отправляем ответ:', answerIndices);
      const answerMessage = { 
        answer: answerIndices
      };
      console.log('📤 Отправляем ANSWER:', answerMessage);
      ws.send(JSON.stringify(answerMessage));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-lg">Загрузка...</div>
      </div>
    );
  }

  if (!isStudent) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-lg text-red-600">Доступ запрещен</div>
      </div>
    );
  }

  if (!gameCodeParam && !gameCode) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <GraduationCap className="h-16 w-16 text-blue-600 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Присоединиться к квизу</h1>
            <p className="text-gray-600 mb-8">Введите код игры, который дал вам учитель</p>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="gameCode" className="block text-sm font-medium text-gray-700 mb-2">
                  Код игры
                </label>
                <input
                  id="gameCode"
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="Введите код игры"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg font-mono tracking-wider"
                  maxLength={6}
                />
              </div>
              
              <Button
                onClick={handleCodeSubmit}
                disabled={!codeInput.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 text-lg cursor-pointer"
              >
                <Play className="h-5 w-5 mr-2" />
                Присоединиться к игре
              </Button>
              
              <Button
                onClick={() => navigate('/')}
                variant="outline"
                className="w-full cursor-pointer"
              >
                На главную
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full montserrat-600 bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <GraduationCap className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Участие в квизе</h1>
                <p className="text-gray-600">Игрок: {playerName}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {(gameCode || gameCodeParam) && (
                <div className="flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-mono">
                  <span className="mr-2">Код:</span>
                  <span className="font-bold">{gameCode || gameCodeParam}</span>
                </div>
              )}
              <div className={`flex items-center px-3 py-1 rounded-full text-sm ${
                wsConnected 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  wsConnected ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                {wsConnected ? 'Подключено' : 'Отключено'}
              </div>
              <Button
                onClick={() => navigate('/')}
                variant="outline"
                className="cursor-pointer"
              >
                Выйти
              </Button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          {gameFinished ? (
            /* Game Finished Display */
            <div className={`p-8 rounded-lg ${
              gameFinished.placement === 1 
                ? 'bg-gradient-to-br from-yellow-100 to-yellow-200 border-2 border-yellow-400' 
                : gameFinished.placement === 2
                ? 'bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-gray-400'
                : gameFinished.placement === 3
                ? 'bg-gradient-to-br from-orange-100 to-orange-200 border-2 border-orange-400'
                : 'bg-gradient-to-br from-blue-100 to-blue-200 border-2 border-blue-400'
            }`}>
              <div className="flex flex-col items-center">
                {/* Trophy Icon */}
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
                  gameFinished.placement === 1 
                    ? 'bg-yellow-500' 
                    : gameFinished.placement === 2
                    ? 'bg-gray-500'
                    : gameFinished.placement === 3
                    ? 'bg-orange-500'
                    : 'bg-blue-500'
                }`}>
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
                
                {/* Placement Text */}
                <h2 className={`text-4xl font-bold mb-4 ${
                  gameFinished.placement === 1 
                    ? 'text-yellow-800' 
                    : gameFinished.placement === 2
                    ? 'text-gray-800'
                    : gameFinished.placement === 3
                    ? 'text-orange-800'
                    : 'text-blue-800'
                }`}>
                  {gameFinished.placement === 1 ? '🥇 1-е место!' :
                   gameFinished.placement === 2 ? '🥈 2-е место!' :
                   gameFinished.placement === 3 ? '🥉 3-е место!' :
                   `${gameFinished.placement}-е место!`}
                </h2>
                
                {/* Score */}
                <div className={`text-2xl font-semibold mb-2 ${
                  gameFinished.placement === 1 
                    ? 'text-yellow-700' 
                    : gameFinished.placement === 2
                    ? 'text-gray-700'
                    : gameFinished.placement === 3
                    ? 'text-orange-700'
                    : 'text-blue-700'
                }`}>
                  Ваш счет: {gameFinished.score}
                </div>
                
                {/* Total Players */}
                <div className={`text-lg mb-6 ${
                  gameFinished.placement === 1 
                    ? 'text-yellow-600' 
                    : gameFinished.placement === 2
                    ? 'text-gray-600'
                    : gameFinished.placement === 3
                    ? 'text-orange-600'
                    : 'text-blue-600'
                }`}>
                  Всего игроков: {gameFinished.totalPlayers}
                </div>
                
                {/* Action Button */}
                <Button
                  onClick={() => navigate('/')}
                  className={`px-8 py-3 text-lg font-bold ${
                    gameFinished.placement === 1 
                      ? 'bg-yellow-600 hover:bg-yellow-700' 
                      : gameFinished.placement === 2
                      ? 'bg-gray-600 hover:bg-gray-700'
                      : gameFinished.placement === 3
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  } text-white cursor-pointer`}
                >
                  На главную
                </Button>
              </div>
            </div>
          ) : roundResult ? (
            /* Round Result Display */
            <div className={`p-8 rounded-lg ${
              roundResult.correct 
                ? 'bg-green-100 border-2 border-green-500' 
                : 'bg-red-100 border-2 border-red-500'
            }`}>
              <div className="flex flex-col items-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                  roundResult.correct ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  {roundResult.correct ? (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                
                <h2 className={`text-2xl font-bold mb-2 ${
                  roundResult.correct ? 'text-green-800' : 'text-red-800'
                }`}>
                  {roundResult.correct ? 'Правильно!' : 'Неправильно!'}
                </h2>
                
                {roundResult.placement && (
                  <p className={`text-lg font-semibold mb-2 ${
                    roundResult.correct ? 'text-green-700' : 'text-red-700'
                  }`}>
                    Ваше место: #{roundResult.placement}
                  </p>
                )}
                
                <p className={`text-sm mb-4 ${
                  roundResult.correct ? 'text-green-600' : 'text-red-600'
                }`}>
                  Баллы за вопрос: {roundResult.questionPoints}
                </p>
                
                <p className="text-gray-600 text-sm">
                  Ожидание следующего вопроса...
                </p>
              </div>
            </div>
          ) : currentQuestion ? (
            /* Question Display with Answer Selection */
            <QuizContent 
              questionData={currentQuestion} 
              timeLeft={timeLeft} 
              onSubmitAnswer={submitAnswer}
            />
          ) : (
            /* Waiting Screen */
            <div>
              <div className="mb-6">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Ожидание начала квиза</h2>
                <p className="text-gray-600 mb-6">
                  Вы присоединились к игре с кодом: <span className="font-mono font-bold text-blue-600">{gameCode || gameCodeParam}</span>
                </p>
              </div>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-center text-gray-600">
                  <Users className="h-5 w-5 mr-2" />
                  <span>Игрок: {playerName}</span>
                </div>
              </div>

              <div className="text-sm text-gray-500">
                <p>Статус подключения: {wsConnected ? '✅ Подключено' : '❌ Отключено'}</p>
                <p>Аутентификация: {authSent ? (authSuccess ? '✅ Успешна' : '⏳ Ожидание ответа') : '❌ Не отправлена'}</p>
                <p>Присоединение к игре: {gameJoined ? '✅ Присоединен' : (authSuccess ? '⏳ Готово к присоединению' : '❌ Ожидание аутентификации')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayQuiz;
