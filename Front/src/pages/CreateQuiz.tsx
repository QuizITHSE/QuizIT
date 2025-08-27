import { addDoc, collection, updateDoc, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
//import { Spinner } from '@/components/ui/spinner';
import { GraduationCap, Check,  Circle, Trash2 } from 'lucide-react'
import { produce } from "immer";
import { auth, db } from '@/lib/firebase';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"
import { Label } from '@/components/ui/label';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Компонент для перетаскиваемого элемента вопроса
const SortableQuestionItem = ({ question, index, isActive, onClick, onDelete, canDelete }: { 
    question: any, 
    index: number, 
    isActive: boolean, 
    onClick: () => void,
    onDelete: () => void,
    canDelete: boolean
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ 
        id: index,
        transition: {
            duration: 150, // Более быстрые переходы
            easing: 'cubic-bezier(0.25, 1, 0.5, 1)', // Плавная кривая
        },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.8 : 1,
        zIndex: isDragging ? 999 : 'auto',
    };

    return (
        <li
            ref={setNodeRef}
            style={style}
            className={`group py-2 px-3 rounded-lg mb-2 cursor-grab active:cursor-grabbing transition-all duration-150 ease-out ${
                isActive ? 'bg-gray-200 font-bold' : 'hover:bg-gray-100'
            } ${isDragging ? 'shadow-xl scale-[1.02] rotate-1' : ''}`}
        >
            <div className="flex items-center justify-between">
                <div 
                    {...attributes}
                    {...listeners}
                    className="flex-1 cursor-pointer"
                    onClick={onClick}
                >
                    <div className="text-xs text-gray-500 mb-1 font-medium">Вопрос {index + 1}</div>
                    <span className="flex-1">
                        {question.question ? question.question : `Вопрос ${index + 1}`}
                    </span>
                </div>
                {canDelete && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Удалить вопрос"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>
        </li>
    );
};

const CreateQuiz = () => {

    const [quiz, setQuiz] = useState([
        {
            id: "",
            question: "",
            options: ["", "", "", ""],
            correct: [] as number[],
            type: "single",
            points: "regular",
            timeLimit: 60,
        }
    ])

    const [quizDocId, setQuizDocId] = useState("")
    
    const [savingText, setSavingText] = useState("Сохранить")



    const [index, setIndex] = useState(0)

    const [searchParams] = useSearchParams();

    useEffect(() => {
        const id = searchParams.get('id');
        if (id) {
            setQuizDocId(id);
            console.log('Quiz ID:', id);
            
            // Получаем существующую викторину из Firestore
            const fetchQuiz = async () => {
                try {
                    const quizDoc = await getDoc(doc(db, "quizes", id));
                    if (quizDoc.exists()) {
                        const quizData = quizDoc.data();
                        console.log('Fetched quiz:', quizData);
                        
                        // Если есть вопросы, загружаем их из коллекции "questions"
                        if (quizData.questions && quizData.questions.length > 0) {
                            const questionIds = quizData.questions;
                            const loadedQuestions = [];
                            
                            // Загружаем каждый вопрос по его id
                            for (const questionId of questionIds) {
                                try {
                                    const questionDoc = await getDoc(doc(db, "questions", questionId));
                                    if (questionDoc.exists()) {
                                        const questionData = questionDoc.data();
                                        loadedQuestions.push({
                                            id: questionId,
                                            question: questionData.question || "",
                                            options: questionData.options || ["", "", "", ""],
                                            correct: questionData.correct || [],
                                            type: questionData.type || "single",
                                            points: questionData.points || "regular",
                                            timeLimit: questionData.timeLimit || 60,
                                        });
                                    }
                                } catch (error) {
                                    console.error(`Error loading question ${questionId}:`, error);
                                }
                            }
                            
                            // Обновляем состояние с загруженными вопросами
                            if (loadedQuestions.length > 0) {
                                setQuiz(loadedQuestions);
                                console.log('Loaded questions:', loadedQuestions);
                            }
                        }
                    } else {
                        console.log('Quiz not found');
                    }
                } catch (error) {
                    console.error('Error fetching quiz:', error);
                }
            };
            
            fetchQuiz();
        }
        
    }, [searchParams]);

    useEffect(() => {
        console.log(quiz)
    }, [quiz])

    const updateQuestionText = (newText: string) => {
        if (!quiz[index]) return;
        
        setQuiz((prev) =>
            produce(prev, (draft) => {
                draft[index].question = newText;
            })
        );
    };

    const updateOptionText = (newText: string, optionIndex: number) => {
        if (!quiz[index]) return;
        
        setQuiz((prev) =>
            produce(prev, (draft) => {
                draft[index].options[optionIndex] = newText;
            })
        );
    };

    const saveQuiz = async () => {
        setSavingText("Сохраняется...")
        console.log("Saving quiz...");
        
        try {
            const questionIds: string[] = [];
            
            // Обрабатываем каждый вопрос
            for (let i = 0; i < quiz.length; i++) {
                const question = quiz[i];
                
                if (!question.id || question.id === "" || question.id === i.toString()) {
                    // Создаем новый документ для вопроса без настоящего id
                    const newQuestion = {
                        question: question.question,
                        options: question.options,
                        correct: question.correct,
                        type: question.type,
                        points: question.points,
                        timeLimit: question.timeLimit,
                    };
                    
                    const docRef = await addDoc(collection(db, "questions"), newQuestion);
                    questionIds.push(docRef.id);
                    
                    // Обновляем локальный id
                    setQuiz((prev) =>
                        produce(prev, (draft) => {
                            draft[i].id = docRef.id;
                        })
                    );
                } else {
                    // Обновляем существующий вопрос с настоящим id
                    await updateDoc(doc(db, "questions", question.id), {
                        question: question.question,
                        options: question.options,
                        correct: question.correct,
                        type: question.type,
                        points: question.points,
                        timeLimit: question.timeLimit,
                    });
                    questionIds.push(question.id);
                }
            }
            
            // Обновляем документ викторины с массивом id вопросов
            if (quizDocId) {
                await updateDoc(doc(db, "quizes", quizDocId), {
                    questions: questionIds,
                    updatedAt: new Date(),
                });
            }
            
            console.log("Quiz saved successfully!");
            console.log("Question IDs:", questionIds);
            
        } catch (error) {
            console.error("Error saving quiz:", error);
        } finally {
            setSavingText("Сохранить")
        }
    };


    const toggleCorrectAnswer = (optionIndex: number) => {
        if (!quiz[index]) return;
        
        setQuiz((prev) =>
            produce(prev, (draft) => {
                const currentQuestion = draft[index];
                const correctIndex = currentQuestion.correct.indexOf(optionIndex);
                
                if (currentQuestion.type === "single") {
                    // Для одного правильного ответа - очищаем все и выбираем новый
                    currentQuestion.correct = [optionIndex];
                } else if (currentQuestion.type === "multiple") {
                    // Для множественного выбора - добавляем/убираем как раньше
                    if (correctIndex === -1) {
                        currentQuestion.correct.push(optionIndex);
                    } else {
                        currentQuestion.correct.splice(correctIndex, 1);
                    }
                }
            })
        );
    };

    const updateQuestionType = (newType: string) => {
        if (!quiz[index]) return;
        
        setQuiz((prev) =>
            produce(prev, (draft) => {
                draft[index].type = newType;
            })
        );
    };

    const updateQuestionPoints = (newPoints: string) => {
        if (!quiz[index]) return;
        
        setQuiz((prev) =>
            produce(prev, (draft) => {
                draft[index].points = newPoints;
            })
        );
    };

    const updateQuestionTimeLimit = (newTimeLimit: string) => {
        if (!quiz[index]) return;
        
        setQuiz((prev) =>
            produce(prev, (draft) => {
                draft[index].timeLimit = Number(newTimeLimit);
            })
        );
    };

    const addQuestion = () => {
        const newQuestion = {
            id: "",
            question: "",
            options: ["", "", "", ""],
            correct: [] as number[],
            type: "single",
            points: "regular",
            timeLimit: 60,
        };

        setQuiz((prev) =>
            produce(prev, (draft) => {
                draft.push(newQuestion);
            })
        );
        setIndex(quiz.length);
    };

    const deleteQuestion = async (questionIndex: number) => {
        if (quiz.length > 1) {
            const questionId = quiz[questionIndex].id;
            // Удаляем вопрос из Firestore, если у него есть id
            if (questionId) {
                try {
                    await deleteDoc(doc(db, "questions", questionId));
                } catch (error) {
                    console.error("Ошибка при удалении вопроса из Firebase:", error);
                }
            }

            setQuiz((prev) =>
                produce(prev, (draft) => {
                    draft.splice(questionIndex, 1);
                })
            );
            
            // Обновляем индекс если удаляемый вопрос был активным или после него
            if (questionIndex === index) {
                setIndex(Math.max(0, index - 1));
            } else if (questionIndex < index) {
                setIndex(index - 1);
            }
        }
    };

      const user = auth.currentUser;

     const navigate = useNavigate(); 

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 3, 
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = Number(active.id);
            const newIndex = Number(over.id);
            
            setQuiz((prev) =>
                produce(prev, (draft) => {
                    const newArray = arrayMove(draft, oldIndex, newIndex);
                    draft.splice(0, draft.length, ...newArray);
                })
            );
            
            // Обновляем индекс если перетаскиваемый элемент был активным
            if (index === oldIndex) {
                setIndex(newIndex);
            } else if (index > oldIndex && index <= newIndex) {
                setIndex(index - 1);
            } else if (index < oldIndex && index >= newIndex) {
                setIndex(index + 1);
            }
        }
    };

    return (
        <div className='h-screen w-full montserrat-600 flex flex-col pt-8 px-8'>
            <div className='w-full flex flex-row items-center drop-shadow-2xl border-2 border-gray-300 rounded-lg p-3 mb-4'>
                <h1 className='text-2xl mr-2'>QuizIT</h1>
                <GraduationCap width={30} height={30} className='mr-5'/>
                <Input placeholder='Введи название викторины..' className='w-120 border-2'/>
                <div className='ml-auto'>
                    <Button className='mr-2 drop-shadow-lg cursor-pointer'>
                        Выйти
                    </Button>
                    <Button onClick={saveQuiz} className='bg-[#EE4266] hover:bg-[#c51d45] drop-shadow-lg cursor-pointer'>
                        {savingText}
                    </Button>
                </div>
            </div>
            <div className='h-[90%] flex flex-row gap-4 '>
                <div className='w-64 border-2 border-gray-300 rounded-lg text-black p-5'>
                    <h1>Вопросы</h1>
                    <div className='h-[90%] overflow-y-auto mt-5'>
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={quiz.map((_, i) => i)}
                                strategy={verticalListSortingStrategy}
                            >
                                <ul>
                                    {quiz.map((q, i) => (
                                        <SortableQuestionItem
                                            key={i}
                                            question={q}
                                            index={i}
                                            isActive={i === index}
                                            onClick={() => setIndex(i)}
                                            onDelete={() => deleteQuestion(i)}
                                            canDelete={quiz.length > 1}
                                        />
                                    ))}
                                </ul>
                            </SortableContext>
                        </DndContext>
                    </div>
                    <Button onClick={addQuestion} className='bg-[#EE4266] hover:bg-[#c51d45] drop-shadow-lg cursor-pointer w-full mb-5'>
                            Добавить вопрос
                    </Button>
                </div>
                <div className='flex-1 relative overflow-hidden rounded-lg border-2 border-gray-300'>
                    <div className='absolute inset-0 bg-[url("/public/bg.png")] bg-cover bg-center bg-no-repeat opacity-30' style={{ filter: 'brightness(0.5)' }}></div>
                    <div className='relative z-10 p-4 text-white'>
                        <div className="flex justify-center items-center h-40">
                            <Input 
                                value={quiz[index]?.question || ""}
                                onChange={(e) => updateQuestionText(e.target.value)}
                                className='bg-white text-black text-center w-full border-2 border-gray-300 rounded-lg'
                                style={{ fontSize: '2rem', height: '60px' }}
                                placeholder="Введите текст вопроса"
                            />
                        </div>
                    </div>
                    <div className='relative z-10 flex flex-col gap-2 p-4 w-full'>
                        <div className="grid grid-cols-2 gap-2 w-full">
                            {/* First */}
                            <div
                                className='rounded-lg p-4 text-white h-20 flex items-center drop-shadow-none transition-all duration-300'
                                style={{
                                    backgroundColor: quiz[index]?.options[0]
                                        ? '#540D6E'
                                        : 'white'
                                }}
                            >
                                <div className='flex items-center justify-center bg-[#540D6E] rounded-lg px-2 py-4'>
                                    <img src="star.svg" alt="img" className='w-8 h-8'/>
                                </div>
                                <input
                                    className='w-full bg-transparent border-none placeholder-gray-500 focus:border-none focus:outline-none drop-shadow-none ml-2'
                                    placeholder='Первый вариант ответа'
                                    style={{
                                        fontSize: '1rem',
                                        color: quiz[index]?.options[0] ? 'white' : 'grey'
                                    }}
                                    value={quiz[index]?.options[0] || ""}
                                    onChange={(e) => updateOptionText(e.target.value, 0)}
                                />
                                <Button 
                                    onClick={() => toggleCorrectAnswer(0)}
                                    className={`ml-2 w-8 h-8 p-0 rounded-full border-2 transition-all duration-200 cursor-pointer ${
                                        quiz[index]?.correct?.includes(0) 
                                            ? 'bg-green-500 border-green-500 hover:bg-green-600' 
                                            : 'bg-transparent border-gray-400 hover:border-gray-300'
                                    }`}
                                >
                                    {quiz[index]?.correct?.includes(0) ? <Check className="w-4 h-4 text-white" /> : <Circle className="w-4 h-4 text-gray-400" />}
                                </Button>
                            </div>
                            {/* Second */}
                            <div
                                className='rounded-lg p-4 text-white h-20 flex items-center drop-shadow-none transition-all duration-300'
                                style={{
                                    backgroundColor: quiz[index]?.options[1]
                                        ? '#EE4266'
                                        : 'white'
                                }}
                            >
                                <div className='flex items-center justify-center bg-[#EE4266] rounded-lg px-2 py-4'>
                                    <img src="sq.svg" alt="img" className='w-8 h-8'/>
                                </div>
                                <input
                                    className='w-full bg-transparent border-none placeholder-gray-500 focus:border-none focus:outline-none drop-shadow-none ml-2'
                                    placeholder='Второй вариант ответа'
                                    style={{
                                        fontSize: '1rem',
                                        color: quiz[index]?.options[1] ? 'white' : 'grey'
                                    }}
                                    value={quiz[index]?.options[1] || ""}
                                    onChange={(e) => updateOptionText(e.target.value, 1)}
                                />
                                <Button 
                                    onClick={() => toggleCorrectAnswer(1)}
                                    className={`ml-2 w-8 h-8 p-0 rounded-full border-2 transition-all duration-200 cursor-pointer ${
                                        quiz[index]?.correct?.includes(1) 
                                            ? 'bg-green-500 border-green-500 hover:bg-green-600' 
                                            : 'bg-transparent border-gray-400 hover:border-gray-300'
                                    }`}
                                >
                                    {quiz[index]?.correct?.includes(1) ? <Check className="w-4 h-4 text-white" /> : <Circle className="w-4 h-4 text-gray-400" />}
                                </Button>
                            </div>
                            {/* Third */}
                            <div
                                className='rounded-lg p-4 text-white h-20 flex items-center drop-shadow-none transition-all duration-300'
                                style={{
                                    backgroundColor: quiz[index]?.options[2]
                                        ? '#FFD23F'
                                        : 'white'
                                }}
                            >
                                <div className='flex items-center justify-center bg-[#FFD23F] rounded-lg px-2 py-4'>
                                    <img src="trig.svg" alt="img" className='w-8 h-8'/>
                                </div>
                                <input
                                    className='w-full bg-transparent border-none placeholder-gray-500 focus:border-none focus:outline-none drop-shadow-none ml-2'
                                    placeholder='Третий вариант ответа'
                                    style={{
                                        fontSize: '1rem',
                                        color: quiz[index]?.options[2] ? 'white' : 'grey'
                                    }}
                                    value={quiz[index]?.options[2] || ""}
                                    onChange={(e) => updateOptionText(e.target.value, 2)}
                                />
                                <Button 
                                    onClick={() => toggleCorrectAnswer(2)}
                                    className={`ml-2 w-8 h-8 p-0 rounded-full border-2 transition-all duration-200 cursor-pointer ${
                                        quiz[index]?.correct?.includes(2) 
                                            ? 'bg-green-500 border-green-500 hover:bg-green-600' 
                                            : 'bg-transparent border-gray-400 hover:border-gray-300'
                                    }`}
                                >
                                    {quiz[index]?.correct?.includes(2) ? <Check className="w-4 h-4 text-white" /> : <Circle className="w-4 h-4 text-gray-400" />}
                                </Button>
                            </div>
                            {/* Fourth */}
                            <div
                                className='rounded-lg p-4 text-white h-20 flex items-center drop-shadow-none transition-all duration-300'
                                style={{
                                    backgroundColor: quiz[index]?.options[3]
                                        ? '#3BCEAC'
                                        : 'white'
                                }}
                            >
                                <div className='flex items-center justify-center bg-[#3BCEAC] rounded-lg px-2 py-4'>
                                    <img src="circ.svg" alt="img" className='w-8 h-8'/>
                                </div>
                                <input
                                    className='w-full bg-transparent border-none placeholder-gray-500 focus:border-none focus:outline-none drop-shadow-none ml-2'
                                    placeholder='Четвертый вариант ответа'
                                    style={{
                                        fontSize: '1rem',
                                        color: quiz[index]?.options[3] ? 'white' : 'grey'
                                    }}
                                    value={quiz[index]?.options[3] || ""}
                                    onChange={(e) => updateOptionText(e.target.value, 3)}
                                />
                                <Button 
                                    onClick={() => toggleCorrectAnswer(3)}
                                    className={`ml-2 w-8 h-8 p-0 rounded-full border-2 transition-all duration-200 cursor-pointer ${
                                        quiz[index]?.correct?.includes(3) 
                                            ? 'bg-green-500 border-green-500 hover:bg-green-600' 
                                            : 'bg-transparent border-gray-400 hover:border-gray-300'
                                    }`}
                                >
                                    {quiz[index]?.correct?.includes(3) ? <Check className="w-4 h-4 text-white" /> : <Circle className="w-4 h-4 text-gray-400" />}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className='w-64 border-2 border-gray-300 rounded-lg'>
                    <div className='p-4'>
                        <h3 className='text-lg font-semibold mb-2 text-black'>Параметры вопроса</h3>
                        <Label className='text-black mb-2'>Тип вопроса</Label>
                        <Select onValueChange={updateQuestionType} value={quiz[index]?.type || "single"}>
                            <SelectTrigger className="w-full">
                                <SelectValue className='text-black' placeholder="Тип вопроса" />
                            </SelectTrigger>

                            <SelectContent className='montserrat-600'>
                                <SelectItem value="single">Один ответ</SelectItem>
                                <SelectItem value="multiple">Несколько ответов</SelectItem>
                                <SelectItem value="text">Текстовый ответ</SelectItem>
                            </SelectContent>
                        </Select>
                        <Label className='text-black mb-2 mt-5'>Количество баллов</Label>
                        <Select onValueChange={updateQuestionPoints} value={quiz[index]?.points || "regular"}>
                            <SelectTrigger className="w-full">
                                <SelectValue className='text-black' placeholder="Выберите баллы" />
                            </SelectTrigger>

                            <SelectContent className='montserrat-600'>
                                <SelectItem value="regular">Обычные баллы</SelectItem>
                                <SelectItem value="double">Двойные баллы</SelectItem>
                                <SelectItem value="none">Без баллов</SelectItem>
                            </SelectContent>
                        </Select>
                        <Label className='text-black mb-2 mt-5'>Время на вопрос</Label>
                        <Select onValueChange={updateQuestionTimeLimit} value={quiz[index]?.timeLimit?.toString() || "60"}>
                            <SelectTrigger className="w-full">
                                <SelectValue className='text-black' placeholder="Выберите время" />
                            </SelectTrigger>
                            <SelectContent className='montserrat-600'>
                                <SelectItem value="5">5 секунд</SelectItem>
                                <SelectItem value="10">10 секунд</SelectItem>
                                <SelectItem value="20">20 секунд</SelectItem>
                                <SelectItem value="30">30 секунд</SelectItem>
                                <SelectItem value="45">45 секунд</SelectItem>
                                <SelectItem value="60">1 минута</SelectItem>
                                <SelectItem value="90">1 минута 30 секунд</SelectItem>
                                <SelectItem value="120">2 минуты</SelectItem>
                                <SelectItem value="180">3 минуты</SelectItem>
                                <SelectItem value="240">4 минуты</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CreateQuiz;