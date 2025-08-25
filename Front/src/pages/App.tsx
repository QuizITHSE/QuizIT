//import { getAnalytics } from 'firebase/analytics';
import './App.css'
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { auth, db } from '@/lib/firebase';

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

    // Создаём новый документ викторины в коллекции "quizes"
    try {
      const docRef = await addDoc(collection(db, "quizes"), {
        title: "",
        questions: [],
        owner: user.uid,
        createdAt: new Date(),
      });
      navigate(`/create-quiz?id=${docRef.id}`);
    } catch (error) {
      console.error("Ошибка при создании викторины:", error);
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
    <div className="min-h-screen w-full flex flex-col items-center justify-center montserrat-600">
      <p>
        Hello,
        {isTeacher ? "Teacher" : "Student"}
      </p>
      {isTeacher && (
        <Button className='cursor-pointer' onClick={createQuiz}>
          Создать викторину
        </Button>
      )}
    </div>
  )
}

export default App
