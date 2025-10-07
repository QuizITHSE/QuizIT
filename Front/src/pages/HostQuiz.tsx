import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { GraduationCap, Users, Clock, Play, Pause, Square } from 'lucide-react';
import QuizContent from '@/components/QuizContent';
import RoundResults from '@/components/RoundResults';
import GameResults from '@/components/GameResults';

interface Question {
  id: string;
  question: string;
  options: string[];
  correct: number[];
  type: string;
  points: string;
  timeLimit: number;
}

interface Quiz {
  id: string;
  title: string;
  questions: string[];
  owner: string;
  createdAt: any;
  updatedAt?: any;
}

interface QuestionData {
  question: string;
  type: string;
  timeLimit: number;
  options: string[];
  points: number;
}

interface RoundResultsData {
  right: number;
  wrong: number;
  by_answer: { [key: string]: number };
  question_points: number;
  total_possible_points: number;
  total_earned_points: number;
}

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

const HostQuiz: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // WebSocket states
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [gameCode, setGameCode] = useState<string | null>(null);
  const [authSent, setAuthSent] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [quizCreated, setQuizCreated] = useState(false);
  const [players, setPlayers] = useState<string[]>([]);
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [roundResults, setRoundResults] = useState<RoundResultsData | null>(null);
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(0);
  const [gameResults, setGameResults] = useState<GameResultsData | null>(null);

  const quizId = searchParams.get('id');

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
        
        // Проверяем, есть ли ключ players в сообщении
        if (message.players !== undefined) {
          console.log('👥 Список игроков:', message);
          setPlayers(message.players || []);
          return;
        }
        
        // Проверяем, есть ли ключ question в сообщении
        if (message.question !== undefined) {
          console.log('❓ Получен вопрос:', message);
          setCurrentQuestion(message);
          setTimeLeft(message.timeLimit || 60);
          setTimerActive(true);
          setCurrentQuestionNumber(prev => prev + 1); // Увеличиваем счетчик вопросов
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
            
          case 'game_created':
            console.log('🎮 Игра создана:', message);
            console.log('🔑 Код игры:', message.code);
            setGameCode(message.code);
            break;
            
          case 'quiz_info':
            console.log('📋 Информация о квизе:', message);
            break;
            
          case 'creating_game':
            console.log('🎮 Создание игры:', message.message);
            break;
            
          case 'round_results':
            console.log('📊 Результаты раунда:', message);
            setRoundResults(message.data);
            setCurrentQuestion(null); // Скрываем вопрос при показе результатов
            setTimerActive(false); // Останавливаем таймер
            break;
            
          case 'game_finished':
            console.log('🏁 Игра завершена:', message);
            setGameResults({
              leaderboard: message.leaderboard || [],
              total_questions: message.total_questions || 0,
              total_players: message.total_players || 0
            });
            setCurrentQuestion(null); // Скрываем вопрос
            setRoundResults(null); // Скрываем результаты раунда
            setTimerActive(false); // Останавливаем таймер
            break;
            
          case 'last_question_completed':
            console.log('🔚 Последний вопрос завершен:', message.message);
            break;
            
          case 'answers':
            console.log('📝 Количество ответов:', message);
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
      setQuizCreated(false);
      setPlayers([]);
      setQuizStarted(false);
      setCurrentQuestion(null);
      setTimeLeft(0);
      setTimerActive(false);
      setRoundResults(null);
      setCurrentQuestionNumber(0);
      setGameResults(null);
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

  // Send auth message when connected and user is authenticated
  useEffect(() => {
    const sendAuthMessage = async () => {
      if (wsConnected && ws && !authSent) {
        console.log('🔐 Проверяем аутентификацию пользователя...');
        
        // Wait for auth state to be ready
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            console.log('✅ Пользователь аутентифицирован, ищем document ID...');
            
            try {
              // Find the user document ID from the users collection
              const { collection: firestoreCollection, query: firestoreQuery, where: firestoreWhere, getDocs: firestoreGetDocs } = await import('firebase/firestore');
              const userQuery = firestoreQuery(
                firestoreCollection(db, 'users'), 
                firestoreWhere('userId', '==', user.uid)
              );
              
              const userSnapshot = await firestoreGetDocs(userQuery);
              console.log('📊 User query results:', {
                empty: userSnapshot.empty,
                size: userSnapshot.size,
                docs: userSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }))
              });
              
              if (userSnapshot.empty) {
                console.error('❌ User document not found for UID:', user.uid);
                unsubscribe();
                return;
              }
              
              const userDocId = userSnapshot.docs[0].id;
              console.log('✅ Found user document ID:', userDocId);
              
              // Send auth message with the document ID
              const authMessage = { user_id: userDocId };
              console.log('📤 Отправляем AUTH:', authMessage);
              ws.send(JSON.stringify(authMessage));
              setAuthSent(true);
              unsubscribe(); // Clean up the listener
              
            } catch (error) {
              console.error('❌ Ошибка при поиске user document:', error);
              unsubscribe();
            }
          } else {
            console.error('❌ Пользователь не аутентифицирован');
            unsubscribe(); // Clean up the listener
          }
        });
      }
    };

    sendAuthMessage();
  }, [wsConnected, ws, authSent]);

  // Send create quiz message when quiz is loaded AND auth is successful
  useEffect(() => {
    if (wsConnected && ws && quiz && quizId && authSuccess && !quizCreated) {
      console.log('🎮 Отправляем сообщение создания квиза...');
      const createQuizMessage = {quiz: "FrDJQ2INCzyCSyWFbXlv", group: "BJwLRRsHfCaUxNzIEc8P"}
      console.log('📤 Отправляем CREATE_QUIZ:', createQuizMessage);
      ws.send(JSON.stringify(createQuizMessage));
      setQuizCreated(true);
    }
  }, [wsConnected, ws, quiz, quizId, authSuccess, quizCreated]);

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

  // Function to start the quiz
  const startQuiz = () => {
    if (ws && !quizStarted) {
      console.log('🚀 Начинаем квиз...');
      const startMessage = { start: true };
      console.log('📤 Отправляем START:', startMessage);
      ws.send(JSON.stringify(startMessage));
      setQuizStarted(true);
    }
  };

  // Function to go to next question or show final results
  const nextQuestion = () => {
    if (ws) {
      const isLastQuestion = currentQuestionNumber >= questions.length;
      
      if (isLastQuestion) {
        console.log('🏁 Показываем финальные результаты...');
        const showResultsMessage = { show_results: true };
        console.log('📤 Отправляем SHOW_RESULTS:', showResultsMessage);
        ws.send(JSON.stringify(showResultsMessage));
      } else {
        console.log('➡️ Переходим к следующему вопросу...');
        const nextMessage = { next: true };
        console.log('📤 Отправляем NEXT:', nextMessage);
        ws.send(JSON.stringify(nextMessage));
      }
      
      setRoundResults(null); // Скрываем результаты
    }
  };

  // Check user authentication and role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/auth');
        return;
      }

      // Check if user is teacher
      try {
        const { collection: firestoreCollection, query: firestoreQuery, where: firestoreWhere, getDocs: firestoreGetDocs } = await import('firebase/firestore');
        const q = firestoreQuery(firestoreCollection(db, 'users'), firestoreWhere('userId', '==', user.uid));
        const querySnapshot = await firestoreGetDocs(q);
        
        if (querySnapshot.empty) {
          navigate('/auth');
          return;
        }
        
        const userData = querySnapshot.docs[0].data();
        setIsTeacher(userData.isTeacher);
        
        if (!userData.isTeacher) {
          alert('Доступ запрещен. Только учителя могут проводить квизы.');
          navigate('/');
          return;
        }
      } catch (error) {
        console.error('Ошибка при проверке роли пользователя:', error);
        navigate('/auth');
        return;
      }

      // Load quiz
      if (quizId) {
        await loadQuiz(quizId, user.uid);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [quizId, navigate]);

  const loadQuiz = async (id: string, userId: string) => {
    try {
      // Get quiz data
      const quizDoc = await getDoc(doc(db, 'quizes', id));
      if (!quizDoc.exists()) {
        alert('Квиз не найден');
        navigate('/');
        return;
      }

      const quizData = quizDoc.data() as Quiz;
      
      // Check if quiz belongs to current user
      if (quizData.owner !== userId) {
        alert('У вас нет прав для проведения этого квиза');
        navigate('/');
        return;
      }

      setQuiz({ ...quizData, id });

      // Load questions
      if (quizData.questions && quizData.questions.length > 0) {
        const loadedQuestions: Question[] = [];
        
        for (const questionId of quizData.questions) {
          try {
            const questionDoc = await getDoc(doc(db, 'questions', questionId));
            if (questionDoc.exists()) {
              const questionData = questionDoc.data();
              loadedQuestions.push({
                id: questionId,
                question: questionData.question || '',
                options: questionData.options || ['', '', '', ''],
                correct: questionData.correct || [],
                type: questionData.type || 'single',
                points: questionData.points || 'regular',
                timeLimit: questionData.timeLimit || 60,
              });
            }
          } catch (error) {
            console.error(`Ошибка при загрузке вопроса ${questionId}:`, error);
          }
        }
        
        setQuestions(loadedQuestions);
      }
    } catch (error) {
      console.error('Ошибка при загрузке квиза:', error);
      alert('Ошибка при загрузке квиза');
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-lg">Загрузка...</div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-lg text-red-600">Квиз не найден</div>
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
                <h1 className="text-2xl font-bold text-gray-900">{quiz.title}</h1>
                <p className="text-gray-600">{questions.length} вопросов</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-gray-600">
                <Users className="h-5 w-5 mr-2" />
                <span>Участники: {players.length}</span>
              </div>
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
                Назад
              </Button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          {gameResults ? (
            /* Final Results Display */
            <GameResults results={gameResults} />
          ) : roundResults ? (
            /* Round Results Display */
            <RoundResults 
              results={roundResults} 
              onNextQuestion={nextQuestion} 
              isLastQuestion={currentQuestionNumber >= questions.length}
            />
          ) : currentQuestion ? (
            /* Question Display */
            <QuizContent questionData={currentQuestion} timeLeft={timeLeft} />
          ) : (
            /* Waiting Screen */
            <div>
              <div className="mb-6">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Квиз готов к проведению!</h2>
                <p className="text-gray-600 mb-6">
                  Квиз "{quiz.title}" содержит {questions.length} вопросов
                </p>
              </div>
            
              {/* Game Code Display */}
              {gameCode ? (
                <div className="mb-6">
                  <p className="text-lg font-semibold text-gray-700 mb-2">Код для подключения игроков:</p>
                  <div className="bg-blue-100 text-blue-800 px-6 py-3 rounded-lg text-2xl font-mono font-bold inline-block">
                    {gameCode}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">Поделитесь этим кодом с игроками</p>
                  
                  {players.length > 0 && (
                    <div className="mt-4">
                      <p className="text-lg font-semibold text-gray-700 mb-2">Подключенные игроки:</p>
                      <div className="flex flex-wrap gap-2">
                        {players.map((player, index) => (
                          <span key={index} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                            {player}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mb-6">
                  <p className="text-lg font-semibold text-gray-700 mb-2">Ожидание создания игры...</p>
                  <div className="bg-yellow-100 text-yellow-800 px-6 py-3 rounded-lg text-lg">
                    {wsConnected ? 'Игра создается на сервере' : 'Ожидание подключения к серверу'}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {!currentQuestion && !roundResults && !gameResults && (
            <>
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-center text-gray-600">
                  <Clock className="h-5 w-5 mr-2" />
                  <span>Общее время: {questions.reduce((total, q) => total + q.timeLimit, 0)} секунд</span>
                </div>
              </div>

              {/* Start Quiz Button - показывается только если есть игроки */}
              {players.length > 0 && !quizStarted && (
                <div className="mb-8">
                  <Button
                    onClick={startQuiz}
                    className="bg-green-600 hover:bg-green-700 px-8 py-3 text-lg cursor-pointer"
                    disabled={!wsConnected}
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Начать квиз
                  </Button>
                  <p className="text-sm text-gray-500 mt-2">
                    {players.length} игрок{players.length === 1 ? '' : players.length < 5 ? 'а' : 'ов'} готов{players.length === 1 ? '' : players.length < 5 ? 'ы' : 'ы'} к игре
                  </p>
                </div>
              )}

              {/* Quiz Started Status */}
              {quizStarted && (
                <div className="mb-8">
                  <div className="bg-green-100 text-green-800 px-6 py-3 rounded-lg text-lg text-center">
                    <Play className="h-6 w-6 mx-auto mb-2" />
                    Квиз запущен!
                  </div>
                </div>
              )}

              <div className="text-sm text-gray-500">
                <p>Статус подключения: {wsConnected ? '✅ Подключено' : '❌ Отключено'}</p>
                <p>Аутентификация: {authSent ? (authSuccess ? '✅ Успешна' : '⏳ Ожидание ответа') : '❌ Не отправлена'}</p>
                <p>Создание игры: {quizCreated ? '✅ Отправлено' : (authSuccess ? '⏳ Готово к отправке' : '❌ Ожидание аутентификации')}</p>
                <p>Статус квиза: {quizStarted ? '🚀 Запущен' : (players.length > 0 ? '⏳ Готов к запуску' : '❌ Ожидание игроков')}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HostQuiz;