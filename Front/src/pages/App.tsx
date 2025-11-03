import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { auth, db } from '@/lib/firebase';
import QuizList from '@/components/QuizList';
import QuizResults from '@/components/QuizResults';
import { Toaster } from '@/components/ui/sonner';
import { Play, Users, TrendingUp, BookOpen, Calendar, UserCheck, FileText, Clock, AlertTriangle, Trophy } from 'lucide-react';

function App() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [activeGame, setActiveGame] = useState<{
    code: string;
    groupName: string;
  } | null>(null);
  const [teacherGroups, setTeacherGroups] = useState<Array<{
    id: string;
    name: string;
    code: string;
    description: string;
    studentsCount: number;
    createdAt: any;
  }>>([]);
  const [studentHomework, setStudentHomework] = useState<Array<{
    id: string;
    quiz_title: string;
    group_name: string;
    deadline: any;
    mode: 'normal' | 'lockdown' | 'tab_tracking';
    time_limit_minutes: number | null;
    description: string;
    status: 'Не начато' | 'Выполнено' | 'Просрочено' | 'Выполнено с опозданием' | 'Нарушение';
    submission?: any;
  }>>([]);
  const [lastGameResult, setLastGameResult] = useState<{
    gameId: string;
    gameCode: string;
    placement: number;
    score: number;
    total_players: number;
    total_questions: number;
    correct_answers: number;
    finished_at: any;
  } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const createQuiz = async () => {
    const user = auth.currentUser;
    if (!user) {
      navigate("/auth");
      return;
    }


    try {
      const docRef = await addDoc(collection(db, "quizes"), {
        title: "Новый квиз",
        questions: [],
        owner: user.uid,
        createdAt: new Date(),
      });
      navigate(`/create-quiz?id=${docRef.id}`);
    } catch (error) {
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/auth");
    } catch (error) {
    }
  }

  const checkActiveGames = async (userUid: string) => {
    try {
      const groupsQuery = query(
        collection(db, 'groups'),
        where('students', 'array-contains', userUid)
      );
      const groupsSnapshot = await getDocs(groupsQuery);
      
      if (groupsSnapshot.empty) {
        setActiveGame(null);
        return;
      }
      
      for (const groupDoc of groupsSnapshot.docs) {
        const groupData = groupDoc.data();
        const groupId = groupDoc.id;
        
        
        const gamesQuery = query(
          collection(db, 'games'),
          where('group_id', '==', groupId),
          where('active', '==', true),
          where('game_finished', '==', false)
        );
        const gamesSnapshot = await getDocs(gamesQuery);
        
        if (!gamesSnapshot.empty) {
          const gameData = gamesSnapshot.docs[0].data();
          
          setActiveGame({
            code: gameData.code,
            groupName: groupData.name
          });
          return;
        }
      }
      
      setActiveGame(null);
      
    } catch (error) {
      setActiveGame(null);
    }
  };

  const getTeacherGroups = async (teacherUid: string) => {
    try {
      
      const groupsQuery = query(
        collection(db, 'groups'),
        where('admin', '==', teacherUid),
        where('isActive', '==', true),
        where('isDeleted', '==', false)
      );
      const groupsSnapshot = await getDocs(groupsQuery);
      
      if (groupsSnapshot.empty) {
        setTeacherGroups([]);
        return;
      }
      
      const groups = groupsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Без названия',
          code: data.code || 'N/A',
          description: data.description || 'Описание отсутствует',
          studentsCount: data.students ? data.students.length : 0,
          createdAt: data.createdAt
        };
      });
      
      setTeacherGroups(groups);
      
    } catch (error) {
      setTeacherGroups([]);
    }
  };

  const getStudentHomework = async (studentUid: string) => {
    try {
      
      const groupsQuery = query(
        collection(db, 'groups'),
        where('students', 'array-contains', studentUid)
      );
      const groupsSnapshot = await getDocs(groupsQuery);
      
      if (groupsSnapshot.empty) {
        setStudentHomework([]);
        return;
      }
      
      const homeworkData: Array<{
        id: string;
        quiz_title: string;
        group_name: string;
        deadline: any;
        mode: 'normal' | 'lockdown' | 'tab_tracking';
        time_limit_minutes: number | null;
        description: string;
        status: 'Не начато' | 'Выполнено' | 'Просрочено' | 'Выполнено с опозданием' | 'Нарушение';
        submission?: any;
      }> = [];
      
      for (const groupDoc of groupsSnapshot.docs) {
        const groupData = groupDoc.data();
        const groupId = groupDoc.id;
        
        const homeworkQuery = query(
          collection(db, 'homework'),
          where('group_id', '==', groupId),
          where('is_active', '==', true)
        );
        const homeworkSnapshot = await getDocs(homeworkQuery);
        
        for (const homeworkDoc of homeworkSnapshot.docs) {
          const homeworkData_doc = homeworkDoc.data();
          
          // Check if homework is assigned to specific students
          if (homeworkData_doc.assigned_to_students && Array.isArray(homeworkData_doc.assigned_to_students)) {
            if (!homeworkData_doc.assigned_to_students.includes(studentUid)) {
              continue; // Skip if student is not in the assigned list
            }
          }
          
          let submission = null;
          let status: 'Не начато' | 'Выполнено' | 'Просрочено' | 'Выполнено с опозданием' | 'Нарушение' = 'Не начато';
          
          try {
            const submissionDoc = await getDoc(doc(db, 'homework', homeworkDoc.id, 'submissions', studentUid));
            if (submissionDoc.exists()) {
              submission = submissionDoc.data();
              if (submission.status === 'cheated') {
                status = 'Нарушение';
              } else if (submission.is_late) {
                status = 'Выполнено с опозданием';
              } else {
                status = 'Выполнено';
              }
            } else {
              const deadline = homeworkData_doc.deadline?.toDate ? homeworkData_doc.deadline.toDate() : new Date(homeworkData_doc.deadline);
              if (deadline < new Date()) {
                status = 'Просрочено';
              }
            }
          } catch (error) {
          }
          
          homeworkData.push({
            id: homeworkDoc.id,
            quiz_title: homeworkData_doc.quiz_title || 'Без названия',
            group_name: groupData.name || 'Без названия',
            deadline: homeworkData_doc.deadline,
            mode: homeworkData_doc.mode || 'normal',
            time_limit_minutes: homeworkData_doc.time_limit_minutes,
            description: homeworkData_doc.description || '',
            status,
            submission
          });
        }
      }
      
      homeworkData.sort((a, b) => {
        const deadlineA = a.deadline?.toDate ? a.deadline.toDate() : new Date(a.deadline);
        const deadlineB = b.deadline?.toDate ? b.deadline.toDate() : new Date(b.deadline);
        return deadlineA.getTime() - deadlineB.getTime();
      });
      
      setStudentHomework(homeworkData);
      
    } catch (error) {
      setStudentHomework([]);
    }
  };

  const getLastGameResult = async (studentUid: string) => {
    try {
      const gamesQuery = query(
        collection(db, 'games'),
        where('players', 'array-contains', studentUid),
        where('game_finished', '==', true)
      );
      
      const gamesSnapshot = await getDocs(gamesQuery);
      
      if (gamesSnapshot.empty) {
        setLastGameResult(null);
        return;
      }
      
      // Sort by finished_at to get the most recent
      const games = gamesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          code: data.code,
          finished_at: data.finished_at
        };
      }).sort((a, b) => {
        const dateA = a.finished_at?.toDate ? a.finished_at.toDate() : new Date(a.finished_at || 0);
        const dateB = b.finished_at?.toDate ? b.finished_at.toDate() : new Date(b.finished_at || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      if (games.length > 0) {
        const latestGame = games[0];
        
        try {
          const userResultDoc = await getDoc(
            doc(db, 'games', latestGame.id, 'results', studentUid)
          );
          
          if (userResultDoc.exists()) {
            const resultData = userResultDoc.data();
            setLastGameResult({
              gameId: latestGame.id,
              gameCode: latestGame.code || 'N/A',
              placement: resultData.placement || 0,
              score: resultData.score || 0,
              total_players: resultData.total_players || 0,
              total_questions: resultData.total_questions || 0,
              correct_answers: resultData.correct_answers || 0,
              finished_at: latestGame.finished_at
            });
            return;
          }
        } catch (error) {
        }
      }
      
      setLastGameResult(null);
    } catch (error) {
      setLastGameResult(null);
    }
  };


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setIsAuthenticated(false);
          setIsTeacher(false);
          setLoading(false);
          return;
        }
        
        setIsAuthenticated(true);
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (!userDoc.exists()) {
          setIsAuthenticated(false);
          setIsTeacher(false);
          setLoading(false);
          return;
        }
        
        const userData = userDoc.data();
        setIsTeacher(userData.isTeacher);
        setCurrentUserId(user.uid);
        
        if (!userData.isTeacher) {
          await checkActiveGames(user.uid); 
          await getStudentHomework(user.uid);
          await getLastGameResult(user.uid);
        } else {
          await getTeacherGroups(user.uid);
        }
        
      } catch (error) {
        setIsAuthenticated(false);
        setIsTeacher(false);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const isHomeworkOverdue = (deadline: any): boolean => {
    const deadlineDate = deadline?.toDate ? deadline.toDate() : new Date(deadline);
    return deadlineDate < new Date();
  };

  const formatDeadline = (deadline: any): string => {
    if (!deadline) return 'Неизвестно';
    const deadlineDate = deadline?.toDate ? deadline.toDate() : new Date(deadline);
    return deadlineDate.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'Выполнено':
        return 'bg-green-100 text-green-800';
      case 'Выполнено с опозданием':
        return 'bg-yellow-100 text-yellow-800';
      case 'Просрочено':
        return 'bg-red-100 text-red-800';
      case 'Нарушение':
        return 'bg-red-600 text-white';
      case 'Не начато':
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'normal':
        return <Clock className="h-4 w-4" />;
      case 'tab_tracking':
        return <AlertTriangle className="h-4 w-4" />;
      case 'lockdown':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getModeLabel = (mode: string): string => {
    switch (mode) {
      case 'normal':
        return 'Обычный';
      case 'tab_tracking':
        return 'Отслеживание вкладок';
      case 'lockdown':
        return 'Режим блокировки';
      default:
        return 'Неизвестно';
    }
  };

  const handleStartHomework = (homeworkId: string) => {
    navigate(`/homework-quiz?id=${homeworkId}`);
  };

  const handleViewResults = (homeworkId: string) => {
    navigate(`/homework-results?id=${homeworkId}`);
  };

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
              {isAuthenticated ? `Добро пожаловать, ${isTeacher ? "Учитель" : "Студент"}!` : "QuizIT"}
            </h1>
            <p className="text-gray-600 mt-2">
              {isAuthenticated 
                ? (isTeacher ? "Управляйте своими квизами и создавайте новые" : "Присоединяйтесь к квизам и проверяйте свои знания")
                : "Система для проведения викторин и проверки знаний"}
            </p>
          </div>
          <div className="flex gap-3">
            {!isAuthenticated ? (
              <Button 
                className='cursor-pointer bg-blue-600 hover:bg-blue-700 px-6 py-3 text-lg' 
                onClick={() => navigate('/auth')}
              >
                Войти
              </Button>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
        
        {!isAuthenticated ? (
          <div className="max-w-2xl mx-auto mt-16 text-center">
            <div className="bg-white rounded-lg shadow-lg p-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Добро пожаловать в QuizIT!
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Система для проведения онлайн викторин и проверки знаний
              </p>
              <div className="space-y-4">
                <Button 
                  className='cursor-pointer bg-blue-600 hover:bg-blue-700 px-8 py-4 text-lg' 
                  onClick={() => navigate('/auth')}
                >
                  Войти в систему
                </Button>
                <p className="text-sm text-gray-500 mt-4">
                  Войдите, чтобы начать использовать QuizIT
                </p>
              </div>
            </div>
          </div>
        ) : isTeacher ? (
          <div className="space-y-8">
            {/* Teacher Groups Section */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="bg-blue-100 p-3 rounded-full mr-4">
                    <BookOpen className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Мои классы</h2>
                    <p className="text-gray-600">
                      Управляйте своими классами и группами студентов
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => navigate('/create-group')}
                  className="bg-blue-600 hover:bg-blue-700 px-6 py-3 text-lg cursor-pointer"
                >
                  <Users className="h-5 w-5 mr-2" />
                  Создать класс
                </Button>
              </div>
              
              {teacherGroups.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {teacherGroups.map((group) => (
                    <div key={group.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-gray-900 text-lg">{group.name}</h3>
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                          {group.code}
                        </span>
                      </div>
                      
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                        {group.description}
                      </p>
                      
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center">
                          <UserCheck className="h-4 w-4 mr-1" />
                          {group.studentsCount} студентов
                        </div>
                        {group.createdAt && (
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {group.createdAt.toDate ? 
                              group.createdAt.toDate().toLocaleDateString('ru-RU') : 
                              'Неизвестно'
                            }
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-4 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 cursor-pointer"
                          onClick={() => navigate(`/group-details?id=${group.id}`)}
                        >
                          Подробнее
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">У вас пока нет классов</h3>
                  <p className="text-gray-600 mb-4">
                    Создайте свой первый класс, чтобы начать проводить квизы
                  </p>
                  <Button
                    onClick={() => navigate('/create-group')}
                    className="bg-blue-600 hover:bg-blue-700 cursor-pointer"
                  >
                    <Users className="h-5 w-5 mr-2" />
                    Создать класс
                  </Button>
                </div>
              )}
            </div>
            
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
            
            {/* Last Game Result */}
            {lastGameResult && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-0">
                  <div className="flex items-center">
                    <div className="bg-yellow-100 p-3 rounded-full mr-4 flex-shrink-0">
                      <Trophy className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-gray-900">Последняя игра</h2>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <div className="flex items-center">
                          <span className="text-sm text-gray-600">Код: </span>
                          <span className="text-sm font-mono font-bold text-blue-600 ml-1">{lastGameResult.gameCode}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-sm text-gray-600">Место: </span>
                          <span className="text-sm font-bold text-gray-900 ml-1">
                            {lastGameResult.placement === 1 ? '🥇 1' :
                             lastGameResult.placement === 2 ? '🥈 2' :
                             lastGameResult.placement === 3 ? '🥉 3' :
                             `#${lastGameResult.placement}`}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-sm text-gray-600">Баллы: </span>
                          <span className="text-sm font-bold text-blue-600 ml-1">{lastGameResult.score}/{lastGameResult.total_questions}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-sm text-gray-600">Правильных: </span>
                          <span className="text-sm font-bold text-green-600 ml-1">{lastGameResult.correct_answers}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => navigate(`/student-quiz-details?gameId=${lastGameResult.gameId}&studentId=${currentUserId || ''}`)}
                    variant="outline"
                    className="w-full md:w-auto px-6 py-3 text-lg cursor-pointer"
                  >
                    <TrendingUp className="h-5 w-5 mr-2" />
                    Посмотреть результаты
                  </Button>
                </div>
              </div>
            )}
            
            {/* Student Homework Section */}
            {studentHomework.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center mb-6">
                  <div className="bg-purple-100 p-3 rounded-full mr-4">
                    <FileText className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Мои домашниения</h2>
                    <p className="text-gray-600">
                      Задания, которые нужно выполнить
                    </p>
                  </div>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {studentHomework.map((homework) => (
                    <div key={homework.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 text-lg mb-1">
                            {homework.quiz_title}
                          </h3>
                          <div className="flex items-center text-sm text-gray-500 mb-2">
                            {getModeIcon(homework.mode)}
                            <span className="ml-1">{getModeLabel(homework.mode)}</span>
                            {homework.time_limit_minutes && (
                              <>
                                <Clock className="h-3 w-3 ml-2" />
                                <span className="ml-1">{homework.time_limit_minutes} мин</span>
                              </>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            Группа: {homework.group_name}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(homework.status)}`}>
                          {homework.status}
                        </span>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="h-4 w-4 mr-2" />
                          <span>Дедлайн: {formatDeadline(homework.deadline)}</span>
                        </div>
                        {homework.description && (
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {homework.description}
                          </p>
                        )}
                        {homework.submission && homework.status !== 'Нарушение' && (
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Балл: </span>
                            <span className="text-blue-600 font-bold">{homework.submission.score}</span>
                            <span className="mx-1">/</span>
                            <span>{homework.submission.max_score || homework.submission.total_questions}</span>
                            <span className="ml-2">({homework.submission.percentage.toFixed(1)}%)</span>
                          </div>
                        )}
                        {homework.status === 'Нарушение' && homework.submission && (
                          <div className="bg-red-50 border border-red-200 rounded p-2 text-sm">
                            <div className="flex items-center text-red-800 font-medium mb-1">
                              <AlertTriangle className="h-4 w-4 mr-1" />
                              Обнаружено нарушение
                            </div>
                            <p className="text-red-700 text-xs">
                              {homework.submission.violation_reason || 'Нарушение правил выполнения'}
                            </p>
                            <p className="text-red-700 text-xs mt-1">
                              Результат: 0 баллов
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        {homework.status === 'Выполнено' || homework.status === 'Выполнено с опозданием' || homework.status === 'Нарушение' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 cursor-pointer"
                            onClick={() => handleViewResults(homework.id)}
                          >
                            <TrendingUp className="h-4 w-4 mr-1" />
                            {homework.status === 'Нарушение' ? 'Подробности' : 'Результат'}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="flex-1 bg-blue-600 hover:bg-blue-700 cursor-pointer"
                            onClick={() => handleStartHomework(homework.id)}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            {homework.status === 'Просрочено' ? 'Выполнить' : 'Начать'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Manual Join Option */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-0">
                <div className="flex items-center">
                  <div className="bg-blue-100 p-3 rounded-full mr-4 flex-shrink-0">
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
                  className="w-full md:w-auto px-6 py-3 text-lg cursor-pointer"
                >
                  <Users className="h-5 w-5 mr-2" />
                  Ввести код
                </Button>
              </div>
            </div>
            
            {/* My Results Option */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-0">
                <div className="flex items-center">
                  <div className="bg-purple-100 p-3 rounded-full mr-4 flex-shrink-0">
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
                  className="w-full md:w-auto px-6 py-3 text-lg cursor-pointer"
                >
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Посмотреть
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      <Toaster />
    </div>
  )
}

export default App
