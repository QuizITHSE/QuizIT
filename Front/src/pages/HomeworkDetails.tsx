import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getDoc, getDocs, collection, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, CheckCircle, XCircle, AlertTriangle, Users } from 'lucide-react';

interface Answer {
  question_index: number;
  question_text: string;
  student_answer: number[] | string;
  correct_answer: number[] | string;
  is_correct: boolean;
  points_earned: number;
  max_points: number;
  question_type?: string;
}

interface Submission {
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
  violation_reason?: string;
}

interface HomeworkData {
  quiz_title: string;
  group_name: string;
  deadline: any;
  mode: string;
  time_limit_minutes: number | null;
  description?: string;
}

const HomeworkDetails: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const homeworkId = searchParams.get('id');
  const studentId = searchParams.get('studentId');
  
  const [homework, setHomework] = useState<HomeworkData | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
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
        
        if (!userData.isTeacher) {
          alert('Доступ запрещен. Только учителя могут просматривать детальные результаты.');
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
        
        const submissionsSnapshot = await getDocs(collection(db, 'homework', homeworkId, 'submissions'));
        const submissionsData: Submission[] = [];
        
        submissionsSnapshot.forEach((doc) => {
          submissionsData.push(doc.data() as Submission);
        });
        
        setSubmissions(submissionsData);
        
        if (studentId) {
          const submission = submissionsData.find(s => s.student_id === studentId);
          if (submission) {
            setSelectedSubmission(submission);
          }
        }
        
      } catch (error) {
        setError('Ошибка при загрузке результатов');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [homeworkId, studentId, navigate]);

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'Неизвестно';
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleStudentClick = (studentId: string) => {
    const submission = submissions.find(s => s.student_id === studentId);
    if (submission) {
      setSelectedSubmission(submission);
    }
  };

  const formatAnswer = (answer: number[] | string, options?: string[]): string => {
    if (typeof answer === 'string') {
      return answer;
    }
    
    if (Array.isArray(answer) && answer.length > 0 && options && options[0]) {
      return answer.map(idx => options[idx] || `Вариант ${idx + 1}`).join(', ');
    }
    
    if (Array.isArray(answer) && answer.length > 0) {
      return answer.map(idx => `Вариант ${idx + 1}`).join(', ');
    }
    
    return 'Не отвечено';
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

  if (error || !homework) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">{error || 'Домашнее задание не найдено'}</div>
          <Button onClick={() => navigate(-1)} className="cursor-pointer">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад
          </Button>
        </div>
      </div>
    );
  }

  if (selectedSubmission) {
    // Show individual student submission details
    return (
      <div className="min-h-screen w-full montserrat-600 bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{homework.quiz_title}</h1>
                <p className="text-gray-600">Группа: {homework.group_name}</p>
                <p className="text-lg font-medium text-gray-900 mt-2">{selectedSubmission.student_name}</p>
                <p className="text-sm text-gray-500">Отправлено: {formatDate(selectedSubmission.submitted_at)}</p>
              </div>
              <Button
                onClick={() => setSelectedSubmission(null)}
                variant="outline"
                className="cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад к списку
              </Button>
            </div>
          </div>

          {/* Violation Warning */}
          {selectedSubmission.status === 'cheated' && (
            <div className="bg-red-600 text-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-8 w-8 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">⚠️ ОБНАРУЖЕНО НАРУШЕНИЕ</h2>
                  <p className="text-lg mb-2">
                    {selectedSubmission.violation_reason || 'Нарушение правил выполнения домашнего задания'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Баллы</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {selectedSubmission.score}/{selectedSubmission.max_score || selectedSubmission.total_questions}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Процент</p>
                  <p className={`text-2xl font-bold ${
                    selectedSubmission.percentage >= 80 ? 'text-green-600' :
                    selectedSubmission.percentage >= 60 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {selectedSubmission.percentage}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-3">
                <span className="text-green-600 text-sm">✅ {selectedSubmission.correct_answers}</span>
                <span className="text-red-600 text-sm">❌ {selectedSubmission.wrong_answers}</span>
                <span className="text-yellow-600 text-sm">⏱️ {selectedSubmission.missed_answers}</span>
              </div>
            </div>

            {selectedSubmission.is_late && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-6">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-yellow-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Статус</p>
                    <p className="text-xl font-bold text-yellow-600">С опозданием</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Answers */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Ответы на вопросы</h2>
            </div>
            
            <div className="space-y-4 p-6">
              {selectedSubmission.answers.map((answer, index) => {
                const hasAnswer = answer.student_answer && (
                  Array.isArray(answer.student_answer) 
                    ? answer.student_answer.length > 0 
                    : typeof answer.student_answer === 'string' 
                    ? answer.student_answer.trim().length > 0
                    : false
                );
                
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
                      <div className="text-right ml-4">
                        <p className={`text-xl font-bold ${
                          !hasAnswer ? 'text-yellow-600' : answer.is_correct ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {answer.points_earned}/{answer.max_points}
                        </p>
                        <p className="text-xs text-gray-500">очков</p>
                      </div>
                    </div>
                    
                    <p className="text-gray-700 mb-3 font-medium">{answer.question_text}</p>
                    
                    <div className="text-sm text-gray-600">
                      <p><strong>Ответ студента:</strong> {formatAnswer(answer.student_answer)}</p>
                      <p><strong>Правильный ответ:</strong> {
                        typeof answer.correct_answer === 'string'
                          ? answer.correct_answer
                          : Array.isArray(answer.correct_answer) && answer.correct_answer.length > 0
                          ? answer.correct_answer.map((idx: number) => `Вариант ${idx + 1}`).join(', ')
                          : 'Неизвестно'
                      }</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show list of all students and their submissions
  return (
    <div className="min-h-screen w-full montserrat-600 bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{homework.quiz_title}</h1>
              <p className="text-gray-600">Группа: {homework.group_name}</p>
              {homework.description && (
                <p className="text-gray-600 mt-2">{homework.description}</p>
              )}
            </div>
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              className="cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>
          </div>
        </div>

        {/* Statistics */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Отправлено</p>
                  <p className="text-2xl font-bold text-gray-900">{submissions.length}</p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Выполнено</p>
                  <p className="text-2xl font-bold text-green-600">
                    {submissions.filter(s => s.status === 'completed').length}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">С опозданием</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {submissions.filter(s => s.is_late).length}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-red-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Нарушения</p>
                  <p className="text-2xl font-bold text-red-600">
                    {submissions.filter(s => s.status === 'cheated').length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Students List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Результаты студентов</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Студент
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Баллы
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Процент
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата отправки
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {submissions.map((submission) => {
                  const percentage = submission.total_questions > 0 
                    ? Math.round((submission.score / submission.total_questions) * 100) 
                    : 0;
                  
                  return (
                    <tr 
                      key={submission.student_id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleStudentClick(submission.student_id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{submission.student_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-center">
                          <span className="text-lg font-bold text-blue-600">
                            {submission.score}/{submission.max_score || submission.total_questions}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-center">
                          <span className={`font-semibold ${
                            percentage >= 80 ? 'text-green-600' :
                            percentage >= 60 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {submission.status === 'cheated' ? (
                          <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                            Нарушение
                          </span>
                        ) : submission.is_late ? (
                          <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-semibold">
                            С опозданием
                          </span>
                        ) : (
                          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-semibold">
                            Выполнено
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {formatDate(submission.submitted_at)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeworkDetails;

