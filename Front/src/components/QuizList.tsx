import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { GraduationCap, Calendar, Users, Edit, Trash2, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Quiz {
  id: string;
  title: string;
  questions: string[];
  owner: string;
  createdAt: any;
  updatedAt?: any;
}

const QuizList: React.FC = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      console.log('User UID:', user.uid);
      
      try {
        // Получаем все квизы текущего пользователя, отсортированные по дате создания
        let q;
        try {
          q = query(
            collection(db, 'quizes'),
            where('owner', '==', user.uid),
            orderBy('createdAt', 'desc')
          );
        } catch (indexError) {
          console.log('Index error, trying without orderBy:', indexError);
          // Если индекс не настроен, делаем запрос без orderBy
          q = query(
            collection(db, 'quizes'),
            where('owner', '==', user.uid)
          );
        }
        
        const querySnapshot = await getDocs(q);
        const quizzesData: Quiz[] = [];
        
        console.log('Query snapshot size:', querySnapshot.size);
        
        querySnapshot.forEach((doc) => {
          console.log('Quiz doc:', doc.id, doc.data());
          quizzesData.push({
            id: doc.id,
            ...doc.data()
          } as Quiz);
        });
        
        // Сортируем локально, если не удалось отсортировать в запросе
        quizzesData.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });
        
        console.log('Quizzes data:', quizzesData);
        setQuizzes(quizzesData);
      } catch (error) {
        console.error('Ошибка при загрузке квизов:', error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

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

  const handleEditQuiz = (quizId: string) => {
    navigate(`/create-quiz?id=${quizId}`);
  };

  const handleDeleteQuiz = async (quizId: string) => {
    const quiz = quizzes.find(q => q.id === quizId);
    const quizTitle = quiz?.title || 'этот квиз';
    
    if (window.confirm(`Вы уверены, что хотите удалить "${quizTitle}"? Это действие нельзя отменить.`)) {
      try {
        // Удаляем квиз из Firebase
        await deleteDoc(doc(db, 'quizes', quizId));
        
        // Обновляем локальное состояние
        setQuizzes(prevQuizzes => prevQuizzes.filter(quiz => quiz.id !== quizId));
        
        console.log('Квиз успешно удален:', quizId);
      } catch (error) {
        console.error('Ошибка при удалении квиза:', error);
        alert('Произошла ошибка при удалении квиза. Попробуйте еще раз.');
      }
    }
  };

  const handleStartQuiz = (quizId: string) => {
    navigate(`/host?id=${quizId}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-lg">Загрузка квизов...</div>
      </div>
    );
  }

  if (quizzes.length === 0) {
    return (
      <div className="text-center p-8">
        <GraduationCap className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Пока нет созданных квизов</h3>
        <p className="text-gray-500 mb-4">Создайте свой первый квиз, чтобы начать работу</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Мои квизы</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {quizzes.map((quiz) => (
          <div key={quiz.id} className="border rounded-lg p-6 hover:shadow-lg transition-shadow duration-200 bg-white">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {quiz.title || 'Без названия'}
                </h3>
                <p className="text-sm text-gray-600">
                  {quiz.questions.length} вопросов
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteQuiz(quiz.id)}
                className="h-8 w-8 p-0 hover:bg-red-100 text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300 cursor-pointer"
                title="Удалить квиз"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="h-4 w-4 mr-2" />
                <span>Создан: {formatDate(quiz.createdAt)}</span>
              </div>
              {quiz.updatedAt && (
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>Обновлен: {formatDate(quiz.updatedAt)}</span>
                </div>
              )}
              <div className="flex space-x-2 pt-2">
                <Button
                  onClick={() => handleEditQuiz(quiz.id)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 cursor-pointer"
                  size="sm"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Редактировать
                </Button>
                <Button
                  onClick={() => handleStartQuiz(quiz.id)}
                  variant="outline"
                  className="flex-1 cursor-pointer"
                  size="sm"
                >
                  <Play className="h-4 w-4 mr-1" />
                  Запустить
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuizList;
