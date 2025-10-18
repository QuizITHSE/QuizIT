import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Target, AlertTriangle, CheckCircle, XCircle, Clock, FileText, Calendar } from 'lucide-react';

interface HomeworkSubmission {
  student_id: string;
  student_name: string;
  submitted_at: any;
  score: number;
  max_score?: number;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  missed_answers: number;
  percentage: number;
  is_late: boolean;
  tab_switches: number;
  answers: Answer[];
  status: 'completed' | 'in_progress' | 'cheated';
  time_started: any;
  time_completed: any;
  time_taken_seconds: number;
  time_limit_seconds: number | null;
  violation_reason?: string;
}

interface Answer {
  question_index: number;
  question_text: string;
  student_answer: number[];
  correct_answer: number[];
  is_correct: boolean;
  points_earned: number;
  max_points: number;
}

interface HomeworkData {
  quiz_title: string;
  group_name: string;
  deadline: any;
  mode: 'normal' | 'lockdown' | 'tab_tracking';
  time_limit_minutes: number | null;
  description?: string;
}

const HomeworkResults: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const homeworkId = searchParams.get('id');
  
  const [submission, setSubmission] = useState<HomeworkSubmission | null>(null);
  const [homework, setHomework] = useState<HomeworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/auth');
        return;
      }

      if (!homeworkId) {
        setError('ID домашнего задания не указан');
        setLoading(false);
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

        
        const homeworkDoc = await getDoc(doc(db, 'homework', homeworkId));
        
        if (!homeworkDoc.exists()) {
          setError('Домашнее задание не найдено');
          setLoading(false);
          return;
        }
        
        const homeworkData = homeworkDoc.data() as HomeworkData;
        setHomework(homeworkData);
        
        const submissionDoc = await getDoc(doc(db, 'homework', homeworkId, 'submissions', user.uid));
        
        if (!submissionDoc.exists()) {
          setError('Вы еще не выполнили это домашнее задание');
          setLoading(false);
          return;
        }
        
        const submissionData = submissionDoc.data() as HomeworkSubmission;
        setSubmission(submissionData);
        
      } catch (error) {
        setError('Ошибка при загрузке результатов');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate, homeworkId]);

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getGameModeLabel = (mode: string) => {
    switch (mode) {
      case 'lockdown':
        return { label: '🔒 Режим блокировки', color: 'text-red-600 bg-red-50' };
      case 'tab_tracking':
        return { label: '👁️ Отслеживание вкладок', color: 'text-yellow-600 bg-yellow-50' };
      default:
        return { label: '📝 Обычный режим', color: 'text-gray-600 bg-gray-50' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Загрузка результатов...</div>
        </div>
      </div>
    );
  }

  if (error || !submission || !homework) {
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

  const percentage = submission.percentage;
  const gameMode = getGameModeLabel(homework.mode);
  const isCheated = submission.status === 'cheated';

  return (
    <div className="min-h-screen w-full montserrat-600 bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{homework.quiz_title}</h1>
              <p className="text-gray-600">Группа: {homework.group_name}</p>
              <p className="text-sm text-gray-500">Отправлено: {formatDate(submission.submitted_at)}</p>
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

        {/* Violation Warning */}
        {isCheated && (
          <div className="bg-red-600 text-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-8 w-8 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">⚠️ ОБНАРУЖЕНО НАРУШЕНИЕ</h2>
                <p className="text-lg mb-2">
                  {submission.violation_reason || 'Нарушение правил выполнения домашнего задания'}
                </p>
                <p className="text-red-100">
                  Ваша попытка была автоматически завершена с нулевым результатом. Преподаватель был уведомлен о нарушении.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Late Submission Warning */}
        {submission.is_late && !isCheated && (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertTriangle className="h-6 w-6 text-yellow-600 mr-3" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">
                  Задание выполнено после дедлайна
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Дедлайн: {formatDate(homework.deadline)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Баллы</p>
                  <p className={`text-2xl font-bold ${isCheated ? 'text-red-600' : 'text-blue-600'}`}>
                    {submission.score}/{submission.max_score || submission.total_questions}
                  </p>
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
                    isCheated ? 'text-red-600' :
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
                  <p className="text-sm font-medium text-gray-600">Время</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatTime(submission.time_taken_seconds)}
                  </p>
                  {submission.time_limit_seconds && (
                    <p className="text-xs text-gray-500">
                      из {formatTime(submission.time_limit_seconds)}
                    </p>
                  )}
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Режим</p>
                  <p className={`text-sm font-semibold px-2 py-1 rounded ${gameMode.color}`}>
                    {gameMode.label}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Answer Statistics */}
        {!isCheated && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-green-800">Правильные</p>
                  <p className="text-2xl font-bold text-green-600">{submission.correct_answers}</p>
                </div>
              </div>
            </div>

            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <XCircle className="h-6 w-6 text-red-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-red-800">Неправильные</p>
                  <p className="text-2xl font-bold text-red-600">{submission.wrong_answers}</p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
              <div className="flex items-center">
                <Clock className="h-6 w-6 text-yellow-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Пропущенные</p>
                  <p className="text-2xl font-bold text-yellow-600">{submission.missed_answers}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Switches Warning */}
        {submission.tab_switches > 0 && homework.mode === 'tab_tracking' && (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertTriangle className="h-6 w-6 text-yellow-600 mr-3" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">
                  Зафиксировано переключений вкладок: {submission.tab_switches}
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Во время выполнения задания вы переключались на другие вкладки или приложения
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Homework Info */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Информация о задании</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start">
              <Calendar className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700">Дедлайн</p>
                <p className="text-sm text-gray-600">{formatDate(homework.deadline)}</p>
              </div>
            </div>
            {homework.description && (
              <div className="flex items-start">
                <FileText className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Описание</p>
                  <p className="text-sm text-gray-600">{homework.description}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Detailed Answers */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Детальный разбор ответов</h2>
            {!isCheated && (
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
            )}
          </div>
          <div className="space-y-4">
            {submission.answers.map((answer, index) => {
              const hasAnswer = answer.student_answer && answer.student_answer.length > 0;
              
              return (
                <div
                  key={index}
                  className={`border-2 rounded-lg p-4 ${
                    !hasAnswer
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
                          Вопрос {answer.question_index + 1}
                        </span>
                        {!hasAnswer ? (
                          <span className="flex items-center text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">
                            <Clock className="h-3 w-3 mr-1" />
                            Не отвечен
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
                      
                      {!isCheated && (
                        <div className="text-sm text-gray-600 mb-2">
                          <p><strong>Ваш ответ:</strong> {
                            hasAnswer 
                              ? answer.student_answer.map(i => i + 1).join(', ')
                              : 'Не отвечено'
                          }</p>
                          <p><strong>Правильный ответ:</strong> {answer.correct_answer.map(i => i + 1).join(', ')}</p>
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className={`text-xl font-bold ${
                        !hasAnswer ? 'text-yellow-600' : answer.is_correct ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {answer.points_earned}/{answer.max_points}
                      </p>
                      <p className="text-xs text-gray-500">очков</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeworkResults;

