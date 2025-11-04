import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { GraduationCap, Users, Clock, Play, Pause, Square } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
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
  const groupId = searchParams.get('group');
  const gameMode = searchParams.get('gameMode') || 'normal';
  const disableCopy = searchParams.get('disableCopy') === 'true';
  const shuffleAnswers = searchParams.get('shuffleAnswers') === 'true';

  useEffect(() => {
    const websocket = new WebSocket('wss://thatisdreamer-quiz-it-back-1e40.twc1.net/ws');
    
    websocket.onopen = () => {
      setWsConnected(true);
      setWs(websocket);
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.players !== undefined) {
          setPlayers(message.players || []);
          return;
        }
        
        if (message.question !== undefined) {
          setCurrentQuestion(message);
          setTimeLeft(message.timeLimit || 60);
          setTimerActive(true);
          setCurrentQuestionNumber(prev => prev + 1); 
          return;
        }
        
        switch (message.type) {
          case 'welcome':
            break;
            
          case 'auth_attempt':
            break;
            
          case 'auth_success':
            setAuthSuccess(true);
            break;
            
          case 'game_created':
            setGameCode(message.code);
            break;
            
          case 'quiz_info':
            break;
            
          case 'creating_game':
            break;
            
          case 'round_results':
            setRoundResults(message.data);
            setCurrentQuestion(null); 
            setTimerActive(false); 
            break;
            
          case 'game_finished':
            setGameResults({
              leaderboard: message.leaderboard || [],
              total_questions: message.total_questions || 0,
              total_players: message.total_players || 0
            });
            setCurrentQuestion(null); 
            setRoundResults(null); 
            setTimerActive(false); 
            break;
            
          case 'last_question_completed':
            break;
            
          case 'answers':
            break;
            
          default:
        }
      } catch (error) {
      }
    };

    websocket.onclose = (event) => {
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
      setWsConnected(false);
    };

    return () => {
      websocket.close();
    };
  }, []);

  useEffect(() => {
    const sendAuthMessage = async () => {
      if (wsConnected && ws && !authSent) {
        
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            
            try {
              const userDoc = await getDoc(doc(db, 'users', user.uid));
              
              if (!userDoc.exists()) {
                unsubscribe();
                return;
              }
              
              
              const authMessage = { user_id: user.uid };
              ws.send(JSON.stringify(authMessage));
              setAuthSent(true);
              unsubscribe(); // Clean up the listener
              
            } catch (error) {
              unsubscribe();
            }
          } else {
            unsubscribe(); // Clean up the listener
          }
        });
      }
    };

    sendAuthMessage();
  }, [wsConnected, ws, authSent]);

  useEffect(() => {
    if (wsConnected && ws && quiz && quizId && groupId && authSuccess && !quizCreated) {
      const createQuizMessage = {
        quiz: quizId, 
        group: groupId, 
        game_type: {
          mode: gameMode,
          disable_copy: disableCopy,
          shuffle_answers: shuffleAnswers
        }
      };
      ws.send(JSON.stringify(createQuizMessage));
      setQuizCreated(true);
    }
  }, [wsConnected, ws, quiz, quizId, groupId, authSuccess, quizCreated, gameMode, disableCopy, shuffleAnswers]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prevTime) => prevTime - 1);
      }, 1000);
    } else if (timeLeft === 0 && timerActive) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  const startQuiz = () => {
    if (ws && !quizStarted) {
      const startMessage = { start: true };
      ws.send(JSON.stringify(startMessage));
      setQuizStarted(true);
    }
  };

  const nextQuestion = () => {
    if (ws) {
      const isLastQuestion = currentQuestionNumber >= questions.length;
      
      if (isLastQuestion) {
        const showResultsMessage = { show_results: true };
        ws.send(JSON.stringify(showResultsMessage));
      } else {
        const nextMessage = { next: true };
        ws.send(JSON.stringify(nextMessage));
      }
      
      setRoundResults(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/auth');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (!userDoc.exists()) {
          navigate('/auth');
          return;
        }
        
        const userData = userDoc.data();
        setIsTeacher(userData.isTeacher);
        
        if (!userData.isTeacher) {
          alert('Доступ запрещен. Только учителя могут проводить квизы.');
          navigate('/');
          return;
        }
      } catch (error) {
        navigate('/auth');
        return;
      }

      if (quizId) {
        await loadQuiz(quizId, user.uid);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [quizId, navigate]);

  const loadQuiz = async (id: string, userId: string) => {
    try {
      const quizDoc = await getDoc(doc(db, 'quizes', id));
      if (!quizDoc.exists()) {
        alert('Квиз не найден');
        navigate('/');
        return;
      }

      const quizData = quizDoc.data() as Quiz;
      
      if (quizData.owner !== userId) {
        alert('У вас нет прав для проведения этого квиза');
        navigate('/');
        return;
      }

      setQuiz({ ...quizData, id });

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
          }
        }
        
        setQuestions(loadedQuestions);
      }
    } catch (error) {
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
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-4 md:mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
            <div className="flex items-center">
              <GraduationCap className="h-6 w-6 md:h-8 md:w-8 text-blue-600 mr-2 md:mr-3 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg md:text-2xl font-bold text-gray-900 truncate">{quiz.title}</h1>
                <p className="text-sm md:text-base text-gray-600">{questions.length} вопросов</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:gap-4">
              <div className="flex items-center text-gray-600 text-sm md:text-base">
                <Users className="h-4 w-4 md:h-5 md:w-5 mr-1.5 md:mr-2 flex-shrink-0" />
                <span className="whitespace-nowrap">Участники: {players.length}</span>
              </div>
              <div className={`flex items-center px-2 md:px-3 py-1 rounded-full text-xs md:text-sm whitespace-nowrap ${
                wsConnected 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-1.5 md:mr-2 flex-shrink-0 ${
                  wsConnected ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                {wsConnected ? 'Подключено' : 'Отключено'}
              </div>
              <Button
                onClick={() => navigate('/')}
                variant="outline"
                className="cursor-pointer text-sm md:text-base whitespace-nowrap"
              >
                Назад
              </Button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-8 text-center">
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
            <QuizContent 
              questionData={currentQuestion} 
              timeLeft={timeLeft} 
              onSubmitAnswer={() => {}}
              isHost={true}
            />
          ) : (
            /* Waiting Screen */
            <div>
              <div className="mb-4 md:mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 md:mb-4">Квиз готов к проведению!</h2>
                <p className="text-base md:text-lg text-gray-600 mb-4 md:mb-6 px-2">
                  Квиз "{quiz.title}" содержит {questions.length} вопросов
                </p>
              </div>
            
              {/* Game Code Display */}
              {gameCode ? (
                <div className="mb-4 md:mb-6 px-2">
                  <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8">
                    {/* QR Code */}
                    <div className="flex flex-col items-center">
                      <p className="text-base md:text-lg font-semibold text-gray-700 mb-3">QR-код для присоединения:</p>
                      <div className="bg-white p-3 rounded-lg shadow-md">
                        <QRCodeSVG 
                          value={`${window.location.origin}/play?code=${gameCode}`} 
                          width={200} 
                          height={200}
                          level="M"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2 text-center max-w-[200px]">
                        Отсканируйте для быстрого присоединения
                      </p>
                    </div>
                    
                    {/* Code Display */}
                    <div className="flex flex-col items-center md:items-start">
                      <p className="text-base md:text-lg font-semibold text-gray-700 mb-2">Или введите код вручную:</p>
                      <div className="bg-blue-100 text-blue-800 px-4 md:px-6 py-3 md:py-4 rounded-lg text-xl md:text-2xl font-mono font-bold inline-block break-all max-w-full">
                        {gameCode}
                      </div>
                      <p className="text-xs md:text-sm text-gray-500 mt-2">Поделитесь этим кодом с игроками</p>
                    </div>
                  </div>
                  
                  {players.length > 0 && (
                    <div className="mt-6">
                      <p className="text-base md:text-lg font-semibold text-gray-700 mb-2 text-center">Подключенные игроки:</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {players.map((player, index) => (
                          <span key={index} className="bg-green-100 text-green-800 px-2 md:px-3 py-1 rounded-full text-xs md:text-sm break-words max-w-full">
                            {player}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mb-4 md:mb-6 px-2">
                  <p className="text-base md:text-lg font-semibold text-gray-700 mb-2">Ожидание создания игры...</p>
                  <div className="bg-yellow-100 text-yellow-800 px-4 md:px-6 py-2 md:py-3 rounded-lg text-sm md:text-lg break-words">
                    {wsConnected ? 'Игра создается на сервере' : 'Ожидание подключения к серверу'}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {!currentQuestion && !roundResults && !gameResults && (
            <>
              <div className="space-y-4 mb-6 md:mb-8">
                <div className="flex items-center justify-center text-gray-600 text-sm md:text-base">
                  <Clock className="h-4 w-4 md:h-5 md:w-5 mr-2 flex-shrink-0" />
                  <span className="break-words text-center">Общее время: {questions.reduce((total, q) => total + q.timeLimit, 0)} секунд</span>
                </div>
              </div>

              {/* Start Quiz Button - показывается только если есть игроки */}
              {players.length > 0 && !quizStarted && (
                <div className="mb-6 md:mb-8 px-2">
                  <Button
                    onClick={startQuiz}
                    className="w-full md:w-auto bg-green-600 hover:bg-green-700 px-6 md:px-8 py-4 md:py-3 text-base md:text-lg cursor-pointer"
                    disabled={!wsConnected}
                  >
                    <Play className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                    Начать квиз
                  </Button>
                  <p className="text-xs md:text-sm text-gray-500 mt-2">
                    {players.length} игрок{players.length === 1 ? '' : players.length < 5 ? 'а' : 'ов'} готов{players.length === 1 ? '' : players.length < 5 ? 'ы' : 'ы'} к игре
                  </p>
                </div>
              )}

              {/* Quiz Started Status */}
              {quizStarted && (
                <div className="mb-6 md:mb-8 px-2">
                  <div className="bg-green-100 text-green-800 px-4 md:px-6 py-2 md:py-3 rounded-lg text-base md:text-lg text-center">
                    <Play className="h-5 w-5 md:h-6 md:w-6 mx-auto mb-2" />
                    Квиз запущен!
                  </div>
                </div>
              )}

              <div className="text-xs md:text-sm text-gray-500 px-2 space-y-1 break-words">
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