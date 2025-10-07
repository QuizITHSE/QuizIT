//import { getAnalytics } from 'firebase/analytics';
import './App.css'
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { auth, db } from '@/lib/firebase';
import QuizList from '@/components/QuizList';
import QuizResults from '@/components/QuizResults';

function App() {
  const navigate = useNavigate();
  const [isTeacher, setIsTeacher] = useState(false);

  const createQuiz = async () => {
    // Получаем текущего пользователя
    const user = auth.currentUser;
    if (!user) {
      navigate("/auth");
      return;
    }

    console.log('Creating quiz for user:', user.uid);

    // Создаём новый документ викторины в коллекции "quizes"
    try {
      const docRef = await addDoc(collection(db, "quizes"), {
        title: "Новый квиз",
        questions: [],
        owner: user.uid,
        createdAt: new Date(),
      });
      console.log('Quiz created with ID:', docRef.id);
      navigate(`/create-quiz?id=${docRef.id}`);
    } catch (error) {
      console.error("Ошибка при создании викторины:", error);
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/auth");
    } catch (error) {
      console.error("Ошибка при выходе:", error);
    }
  }


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/auth");
        return;
      }
      const q = query(collection(db, 'users'), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        navigate("/auth");
      } else {
        setIsTeacher(querySnapshot.docs[0].data().isTeacher);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen w-full montserrat-600">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Добро пожаловать, {isTeacher ? "Учитель" : "Студент"}!
            </h1>
            <p className="text-gray-600 mt-2">
              {isTeacher ? "Управляйте своими квизами и создавайте новые" : "Присоединяйтесь к квизам и проверяйте свои знания"}
            </p>
          </div>
          <div className="flex gap-3">
            {isTeacher && (
              <Button 
                className='cursor-pointer bg-blue-600 hover:bg-blue-700 px-6 py-3 text-lg' 
                onClick={createQuiz}
              >
                Создать викторину
              </Button>
            )}
            <Button 
              variant="outline"
              className='cursor-pointer px-6 py-3 text-lg' 
              onClick={handleLogout}
            >
              Выйти
            </Button>
          </div>
        </div>
        
        {isTeacher && (
          <div className="space-y-8">
            <QuizList />
            <QuizResults />
          </div>
        )}
      </div>
    </div>
  )
}

export default App
