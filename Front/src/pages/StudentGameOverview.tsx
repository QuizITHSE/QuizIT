import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, getDoc, doc, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Trophy, Calendar, Target, AlertTriangle, CheckCircle, XCircle, Clock, BookOpen, Loader2 } from 'lucide-react';

interface UserGameResult {
  gameId: string;
  gameCode: string;
  username: string;
  score: number;
  placement: number;
  total_players: number;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  missed_answers: number;
  tab_switches: number;
  answers: Answer[];
  finished_at?: any;
  game_mode?: string;
}

interface Answer {
  question_number: number;
  question_text: string;
  question_type: string;
  options: string[];
  user_answer: number[] | number | null;
  correct_answer: number[] | number;
  is_correct: boolean;
  points_earned: number;
  possible_points: number;
  missed?: boolean;
  explanation?: string;
}

const StudentGameOverview: React.FC = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState<UserGameResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<UserGameResult | null>(null);
  const [creatingRevision, setCreatingRevision] = useState(false);
  const [gameData, setGameData] = useState<any>(null);
  const [quizData, setQuizData] = useState<any>(null);

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
          alert('Эта страница только для студентов.');
          navigate('/');
          return;
        }

        
        const gamesQuery = query(
          collection(db, 'games'),
          where('players', 'array-contains', user.uid),
          where('game_finished', '==', true)
        );
        
        const gamesSnapshot = await getDocs(gamesQuery);
        
        const userResults: UserGameResult[] = [];
        
        for (const gameDoc of gamesSnapshot.docs) {
          const gameData = gameDoc.data();
          const gameId = gameDoc.id;
          
          
          try {
            const userResultDoc = await getDoc(
              doc(db, 'games', gameId, 'results', user.uid)
            );
            
            if (userResultDoc.exists()) {
              const resultData = userResultDoc.data();
              
              userResults.push({
                gameId: gameId,
                gameCode: gameData.code || 'N/A',
                username: resultData.username || 'Неизвестно',
                score: resultData.score || 0,
                placement: resultData.placement || 0,
                total_players: resultData.total_players || 0,
                total_questions: resultData.total_questions || 0,
                correct_answers: resultData.correct_answers || 0,
                wrong_answers: resultData.wrong_answers || 0,
                missed_answers: resultData.missed_answers || 0,
                tab_switches: resultData.tab_switches || 0,
                answers: resultData.answers || [],
                finished_at: gameData.finished_at,
                game_mode: gameData.game_mode || gameData.type?.mode || 'normal'
              });
            }
          } catch (error) {
          }
        }
        
        userResults.sort((a, b) => {
          const dateA = a.finished_at?.toDate ? a.finished_at.toDate() : new Date(a.finished_at || 0);
          const dateB = b.finished_at?.toDate ? b.finished_at.toDate() : new Date(b.finished_at || 0);
          return dateB.getTime() - dateA.getTime();
        });
        
        setResults(userResults);
      } catch (error) {
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const loadGameData = async () => {
      if (!selectedGame) {
        setGameData(null);
        setQuizData(null);
        return;
      }

      try {
        const gameDoc = await getDoc(doc(db, 'games', selectedGame.gameId));
        if (gameDoc.exists()) {
          const gameDocData = gameDoc.data();
          setGameData(gameDocData);
          
          if (gameDocData.quiz_id) {
            const quizDoc = await getDoc(doc(db, 'quizes', gameDocData.quiz_id));
            if (quizDoc.exists()) {
              setQuizData(quizDoc.data());
            }
          }
        }
      } catch (error) {
        console.error('Error loading game data:', error);
      }
    };

    loadGameData();
  }, [selectedGame]);

  const formatDate = (date: any) => {
    if (!date) return 'Неизвестно';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPlacementColor = (placement: number) => {
    if (placement === 1) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (placement === 2) return 'bg-gray-100 text-gray-800 border-gray-300';
    if (placement === 3) return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-blue-100 text-blue-800 border-blue-300';
  };

  const getPlacementIcon = (placement: number) => {
    if (placement === 1) return '🥇';
    if (placement === 2) return '🥈';
    if (placement === 3) return '🥉';
    return '🏅';
  };

  const getGameModeLabel = (mode: string) => {
    switch (mode) {
      case 'lockdown':
        return { label: '🔒 Lockdown', color: 'text-red-600 bg-red-50' };
      case 'tab_tracking':
        return { label: '👁️ Tracking', color: 'text-yellow-600 bg-yellow-50' };
      default:
        return { label: '📝 Normal', color: 'text-gray-600 bg-gray-50' };
    }
  };

  const handleCreateRevisionQuiz = async () => {
    if (!selectedGame || !auth.currentUser) return;
    
    setCreatingRevision(true);
    try {
      // Get wrong/missed answers
      const wrongAnswers = selectedGame.answers.filter(a => !a.is_correct);
      
      if (wrongAnswers.length === 0) {
        alert('У вас нет ошибок для повторения!');
        setCreatingRevision(false);
        return;
      }
      
      let questionIds: string[] = [];
      let quizTitle = '';
      
      // If we have quizData with original questions, use them
      if (quizData && quizData.questions) {
        const originalQuestions = quizData.questions;
        const mistakeQuestionIndices = wrongAnswers.map(a => a.question_number - 1);
        
        for (const questionIdx of mistakeQuestionIndices) {
          if (originalQuestions[questionIdx]) {
            questionIds.push(originalQuestions[questionIdx]);
          }
        }
        quizTitle = `Квиз повторения ошибок - ${selectedGame.username}`;
      } else {
        // Fallback: create questions from answer data
        const questionPromises = wrongAnswers.map(async (answer) => {
          const isTextQuestion = answer.question_type === 'text';
          const questionData: any = {
            question: answer.question_text,
            options: answer.options,
            correct: isTextQuestion 
              ? []
              : (Array.isArray(answer.correct_answer) 
                ? answer.correct_answer 
                : typeof answer.correct_answer === 'number' 
                ? [answer.correct_answer]
                : []),
            type: answer.question_type,
            points: answer.possible_points,
            timeLimit: 60,
            explanation: answer.explanation || ''
          };
          
          if (isTextQuestion && typeof answer.correct_answer === 'string') {
            questionData.textAnswer = answer.correct_answer;
          }
          
          const docRef = await addDoc(collection(db, 'questions'), questionData);
          return docRef.id;
        });
        
        questionIds = await Promise.all(questionPromises);
        quizTitle = `Квиз повторения ошибок - ${selectedGame.username}`;
      }
      
      const revisionQuizData = {
        title: quizTitle,
        questions: questionIds,
        owner: auth.currentUser.uid,
        createdAt: new Date(),
        isRevisionQuiz: true,
        originalGameId: selectedGame.gameId,
        originalStudentId: auth.currentUser.uid
      };
      
      const revisionQuizRef = await addDoc(collection(db, 'quizes'), revisionQuizData);
      
      // Find the group for this student
      const groupsQuery = query(
        collection(db, 'groups'),
        where('students', 'array-contains', auth.currentUser!.uid)
      );
      const groupsSnapshot = await getDocs(groupsQuery);
      
      if (groupsSnapshot.empty) {
        alert('Не найдена группа для вас');
        setCreatingRevision(false);
        return;
      }
      
      const group = groupsSnapshot.docs[0].data();
      const groupId = groupsSnapshot.docs[0].id;
      const teacherId = group.admin;
      
      // Create homework assignment for this specific student
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 7);
      
      const homeworkData = {
        quiz_id: revisionQuizRef.id,
        quiz_title: revisionQuizData.title,
        group_id: groupId,
        group_name: group.name,
        teacher_id: teacherId,
        created_at: new Date(),
        deadline: deadline,
        total_questions: questionIds.length,
        is_active: true,
        description: quizData ? `Квиз повторения ошибок из игры ${quizData.title}` : 'Квиз повторения ошибок',
        mode: 'normal',
        time_limit_minutes: null,
        assigned_to_students: [auth.currentUser.uid]
      };
      
      await addDoc(collection(db, 'homework'), homeworkData);
      
      alert(`Квиз повторения ошибок успешно создан и назначен вам!`);
      
    } catch (error) {
      console.error('Error creating revision quiz:', error);
      alert('Ошибка при создании квиза повторения ошибок');
    } finally {
      setCreatingRevision(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Загрузка ваших результатов...</div>
        </div>
      </div>
    );
  }

  if (selectedGame) {
    const percentage = selectedGame.total_questions > 0 
      ? Math.round((selectedGame.correct_answers / selectedGame.total_questions) * 100) 
      : 0;
    const gameMode = getGameModeLabel(selectedGame.game_mode || 'normal');

    return (
      <div className="min-h-screen w-full montserrat-600 bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Детали игры #{selectedGame.gameCode}</h1>
                <p className="text-gray-600">{formatDate(selectedGame.finished_at)}</p>
              </div>
              <Button
                onClick={() => setSelectedGame(null)}
                variant="outline"
                className="cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад к списку
              </Button>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Место</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {getPlacementIcon(selectedGame.placement)} #{selectedGame.placement}
                    </p>
                  </div>
                  <Trophy className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Баллы</p>
                    <p className="text-2xl font-bold text-blue-600">{selectedGame.score}</p>
                  </div>
                  <Target className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Процент</p>
                    <p className={`text-2xl font-bold ${
                      percentage >= 80 ? 'text-green-600' :
                      percentage >= 60 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {percentage}%
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Режим игры</p>
                    <p className={`text-sm font-semibold px-2 py-1 rounded ${gameMode.color}`}>
                      {gameMode.label}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Answer Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-green-800">Правильные</p>
                  <p className="text-2xl font-bold text-green-600">{selectedGame.correct_answers}</p>
                </div>
              </div>
            </div>

            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <XCircle className="h-6 w-6 text-red-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-red-800">Неправильные</p>
                  <p className="text-2xl font-bold text-red-600">{selectedGame.wrong_answers}</p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
              <div className="flex items-center">
                <Clock className="h-6 w-6 text-yellow-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Пропущенные</p>
                  <p className="text-2xl font-bold text-yellow-600">{selectedGame.missed_answers}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Switches Warning */}
          {selectedGame.tab_switches > 0 && (
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <AlertTriangle className="h-6 w-6 text-yellow-600 mr-3" />
                <div>
                  <p className="text-sm font-semibold text-yellow-800">
                    Зафиксировано переключений вкладок: {selectedGame.tab_switches}
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Во время игры вы переключались на другие вкладки или приложения
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Create Revision Quiz Button */}
          {(selectedGame.wrong_answers > 0 || selectedGame.missed_answers > 0) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-8 w-8 text-blue-600" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Квиз повторения ошибок</h3>
                    <p className="text-sm text-gray-600">
                      Создайте квиз из {selectedGame.wrong_answers + selectedGame.missed_answers} вопросов, на которые вы ответили неправильно или пропустили
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleCreateRevisionQuiz}
                  disabled={creatingRevision}
                  className="cursor-pointer"
                >
                  {creatingRevision ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Создание...
                    </>
                  ) : (
                    <>
                      <BookOpen className="h-4 w-4 mr-2" />
                      Создать квиз повторения
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Detailed Answers */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Детальный разбор ответов</h2>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-100 border-2 border-green-300 rounded mr-1"></div>
                  <span className="text-gray-600">Ваш правильный</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-red-100 border-2 border-red-300 rounded mr-1"></div>
                  <span className="text-gray-600">Ваш неправильный</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-50 border-2 border-green-200 rounded mr-1"></div>
                  <span className="text-gray-600">Правильный ответ</span>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              {selectedGame.answers.map((answer, index) => (
                <div
                  key={index}
                  className={`border-2 rounded-lg p-4 ${
                    answer.missed
                      ? 'bg-yellow-50 border-yellow-300'
                      : answer.is_correct
                      ? 'bg-green-50 border-green-300'
                      : 'bg-red-50 border-red-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-900">
                          Вопрос {answer.question_number + 1}
                        </span>
                        {answer.missed ? (
                          <span className="flex items-center text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">
                            <Clock className="h-3 w-3 mr-1" />
                            Пропущен
                          </span>
                        ) : answer.is_correct ? (
                          <span className="flex items-center text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Правильно
                          </span>
                        ) : (
                          <span className="flex items-center text-xs bg-red-200 text-red-800 px-2 py-1 rounded-full">
                            <XCircle className="h-3 w-3 mr-1" />
                            Неправильно
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 mb-3 font-medium">{answer.question_text}</p>
                      
                      {answer.question_type === 'text' ? (
                        <div className="space-y-3 mb-3">
                          <div className="border-2 rounded p-3 bg-gray-50 border-gray-200">
                            <p className="text-xs font-semibold text-gray-500 mb-1">Ваш ответ:</p>
                            <p className="text-sm text-gray-800">
                              {answer.user_answer ? (typeof answer.user_answer === 'string' ? answer.user_answer : String(answer.user_answer)) : 'Не отвечено'}
                            </p>
                          </div>
                          <div className="border-2 rounded p-3 bg-green-50 border-green-200">
                            <p className="text-xs font-semibold text-green-600 mb-1">Правильный ответ:</p>
                            <p className="text-sm text-gray-800">
                              {typeof answer.correct_answer === 'string' ? answer.correct_answer : String(answer.correct_answer)}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Display all options with visual indicators */}
                          <div className="space-y-2 mb-3">
                            {answer.options.map((option, optionIndex) => {
                              const isUserAnswer = Array.isArray(answer.user_answer)
                                ? answer.user_answer.includes(optionIndex)
                                : answer.user_answer === optionIndex;
                              
                              const isCorrectAnswer = Array.isArray(answer.correct_answer)
                                ? answer.correct_answer.includes(optionIndex)
                                : answer.correct_answer === optionIndex;
                              
                              let bgColor = 'bg-gray-50 border-gray-200';
                              let icon = null;
                              
                              if (isCorrectAnswer && isUserAnswer) {
                                bgColor = 'bg-green-100 border-green-300';
                                icon = <CheckCircle className="h-4 w-4 text-green-600" />;
                              } else if (isCorrectAnswer && !isUserAnswer) {
                                bgColor = 'bg-green-50 border-green-200';
                                icon = <CheckCircle className="h-4 w-4 text-green-500" />;
                              } else if (!isCorrectAnswer && isUserAnswer) {
                                bgColor = 'bg-red-100 border-red-300';
                                icon = <XCircle className="h-4 w-4 text-red-600" />;
                              }
                              
                              return (
                                <div
                                  key={optionIndex}
                                  className={`border-2 rounded p-2 flex items-center justify-between ${bgColor}`}
                                >
                                  <span className="text-sm text-gray-800">{option}</span>
                                  {icon}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                      
                      {answer.missed && (
                        <div className="text-sm text-yellow-700 font-medium bg-yellow-100 rounded p-2 mb-2">
                          ⏱️ Вы не успели ответить на этот вопрос
                        </div>
                      )}
                      
                      {answer.explanation && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                          <p><strong className="text-blue-700">Объяснение:</strong> <span className="text-gray-700">{answer.explanation}</span></p>
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className={`text-xl font-bold ${
                        answer.missed ? 'text-yellow-600' : answer.is_correct ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {answer.points_earned}/{answer.possible_points}
                      </p>
                      <p className="text-xs text-gray-500">очков</p>
                    </div>
                  </div>
                </div>
              ))}
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Мои результаты</h1>
              <p className="text-gray-600">История ваших игр и результатов</p>
            </div>
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              На главную
            </Button>
          </div>
        </div>

        {results.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Trophy className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">Нет завершенных игр</h3>
            <p className="text-gray-500 mb-6">Присоединитесь к игре, чтобы увидеть результаты здесь</p>
            <Button
              onClick={() => navigate('/play')}
              className="bg-blue-600 hover:bg-blue-700 cursor-pointer"
            >
              Присоединиться к игре
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {results.map((result) => {
              const placementColor = getPlacementColor(result.placement);
              const percentage = result.total_questions > 0
                ? Math.round((result.correct_answers / result.total_questions) * 100)
                : 0;
              const gameMode = getGameModeLabel(result.game_mode || 'normal');

              return (
                <Card key={result.gameId} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedGame(result)}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Игра #{result.gameCode}</CardTitle>
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${placementColor}`}>
                        {getPlacementIcon(result.placement)} Место {result.placement}
                      </div>
                    </div>
                    <CardDescription>
                      {formatDate(result.finished_at)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Баллы</span>
                      <span className="text-lg font-bold text-blue-600">{result.score}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Процент правильных</span>
                      <span className={`text-lg font-bold ${
                        percentage >= 80 ? 'text-green-600' :
                        percentage >= 60 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {percentage}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>✅ {result.correct_answers}</span>
                      <span>❌ {result.wrong_answers}</span>
                      <span>⏱️ {result.missed_answers}</span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <span className={`text-xs px-2 py-1 rounded ${gameMode.color}`}>
                        {gameMode.label}
                      </span>
                      <span className="text-xs text-gray-500">
                        из {result.total_players} игроков
                      </span>
                    </div>

                    {result.tab_switches > 0 && (
                      <div className="bg-yellow-100 border border-yellow-300 rounded p-2 mt-2">
                        <div className="flex items-center text-xs text-yellow-800">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          <span>{result.tab_switches} переключени{result.tab_switches === 1 ? 'е' : result.tab_switches < 5 ? 'я' : 'й'}</span>
                        </div>
                      </div>
                    )}

                    <div className="pt-2">
                      <p className="text-xs text-blue-600 font-medium">Нажмите для детального просмотра →</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentGameOverview;

