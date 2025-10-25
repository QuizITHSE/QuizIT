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
        <div className="min-h-screen w-full montserrat-600 flex justify-center items-center flex-col">
            <div className="w-[500px] p-5 flex flex-col gap-5 items-center justify-center rounded-lg border-2 bordeer-grey-300 overflow-hidden">
                <h1 className='text-2xl font-bold'>Присоединиться к группе</h1>
                <Input type='text' placeholder='Код группы' value={groupCode} onChange={handleGroupCodeChange}/>
                {error && <p className='text-red-500 text-sm text-center w-full'>{error}</p>}
                <Button onClick={joinGroup} className='cursor-pointer'>{isJoining ? <Spinner color=''/> : 'Присоединиться'}</Button> 
                <Link className='text-sm text-gray-500' to='/'>Позже</Link>
            </div>
        </div>
    )
}

export default StudentJoin;