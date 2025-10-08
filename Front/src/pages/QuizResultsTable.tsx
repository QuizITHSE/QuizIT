import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Users, BarChart3, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
} from '@tanstack/react-table';
import type { SortingState } from '@tanstack/react-table';

interface QuizResult {
  placement: number;
  score: number;
  total_players: number;
  total_questions: number;
  user_id: string;
  username: string;
}

const QuizResultsTable: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  const columnHelper = createColumnHelper<QuizResult>();

  const columns = [
    columnHelper.accessor('placement', {
      header: 'Место',
      cell: (info) => {
        const placement = info.getValue();
        let icon = '';
        let bgColor = '';
        
        if (placement === 1) {
          icon = '🥇';
          bgColor = 'bg-yellow-100 text-yellow-800';
        } else if (placement === 2) {
          icon = '🥈';
          bgColor = 'bg-gray-100 text-gray-800';
        } else if (placement === 3) {
          icon = '🥉';
          bgColor = 'bg-orange-100 text-orange-800';
        } else {
          icon = '🏅';
          bgColor = 'bg-blue-100 text-blue-800';
        }
        
        return (
          <div className={`flex items-center justify-center px-3 py-1 rounded-full text-sm font-semibold ${bgColor}`}>
            <span className="mr-1">{icon}</span>
            {placement}
          </div>
        );
      },
    }),
    columnHelper.accessor('username', {
      header: 'Имя участника',
      cell: (info) => (
        <div className="font-medium text-gray-900">
          {info.getValue()}
        </div>
      ),
    }),
    columnHelper.accessor('score', {
      header: 'Очки',
      cell: (info) => (
        <div className="text-center">
          <span className="text-lg font-bold text-blue-600">
            {info.getValue()}
          </span>
        </div>
      ),
    }),
    columnHelper.accessor('total_questions', {
      header: 'Всего вопросов',
      cell: (info) => (
        <div className="text-center text-gray-600">
          {info.getValue()}
        </div>
      ),
    }),
    columnHelper.display({
      id: 'percentage',
      header: 'Процент',
      cell: (info) => {
        const score = info.row.original.score;
        const totalQuestions = info.row.original.total_questions;
        const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
        
        return (
          <div className="text-center">
            <span className={`font-semibold ${
              percentage >= 80 ? 'text-green-600' :
              percentage >= 60 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {percentage}%
            </span>
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: results,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const exportToCSV = () => {
    if (results.length === 0) {
      alert('Нет данных для экспорта');
      return;
    }

    const csvData = results.map(result => ({
      'Место': result.placement,
      'Имя участника': result.username,
      'Очки': result.score,
      'Всего вопросов': result.total_questions,
      'Процент': Math.round((result.score / result.total_questions) * 100),
      'Всего участников': result.total_players
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `quiz_results_${gameId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    if (results.length === 0) {
      alert('Нет данных для экспорта');
      return;
    }

    const excelData = results.map(result => ({
      'Место': result.placement,
      'Имя участника': result.username,
      'Очки': result.score,
      'Всего вопросов': result.total_questions,
      'Процент': Math.round((result.score / result.total_questions) * 100),
      'Всего участников': result.total_players
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Результаты викторины');
    
    XLSX.writeFile(workbook, `quiz_results_${gameId}.xlsx`);
  };

  useEffect(() => {
    const fetchResults = async () => {
      if (!gameId) {
        setError('ID игры не найден');
        setLoading(false);
        return;
      }

      try {
        console.log('🔍 Загружаем результаты для игры:', gameId);
        
        // Получаем результаты из подколлекции results для конкретной игры
        const resultsQuery = query(
          collection(db, 'games', gameId, 'results')
        );
        
        const resultsSnapshot = await getDocs(resultsQuery);
        console.log('📊 Результаты запроса:', {
          empty: resultsSnapshot.empty,
          size: resultsSnapshot.size,
          docs: resultsSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }))
        });
        
        if (resultsSnapshot.empty) {
          console.log('⚠️ Результаты не найдены для игры:', gameId);
          setError('Результаты для этой игры не найдены');
          setLoading(false);
          return;
        }
        
        const resultsData: QuizResult[] = [];
        resultsSnapshot.forEach((doc) => {
          const data = doc.data();
          resultsData.push({
            placement: data.placement || 0,
            score: data.score || 0,
            total_players: data.total_players || 0,
            total_questions: data.total_questions || 0,
            user_id: data.user_id || doc.id,
            username: data.username || 'Неизвестный участник',
          });
        });
        
        // Сортируем по месту (placement)
        resultsData.sort((a, b) => a.placement - b.placement);
        
        console.log('✅ Загружены результаты:', resultsData);
        setResults(resultsData);
      } catch (error) {
        console.error('❌ Ошибка при загрузке результатов:', error);
        setError('Ошибка при загрузке результатов');
      } finally {
        setLoading(false);
      }
    };

    // Проверяем аутентификацию пользователя
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/auth');
        return;
      }
      
      // Проверяем, является ли пользователь учителем
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (!userDoc.exists()) {
          navigate('/auth');
          return;
        }
        
        const userData = userDoc.data();
        
        if (!userData.isTeacher) {
          alert('Доступ запрещен. Только учителя могут просматривать результаты.');
          navigate('/');
          return;
        }
        
        // Загружаем результаты после проверки прав
        await fetchResults();
      } catch (error) {
        console.error('Ошибка при проверке роли пользователя:', error);
        navigate('/auth');
      }
    });

    return () => unsubscribe();
  }, [gameId, navigate]);

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

  if (error) {
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

  if (results.length === 0) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <Trophy className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <div className="text-lg text-gray-600 mb-4">Результаты не найдены</div>
          <Button onClick={() => navigate('/')} className="cursor-pointer">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Вернуться на главную
          </Button>
        </div>
      </div>
    );
  }

  const totalPlayers = results.length > 0 ? results[0].total_players : 0;
  const totalQuestions = results.length > 0 ? results[0].total_questions : 0;
  const averageScore = results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0;

  return (
    <div className="min-h-screen w-full montserrat-600 bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Trophy className="h-8 w-8 text-yellow-500 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Результаты игры #{gameId}</h1>
                <p className="text-gray-600">Детальная таблица результатов участников</p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Участников</p>
                <p className="text-2xl font-bold text-gray-900">{totalPlayers}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Всего вопросов</p>
                <p className="text-2xl font-bold text-gray-900">{totalQuestions}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Trophy className="h-8 w-8 text-yellow-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Средний балл</p>
                <p className="text-2xl font-bold text-gray-900">{averageScore}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Таблица результатов</h2>
            <div className="flex gap-2">
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
            </div>
          </div>
          
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
        </div>
      </div>
    </div>
  );
};

export default QuizResultsTable;
