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
import { GraduationCap, ArrowRight, Check,  BookMarked, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from "motion/react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';


import { addDoc, collection, doc, setDoc } from "firebase/firestore";
import { db, app, auth } from '@/lib/firebase';

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

// Интерфейс для критериев пароля
interface PasswordCriteria {
    minLength: boolean;
    hasUpperCase: boolean;
    hasLowerCase: boolean;
    hasNumbers: boolean;
    hasSpecialChars: boolean;
}

// Функция для проверки критериев пароля
const validatePassword = (password: string): PasswordCriteria => {
    return {
        minLength: password.length >= 8,
        hasUpperCase: /[A-Z]/.test(password),
        hasLowerCase: /[a-z]/.test(password),
        hasNumbers: /\d/.test(password),
        hasSpecialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
};

// Функция для проверки формата email
const validateEmail = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email.trim());
};

// Компонент для отображения критериев пароля
const PasswordCriteriaDisplay = ({ password }: { password: string }) => {
    const criteria = validatePassword(password);
    
    const criteriaList = [
        { key: 'minLength', label: 'Минимум 8 символов', met: criteria.minLength },
        { key: 'hasUpperCase', label: 'Заглавная буква', met: criteria.hasUpperCase },
        { key: 'hasLowerCase', label: 'Строчная буква', met: criteria.hasLowerCase },
        { key: 'hasNumbers', label: 'Цифра', met: criteria.hasNumbers },
        { key: 'hasSpecialChars', label: 'Специальный символ', met: criteria.hasSpecialChars }
    ];

    if (!password) return null;

    return (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
            <p className="text-sm font-medium text-gray-700 mb-2">Требования к паролю:</p>
            <ul className="space-y-1">
                {criteriaList.map((criterion) => (
                    <li key={criterion.key} className="flex items-center text-sm">
                        {criterion.met ? (
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        ) : (
                            <XCircle className="h-4 w-4 text-red-500 mr-2" />
                        )}
                        <span className={criterion.met ? 'text-green-700' : 'text-red-700'}>
                            {criterion.label}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

function Auth() {

    const analytics = getAnalytics(app);


    const [activeTab, setActiveTab] = React.useState<'login' | 'signup'>('login');
    const loginRef = useRef<HTMLDivElement>(null);
    const signupRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const usersCollection = collection(db, 'users');


    const [regStep, setRegStep] = React.useState<number>(0);
    const [regButtonText, setRegButtonText] = React.useState<string>("Далее");
    const [regError, setRegError] = React.useState<string | null>(null);
    const [isCreatingAccount, setIsCreatingAccount] = React.useState<boolean>(false);
    const [isLoggingIn, setIsLoggingIn] = React.useState<boolean>(false);

    const navigate = useNavigate();

    const [userCreds, setUserCreds] = React.useState<any>(null);

    const loginForm = useForm({
        defaultValues: {
            email: "",
            password: "",
        }
    });

    const signupForm = useForm({
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            password: "",
            passwordRepeat: "",
        }
    });

    const handleLogin = async (values: { email: string, password: string }) => {
        setIsLoggingIn(true);
        
        // Проверка формата email
        if (!validateEmail(values.email)) {
            loginForm.setError("email", { message: "Некорректный формат email. Пожалуйста, проверьте введенные данные" });
            setIsLoggingIn(false);
            return;
        }
        
        try {
            const { signInWithEmailAndPassword } = await import("firebase/auth");
            
            await signInWithEmailAndPassword(auth, values.email.trim(), values.password);
            navigate("/");
    } catch (error: any) {
        if (error.code === "auth/user-not-found") {
                loginForm.setError("email", { message: "Пользователь с такой почтой не найден" });
            } else if (error.code === "auth/wrong-password") {
                loginForm.setError("password", { message: "Неверный пароль" });
            } else if (error.code === "auth/invalid-email") {
                loginForm.setError("email", { message: "Некорректный формат email. Пожалуйста, проверьте введенные данные" });
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

    const handleSignup = async (values: { firstName: string, lastName: string, email: string, password: string, passwordRepeat: string }) => {
        setRegError(null);
        
        // Проверка формата email
        if (!validateEmail(values.email)) {
            setRegError("Некорректный формат email. Пожалуйста, проверьте введенные данные");
            return;
        }
        
        // Проверка соответствия паролей
        if (values.password !== values.passwordRepeat) {
            setRegError("Пароли не совпадают");
            return;
        }

        // Проверка критериев надежности пароля
        const passwordCriteria = validatePassword(values.password);
        const allCriteriaMet = Object.values(passwordCriteria).every(criterion => criterion);
        
        if (!allCriteriaMet) {
            setRegError("Пароль не соответствует требованиям безопасности. Проверьте критерии ниже.");
            return;
        }

        setIsCreatingAccount(true);

        try {
            const { fetchSignInMethodsForEmail, createUserWithEmailAndPassword, sendEmailVerification } = await import("firebase/auth");

            const methods = await fetchSignInMethodsForEmail(auth, values.email);
            if (methods.length > 0) {
                setRegError("Пользователь с такой почтой уже существует");
                setIsCreatingAccount(false);
                return;
            }

            const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
            setUserCreds(userCredential.user);


            setRegStep(1);
            setRegButtonText("Готово");
            setIsCreatingAccount(false);
        } catch (error: any) {
            setIsCreatingAccount(false);
            if (error.code === "auth/email-already-in-use") {
                setRegError("Пользователь с такой почтой уже существует");
            } else if (error.code === "auth/invalid-email") {
                setRegError("Некорректный формат email. Пожалуйста, проверьте введенные данные");
            } else if (error.code === "auth/weak-password") {
                setRegError("Слабый пароль. Минимум 6 символов.");
            } else if (error.code === "auth/too-many-requests") {
                setRegError("Слишком много попыток регистрации. Попробуйте позже.");
            } else {
                setRegError("Ошибка регистрации: " + (error.message || "Неизвестная ошибка"));
            }
        }
    }

    const [userType, setUserType] = React.useState<"student" | "teacher">("student");

    const handleUserTypeChange = (value: string) => {
        setSelectedOption(value);
        if (value === "option-one") {
            setUserType("student");
        } else if (value === "option-two") {
            setUserType("teacher");
        }
    };

    const [selectedOption, setSelectedOption] = React.useState("option-one");
    const [isUserCreating, setIsUserCreating] = React.useState(false);
    const [emailVerificationSent, setEmailVerificationSent] = React.useState(false);
    const [isResendingEmail, setIsResendingEmail] = React.useState(false);
    const [resendCooldown, setResendCooldown] = React.useState(0);

    const resendVerificationEmail = async () => {
        if (!userCreds || resendCooldown > 0) return;
        
        setIsResendingEmail(true);
        try {
            const { sendEmailVerification } = await import("firebase/auth");
            await sendEmailVerification(userCreds, {
                url: `${window.location.origin}/email-confirmed?userType=${userType}`
            });
            setEmailVerificationSent(true);
            
            // Устанавливаем кулдаун на 60 секунд
            setResendCooldown(60);
            const cooldownInterval = setInterval(() => {
                setResendCooldown(prev => {
                    if (prev <= 1) {
                        clearInterval(cooldownInterval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            
        } catch (error: any) {
            console.error("Ошибка повторной отправки email:", error);
            if (error.code === 'auth/too-many-requests') {
                alert("Слишком много попыток отправки email. Попробуйте позже.");
            } else {
                alert("Ошибка отправки email. Попробуйте позже.");
            }
        } finally {
            setIsResendingEmail(false);
        }
    };

    const saveUserType = async () => {
        setIsUserCreating(true);
        try {
            await setDoc(doc(db, "users", userCreds.uid), {
              isTeacher: userType === "teacher" ? true : false,
              name: signupForm.getValues("firstName"),
              lastName: signupForm.getValues("lastName"),
            });
            
            // Отправляем подтверждающий email ПОСЛЕ сохранения типа пользователя
            try {
                const { sendEmailVerification } = await import("firebase/auth");
                await sendEmailVerification(userCreds, {
                    url: `${window.location.origin}/email-confirmed?userType=${userType}`
                });
                setEmailVerificationSent(true);
            } catch (emailError: any) {
                console.error("Ошибка отправки подтверждающего email:", emailError);
                if (emailError.code === 'auth/too-many-requests') {
                    console.warn("Слишком много попыток отправки email");
                }
            }
            
            setIsUserCreating(false);
            
            // Показываем сообщение о том, что нужно проверить email
            alert("Регистрация завершена! Проверьте вашу почту и перейдите по ссылке для подтверждения аккаунта.");
          } catch (e) {
            setIsUserCreating(false);
          } 
    }
    

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
                                                                    <Input type="password" {...field} className={`mb-2 ${fieldState.error ? 'border-red-500' : ''}`} />
                                                                </FormControl>
                                                                <FormMessage />
                                                                <PasswordCriteriaDisplay password={field.value} />
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
