import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getDoc, doc, getDocs, collection, addDoc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle, XCircle, Clock, Trophy, BookOpen, Loader2, Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface Answer {
  question_number: number;
  question_text: string;
  question_type: string;
  options: string[];
  user_answer: number[] | number | string | null;
  correct_answer: number[] | number | string;
  is_correct: boolean;
  points_earned: number;
  possible_points: number;
  missed?: boolean;
  explanation?: string;
}

interface StudentResult {
  user_id: string;
  username: string;
  score: number;
  placement: number;
  total_questions: number;
  total_players: number;
  tab_switches: number;
  answers: Answer[];
  correct_answers: number;
  wrong_answers: number;
  missed_answers: number;
}

const StudentQuizDetails: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('gameId');
  const studentId = searchParams.get('studentId');
  
  const [result, setResult] = useState<StudentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameData, setGameData] = useState<any>(null);
  const [quizData, setQuizData] = useState<any>(null);
  const [creatingRevision, setCreatingRevision] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/auth');
        return;
      }

      if (!gameId || !studentId) {
        setError('Параметры не указаны');
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
        
        // Students can only view their own results, teachers can view any student's results
        if (!userData.isTeacher && user.uid !== studentId) {
          alert('Доступ запрещен. Вы можете просматривать только свои результаты.');
          navigate('/');
          return;
        }

        const resultDoc = await getDoc(doc(db, 'games', gameId, 'results', studentId));
        
        if (!resultDoc.exists()) {
          setError('Результаты для этого студента не найдены');
          setLoading(false);
          return;
        }
        
        const resultData = resultDoc.data() as StudentResult;
        setResult(resultData);
        
        // Load game and quiz data
        const gameDoc = await getDoc(doc(db, 'games', gameId));
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
        setError('Ошибка при загрузке результатов');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [gameId, studentId, navigate]);

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

  if (error || !result) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">{error || 'Результаты не найдены'}</div>
          <Button onClick={() => navigate(-1)} className="cursor-pointer">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад
          </Button>
        </div>
      </div>
    );
  }

  const percentage = result.total_questions > 0 
    ? Math.round((result.score / result.total_questions) * 100) 
    : 0;

  const formatAnswer = (answer: number[] | number | string | null, options: string[]): string => {
    if (answer === null || answer === undefined) return 'Не отвечено';
    
    if (typeof answer === 'string') {
      return answer;
    }
    
    if (typeof answer === 'number') {
      return options[answer] || `Вариант ${answer + 1}`;
    }
    
    if (Array.isArray(answer)) {
      return answer.map(idx => options[idx] || `Вариант ${idx + 1}`).join(', ');
    }
    
    return 'Неизвестно';
  };

  const formatCorrectAnswer = (answer: number[] | number | string, options: string[]): string => {
    if (typeof answer === 'string') {
      return answer;
    }
    
    if (typeof answer === 'number') {
      return options[answer] || `Вариант ${answer + 1}`;
    }
    
    if (Array.isArray(answer)) {
      return answer.map(idx => options[idx] || `Вариант ${idx + 1}`).join(', ');
    }
    
    return 'Неизвестно';
  };

  const handleCreateRevisionQuiz = async () => {
    if (!result || !auth.currentUser) return;
    
    setCreatingRevision(true);
    try {
      // Get wrong/missed answers
      const wrongAnswers = result.answers.filter(a => !a.is_correct);
      
      if (wrongAnswers.length === 0) {
        alert('У студента нет ошибок для повторения!');
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
        quizTitle = `Квиз повторения ошибок - ${result.username}`;
      } else {
        // Fallback: create questions from answer data
        const questionPromises = wrongAnswers.map(async (answer) => {
          const isTextQuestion = answer.question_type === 'text';
          const questionData: any = {
            question: answer.question_text,
            options: answer.options,
            correct: isTextQuestion 
              ? []  // For text questions, correct is always empty array
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
          
          // Only add textAnswer for text questions
          if (isTextQuestion && typeof answer.correct_answer === 'string') {
            questionData.textAnswer = answer.correct_answer;
          }
          
          const docRef = await addDoc(collection(db, 'questions'), questionData);
          return docRef.id;
        });
        
        questionIds = await Promise.all(questionPromises);
        quizTitle = `Квиз повторения ошибок - ${result.username}`;
      }
      
      const revisionQuizData = {
        title: quizTitle,
        questions: questionIds,
        owner: auth.currentUser.uid,
        createdAt: new Date(),
        isRevisionQuiz: true,
        originalGameId: gameId,
        originalStudentId: studentId
      };
      
      const revisionQuizRef = await addDoc(collection(db, 'quizes'), revisionQuizData);
      
      // Check if current user is a teacher or student
      const currentUserDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const isTeacher = currentUserDoc.exists() && currentUserDoc.data()?.isTeacher;
      
      // Find the group for this student (only if teacher)
      let groupId = null;
      let groupName = 'None';
      let teacherId = auth.currentUser.uid;
      
      if (isTeacher) {
        const groupsQuery = query(
          collection(db, 'groups'),
          where('students', 'array-contains', studentId),
          where('admin', '==', auth.currentUser.uid)
        );
        const groupsSnapshot = await getDocs(groupsQuery);
        
        if (!groupsSnapshot.empty) {
          const group = groupsSnapshot.docs[0].data();
          groupId = groupsSnapshot.docs[0].id;
          groupName = group.name;
        }
      } else {
        // For students, try to find their group
        const groupsQuery = query(
          collection(db, 'groups'),
          where('students', 'array-contains', studentId)
        );
        const groupsSnapshot = await getDocs(groupsQuery);
        
        if (!groupsSnapshot.empty) {
          const group = groupsSnapshot.docs[0].data();
          groupId = groupsSnapshot.docs[0].id;
          groupName = group.name;
          teacherId = group.admin;
        }
        // If no group found, allow creating without group (groupId remains null)
      }
      
      // Create homework assignment for this specific student
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 7); // 7 days deadline
      
      const homeworkData: any = {
        quiz_id: revisionQuizRef.id,
        quiz_title: revisionQuizData.title,
        teacher_id: teacherId,
        created_at: new Date(),
        deadline: deadline,
        total_questions: questionIds.length,
        is_active: true,
        description: quizData ? `Квиз повторения ошибок из игры ${quizData.title}` : 'Квиз повторения ошибок',
        mode: 'normal',
        time_limit_minutes: null,
        assigned_to_students: [studentId]
      };
      
      // Only add group_id and group_name if group exists
      if (groupId) {
        homeworkData.group_id = groupId;
        homeworkData.group_name = groupName;
      }
      
      await addDoc(collection(db, 'homework'), homeworkData);
      
      // Показываем toast уведомление
      toast.success('Квиз повторения ошибок успешно создан!', {
        description: groupId ? `Назначен студенту ${result.username}` : 'Домашнее задание создано',
      });
      
    } catch (error) {
      console.error('Error creating revision quiz:', error);
      alert('Ошибка при создании квиза повторения ошибок');
    } finally {
      setCreatingRevision(false);
    }
  };

  const exportToCSV = () => {
    if (!result) {
      alert('Нет данных для экспорта');
      return;
    }

    const csvData = [
      {
        'Вопрос': 'Общая информация',
        'Текст вопроса': '',
        'Ответ студента': '',
        'Правильный ответ': '',
        'Результат': '',
        'Баллы': ''
      },
      {
        'Вопрос': 'Итоги',
        'Текст вопроса': `${result.score}/${result.total_questions} (${Math.round((result.score / result.total_questions) * 100)}%)`,
        'Ответ студента': `Правильно: ${result.correct_answers}`,
        'Правильный ответ': `Неправильно: ${result.wrong_answers}`,
        'Результат': `Пропущено: ${result.missed_answers}`,
        'Баллы': ''
      }
    ];

    result.answers.forEach((answer, index) => {
      const studentAnswer = formatAnswer(answer.user_answer, answer.options);
      const correctAnswer = formatCorrectAnswer(answer.correct_answer, answer.options);
      
      csvData.push({
        'Вопрос': `Вопрос ${index + 1}`,
        'Текст вопроса': answer.question_text,
        'Ответ студента': studentAnswer,
        'Правильный ответ': correctAnswer,
        'Результат': answer.is_correct ? 'Правильно' : (answer.missed ? 'Пропущено' : 'Неправильно'),
        'Баллы': `${answer.points_earned}/${answer.possible_points}`
      });
    });

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `student_results_${result.username}_${gameId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    if (!result) {
      alert('Нет данных для экспорта');
      return;
    }

    const excelData = [
      {
        'Вопрос': 'Общая информация',
        'Текст вопроса': '',
        'Ответ студента': '',
        'Правильный ответ': '',
        'Результат': '',
        'Баллы': ''
      },
      {
        'Вопрос': 'Итоги',
        'Текст вопроса': `${result.score}/${result.total_questions} (${Math.round((result.score / result.total_questions) * 100)}%)`,
        'Ответ студента': `Правильно: ${result.correct_answers}`,
        'Правильный ответ': `Неправильно: ${result.wrong_answers}`,
        'Результат': `Пропущено: ${result.missed_answers}`,
        'Баллы': ''
      }
    ];

    result.answers.forEach((answer, index) => {
      const studentAnswer = formatAnswer(answer.user_answer, answer.options);
      const correctAnswer = formatCorrectAnswer(answer.correct_answer, answer.options);
      
      excelData.push({
        'Вопрос': `Вопрос ${index + 1}`,
        'Текст вопроса': answer.question_text,
        'Ответ студента': studentAnswer,
        'Правильный ответ': correctAnswer,
        'Результат': answer.is_correct ? 'Правильно' : (answer.missed ? 'Пропущено' : 'Неправильно'),
        'Баллы': `${answer.points_earned}/${answer.possible_points}`
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Результаты студента');
    
    XLSX.writeFile(workbook, `student_results_${result.username}_${gameId}.xlsx`);
  };

  return (
    <div className="min-h-screen w-full montserrat-600 bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Результаты студента</h1>
              <p className="text-gray-600">{result.username}</p>
              <p className="text-sm text-gray-500">Игра #{gameId}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={exportToCSV}
                variant="outline"
                size="sm"
                className="cursor-pointer"
              >
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button
                onClick={exportToExcel}
                variant="outline"
                size="sm"
                className="cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </Button>
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
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Trophy className="h-8 w-8 text-yellow-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Место</p>
                <p className="text-2xl font-bold text-gray-900">#{result.placement}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Trophy className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Баллы</p>
                <p className="text-2xl font-bold text-blue-600">{result.score}/{result.total_questions}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
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
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="flex gap-3">
                <span className="text-green-600">✅ {result.correct_answers}</span>
                <span className="text-red-600">❌ {result.wrong_answers}</span>
                <span className="text-yellow-600">⏱️ {result.missed_answers}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Create Revision Quiz Button */}
        {(result.wrong_answers > 0 || result.missed_answers > 0) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="h-8 w-8 text-blue-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Квиз повторения ошибок</h3>
                  <p className="text-sm text-gray-600">
                    Создайте квиз из {result.wrong_answers + result.missed_answers} вопросов, на которые студент ответил неправильно или пропустил
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

        {/* Answers */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Ответы на вопросы</h2>
          </div>
          
          <div className="space-y-4 p-6">
            {result.answers.map((answer, index) => (
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
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-900">
                      Вопрос {answer.question_number}
                    </span>
                    {answer.missed ? (
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
                      answer.missed ? 'text-yellow-600' : answer.is_correct ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {answer.points_earned}/{answer.possible_points}
                    </p>
                    <p className="text-xs text-gray-500">очков</p>
                  </div>
                </div>
                
                <p className="text-gray-700 mb-3 font-medium">{answer.question_text}</p>
                
                <div className="text-sm text-gray-600">
                  <p><strong>Ответ студента:</strong> {formatAnswer(answer.user_answer, answer.options)}</p>
                  <p><strong>Правильный ответ:</strong> {formatCorrectAnswer(answer.correct_answer, answer.options)}</p>
                  {answer.explanation && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                      <p><strong className="text-blue-700">Объяснение:</strong> <span className="text-gray-700">{answer.explanation}</span></p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentQuizDetails;

