import { collection, query, where, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { auth, db } from '@/lib/firebase';





const StudentJoin = () => {

    const joinGroup = async () => {
        setIsJoining(true);
        try {
            const q = query(collection(db, 'groups'), where('code', '==', groupCode));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                setError('Неверный код приглашения. Пожалуйста, уточните код у вашего преподавателя');
                setIsJoining(false);
                return;
            }
            await updateDoc(querySnapshot.docs[0].ref, {
                students: arrayUnion(user?.uid),
            });
            setIsJoining(false);
            navigate('/');
        } catch (error) {
            setIsJoining(false);
            setError('Не удалось присоединиться к группе');
        }
    }


      const user = auth.currentUser;
      const [isJoining, setIsJoining] = useState(false);
    const [groupCode, setGroupCode] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleGroupCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setGroupCode(e.target.value);
        if (error) setError(''); // Сбрасываем ошибку при вводе
    }

    return (
        <div className="min-h-screen w-full montserrat-600 flex justify-center items-center flex-col px-4 py-8">
            <div className="w-full max-w-md p-5 md:p-6 flex flex-col gap-4 md:gap-5 items-center justify-center rounded-lg border-2 border-gray-300 overflow-hidden">
                <h1 className='text-xl md:text-2xl font-bold text-center'>Присоединиться к группе</h1>
                <Input type='text' placeholder='Код группы' value={groupCode} onChange={handleGroupCodeChange} className='w-full'/>
                {error && <p className='text-red-500 text-xs md:text-sm text-center w-full break-words px-2'>{error}</p>}
                <Button onClick={joinGroup} className='cursor-pointer w-full md:w-auto px-6 py-3 text-base md:text-base'>{isJoining ? <Spinner color=''/> : 'Присоединиться'}</Button> 
                <Link className='text-sm text-gray-500' to='/'>Позже</Link>
            </div>
        </div>
    )
}

export default StudentJoin;