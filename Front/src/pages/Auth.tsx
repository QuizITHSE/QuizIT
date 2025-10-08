import React from 'react';
import './Auth.css'

import { useRef, useLayoutEffect } from 'react';
import { getAnalytics } from "firebase/analytics";
import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    TabsContents,
 } from '@/components/animate-ui/components/tabs';
import { GraduationCap, ArrowRight, Check,  BookMarked } from 'lucide-react'
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from "motion/react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';


import { addDoc, collection, doc, setDoc } from "firebase/firestore";
import { db, app } from '@/lib/firebase';

import { useForm } from "react-hook-form"
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form"
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';

function Auth() {

    const analytics = getAnalytics(app);


    // Состояние для активной вкладки
    const [activeTab, setActiveTab] = React.useState<'login' | 'signup'>('login');
    // refs для контента вкладок
    const loginRef = useRef<HTMLDivElement>(null);
    const signupRef = useRef<HTMLDivElement>(null);
    // ref для контейнера
    const containerRef = useRef<HTMLDivElement>(null);

    const usersCollection = collection(db, 'users');


    // Состояния для регистрации
    const [regStep, setRegStep] = React.useState<number>(0);
    const [regButtonText, setRegButtonText] = React.useState<string>("Далее");
    const [regError, setRegError] = React.useState<string | null>(null);
    const [isCreatingAccount, setIsCreatingAccount] = React.useState<boolean>(false);
    const [isLoggingIn, setIsLoggingIn] = React.useState<boolean>(false);

    const navigate = useNavigate();

    const [userCreds, setUserCreds] = React.useState<any>(null);

    // react-hook-form для логина
    const loginForm = useForm({
        defaultValues: {
            email: "",
            password: "",
        }
    });

    // react-hook-form для регистрации
    const signupForm = useForm({
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            password: "",
            passwordRepeat: "",
        }
    });

    // Логика логина
    const handleLogin = async (values: { email: string, password: string }) => {
        setIsLoggingIn(true);
        
        // Отладка: проверяем данные перед отправкой
        console.log("Попытка входа с данными:");
        console.log("Email:", `"${values.email}"`);
        console.log("Password length:", values.password.length);
        console.log("Password (первые 3 символа):", values.password.substring(0, 3) + "***");
        
        try {
            const { getAuth, signInWithEmailAndPassword } = await import("firebase/auth");
            const auth = getAuth();
            
            await signInWithEmailAndPassword(auth, values.email.trim(), values.password);
            console.log("Успешный вход:", values.email);
            navigate("/");
    } catch (error: any) {
        console.error("Ошибка входа:", error);
        console.error("Код ошибки:", error.code);
        console.error("Сообщение ошибки:", error.message);
        console.error("Email для входа:", values.email);
        console.error("Длина пароля:", values.password.length);
        if (error.code === "auth/user-not-found") {
                loginForm.setError("email", { message: "Пользователь с такой почтой не найден" });
            } else if (error.code === "auth/wrong-password") {
                loginForm.setError("password", { message: "Неверный пароль" });
            } else if (error.code === "auth/invalid-email") {
                loginForm.setError("email", { message: "Некорректный формат почты" });
        } else if (error.code === "auth/invalid-credential") {
            loginForm.setError("root", { message: "Неверный email или пароль. Если вы сбросили пароль, проверьте почту для получения ссылки на сброс." });
        } else if (error.code === "auth/too-many-requests") {
            loginForm.setError("root", { message: "Слишком много попыток входа. Попробуйте позже." });
        } else if (error.code === "auth/user-disabled") {
            loginForm.setError("root", { message: "Аккаунт отключен. Обратитесь к администратору." });
        } else if (error.code === "auth/network-request-failed") {
            loginForm.setError("root", { message: "Ошибка сети. Проверьте подключение к интернету." });
        } else {
            loginForm.setError("root", { message: "Ошибка входа: " + (error.message || "Неизвестная ошибка") });
        }
        } finally {
            setIsLoggingIn(false);
        }
    }

    // Логика регистрации
    const handleSignup = async (values: { firstName: string, lastName: string, email: string, password: string, passwordRepeat: string }) => {
        setRegError(null);
        if (values.password !== values.passwordRepeat) {
            setRegError("Пароли не совподают");
            return;
        }

        setIsCreatingAccount(true);

        // Проверка, существует ли пользователь с такой почтой в Firebase Auth
        try {
            const { getAuth, fetchSignInMethodsForEmail, createUserWithEmailAndPassword } = await import("firebase/auth");
            const auth = getAuth();

            // Проверяем, есть ли уже пользователь с такой почтой
            const methods = await fetchSignInMethodsForEmail(auth, values.email);
            if (methods.length > 0) {
                setRegError("Пользователь с такой почтой уже существует");
                setIsCreatingAccount(false);
                return;
            }

            // Если пользователя нет, создаём его
            await createUserWithEmailAndPassword(auth, values.email, values.password);
            setUserCreds(auth.currentUser);

            setRegStep(1);
            setRegButtonText("Готово");
            setIsCreatingAccount(false);
            console.log("Регистрация:", values);
        } catch (error: any) {
            setIsCreatingAccount(false);
            if (error.code === "auth/email-already-in-use") {
                setRegError("Пользователь с такой почтой уже существует");
            } else if (error.code === "auth/invalid-email") {
                setRegError("Некорректный формат почты");
            } else if (error.code === "auth/weak-password") {
                setRegError("Слабый пароль. Минимум 6 символов.");
            } else if (error.code === "auth/too-many-requests") {
                setRegError("Слишком много попыток регистрации. Попробуйте позже.");
            } else {
                setRegError("Ошибка регистрации: " + (error.message || "Неизвестная ошибка"));
            }
        }
    }

    // Сохраняем выбранный тип пользователя
    const [userType, setUserType] = React.useState<"student" | "teacher">("student");

    // Обработчик изменения выбора в RadioGroup
    const handleUserTypeChange = (value: string) => {
        setSelectedOption(value);
        if (value === "option-one") {
            setUserType("student");
        } else if (value === "option-two") {
            setUserType("teacher");
        }
    };

    // Состояние для выбранного значения RadioGroup
    const [selectedOption, setSelectedOption] = React.useState("option-one");
    const [isUserCreating, setIsUserCreating] = React.useState(false);

    const saveUserType = async () => {
        setIsUserCreating(true);
        console.log("Выбранный тип пользователя:", userType);
        try {
            // Используем UID как document ID
            await setDoc(doc(db, "users", userCreds.uid), {
              isTeacher: userType === "teacher" ? true : false,
              name: signupForm.getValues("firstName"),
              lastName: signupForm.getValues("lastName"),
            });
            console.log("Document written with ID: ", userCreds.uid);
            if(userType === "teacher"){ 
                navigate("/create-group")
            } else {
                navigate("/student-join")
            }
            setIsUserCreating(false);
          } catch (e) {
            console.error("Error adding document: ", e);
            setIsUserCreating(false);
          } 
    }
    

    // Эффект для динамического изменения высоты контейнера
    useLayoutEffect(() => {
        let node: HTMLDivElement | null = null;
        if (activeTab === 'login') {
            node = loginRef.current;
        } else if (activeTab === 'signup') {
            node = signupRef.current;
        }
        if (node && containerRef.current) {
            const height = node.offsetHeight;
            containerRef.current.style.height = height + 'px';
        }
    }, [
        activeTab,
        loginForm.watch(),
        signupForm.watch(),
        regError,
        isCreatingAccount,
        isLoggingIn,
        loginForm.formState.errors,
        signupForm.formState.errors
    ]);


    return (
        <div className="min-h-screen w-full montserrat-600 flex justify-center items-center flex-col">

            <div className='m-4 flex-row flex gap-2'>
                <h1 className='text-4xl'>
                    Quiz IT
                </h1>
                <GraduationCap size={40}/>
            </div>

            <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-[400px] rounded-lg border-2 bordeer-grey-300"
            >
                <TabsList className="grid w-full grid-cols-2 ">
                    <TabsTrigger value="login">Войти</TabsTrigger>
                    <TabsTrigger value="signup">Зарегестрироваться</TabsTrigger>
                </TabsList>

                {/* Контейнер с анимируемой высотой */}
                <div
                    ref={containerRef}
                    style={{
                        transition: 'height 0.3s cubic-bezier(.4,0,.2,1)',
                        overflow: 'hidden',
                        width: '100%',
                    }}
                    className="rounded-lg bg-muted"
                >
                    <TabsContents>
                        <TabsContent
                            ref={loginRef}
                            className='p-2 flex justify-center items-center flex-col gap-5'
                            value="login"
                        >
                            <Form {...loginForm}>
                                <form className="w-full flex flex-col gap-5" onSubmit={loginForm.handleSubmit(handleLogin)} noValidate>
                                    <h1 className='mb-3'>Рады вас видеть!</h1>
                                    <FormField
                                        control={loginForm.control}
                                        name="email"
                                        rules={{ required: "Введите почту" }}
                                        render={({ field, fieldState }) => (
                                            <FormItem>
                                                <FormLabel className='text-left w-full'>Почта</FormLabel>
                                                <FormControl>
                                                    <Input type="email" {...field} className={fieldState.error ? 'border-red-500' : ''} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={loginForm.control}
                                        name="password"
                                        rules={{ required: "Введите пароль" }}
                                        render={({ field, fieldState }) => (
                                            <FormItem>
                                                <FormLabel className='text-left w-full'>Пароль</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} className={`mb-4 ${fieldState.error ? 'border-red-500' : ''}`} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    {loginForm.formState.errors.root && (
                                        <div className='text-red-500 text-sm'>
                                            {loginForm.formState.errors.root.message}
                                        </div>
                                    )}
                                    <Button className='w-full cursor-pointer' type="submit" disabled={isLoggingIn}>
                                        {isLoggingIn ? (
                                            <>
                                                <Spinner size="sm" className="text-white" />
                                                Входим...
                                            </>
                                        ) : (
                                            "Войти"
                                        )}
                                    </Button>
                                </form>
                            </Form>
                        </TabsContent>
                        <TabsContent
                            ref={signupRef}
                            value="signup"
                        >
                            <Form {...signupForm}>
                                <AnimatePresence mode="wait">
                                    {regStep == 0 && (
                                        <motion.div
                                            key={regStep}
                                            initial={{ x: 300, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            exit={{ x: -300, opacity: 0 }}
                                            transition={{ duration: 0.4, ease: "easeInOut" }}
                                            className='p-1.5'
                                        >
                                            <form className="w-full flex flex-col gap-5" onSubmit={signupForm.handleSubmit(handleSignup)} noValidate>
                                                    <h1 className='mb-3'>Добро пожаловать!</h1>
                                                    <FormField
                                                        control={signupForm.control}
                                                        name="firstName"
                                                        rules={{ required: "Введите имя" }}
                                                        render={({ field, fieldState }) => (
                                                            <FormItem>
                                                                <FormLabel className='text-left w-full'>Имя</FormLabel>
                                                                <FormControl>
                                                                    <Input type="text" {...field} className={fieldState.error ? 'border-red-500' : ''} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={signupForm.control}
                                                        name="lastName"
                                                        rules={{ required: "Введите фамилию" }}
                                                        render={({ field, fieldState }) => (
                                                            <FormItem>
                                                                <FormLabel className='text-left w-full'>Фамилия</FormLabel>
                                                                <FormControl>
                                                                    <Input type="text" {...field} className={fieldState.error ? 'border-red-500' : ''} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={signupForm.control}
                                                        name="email"
                                                        rules={{ required: "Введите почту" }}
                                                        render={({ field, fieldState }) => (
                                                            <FormItem>
                                                                <FormLabel className='text-left w-full'>Почта</FormLabel>
                                                                <FormControl>
                                                                    <Input type="email" {...field} className={fieldState.error ? 'border-red-500' : ''} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={signupForm.control}
                                                        name="password"
                                                        rules={{ required: "Введите пароль" }}
                                                        render={({ field, fieldState }) => (
                                                            <FormItem>
                                                                <FormLabel className='text-left w-full'>Пароль</FormLabel>
                                                                <FormControl>
                                                                    <Input type="password" {...field} className={`mb-4 ${fieldState.error ? 'border-red-500' : ''}`} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={signupForm.control}
                                                        name="passwordRepeat"
                                                        rules={{ required: "Повторите пароль" }}
                                                        render={({ field, fieldState }) => (
                                                            <FormItem>
                                                                <FormLabel className='text-left w-full'>Повтори Пароль</FormLabel>
                                                                <FormControl>
                                                                    <Input type="password" {...field} className={`mb-4 ${fieldState.error ? 'border-red-500' : ''}`} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    {regError && (
                                                        <div className='text-red-500 text-sm'>
                                                            {regError}
                                                        </div>
                                                    )}
                                                    <Button type="submit" className='w-full cursor-pointer' disabled={isCreatingAccount}>
                                                        {isCreatingAccount ? (
                                                            <>
                                                                <Spinner size="sm" className="text-white" />
                                                                Создаем аккаунт...
                                                            </>
                                                        ) : (
                                                            <>
                                                                Дальше
                                                                <ArrowRight/>
                                                            </>
                                                        )}
                                                    </Button>
                                                </form>
                                        </motion.div>
                                    )}
                                    {regStep == 1 && (
                                     <div className='w-full p-1'>
                                        <RadioGroup
                                            className='h-full'
                                            value={selectedOption}
                                            onValueChange={handleUserTypeChange}
                                        >
                                            <label
                                                htmlFor="option-one"
                                                className={`flex flex-col border-2 p-5 m-2 rounded-2xl cursor-pointer ${selectedOption === 'option-one' ? 'bg-blue-100' : ''}`}
                                                style={{ userSelect: 'none' }}
                                            >
                                                <div className="flex items-center">
                                                    <RadioGroupItem value="option-one" id="option-one" />
                                                    <Label htmlFor="option-one" className="ml-2 cursor-pointer text-xl flex items-center">
                                                        <BookMarked className="mr-2"/>
                                                        Я студент
                                                    </Label>
                                                </div>
                                                <ul className="list-disc ml-8 mt-2 text-base text-gray-700">
                                                    <li>Доступ к тестам и материалам</li>
                                                    <li>Возможность отслеживать прогресс</li>
                                                </ul>
                                            </label>
                                            <label
                                                htmlFor="option-two"
                                                className={`flex flex-col border-2 p-5 m-2 rounded-2xl cursor-pointer ${selectedOption === 'option-two' ? 'bg-blue-100' : ''}`}
                                                style={{ userSelect: 'none' }}
                                            >
                                                <div className="flex items-center">
                                                    <RadioGroupItem value="option-two" id="option-two" />
                                                    <Label htmlFor="option-two" className="ml-2 cursor-pointer text-xl flex items-center">
                                                        <GraduationCap className="mr-2"/>
                                                        Я учитель
                                                    </Label>
                                                </div>
                                                <ul className="list-disc ml-8 mt-2 text-base text-gray-700">
                                                    <li>Создание и управление тестами</li>
                                                    <li>Аналитика по результатам студентов</li>
                                                </ul>
                                            </label>
                                        </RadioGroup>
                                        <Button onClick={saveUserType} type="button" className='w-full cursor-pointer mt-4 mb-4'>
                                            {
                                                isUserCreating ? (
                                                    <>
                                                        <Spinner size="sm" className="text-white" />
                                                        Почти готово...
                                                    </>
                                                ) : (
                                                    <>
                                                        Закончить
                                                        <Check/>
                                                    </>
                                                )
                                            }
                                        </Button>
                                     </div>
                                    
                                    )}
                                </AnimatePresence>
                            </Form>
                        </TabsContent>
                    </TabsContents>
                </div>
            </Tabs>
        </div>
  )
}

export default Auth
