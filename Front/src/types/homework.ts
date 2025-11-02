// Интерфейсы для системы домашних заданий

export interface Homework {
  id: string;                    // Автогенерируемый ID документа
  quiz_id: string;               // ID квиза из коллекции 'quizes'
  quiz_title: string;            // Название квиза (денормализация для быстрого доступа)
  group_id: string;              // ID группы, которой назначено ДЗ
  group_name: string;            // Название группы (денормализация)
  teacher_id: string;            // UID учителя, создавшего ДЗ
  created_at: any;               // Дата создания ДЗ
  deadline: any;                 // Дедлайн выполнения
  total_questions: number;       // Количество вопросов в квизе
  is_active: boolean;            // Активно ли задание (можно деактивировать)
  description?: string;          // Опциональное описание задания
  
  // Режимы выполнения и время
  mode: 'normal' | 'lockdown' | 'tab_tracking';  // Режим выполнения
  time_limit_minutes: number | null;  // Лимит времени в минутах (null = без ограничения)
  
  // Назначение конкретным студентам (опционально)
  assigned_to_students?: string[];   // Массив UID студентов, если задание назначено не всей группе
}

export interface HomeworkSubmission {
  student_id: string;            // UID студента
  student_name: string;          // Имя студента
  submitted_at: any;             // Время выполнения
  score: number;                 // Набранные баллы
  max_score?: number;            // Максимальное количество баллов
  total_questions: number;       // Всего вопросов
  correct_answers: number;       // Правильных ответов
  wrong_answers: number;         // Неправильных ответов
  missed_answers: number;        // Пропущенных ответов
  percentage: number;            // Процент правильных ответов
  is_late: boolean;              // Сдано после дедлайна
  tab_switches: number;          // Количество переключений вкладок
  answers: Array<any>;           // Детальные ответы
  status: 'completed' | 'in_progress' | 'cheated'; // Статус выполнения
  
  // Отслеживание времени
  time_started: any;             // Время начала выполнения
  time_completed: any;           // Время завершения
  time_taken_seconds: number;    // Время выполнения в секундах
  time_limit_seconds: number | null;    // Установленный лимит времени в секундах
  
  // Информация о нарушениях
  violation_reason?: string;     // Причина нарушения (если status = 'cheated')
}

export interface Group {
  id: string;
  name: string;
  code: string;
  description: string;
  students: string[];
  createdAt: any;
}

// Статусы домашнего задания для студентов
export type HomeworkStatus = 'Не начато' | 'Выполнено' | 'Просрочено' | 'Выполнено с опозданием' | 'В процессе';

// Режимы выполнения домашних заданий
export type HomeworkMode = 'normal' | 'lockdown' | 'tab_tracking';
