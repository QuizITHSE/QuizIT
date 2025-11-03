import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Calendar, Clock, Users, Settings, BookOpen } from 'lucide-react';
import type { Homework, Group, HomeworkMode } from '@/types/homework';
import { toast } from 'sonner';

interface AssignHomeworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizId: string;
  quizTitle: string;
  totalQuestions: number;
}

const AssignHomeworkModal: React.FC<AssignHomeworkModalProps> = ({
  isOpen,
  onClose,
  quizId,
  quizTitle,
  totalQuestions
}) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [deadline, setDeadline] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [mode, setMode] = useState<HomeworkMode>('normal');
  const [hasTimeLimit, setHasTimeLimit] = useState<boolean>(false);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(30);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Загружаем группы учителя
  useEffect(() => {
    const loadGroups = async () => {
      if (!auth.currentUser) return;
      
      try {
        const groupsQuery = query(
          collection(db, 'groups'),
          where('admin', '==', auth.currentUser.uid),
          where('isActive', '==', true),
          where('isDeleted', '==', false)
        );
        const groupsSnapshot = await getDocs(groupsQuery);
        
        const groupsData: Group[] = [];
        groupsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          groupsData.push({
            id: doc.id,
            name: data.name || 'Без названия',
            code: data.code || 'N/A',
            description: data.description || '',
            students: data.students || [],
            createdAt: data.createdAt
          });
        });
        
        setGroups(groupsData);
      } catch (error) {
        setError('Ошибка при загрузке групп');
      }
    };

    if (isOpen) {
      loadGroups();
    }
  }, [isOpen]);

  const validateForm = (): boolean => {
    if (!selectedGroupId) {
      setError('Выберите группу');
      return false;
    }
    
    if (!deadline) {
      setError('Установите дедлайн');
      return false;
    }
    
    const deadlineDate = new Date(deadline);
    const now = new Date();
    
    if (deadlineDate <= now) {
      setError('Дедлайн должен быть в будущем');
      return false;
    }
    
    if (hasTimeLimit && timeLimitMinutes <= 0) {
      setError('Время выполнения должно быть больше 0 минут');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!auth.currentUser || !validateForm()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const selectedGroup = groups.find(g => g.id === selectedGroupId);
      if (!selectedGroup) {
        setError('Выбранная группа не найдена');
        return;
      }
      
      const homeworkData: Omit<Homework, 'id'> = {
        quiz_id: quizId,
        quiz_title: quizTitle,
        group_id: selectedGroupId,
        group_name: selectedGroup.name,
        teacher_id: auth.currentUser.uid,
        created_at: new Date(),
        deadline: new Date(deadline),
        total_questions: totalQuestions,
        is_active: true,
        description: description.trim() || "",
        mode: mode,
        time_limit_minutes: hasTimeLimit ? timeLimitMinutes : null
      };
      
      await addDoc(collection(db, 'homework'), homeworkData);
      
      // Показываем toast уведомление
      toast.success('Домашнее задание успешно назначено!', {
        description: `Квиз "${quizTitle}" назначен группе "${selectedGroup.name}"`,
      });
      
      // Сбрасываем форму
      setSelectedGroupId('');
      setDeadline('');
      setDescription('');
      setMode('normal');
      setHasTimeLimit(false);
      setTimeLimitMinutes(30);
      
      onClose();
      
    } catch (error) {
      setError('Ошибка при создании домашнего задания');
    } finally {
      setLoading(false);
    }
  };

  const getModeDescription = (mode: HomeworkMode): string => {
    switch (mode) {
      case 'normal':
        return 'Обычный режим - студенты могут переключаться между вкладками';
      case 'tab_tracking':
        return 'Отслеживание вкладок - фиксируются переключения между вкладками';
      case 'lockdown':
        return 'Режим блокировки - переключение вкладок блокирует выполнение';
      default:
        return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="bg-blue-100 p-3 rounded-full mr-4">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Задать домашнее задание</h2>
                <p className="text-gray-600 text-sm">Назначить квиз "{quizTitle}" как домашнее задание</p>
              </div>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              className="h-8 w-8 p-0 cursor-pointer"
            >
              ×
            </Button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            {/* Выбор группы */}
            <div>
              <Label htmlFor="group-select" className="flex items-center mb-2">
                <Users className="h-4 w-4 mr-2" />
                Группа
              </Label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите группу" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.students.length} студентов)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Дедлайн */}
            <div>
              <Label htmlFor="deadline" className="flex items-center mb-2">
                <Calendar className="h-4 w-4 mr-2" />
                Дедлайн
              </Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>

            {/* Описание */}
            <div>
              <Label htmlFor="description" className="mb-2">
                Описание задания (необязательно)
              </Label>
              <textarea
                id="description"
                value={description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                placeholder="Добавьте дополнительную информацию о задании..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Режим выполнения */}
            <div>
              <Label className="flex items-center mb-2">
                <Settings className="h-4 w-4 mr-2" />
                Режим выполнения
              </Label>
              <Select value={mode} onValueChange={(value: HomeworkMode) => setMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Обычный режим</SelectItem>
                  <SelectItem value="tab_tracking">Отслеживание вкладок</SelectItem>
                  <SelectItem value="lockdown">Режим блокировки</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500 mt-1">
                {getModeDescription(mode)}
              </p>
            </div>

            {/* Лимит времени */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Лимит времени
                </Label>
                <Switch
                  checked={hasTimeLimit}
                  onCheckedChange={setHasTimeLimit}
                />
              </div>
              
              {hasTimeLimit && (
                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    min="1"
                    max="300"
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(parseInt(e.target.value) || 30)}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-600">минут</span>
                </div>
              )}
              
              {!hasTimeLimit && (
                <p className="text-sm text-gray-500">
                  Без ограничения времени
                </p>
              )}
            </div>

            {/* Информация о квизе */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Информация о квизе</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>Название:</strong> {quizTitle}</p>
                <p><strong>Вопросов:</strong> {totalQuestions}</p>
              </div>
            </div>
          </div>

          {/* Кнопки */}
          <div className="flex justify-end space-x-3 mt-8">
            <Button
              onClick={onClose}
              variant="outline"
              className="cursor-pointer"
              disabled={loading}
            >
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-blue-600 hover:bg-blue-700 cursor-pointer"
              disabled={loading}
            >
              {loading ? 'Создание...' : 'Назначить задание'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignHomeworkModal;
