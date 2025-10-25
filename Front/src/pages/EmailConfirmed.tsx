import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

function EmailConfirmed() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        const userType = searchParams.get('userType');

        console.log('EmailConfirmation Debug:', {
            userType,
            allParams: Object.fromEntries(searchParams.entries())
        });

        setStatus('success');
        
        setTimeout(() => {
            if (userType === 'teacher') {
                console.log('Redirecting to create-group based on URL param');
                navigate('/create-group');
            } else {
                console.log('Redirecting to student-join based on URL param');
                navigate('/student-join');
            }
        }, 3000);
    }, [searchParams, navigate]);

    return (
        <div className="min-h-screen w-full montserrat-600 flex justify-center items-center flex-col bg-gray-50">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
                {status === 'loading' && (
                    <div className="text-center">
                        <Loader2 className="h-16 w-16 text-blue-600 animate-spin mx-auto mb-4" />
                        <h1 className="text-2xl font-semibold text-gray-800 mb-2">
                            Подтверждение email
                        </h1>
                        <p className="text-gray-600">
                            Проверяем вашу ссылку подтверждения...
                        </p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="text-center">
                        <div className="bg-green-100 rounded-full p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                            <Check className="h-10 w-10 text-green-600" />
                        </div>
                        <h1 className="text-2xl font-semibold text-gray-800 mb-2">
                            Email успешно подтвержден!
                        </h1>
                        <p className="text-gray-600 mb-6">
                            Ваш аккаунт активирован. Вы будете перенаправлены на соответствующую страницу через несколько секунд.
                        </p>
                        <Button 
                            onClick={() => {
                                console.log('Continue button clicked');
                                const userType = searchParams.get('userType');
                                console.log('Continue button - UserType from URL:', userType);
                                
                                if (userType === 'teacher') {
                                    console.log('Continue button - Redirecting to create-group');
                                    navigate('/create-group');
                                } else {
                                    console.log('Continue button - Redirecting to student-join');
                                    navigate('/student-join');
                                }
                            }}
                            className="w-full"
                        >
                            Продолжить
                        </Button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center">
                        <div className="bg-red-100 rounded-full p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                            <X className="h-10 w-10 text-red-600" />
                        </div>
                        <h1 className="text-2xl font-semibold text-gray-800 mb-2">
                            Ошибка подтверждения
                        </h1>
                        <p className="text-gray-600 mb-6">
                            {errorMessage}
                        </p>
                        <div className="space-y-3">
                            <Button 
                                onClick={() => navigate('/auth')} 
                                className="w-full"
                            >
                                Вернуться к авторизации
                            </Button>
                            <Button 
                                onClick={() => navigate('/')} 
                                variant="outline"
                                className="w-full"
                            >
                                На главную
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default EmailConfirmed;
