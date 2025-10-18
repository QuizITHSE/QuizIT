import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/CopyButton';
import { QRCodeSVG } from 'qrcode.react';
import { 
  BookOpen, 
  Users, 
  TrendingUp, 
  Calendar, 
  AlertTriangle, 
  ArrowLeft,
  Trophy,
  BarChart3,
  Target,
  Clock,
  FileText,
  Eye,
  Settings,
  Timer
} from 'lucide-react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
} from '@tanstack/react-table';
import type { SortingState } from '@tanstack/react-table';
import type { Homework, HomeworkSubmission, HomeworkMode } from '@/types/homework';

interface StudentStats {
  user_id: string;
  username: string;
  avgScore: number;
  avgPercentage: number;
  gamesCompleted: number;
  totalTabSwitches: number;
  status: 'Завершено' | 'Не начато';
}

interface GroupData {
  id: string;
  name: string;
  code: string;
  description: string;
  students: string[];
  createdAt: any;
}

interface GameResult {
  user_id: string;
  username: string;
  score: number;
  placement: number;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  missed_answers: number;
  tab_switches: number;
  answers: any[];
}

interface ClassStats {
  avgScore: number;
  avgPercentage: number;
  totalGames: number;
  gradeDistribution: {
    excellent: number; // 75-100%
    good: number;      // 50-75%
    average: number;   // 25-50%
    poor: number;      // 0-25%
  };
}

const GroupDetails: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const groupId = searchParams.get('id');
  
  const [loading, setLoading] = useState(true);
  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [classStats, setClassStats] = useState<ClassStats | null>(null);
  const [studentStats, setStudentStats] = useState<StudentStats[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [error, setError] = useState<string | null>(null);
  const [homeworkList, setHomeworkList] = useState<Homework[]>([]);

  const columnHelper = createColumnHelper<StudentStats>();

  const columns = [
    columnHelper.accessor('username', {
      header: 'Имя студента',
      cell: (info) => (
        <div className="font-medium text-gray-900">
          {info.getValue()}
        </div>
      ),
    }),
    columnHelper.accessor('avgScore', {
      header: 'Средний балл',
      cell: (info) => (
        <div className="text-center">
          <span className="text-lg font-bold text-blue-600">
            {info.getValue().toFixed(1)}
          </span>
        </div>
      ),
    }),
    columnHelper.accessor('avgPercentage', {
      header: 'Процент правильных ответов',
      cell: (info) => {
        const percentage = info.getValue();
        let colorClass = 'text-gray-600';
        if (percentage >= 75) colorClass = 'text-green-600';
        else if (percentage >= 50) colorClass = 'text-blue-600';
        else if (percentage >= 25) colorClass = 'text-yellow-600';
        else colorClass = 'text-red-600';
        
        return (
          <div className="text-center">
            <span className={`text-lg font-bold ${colorClass}`}>
              {percentage.toFixed(1)}%
            </span>
          </div>
        );
      },
    }),
    columnHelper.accessor('gamesCompleted', {
      header: 'Завершено игр',
      cell: (info) => (
        <div className="text-center">
          <span className="text-lg font-bold text-gray-700">
            {info.getValue()}
          </span>
        </div>
      ),
    }),
    columnHelper.accessor('totalTabSwitches', {
      header: 'Инциденты переключения вкладок',
      cell: (info) => {
        const switches = info.getValue();
        if (switches === 0) {
          return (
            <div className="text-center">
              <span className="text-green-600 font-medium">0</span>
            </div>
          );
        }
        
        return (
          <div className="flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-orange-500 mr-1" />
            <span className="text-orange-600 font-bold">
              {switches}
            </span>
          </div>
        );
      },
    }),
    columnHelper.accessor('status', {
      header: 'Статус',
      cell: (info) => {
        const status = info.getValue();
        const isCompleted = status === 'Завершено';
        
        return (
          <div className="text-center">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              isCompleted 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {status}
            </span>
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: studentStats,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const calculateClassStats = (allResults: GameResult[]): ClassStats => {
    if (allResults.length === 0) {
      return {
        avgScore: 0,
        avgPercentage: 0,
        totalGames: 0,
        gradeDistribution: { excellent: 0, good: 0, average: 0, poor: 0 }
      };
    }

    const totalScore = allResults.reduce((sum, result) => sum + result.score, 0);
    const avgScore = totalScore / allResults.length;

    const totalPercentage = allResults.reduce((sum, result) => {
      const percentage = (result.correct_answers / result.total_questions) * 100;
      return sum + percentage;
    }, 0);
    const avgPercentage = totalPercentage / allResults.length;

    const gradeDistribution = allResults.reduce((dist, result) => {
      const percentage = (result.correct_answers / result.total_questions) * 100;
      if (percentage >= 75) dist.excellent++;
      else if (percentage >= 50) dist.good++;
      else if (percentage >= 25) dist.average++;
      else dist.poor++;
      return dist;
    }, { excellent: 0, good: 0, average: 0, poor: 0 });

    return {
      avgScore,
      avgPercentage,
      totalGames: new Set(allResults.map(r => r.user_id)).size,
      gradeDistribution
    };
  };

  const calculateStudentStats = (studentId: string, allGameResults: GameResult[]): StudentStats => {
    const studentResults = allGameResults.filter(result => result.user_id === studentId);
    
    if (studentResults.length === 0) {
      return {
        user_id: studentId,
        username: 'Неизвестный студент',
        avgScore: 0,
        avgPercentage: 0,
        gamesCompleted: 0,
        totalTabSwitches: 0,
        status: 'Не начато'
      };
    }

    const avgScore = studentResults.reduce((sum, r) => sum + r.score, 0) / studentResults.length;
    const avgPercentage = studentResults.reduce((sum, r) => {
      return sum + ((r.correct_answers / r.total_questions) * 100);
    }, 0) / studentResults.length;
    const totalTabSwitches = studentResults.reduce((sum, r) => sum + r.tab_switches, 0);

    return {
      user_id: studentId,
      username: studentResults[0].username,
      avgScore,
      avgPercentage,
      gamesCompleted: studentResults.length,
      totalTabSwitches,
      status: 'Завершено'
    };
  };

  const loadHomework = async (groupId: string): Promise<Homework[]> => {
    try {
      const homeworkQuery = query(
        collection(db, 'homework'),
        where('group_id', '==', groupId),
        where('is_active', '==', true)
      );
      const homeworkSnapshot = await getDocs(homeworkQuery);
      
      const homeworkData: Homework[] = [];
      homeworkSnapshot.docs.forEach(doc => {
        const data = doc.data();
        homeworkData.push({
          id: doc.id,
          ...data
        } as Homework);
      });
      
      homeworkData.sort((a, b) => {
        const deadlineA = a.deadline?.toDate ? a.deadline.toDate() : new Date(a.deadline);
        const deadlineB = b.deadline?.toDate ? b.deadline.toDate() : new Date(b.deadline);
        return deadlineA.getTime() - deadlineB.getTime();
      });
      
      return homeworkData;
    } catch (error) {
      return [];
    }
  };

  useEffect(() => {
    if (!groupId) {
      setError('ID группы не найден');
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const groupDoc = await getDoc(doc(db, 'groups', groupId));
        if (!groupDoc.exists()) {
          setError('Группа не найдена');
          return;
        }

        const group = groupDoc.data();
        setGroupData({
          id: groupDoc.id,
          name: group.name || 'Без названия',
          code: group.code || 'N/A',
          description: group.description || 'Описание отсутствует',
          students: group.students || [],
          createdAt: group.createdAt
        });

        const gamesQuery = query(
          collection(db, 'games'),
          where('group_id', '==', groupId),
          where('game_finished', '==', true)
        );
        const gamesSnapshot = await getDocs(gamesQuery);

        if (gamesSnapshot.empty) {
          setClassStats({
            avgScore: 0,
            avgPercentage: 0,
            totalGames: 0,
            gradeDistribution: { excellent: 0, good: 0, average: 0, poor: 0 }
          });
          setStudentStats([]);
          return;
        }

        const allResults: GameResult[] = [];
        const gameIds: string[] = [];

        for (const gameDoc of gamesSnapshot.docs) {
          gameIds.push(gameDoc.id);
          
          const resultsQuery = collection(db, 'games', gameDoc.id, 'results');
          const resultsSnapshot = await getDocs(resultsQuery);
          
          resultsSnapshot.docs.forEach(resultDoc => {
            const data = resultDoc.data();
            allResults.push({
              user_id: data.user_id,
              username: data.username,
              score: data.score,
              placement: data.placement,
              total_questions: data.total_questions,
              correct_answers: data.correct_answers,
              wrong_answers: data.wrong_answers,
              missed_answers: data.missed_answers,
              tab_switches: data.tab_switches || 0,
              answers: data.answers || []
            });
          });
        }

        const classStatsData = calculateClassStats(allResults);
        classStatsData.totalGames = gameIds.length; 
        setClassStats(classStatsData);

        const studentsData: StudentStats[] = [];
        
        for (const studentId of group.students || []) {
          const studentStatsData = calculateStudentStats(studentId, allResults);
          studentsData.push(studentStatsData);
        }

        setStudentStats(studentsData);

        const homeworkData = await loadHomework(groupId);
        setHomeworkList(homeworkData);

      } catch (error) {
        setError('Ошибка при загрузке данных группы');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [groupId]);

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-lg">Загрузка...</div>
      </div>
    );
  }

  if (error || !groupData) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">{error}</div>
          <Button onClick={() => navigate('/')} className="cursor-pointer">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Вернуться на главную
          </Button>
        </div>
      </div>
    );
  }

  const joinUrl = `${window.location.origin}/join?code=${groupData.code}`;

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

  const getModeIcon = (mode: HomeworkMode) => {
    switch (mode) {
      case 'normal':
        return <Settings className="h-4 w-4" />;
      case 'tab_tracking':
        return <Eye className="h-4 w-4" />;
      case 'lockdown':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const getModeLabel = (mode: HomeworkMode): string => {
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

  return (
    <div className="min-h-screen w-full montserrat-600">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Button 
              onClick={() => navigate('/')} 
              variant="outline" 
              className="mr-4 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{groupData.name}</h1>
              <p className="text-gray-600 mt-2">{groupData.description}</p>
            </div>
          </div>
        </div>

        {/* Group Info and QR Code */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Group Info */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <div className="bg-blue-100 p-3 rounded-full mr-4">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Информация о группе</h2>
                <p className="text-gray-600">Основные данные класса</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Студентов в группе:</span>
                <span className="font-semibold">{groupData.students.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Дата создания:</span>
                <span className="font-semibold">
                  {groupData.createdAt?.toDate ? 
                    groupData.createdAt.toDate().toLocaleDateString('ru-RU') : 
                    'Неизвестно'
                  }
                </span>
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <div className="bg-green-100 p-3 rounded-full mr-4">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Присоединиться к группе</h2>
                <p className="text-gray-600">Поделитесь кодом или QR-кодом</p>
              </div>
            </div>
            
            <div className="text-center">
              <div className="mb-4">
                <QRCodeSVG value={joinUrl} width={200} height={200} />
              </div>
              <div className="mb-4">
                <span className="text-sm text-gray-500">Код группы: </span>
                <span className="font-mono font-bold text-blue-600 text-lg">{groupData.code}</span>
              </div>
              <CopyButton text={groupData.code} className="w-full">
                Скопировать код
              </CopyButton>
            </div>
          </div>
        </div>

        {/* Homework Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center mb-6">
            <div className="bg-purple-100 p-3 rounded-full mr-4">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Домашние задания</h2>
              <p className="text-gray-600">Активные задания для этой группы</p>
            </div>
          </div>
          
          {homeworkList.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {homeworkList.map((homework) => (
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
                            <Timer className="h-3 w-3 ml-2" />
                            <span className="ml-1">{homework.time_limit_minutes} мин</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      isHomeworkOverdue(homework.deadline)
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {isHomeworkOverdue(homework.deadline) ? 'Просрочено' : 'Активно'}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span>Дедлайн: {formatDeadline(homework.deadline)}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="h-4 w-4 mr-2" />
                      <span>{groupData.students.length} студентов</span>
                    </div>
                    {homework.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {homework.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 cursor-pointer"
                      onClick={() => navigate(`/homework-details?id=${homework.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Подробнее
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Нет домашних заданий</h3>
              <p className="text-gray-600">
                Для этой группы пока не назначены домашние задания
              </p>
            </div>
          )}
        </div>

        {/* Class Statistics */}
        {classStats && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="flex items-center mb-6">
              <div className="bg-purple-100 p-3 rounded-full mr-4">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Статистика класса</h2>
                <p className="text-gray-600">Общие показатели по всем играм</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="bg-blue-100 p-4 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                  <Trophy className="h-8 w-8 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{classStats.avgScore.toFixed(1)}</div>
                <div className="text-sm text-gray-600">Средний балл</div>
              </div>
              
              <div className="text-center">
                <div className="bg-green-100 p-4 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                  <Target className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{classStats.avgPercentage.toFixed(1)}%</div>
                <div className="text-sm text-gray-600">Процент правильных ответов</div>
              </div>
              
              <div className="text-center">
                <div className="bg-purple-100 p-4 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                  <Clock className="h-8 w-8 text-purple-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{classStats.totalGames}</div>
                <div className="text-sm text-gray-600">Завершено игр</div>
              </div>
              
              <div className="text-center">
                <div className="bg-orange-100 p-4 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                  <TrendingUp className="h-8 w-8 text-orange-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {classStats.gradeDistribution.excellent + classStats.gradeDistribution.good}
                </div>
                <div className="text-sm text-gray-600">Успешных результатов (≥50%)</div>
              </div>
            </div>
          </div>
        )}

        {/* Students Table */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="bg-gray-100 p-3 rounded-full mr-4">
                <Users className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Результаты студентов</h2>
                <p className="text-gray-600">Индивидуальная статистика по каждому студенту</p>
              </div>
            </div>
          </div>
          
          {studentStats.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <div className="flex items-center">
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                            {header.column.getIsSorted() === 'asc' && ' ↑'}
                            {header.column.getIsSorted() === 'desc' && ' ↓'}
                          </div>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Нет результатов</h3>
              <p className="text-gray-600">
                В этой группе еще не проводились игры или нет завершенных игр
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupDetails;
