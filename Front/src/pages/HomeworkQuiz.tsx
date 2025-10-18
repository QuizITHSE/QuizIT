import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { getDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { GraduationCap, Clock, Play, ArrowRight, CheckCircle, XCircle, AlertTriangle, Timer } from 'lucide-react';
import type { Homework } from '@/types/homework';
import QuizHomeworkContent from '@/components/QuizHomeworkContent';

interface QuizQuestion {
  question: string;
  type: string;
  options: string[];
  correct: number[];
  point: number;
}

interface HomeworkQuizState {
  homework: Homework | null;
  quiz: {
    title: string;
    questions: QuizQuestion[];
  } | null;
  canStart: boolean;
  statusMessage: string | null;
}

const HomeworkQuiz: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const homeworkId = searchParams.get('id');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStudent, setIsStudent] = useState(false);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  
  const [currentQuiestion, setCurrentQuiestion] = useState(0);
  const [answers, setAnswers] = useState<number[][]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timeStarted, setTimeStarted] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [autoSubmitted, setAutoSubmitted] = useState(false);

  const [state, setState] = useState<HomeworkQuizState>({
    homework: null,
    quiz: null,
    canStart: true,
    statusMessage: null
  });

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
          alert('Учителя не могут выполнять домашние задания.');
          navigate('/');
          return;
        }
        
        setIsStudent(true);
        setUserUid(user.uid);
        setUserName(user.displayName || user.email || 'Студент');
      } catch (error) {
        navigate('/auth');
        return;
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const loadHomework = async () => {
      if (!homeworkId || !userUid) return;
      
      try {
        setLoading(true);
        setError(null);

        const homeworkDoc = await getDoc(doc(db, 'homework', homeworkId));
        if (!homeworkDoc.exists()) {
          setError('Домашнее задание не найдено');
          return;
        }

        const homeworkData = homeworkDoc.data() as Homework;
        
        const submissionDoc = await getDoc(doc(db, 'homework', homeworkId, 'submissions', userUid));
        const isAlreadyCompleted = submissionDoc.exists();

        const deadline = homeworkData.deadline?.toDate ? homeworkData.deadline.toDate() : new Date(homeworkData.deadline);
        const isDeadlinePassed = deadline < new Date();

        const quizDoc = await getDoc(doc(db, 'quizes', homeworkData.quiz_id));
        if (!quizDoc.exists()) {
          setError('Квиз не найден');
          return;
        }

        const quizData = quizDoc.data();
        
        
        const loadedQuestions: QuizQuestion[] = [];
        if (quizData.questions && quizData.questions.length > 0) {
          for (const questionId of quizData.questions) {
            try {
              const questionDoc = await getDoc(doc(db, 'questions', questionId));
              if (questionDoc.exists()) {
                const questionData = questionDoc.data();
                loadedQuestions.push({
                  question: questionData.question || '',
                  type: questionData.type || 'single',
                  options: questionData.options || ['', '', '', ''],
                  correct: questionData.correct || [],
                  point: typeof questionData.points === 'number' ? questionData.points : (questionData.points === 'regular' ? 1 : (questionData.points === 'hard' ? 2 : 1))
                });
              } else {
              }
            } catch (error) {
            }
          }
        } else {
        }
        
        
        const timeLimitSeconds = homeworkData.time_limit_minutes ? homeworkData.time_limit_minutes * 60 : null;

        let canStart = true;
        let statusMessage = null;

        if (isAlreadyCompleted) {
          canStart = false;
          statusMessage = 'Вы уже выполнили это домашнее задание';
        } else if (isDeadlinePassed) {
          canStart = false;
          statusMessage = 'Срок выполнения домашнего задания истек';
        }


        setState(prev => ({
          ...prev,
          homework: homeworkData,
          quiz: {
            title: homeworkData.quiz_title,
            questions: loadedQuestions
          },
          canStart,
          statusMessage
        }));

      } catch (error) {
        setError('Ошибка при загрузке данных');
      } finally {
        setLoading(false);
      }
    };

    loadHomework();
  }, [homeworkId, userUid]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || currentQuiestion === 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, currentQuiestion]);

  useEffect(() => {
    if (timeLeft === 0 && currentQuiestion > 0 && !isSubmitting && !autoSubmitted) {
      setAutoSubmitted(true);
      const autoSubmit = async () => {
        alert('⏰ Время истекло! Квиз автоматически отправляется с текущими ответами.');
        await handleSubmitQuiz();
      };
      autoSubmit();
    }
  }, [timeLeft, currentQuiestion, isSubmitting, autoSubmitted]);

  useEffect(() => {
    if (currentQuiestion === 0 || !state.homework) return;
    if (state.homework.mode !== 'lockdown') return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        handleLockdownViolation();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [currentQuiestion, state.homework]);

  useEffect(() => {
    if (currentQuiestion === 0 || !state.homework) return;
    
    const mode = state.homework.mode;
    if (mode !== 'tab_tracking') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitches(prev => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentQuiestion, state.homework]);

  const handleStartQuiz = async () => {
    if (state.homework?.mode === 'lockdown') {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        alert('Не удалось перейти в полноэкранный режим. Режим блокировки требует полноэкранный режим для начала.');
        return;
      }
    }
    
    setCurrentQuiestion(1);
    setTimeStarted(new Date());
    if (state.homework?.time_limit_minutes) {
      setTimeLeft(state.homework.time_limit_minutes * 60);
    }
  };

  const handleSubmitAnswer = (answer: number[]) => {
    
    const newAnswers = [...answers];
    newAnswers[currentQuiestion - 1] = answer;
    setAnswers(newAnswers);

    if (state.quiz) {
      if (currentQuiestion < state.quiz.questions.length) {
        setCurrentQuiestion(prev => prev + 1);
      } else {
        setCurrentQuiestion(state.quiz.questions.length + 1);
      }
    }
  };

  const handleGoToQuestion = (questionNumber: number) => {
    setCurrentQuiestion(questionNumber);
  };

  const handleLockdownViolation = async () => {
    if (!homeworkId || !userUid || !userName || !state.homework || !state.quiz || autoSubmitted) {
      return;
    }

    setAutoSubmitted(true);
    setIsSubmitting(true);

    try {
      const timeCompleted = new Date();
      const timeTakenSeconds = timeStarted 
        ? Math.floor((timeCompleted.getTime() - timeStarted.getTime()) / 1000)
        : 0;

      const deadline = state.homework.deadline?.toDate 
        ? state.homework.deadline.toDate() 
        : new Date(state.homework.deadline);
      const isLate = timeCompleted > deadline;

      const totalQuestions = state.quiz.questions.length;

      const detailedAnswers = state.quiz.questions.map((question, index) => ({
        question_index: index,
        question_text: question.question,
        student_answer: answers[index] || [],
        correct_answer: question.correct,
        is_correct: false,
        points_earned: 0,
        max_points: question.point
      }));

      const submission = {
        student_id: userUid,
        student_name: userName,
        submitted_at: serverTimestamp(),
        score: 0,
        max_score: state.quiz.questions.reduce((sum, q) => sum + q.point, 0),
        total_questions: totalQuestions,
        correct_answers: 0,
        wrong_answers: 0,
        missed_answers: totalQuestions,
        percentage: 0,
        is_late: isLate,
        tab_switches: tabSwitches,
        answers: detailedAnswers,
        status: 'cheated',
        time_started: timeStarted,
        time_completed: serverTimestamp(),
        time_taken_seconds: timeTakenSeconds,
        time_limit_seconds: state.homework.time_limit_minutes 
          ? state.homework.time_limit_minutes * 60 
          : null,
        violation_reason: 'Выход из полноэкранного режима в режиме блокировки'
      };

      await setDoc(
        doc(db, 'homework', homeworkId, 'submissions', userUid),
        submission
      );

      
      alert('⚠️ НАРУШЕНИЕ РЕЖИМА БЛОКИРОВКИ!\n\nВы вышли из полноэкранного режима.\nКвиз автоматически завершен с результатом 0 баллов.\n\nВаш преподаватель будет уведомлен о нарушении.');
      
      navigate('/');
    } catch (error) {
      alert('Произошла ошибка. Обратитесь к преподавателю.');
      navigate('/');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!homeworkId || !userUid || !userName || !state.homework || !state.quiz || autoSubmitted) {
      if (autoSubmitted) return; 
      alert('Ошибка: отсутствуют необходимые данные');
      return;
    }

    setAutoSubmitted(true);
    setIsSubmitting(true);

    try {
      const timeCompleted = new Date();
      const timeTakenSeconds = timeStarted 
        ? Math.floor((timeCompleted.getTime() - timeStarted.getTime()) / 1000)
        : 0;

      let score = 0;
      let correctAnswers = 0;
      let wrongAnswers = 0;
      let missedAnswers = 0;

      const detailedAnswers = state.quiz.questions.map((question, index) => {
        const studentAnswer = answers[index] || [];
        const isCorrect = studentAnswer.length > 0 && 
          studentAnswer.length === question.correct.length &&
          studentAnswer.every(ans => question.correct.includes(ans));
        
        if (studentAnswer.length === 0) {
          missedAnswers++;
        } else if (isCorrect) {
          correctAnswers++;
          score += question.point;
        } else {
          wrongAnswers++;
        }

        return {
          question_index: index,
          question_text: question.question,
          student_answer: studentAnswer,
          correct_answer: question.correct,
          is_correct: isCorrect,
          points_earned: isCorrect ? question.point : 0,
          max_points: question.point
        };
      });

      const totalQuestions = state.quiz.questions.length;
      const percentage = totalQuestions > 0 
        ? Math.round((correctAnswers / totalQuestions) * 100) 
        : 0;

      const deadline = state.homework.deadline?.toDate 
        ? state.homework.deadline.toDate() 
        : new Date(state.homework.deadline);
      const isLate = timeCompleted > deadline;

      const maxScore = state.quiz.questions.reduce((sum, q) => sum + q.point, 0);

      const submission = {
        student_id: userUid,
        student_name: userName,
        submitted_at: serverTimestamp(),
        score: score,
        max_score: maxScore,
        total_questions: totalQuestions,
        correct_answers: correctAnswers,
        wrong_answers: wrongAnswers,
        missed_answers: missedAnswers,
        percentage: percentage,
        is_late: isLate,
        tab_switches: tabSwitches,
        answers: detailedAnswers,
        status: 'completed',
        time_started: timeStarted,
        time_completed: serverTimestamp(),
        time_taken_seconds: timeTakenSeconds,
        time_limit_seconds: state.homework.time_limit_minutes 
          ? state.homework.time_limit_minutes * 60 
          : null
      };

      await setDoc(
        doc(db, 'homework', homeworkId, 'submissions', userUid),
        submission
      );

      
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      
      alert(`Квиз успешно отправлен!\n\nВаш результат:\n${correctAnswers} из ${totalQuestions} правильных ответов\nБаллы: ${score} из ${maxScore}\nПроцент: ${percentage}%`);
      
      navigate('/');
    } catch (error) {
      alert('Ошибка при отправке результатов. Пожалуйста, попробуйте еще раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDeadline = (deadline: any): string => {
    const deadlineDate = deadline?.toDate ? deadline.toDate() : new Date(deadline);
    return deadlineDate.toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatGameMode = (mode: string): string => {
    switch (mode) {
      case 'normal':
        return 'Обычный режим';
      case 'lockdown':
        return 'Режим блокировки (запрет переключения вкладок)';
      case 'tab_tracking':
        return 'Отслеживание переключений вкладок';
      default:
        return mode;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-lg">Загрузка домашнего задания...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Ошибка</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 text-lg cursor-pointer"
          >
            На главную
          </Button>
        </div>
      </div>
    );
  }

  if (!state.homework || !state.quiz || !state.quiz.questions || state.quiz.questions.length === 0) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-lg">
          {!state.homework || !state.quiz ? 'Данные не найдены' : 'В квизе нет вопросов'}
        </div>
      </div>
    );
  }

  if (currentQuiestion > 0 && state.quiz && state.quiz.questions.length > 0) {
    const isResultsView = currentQuiestion === state.quiz.questions.length + 1;
    const currentQuestion = !isResultsView ? state.quiz.questions[currentQuiestion - 1] : null;
    const currentAnswers = currentQuestion ? (answers[currentQuiestion - 1] || []) : [];
    
    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const answeredCount = answers.filter(a => a && a.length > 0).length;
    const totalQuestions = state.quiz.questions.length;
    
    return (
      <div className="min-h-screen w-full montserrat-600 bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          {/* Progress Header */}
          <div className="max-w-3xl mx-auto mb-6">
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-gray-900">{state.quiz.title}</h2>
                <span className="text-sm text-gray-600">
                  {isResultsView 
                    ? `Результаты (${answeredCount} / ${totalQuestions})`
                    : `Вопрос ${currentQuiestion} из ${totalQuestions}`
                  }
                </span>
              </div>
              
              {/* Timer Bar - показываем только если есть лимит времени */}
              {timeLeft !== null && state.homework?.time_limit_minutes && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Осталось времени
                    </span>
                    <span className={`text-sm font-bold ${
                      timeLeft <= 60 ? 'text-red-600' : timeLeft <= 300 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {formatTime(timeLeft)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-1000 ${
                        timeLeft <= 60 ? 'bg-red-500' : 
                        timeLeft <= 300 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ 
                        width: `${Math.max(0, (timeLeft / (state.homework.time_limit_minutes * 60)) * 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Mode Warning and Tab Tracking */}
              {state.homework.mode === 'lockdown' && (
                <div className="mb-4 p-3 rounded-lg border-2 bg-orange-50 border-orange-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                      <span className="text-sm font-medium text-gray-900">
                        🔒 Полноэкранный режим блокировки
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Не выходите из полноэкранного режима. Выход приведет к автоматическому завершению квиза с нулевым результатом.
                  </p>
                </div>
              )}
              {state.homework.mode === 'tab_tracking' && (
                <div className="mb-4 p-3 rounded-lg border-2 bg-blue-50 border-blue-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-blue-600" />
                      <span className="text-sm font-medium text-gray-900">
                        👁️ Отслеживание вкладок активно
                      </span>
                    </div>
                    {tabSwitches > 0 && (
                      <span className="text-sm font-bold px-2 py-1 rounded bg-blue-600 text-white">
                        Переключений: {tabSwitches}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Переключения вкладок отслеживаются и будут видны преподавателю
                  </p>
                </div>
              )}

              {/* Question Navigation Menu */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-gray-600 mr-2">Навигация:</span>
                  {state.quiz.questions.map((_, index) => {
                    const questionNumber = index + 1;
                    const hasAnswer = answers[index] && answers[index].length > 0;
                    const isCurrent = questionNumber === currentQuiestion && !isResultsView;
                    
                    return (
                      <button
                        key={questionNumber}
                        onClick={() => handleGoToQuestion(questionNumber)}
                        className={`w-10 h-10 rounded-lg font-bold text-sm transition-all duration-200 cursor-pointer ${
                          isCurrent
                            ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300'
                            : hasAnswer
                            ? 'bg-green-100 text-green-800 hover:bg-green-200 border-2 border-green-300'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-gray-300'
                        }`}
                      >
                        {questionNumber}
                      </button>
                    );
                  })}
                  
                  {/* Results Tab */}
                  <button
                    onClick={() => state.quiz && handleGoToQuestion(state.quiz.questions.length + 1)}
                    className={`w-10 h-10 rounded-lg font-bold text-sm transition-all duration-200 cursor-pointer flex items-center justify-center ${
                      isResultsView
                        ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-300'
                        : 'bg-purple-100 text-purple-800 hover:bg-purple-200 border-2 border-purple-300'
                    }`}
                    title="Результаты и отправка"
                  >
                    <CheckCircle className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quiz Content */}
          {isResultsView ? (
            /* Results Overview */
            <div className="max-w-3xl mx-auto">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Обзор результатов</h2>
                
                {/* Progress Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-medium text-gray-700">Прогресс:</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {answeredCount} / {totalQuestions}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 mt-3">
                    <div 
                      className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Questions List */}
                <div className="space-y-3 mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Статус вопросов:</h3>
                  {state.quiz.questions.map((q, index) => {
                    const hasAnswer = answers[index] && answers[index].length > 0;
                    const questionNumber = index + 1;
                    
                    return (
                      <div 
                        key={index}
                        className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all duration-200 ${
                          hasAnswer 
                            ? 'bg-green-50 border-green-300' 
                            : 'bg-red-50 border-red-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            hasAnswer ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                          }`}>
                            {questionNumber}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 line-clamp-1">
                              {q.question}
                            </p>
                            {hasAnswer && (
                              <p className="text-xs text-gray-600 mt-1">
                                Выбрано вариантов: {answers[index].map(i => i + 1).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleGoToQuestion(questionNumber)}
                          className="ml-3 px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded cursor-pointer transition-colors"
                        >
                          {hasAnswer ? 'Изменить' : 'Ответить'}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Warning if not all answered */}
                {answeredCount < totalQuestions && (
                  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-yellow-900">Внимание!</p>
                        <p className="text-sm text-yellow-800 mt-1">
                          Вы ответили не на все вопросы. Вы можете отправить квиз сейчас или вернуться и ответить на оставшиеся вопросы.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab Switches Info */}
                {state.homework.mode === 'lockdown' && (
                  <div className="rounded-lg p-4 mb-6 border-2 bg-green-50 border-green-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium text-gray-900">
                            🔒 Полноэкранный режим блокировки
                          </p>
                          <p className="text-sm text-gray-700">
                            Квиз выполнен в полноэкранном режиме ✓
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {state.homework.mode === 'tab_tracking' && (
                  <div className={`rounded-lg p-4 mb-6 border-2 ${
                    tabSwitches > 0
                      ? 'bg-orange-50 border-orange-300'
                      : 'bg-green-50 border-green-300'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {tabSwitches > 0 ? (
                          <AlertTriangle className="h-5 w-5 text-orange-600" />
                        ) : (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900">
                            👁️ Отслеживание вкладок
                          </p>
                          <p className="text-sm text-gray-700">
                            {tabSwitches === 0 
                              ? 'Переключений не обнаружено ✓'
                              : `Зафиксировано переключений: ${tabSwitches}`
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex gap-4">
                  <Button
                    onClick={handleSubmitQuiz}
                    disabled={isSubmitting}
                    className={`flex-1 px-8 py-4 text-lg font-bold cursor-pointer ${
                      isSubmitting
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    {isSubmitting ? 'Отправка...' : 'Отправить квиз'}
                  </Button>
                  
                </div>
              </div>
            </div>
          ) : currentQuestion ? (
            <QuizHomeworkContent
              questionData={{
                question: currentQuestion.question,
                type: currentQuestion.type,
                options: currentQuestion.options
              }}
              onSubmitAnswer={handleSubmitAnswer}
              initialAnswers={currentAnswers}
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full montserrat-600 bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            <div className="flex items-center mb-6">
              <GraduationCap className="h-12 w-12 text-blue-600 mr-4" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{state.quiz.title}</h1>
                <p className="text-gray-600 text-lg">Домашнее задание</p>
                <p className="text-gray-500">Группа: {state.homework.group_name}</p>
              </div>
            </div>
            
            {/* Status Message */}
            {state.statusMessage && (
              <div className={`p-4 rounded-lg mb-6 ${
                state.canStart 
                  ? 'bg-blue-100 border border-blue-300 text-blue-800' 
                  : 'bg-red-100 border border-red-300 text-red-800'
              }`}>
                <div className="flex items-center">
                  {state.canStart ? (
                    <CheckCircle className="h-5 w-5 mr-2" />
                  ) : (
                    <XCircle className="h-5 w-5 mr-2" />
                  )}
                  <span className="font-medium">{state.statusMessage}</span>
                </div>
              </div>
            )}
          </div>

          {/* Quiz Information */}
          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Информация о квизе</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-blue-600 mr-3" />
                  <div>
                    <span className="font-medium text-gray-700">Количество вопросов:</span>
                    <span className="ml-2 text-gray-900">{state.quiz.questions.length}</span>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <Timer className="h-5 w-5 text-blue-600 mr-3" />
                  <div>
                    <span className="font-medium text-gray-700">Лимит времени:</span>
                    <span className="ml-2 text-gray-900">
                      {state.homework.time_limit_minutes 
                        ? `${state.homework.time_limit_minutes} минут` 
                        : 'Без ограничения времени'
                      }
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-blue-600 mr-3" />
                  <div>
                    <span className="font-medium text-gray-700">Режим выполнения:</span>
                    <span className="ml-2 text-gray-900">{formatGameMode(state.homework.mode)}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-blue-600 mr-3" />
                  <div>
                    <span className="font-medium text-gray-700">Дедлайн:</span>
                    <span className="ml-2 text-gray-900">{formatDeadline(state.homework.deadline)}</span>
                  </div>
                </div>
                
                {state.homework.description && (
                  <div className="flex items-start">
                    <ArrowRight className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                    <div>
                      <span className="font-medium text-gray-700">Описание:</span>
                      <p className="text-gray-900 mt-1">{state.homework.description}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mode Warning */}
          {(state.homework.mode === 'lockdown' || state.homework.mode === 'tab_tracking') && (
            <div className={`rounded-lg shadow-md p-6 mb-6 ${
              state.homework.mode === 'lockdown'
                ? 'bg-orange-50 border-2 border-orange-400'
                : 'bg-blue-50 border-2 border-blue-400'
            }`}>
              <div className="flex items-start gap-4">
                <AlertTriangle className={`h-8 w-8 mt-1 ${
                  state.homework.mode === 'lockdown' ? 'text-orange-600' : 'text-blue-600'
                }`} />
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {state.homework.mode === 'lockdown' 
                      ? '🔒 Режим блокировки активен!' 
                      : '👁️ Отслеживание вкладок активно'
                    }
                  </h3>
                  <div className="text-gray-700 space-y-2">
                    {state.homework.mode === 'lockdown' ? (
                      <>
                        <p className="font-medium text-red-700">⚠️ СТРОГИЕ ПРАВИЛА:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li><strong>Квиз будет выполняться в полноэкранном режиме</strong></li>
                          <li><strong className="text-red-700">Выход из fullscreen = автоматическое завершение с 0 баллов</strong></li>
                          <li>Результат будет помечен как "нарушение" (cheated)</li>
                          <li>Не нажимайте ESC и не используйте горячие клавиши для выхода из fullscreen</li>
                          <li>Закройте все лишние программы и уведомления</li>
                          <li>Убедитесь, что готовы начать перед стартом</li>
                        </ul>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">Обратите внимание:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>Все переключения между вкладками будут отслеживаться</li>
                          <li>Количество переключений будет видно преподавателю</li>
                          <li>Рекомендуется сосредоточиться на выполнении задания</li>
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={handleStartQuiz}
                disabled={!state.canStart}
                className={`px-8 py-4 text-lg font-bold ${
                  state.canStart
                    ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Play className="h-5 w-5 mr-2" />
                {state.canStart ? 'Начать выполнение' : 'Начать невозможно'}
              </Button>
              
              <Button
                onClick={() => navigate('/')}
                variant="outline"
                className="px-8 py-4 text-lg cursor-pointer"
              >
                На главную
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeworkQuiz;
