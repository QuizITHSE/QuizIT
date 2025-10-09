import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy, getDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContents, TabsContent } from '@/components/animate-ui/components/tabs';
import { Trophy, Users, Calendar, Clock, BarChart3, Eye, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface Game {
  id: string;
  host: string;
  players: string[];
  group_id: string;
  active: boolean;
  game_finished: boolean;
  code: string;
  finished_at?: any;
  final_results?: LeaderboardEntry[];
  type?: {
    mode?: 'normal' | 'lockdown' | 'tab_tracking';
  };
  game_mode?: 'normal' | 'lockdown' | 'tab_tracking';
}

interface LeaderboardEntry {
  username: string;
  score: number;
  user_id: string;
  tab_switches?: number;
}

const QuizResults: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('recent');
  const navigate = useNavigate();

  useEffect(() => {
    console.log('🚀 QuizResults component mounted, setting up auth listener...');
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        console.log('👤 No authenticated user found');
        setLoading(false);
        return;
      }
      
      try {
        console.log('🔍 Starting QuizResults query process...');
        console.log('👤 Current user UID:', user.uid);
        
        // Get user data directly by UID
        console.log('📋 Getting user document by UID:', user.uid);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        console.log('📊 User document exists:', userDoc.exists());
        
        if (!userDoc.exists()) {
          console.error('❌ User document not found for UID:', user.uid);
          setLoading(false);
          return;
        }
        
        const userData = userDoc.data();
        console.log('👤 User data:', userData);
        
        // Now fetch all finished games for the current user as host using the UID directly
        console.log('🎮 Querying games collection for host:', user.uid);
        const q = query(
          collection(db, 'games'),
          where('host', '==', user.uid),
          where('game_finished', '==', true),
          orderBy('finished_at', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        console.log('🎯 Games query results:', {
          empty: querySnapshot.empty,
          size: querySnapshot.size,
          docs: querySnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }))
        });
        
        const gamesData: Game[] = [];
        
        querySnapshot.forEach((doc) => {
          const gameData = {
            id: doc.id,
            ...doc.data()
          } as Game;
          console.log('📝 Processing game:', gameData);
          gamesData.push(gameData);
        });
        
        console.log('🎉 Final games data:', gamesData);
        setGames(gamesData);
      } catch (error) {
        console.error('❌ Error fetching games:', error);
        console.log('🔄 Trying fallback query without orderBy...');
        // Try without orderBy if index is not set up
        try {
          // Get user data directly by UID (fallback)
          console.log('📋 Fallback: Getting user document by UID:', user.uid);
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          
          console.log('📊 Fallback: User document exists:', userDoc.exists());
          
          if (!userDoc.exists()) {
            console.error('❌ Fallback: User document not found for UID:', user.uid);
            setLoading(false);
            return;
          }
          
          const userData = userDoc.data();
          console.log('👤 Fallback: User data:', userData);
          
          console.log('🎮 Fallback: Querying games collection for host:', user.uid);
          const q = query(
            collection(db, 'games'),
            where('host', '==', user.uid),
            where('game_finished', '==', true)
          );
          
          const querySnapshot = await getDocs(q);
          console.log('🎯 Fallback games query results:', {
            empty: querySnapshot.empty,
            size: querySnapshot.size,
            docs: querySnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }))
          });
          
          const gamesData: Game[] = [];
          
          querySnapshot.forEach((doc) => {
            const gameData = {
              id: doc.id,
              ...doc.data()
            } as Game;
            console.log('📝 Fallback: Processing game:', gameData);
            gamesData.push(gameData);
          });
          
          // Sort locally by finished_at
          console.log('🔄 Sorting games locally by finished_at...');
          gamesData.sort((a, b) => {
            const dateA = a.finished_at?.toDate ? a.finished_at.toDate() : new Date(a.finished_at);
            const dateB = b.finished_at?.toDate ? b.finished_at.toDate() : new Date(b.finished_at);
            return dateB.getTime() - dateA.getTime();
          });
          
          console.log('🎉 Fallback: Final games data:', gamesData);
          setGames(gamesData);
        } catch (fallbackError) {
          console.error('❌ Error fetching games (fallback):', fallbackError);
        }
      } finally {
        console.log('🏁 QuizResults query process completed');
        setLoading(false);
      }
    });

    return () => {
      console.log('🧹 QuizResults component unmounting, cleaning up auth listener...');
      unsubscribe();
    };
  }, []);

  const formatDate = (date: any) => {
    if (!date) return 'Unknown date';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTopPlayer = (game: Game) => {
    if (!game.final_results || game.final_results.length === 0) return null;
    return game.final_results.reduce((top, current) => 
      current.score > top.score ? current : top
    );
  };

  const getTotalPlayers = (game: Game) => {
    return game.final_results?.length || game.players?.length || 0;
  };

  const getTotalQuestions = (game: Game) => {
    // This would need to be fetched from the quiz data
    // For now, we'll use a placeholder
    return 'N/A';
  };

  const getTotalTabSwitches = (game: Game) => {
    if (!game.final_results) return 0;
    return game.final_results.reduce((total, player) => total + (player.tab_switches || 0), 0);
  };

  const hasTabTracking = (game: Game) => {
    const mode = game.game_mode || game.type?.mode;
    return mode === 'tab_tracking' || mode === 'lockdown';
  };

  const getGameModeLabel = (game: Game) => {
    const mode = game.game_mode || game.type?.mode || 'normal';
    switch (mode) {
      case 'lockdown':
        return { label: '🔒 Режим блокировки', color: 'text-red-600' };
      case 'tab_tracking':
        return { label: '👁️ Отслеживание вкладок', color: 'text-yellow-600' };
      default:
        return { label: '📝 Обычный режим', color: 'text-gray-600' };
    }
  };

  const handleViewDetailedResults = (gameId: string) => {
    navigate(`/results/${gameId}`);
  };

  const recentGames = games.slice(0, 5);
  const allGames = games;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="text-center p-8">
        <Trophy className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Нет завершенных игр</h3>
        <p className="text-gray-500">Создайте и проведите квиз, чтобы увидеть результаты здесь.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Результаты игр</h2>
          <p className="text-gray-600 mt-1">Просмотрите результаты ваших завершенных квизов</p>
        </div>
        <div className="text-sm text-gray-500">
          Всего игр: {games.length}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="recent">Недавние</TabsTrigger>
          <TabsTrigger value="all">Все игры</TabsTrigger>
        </TabsList>

        <TabsContents className="mt-6">
          <TabsContent value="recent">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recentGames.map((game) => {
                const topPlayer = getTopPlayer(game);
                const totalTabSwitches = getTotalTabSwitches(game);
                const gameMode = getGameModeLabel(game);
                return (
                  <Card key={game.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Игра #{game.code}</CardTitle>
                        <Trophy className="h-5 w-5 text-yellow-500" />
                      </div>
                      <CardDescription>
                        Завершена {formatDate(game.finished_at)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center text-gray-600">
                          <Users className="h-4 w-4 mr-2" />
                          <span>{getTotalPlayers(game)} игроков</span>
                        </div>
                        <div className={`text-xs font-medium ${gameMode.color}`}>
                          {gameMode.label}
                        </div>
                      </div>
                      
                      {topPlayer && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">Лучший результат</p>
                              <p className="text-xs text-gray-600">{topPlayer.username}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-blue-600">{topPlayer.score}</p>
                              <p className="text-xs text-gray-500">очков</p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {hasTabTracking(game) && totalTabSwitches > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                          <div className="flex items-center text-xs text-yellow-800">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            <span className="font-medium">
                              {totalTabSwitches} переключени{totalTabSwitches === 1 ? 'е' : totalTabSwitches < 5 ? 'я' : 'й'} вкладок
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center text-gray-600">
                          <BarChart3 className="h-4 w-4 mr-1" />
                          <span>Результаты</span>
                        </div>
                        <div className="text-gray-500">
                          {game.final_results?.length || 0} участников
                        </div>
                      </div>
                      
                      <Button
                        onClick={() => handleViewDetailedResults(game.id)}
                        className="w-full bg-blue-600 hover:bg-blue-700 cursor-pointer"
                        size="sm"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Просмотреть результаты
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="all">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {allGames.map((game) => {
                const topPlayer = getTopPlayer(game);
                const totalTabSwitches = getTotalTabSwitches(game);
                const gameMode = getGameModeLabel(game);
                return (
                  <Card key={game.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Игра #{game.code}</CardTitle>
                        <Trophy className="h-5 w-5 text-yellow-500" />
                      </div>
                      <CardDescription>
                        Завершена {formatDate(game.finished_at)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center text-gray-600">
                          <Users className="h-4 w-4 mr-2" />
                          <span>{getTotalPlayers(game)} игроков</span>
                        </div>
                        <div className={`text-xs font-medium ${gameMode.color}`}>
                          {gameMode.label}
                        </div>
                      </div>
                      
                      {topPlayer && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">Лучший результат</p>
                              <p className="text-xs text-gray-600">{topPlayer.username}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-blue-600">{topPlayer.score}</p>
                              <p className="text-xs text-gray-500">очков</p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {hasTabTracking(game) && totalTabSwitches > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                          <div className="flex items-center text-xs text-yellow-800">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            <span className="font-medium">
                              {totalTabSwitches} переключени{totalTabSwitches === 1 ? 'е' : totalTabSwitches < 5 ? 'я' : 'й'} вкладок
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center text-gray-600">
                          <BarChart3 className="h-4 w-4 mr-1" />
                          <span>Результаты</span>
                        </div>
                        <div className="text-gray-500">
                          {game.final_results?.length || 0} участников
                        </div>
                      </div>
                      
                      <Button
                        onClick={() => handleViewDetailedResults(game.id)}
                        className="w-full bg-blue-600 hover:bg-blue-700 cursor-pointer"
                        size="sm"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Просмотреть результаты
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </TabsContents>
      </Tabs>
    </div>
  );
};

export default QuizResults;

