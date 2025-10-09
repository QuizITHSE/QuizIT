//import { getAnalytics } from 'firebase/analytics';
import './App.css'
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { auth, db } from '@/lib/firebase';
import QuizList from '@/components/QuizList';
import QuizResults from '@/components/QuizResults';
import { Play, Users, TrendingUp } from 'lucide-react';

function App() {
  const navigate = useNavigate();
  const [isTeacher, setIsTeacher] = useState(false);
  const [activeGame, setActiveGame] = useState<{
    code: string;
    groupName: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

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

  const checkActiveGames = async (userUid: string) => {
    try {
      console.log('🔍 Проверяем активные игры для студента:', userUid);
      
      // Находим группы, где студент является участником
      const groupsQuery = query(
        collection(db, 'groups'),
        where('students', 'array-contains', userUid)
      );
      const groupsSnapshot = await getDocs(groupsQuery);
      
      if (groupsSnapshot.empty) {
        console.log('📝 Студент не состоит ни в одной группе');
        setActiveGame(null);
        return;
      }
      
      console.log('👥 Найдено групп:', groupsSnapshot.size);
      
      // Проверяем каждую группу на наличие активных игр
      for (const groupDoc of groupsSnapshot.docs) {
        const groupData = groupDoc.data();
        const groupId = groupDoc.id;
        
        console.log('🎮 Проверяем группу:', groupData.name, 'ID:', groupId);
        
        // Ищем активные незавершенные игры для этой группы
        const gamesQuery = query(
          collection(db, 'games'),
          where('group_id', '==', groupId),
          where('active', '==', true),
          where('game_finished', '==', false)
        );
        const gamesSnapshot = await getDocs(gamesQuery);
        
        if (!gamesSnapshot.empty) {
          const gameData = gamesSnapshot.docs[0].data();
          console.log('🎯 Найдена активная игра:', gameData.code);
          
          setActiveGame({
            code: gameData.code,
            groupName: groupData.name
          });
          return;
        }
      }
      
      console.log('❌ Активных игр не найдено');
      setActiveGame(null);
      
    } catch (error) {
      console.error('❌ Ошибка при проверке активных игр:', error);
      setActiveGame(null);
    }
  };


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/auth");
        return;
      }
      
      try {
        // Получаем данные пользователя напрямую по UID
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (!userDoc.exists()) {
          navigate("/auth");
          return;
        }
        
        const userData = userDoc.data();
        setIsTeacher(userData.isTeacher);
        
        // Если пользователь студент, проверяем активные игры
        if (!userData.isTeacher) {
          await checkActiveGames(user.uid); // Теперь используем UID напрямую
        }
        
      } catch (error) {
        console.error('Ошибка при загрузке данных пользователя:', error);
        navigate("/auth");
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-lg">Загрузка...</div>
      </div>
    );
  }

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
        
        {isTeacher ? (
          <div className="space-y-8">
            <QuizList />
            <QuizResults />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Quick Join Button for Students */}
            {activeGame && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="bg-green-100 p-3 rounded-full mr-4">
                      <Play className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Активная игра!</h2>
                      <p className="text-gray-600">
                        В группе "{activeGame.groupName}" идет квиз
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Код игры: <span className="font-mono font-bold text-blue-600">{activeGame.code}</span>
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => navigate(`/play?code=${activeGame.code}`)}
                    className="bg-green-600 hover:bg-green-700 px-6 py-3 text-lg cursor-pointer"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Присоединиться
                  </Button>
                </div>
              </div>
            )}
            
            {/* Manual Join Option */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="bg-blue-100 p-3 rounded-full mr-4">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Присоединиться к игре</h2>
                    <p className="text-gray-600">
                      Введите код игры для участия в квизе
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => navigate('/play')}
                  variant="outline"
                  className="px-6 py-3 text-lg cursor-pointer"
                >
                  <Users className="h-5 w-5 mr-2" />
                  Ввести код
                </Button>
              </div>
            </div>
            
            {/* My Results Option */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="bg-purple-100 p-3 rounded-full mr-4">
                    <TrendingUp className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Мои результаты</h2>
                    <p className="text-gray-600">
                      Просмотрите историю ваших игр и достижения
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => navigate('/my-results')}
                  variant="outline"
                  className="px-6 py-3 text-lg cursor-pointer"
                >
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Посмотреть
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
