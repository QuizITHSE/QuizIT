import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { getDoc, doc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { GraduationCap, Users, Clock, Play, ArrowRight } from 'lucide-react';
import QuizContent from '@/components/QuizContent';

interface QuestionData {
  question: string;
  type: string;
  timeLimit: number;
  options: string[];
  points: number;
  textAnswer?: string;
}

const PlayQuiz: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isStudent, setIsStudent] = useState(false);
  
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
    missed?: boolean;
    message?: string;
  } | null>(null);
  const [gameFinished, setGameFinished] = useState<{
    placement: number;
    score: number;
    totalPlayers: number;
  } | null>(null);
  const [finishedGameId, setFinishedGameId] = useState<string | null>(null);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<'normal' | 'lockdown' | 'tab_tracking'>('normal');
  const [disableCopy, setDisableCopy] = useState<boolean>(false);
  const [isKicked, setIsKicked] = useState(false);
  const [kickReason, setKickReason] = useState<string>('');

  const gameCodeParam = searchParams.get('code');

  useEffect(() => {
    const websocket = new WebSocket('wss://thatisdreamer-quiz-it-back-1e40.twc1.net/ws');
    
    websocket.onopen = () => {
      setWsConnected(true);
      setWs(websocket);
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.question !== undefined) {
          setCurrentQuestion(message);
          setTimeLeft(message.timeLimit || 60);
          setTimerActive(true);
          setRoundResult(null); 
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
            
          case 'joined':
            setGameJoined(true);
            if (message.game_settings?.mode) {
              setGameMode(message.game_settings.mode);
            }
            if (message.game_settings?.disable_copy !== undefined) {
              setDisableCopy(message.game_settings.disable_copy);
            }
            break;
            
          case 'game_joined':
            setGameJoined(true);
            break;
            
          case 'game_not_found':
            alert('Игра с таким кодом не найдена');
            break;
            
          case 'round_ended':
            let placement: number | undefined;
            if (message.scoreboard) {
              const sortedPlayers = Object.entries(message.scoreboard)
                .sort(([,a], [,b]) => ((b as [string, number])[1]) - ((a as [string, number])[1]));
              
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
              questionPoints: message.question_points,
              missed: message.missed || false,
              message: message.message
            });
            setCurrentQuestion(null);
            setTimerActive(false);
            break;
            
          case 'game_finished':
            setGameFinished({
              placement: message.placement,
              score: message.score,
              totalPlayers: message.total_players
            });
            setCurrentQuestion(null);
            setRoundResult(null);
            setTimerActive(false);
            // Find gameId by game code
            if (gameCode || gameCodeParam) {
              findGameIdByCode(gameCode || gameCodeParam || '');
            }
            break;
            
          case 'kicked':
            setIsKicked(true);
            setKickReason(message.message || 'Вы были удалены из игры');
            setCurrentQuestion(null);
            setRoundResult(null);
            setTimerActive(false);
            break;
            
          case 'tab_switch_recorded':
            break;
            
          case 'player_removed':
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
      setGameJoined(false);
      setCurrentQuestion(null);
      setTimeLeft(0);
      setTimerActive(false);
    };

    websocket.onerror = (error) => {
      setWsConnected(false);
    };

    return () => {
      websocket.close();
    };
  }, []);

  useEffect(() => {
    if (wsConnected && ws && !authSent && userUid) {
      const authMessage = { user_id: userUid };
      ws.send(JSON.stringify(authMessage));
      setAuthSent(true);
    }
  }, [wsConnected, ws, authSent, userUid]);

  useEffect(() => {
    const codeToUse = gameCode || gameCodeParam;
    if (wsConnected && ws && authSuccess && codeToUse && !gameJoined) {
      const joinMessage = { 
        code: codeToUse
      };
      ws.send(JSON.stringify(joinMessage));
      setGameJoined(true);
    }
  }, [wsConnected, ws, authSuccess, gameCode, gameCodeParam, gameJoined, playerName]);

  const reportCheating = useCallback(() => {
    if (ws && ws.readyState === WebSocket.OPEN && gameJoined) {
      const reportMessage = { 
        report: "switched_tabs"
      };
      try {
        ws.send(JSON.stringify(reportMessage));
      } catch (error) {
      }
    } else {
    }
  }, [ws, gameJoined]);

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

  useEffect(() => {
    if (!gameJoined || gameMode === 'normal') {
      return;
    }

    // Check if device is mobile
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                           (window.innerWidth <= 768);

    let blurTimeout: NodeJS.Timeout | null = null;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (gameMode === 'lockdown') {
          if (isMobileDevice) {
            // On mobile in lockdown mode, just disconnect instead of reporting cheating
            if (ws) {
              ws.close();
            }
            navigate('/');
          } else {
            reportCheating();
          }
        } else if (gameMode === 'tab_tracking') {
          // In tab_tracking mode, always report violations regardless of device
          reportCheating();
        }
      }
    };

    const handleBlur = () => {
      if (blurTimeout) {
        clearTimeout(blurTimeout);
      }
      
      blurTimeout = setTimeout(() => {
        if (document.hidden) {
          if (gameMode === 'lockdown') {
            if (isMobileDevice) {
              // On mobile in lockdown mode, just disconnect instead of reporting cheating
              if (ws) {
                ws.close();
              }
              navigate('/');
            } else {
              reportCheating();
            }
          } else if (gameMode === 'tab_tracking') {
            // In tab_tracking mode, always report violations regardless of device
            reportCheating();
          }
        }
      }, 500);
    };

    // Helper function to check if fullscreen is supported
    const isFullscreenSupported = () => {
      return !!(
        document.fullscreenEnabled ||
        (document as any).webkitFullscreenEnabled ||
        (document as any).mozFullScreenEnabled ||
        (document as any).msFullscreenEnabled
      );
    };

    // Helper function to get fullscreen element
    const getFullscreenElement = () => {
      return (
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
    };

    // Helper function to request fullscreen
    const requestFullscreen = async (elem: HTMLElement) => {
      if (elem.requestFullscreen) {
        return elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        return (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).mozRequestFullScreen) {
        return (elem as any).mozRequestFullScreen();
      } else if ((elem as any).msRequestFullscreen) {
        return (elem as any).msRequestFullscreen();
      }
      throw new Error('Fullscreen API is not supported');
    };

    const handleFullscreenChange = () => {
      const isFullscreen = !!getFullscreenElement();
      if (gameMode === 'lockdown' && !isFullscreen) {
        if (isMobileDevice) {
          // On mobile, just disconnect instead of reporting cheating
          if (ws) {
            ws.close();
          }
          navigate('/');
        } else {
          reportCheating();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    
    // Add fullscreen change listeners for all browsers
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    if (gameMode === 'lockdown' && gameJoined && !getFullscreenElement()) {
      if (isFullscreenSupported()) {
        const elem = document.documentElement;
        requestFullscreen(elem).catch((err) => {
          console.error('Fullscreen error:', err);
          // On mobile, fullscreen might not be supported, so we don't block the quiz
          // The quiz will continue but without fullscreen protection
        });
      } else {
        // Fullscreen is not supported (likely mobile), allow quiz to continue
        console.warn('Fullscreen API is not supported on this device');
      }
    }

    return () => {
      if (blurTimeout) {
        clearTimeout(blurTimeout);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [gameJoined, gameMode, reportCheating, ws]);

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
        
        if (userData.isTeacher) {
          alert('Учителя не могут участвовать в квизах как студенты.');
          navigate('/');
          return;
        }
        
        setIsStudent(true);
        setPlayerName(user.displayName || user.email || 'Студент');
        setUserUid(user.uid);
      } catch (error) {
        navigate('/auth');
        return;
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  const findGameIdByCode = async (code: string) => {
    try {
      const gamesQuery = query(
        collection(db, 'games'),
        where('code', '==', code.toUpperCase()),
        where('game_finished', '==', true)
      );
      const gamesSnapshot = await getDocs(gamesQuery);
      if (!gamesSnapshot.empty) {
        setFinishedGameId(gamesSnapshot.docs[0].id);
      }
    } catch (error) {
      // Error finding gameId, button won't show
    }
  };

  const handleCodeSubmit = () => {
    if (codeInput.trim()) {
      setGameCode(codeInput.trim());
      const newUrl = `/play?code=${codeInput.trim()}`;
      window.history.pushState({}, '', newUrl);
    }
  };

  const resetRoundResult = () => {
    setRoundResult(null);
  };

  const resetGame = () => {
    setGameFinished(null);
    setRoundResult(null);
    setCurrentQuestion(null);
    setTimerActive(false);
    setFinishedGameId(null);
  };

  const submitAnswer = (answer: number[] | string) => {
    if (ws && currentQuestion) {
      const answerMessage = { 
        answer: answer
      };
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
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-4 py-8">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 md:p-8">
          <div className="text-center">
            <GraduationCap className="h-12 w-12 md:h-16 md:w-16 text-blue-600 mx-auto mb-4 md:mb-6" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 md:mb-4">Присоединиться к квизу</h1>
            <p className="text-sm md:text-base text-gray-600 mb-6 md:mb-8">Введите код игры, который дал вам учитель</p>
            
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
                  className="w-full px-4 py-3 md:py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-base md:text-lg font-mono tracking-wider"
                  maxLength={6}
                />
              </div>
              
              <Button
                onClick={handleCodeSubmit}
                disabled={!codeInput.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-4 md:py-3 text-base md:text-lg cursor-pointer"
              >
                <Play className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                Присоединиться к игре
              </Button>
              
              <Button
                onClick={() => navigate('/')}
                variant="outline"
                className="w-full cursor-pointer text-base md:text-base"
              >
                На главную
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isKicked) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            
            <h2 className="text-3xl font-bold text-red-800 mb-4">
              Удалены из игры
            </h2>
            
            <p className="text-lg text-gray-700 mb-6">
              {kickReason}
            </p>
            
            <Button
              onClick={() => navigate('/')}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-3 text-lg cursor-pointer"
            >
              На главную
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full montserrat-600 bg-gray-50">
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-8 w-full">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-4 md:mb-6 overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
            <div className="flex items-center">
              <GraduationCap className="h-8 w-8 md:h-8 md:w-8 text-blue-600 mr-3 md:mr-3 flex-shrink-0" />
              <div className="flex-1">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">Участие в квизе</h1>
                <p className="text-base md:text-base text-gray-600">Игрок: {playerName}</p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 md:gap-4 w-full md:w-auto">
              {(gameCode || gameCodeParam) && (
                <div className="flex items-center bg-blue-100 text-blue-800 px-3 md:px-3 py-1.5 md:py-1 rounded-full text-sm md:text-sm font-mono w-full md:w-auto justify-center md:justify-start">
                  <span className="mr-2 md:mr-2">Код:</span>
                  <span className="font-bold">{gameCode || gameCodeParam}</span>
                </div>
              )}
              {gameMode !== 'normal' && (
                <div className={`flex items-center px-3 md:px-3 py-1.5 md:py-1 rounded-full text-sm md:text-sm font-semibold w-full md:w-auto justify-center md:justify-start ${
                  gameMode === 'lockdown' 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {gameMode === 'lockdown' ? '🔒 Режим блокировки' : '👁️ Отслеживание вкладок'}
                </div>
              )}
              <div className={`flex items-center px-3 md:px-3 py-1.5 md:py-1 rounded-full text-sm md:text-sm w-full md:w-auto justify-center md:justify-start ${
                wsConnected 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                <div className={`w-2.5 h-2.5 md:w-2 md:h-2 rounded-full mr-2 md:mr-2 flex-shrink-0 ${
                  wsConnected ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                {wsConnected ? 'Подключено' : 'Отключено'}
              </div>
              <Button
                onClick={() => navigate('/')}
                variant="outline"
                className="cursor-pointer text-sm md:text-sm w-full md:w-auto"
              >
                Выйти
              </Button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-8 text-center">
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
                
                {/* Action Buttons */}
                <div className="flex flex-col md:flex-row gap-3 mt-4">
                  {finishedGameId && userUid && (
                    <Button
                      onClick={() => navigate(`/student-quiz-details?gameId=${finishedGameId}&studentId=${userUid}`)}
                      className={`px-6 py-3 text-base font-bold ${
                        gameFinished.placement === 1 
                          ? 'bg-purple-600 hover:bg-purple-700' 
                          : gameFinished.placement === 2
                          ? 'bg-purple-600 hover:bg-purple-700'
                          : gameFinished.placement === 3
                          ? 'bg-purple-600 hover:bg-purple-700'
                          : 'bg-purple-600 hover:bg-purple-700'
                      } text-white cursor-pointer`}
                    >
                      Посмотреть результаты
                    </Button>
                  )}
                  <Button
                    onClick={() => navigate('/')}
                    className={`px-6 py-3 text-base font-bold ${
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
            </div>
          ) : roundResult ? (
            /* Round Result Display */
            <div className={`p-8 rounded-lg ${
              roundResult.missed 
                ? 'bg-yellow-100 border-2 border-yellow-500'
                : roundResult.correct 
                ? 'bg-green-100 border-2 border-green-500' 
                : 'bg-red-100 border-2 border-red-500'
            }`}>
              <div className="flex flex-col items-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                  roundResult.missed 
                    ? 'bg-yellow-500'
                    : roundResult.correct ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  {roundResult.missed ? (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : roundResult.correct ? (
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
                  roundResult.missed 
                    ? 'text-yellow-800'
                    : roundResult.correct ? 'text-green-800' : 'text-red-800'
                }`}>
                  {roundResult.missed ? 'Время вышло!' : roundResult.correct ? 'Правильно!' : 'Неправильно!'}
                </h2>
                
                {roundResult.message && (
                  <p className={`text-lg mb-4 ${
                    roundResult.missed 
                      ? 'text-yellow-700'
                      : roundResult.correct ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {roundResult.message}
                  </p>
                )}
                
                {roundResult.placement && (
                  <p className={`text-lg font-semibold mb-2 ${
                    roundResult.missed 
                      ? 'text-yellow-700'
                      : roundResult.correct ? 'text-green-700' : 'text-red-700'
                  }`}>
                    Ваше место: #{roundResult.placement}
                  </p>
                )}
                
                <p className={`text-sm mb-4 ${
                  roundResult.missed 
                    ? 'text-yellow-600'
                    : roundResult.correct ? 'text-green-600' : 'text-red-600'
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
              disableCopy={disableCopy}
            />
          ) : (
            /* Waiting Screen */
            <div>
              <div className="mb-4 md:mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 md:mb-4">Ожидание начала квиза</h2>
                <p className="text-base md:text-lg text-gray-600 mb-4 md:mb-6">
                  Вы присоединились к игре с кодом: <span className="font-mono font-bold text-blue-600">{gameCode || gameCodeParam}</span>
                </p>
              </div>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-center text-gray-600">
                  <Users className="h-6 w-6 md:h-5 md:w-5 mr-2 flex-shrink-0" />
                  <span className="text-base md:text-base text-center">Игрок: {playerName}</span>
                </div>
              </div>

              <div className="text-sm md:text-sm text-gray-500 space-y-2">
                <p>Статус подключения: {wsConnected ? '✅ Подключено' : '❌ Отключено'}</p>
                <p>Аутентификация: {authSent ? (authSuccess ? '✅ Успешна' : '⏳ Ожидание ответа') : '❌ Не отправлена'}</p>
                <p>Присоединение к игре: {gameJoined ? '✅ Присоединен' : (authSuccess ? '⏳ Готово к присоединению' : '❌ Ожидание аутентификации')}</p>
                <p>Режим игры: {gameMode === 'lockdown' ? '🔒 Lockdown' : gameMode === 'tab_tracking' ? '👁️ Tab Tracking' : '📝 Normal'}</p>
                <p>WebSocket: {ws?.readyState === WebSocket.OPEN ? '✅ Открыто' : ws?.readyState === WebSocket.CONNECTING ? '⏳ Подключение' : '❌ Закрыто'}</p>
              </div>
              
              {/* Test button for development */}
              {(gameMode === 'tab_tracking' || gameMode === 'lockdown') && gameJoined && (
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 mb-2 font-semibold">🧪 Режим отладки</p>
                  <Button
                    onClick={() => {
                      reportCheating();
                    }}
                    variant="outline"
                    size="sm"
                    className="cursor-pointer bg-white hover:bg-yellow-100 text-yellow-800 border-yellow-300"
                  >
                    Тест: Отправить отчет
                  </Button>
                  <p className="text-xs text-yellow-700 mt-2">
                    Откройте консоль браузера (F12) для просмотра логов отправки
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayQuiz;
