import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { CopyButton } from '@/components/CopyButton';
import {QRCodeSVG} from 'qrcode.react';
import { addDoc, collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from "motion/react";
import { auth, db } from '@/lib/firebase';


function generateGroupCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function generateUniqueGroupCode(db: any, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateGroupCode();
    const q = query(collection(db, 'groups'), where('code', '==', code));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return code;
    }
  }
  throw new Error('Не удалось сгенерировать уникальный код группы. Попробуйте ещё раз.');
}

function CreateGroup() {

      const user = auth.currentUser;

    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [step, setStep] = useState(1);
    const [groupCode, setGroupCode] = useState('');

    const navigate = useNavigate();

    const createGroup = async () => {
        if(groupName.length > 0){
            try {
                // Получаем данные пользователя напрямую по UID
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                
                if (!userDoc.exists()) {
                  console.error('❌ CreateGroup: Пользователь не найден');
                  alert('Ошибка: данные пользователя не найдены');
                  return;
                }
                
                console.log('✅ CreateGroup: Данные пользователя получены');
                
                const code = await generateUniqueGroupCode(db);
                setGroupCode(code);
                const docRef = await addDoc(collection(db, "groups"), {
                  admin: user.uid,  // Используем UID напрямую
                  name: groupName,
                  description: groupDescription,
                  createdAt: new Date(),
                  isActive: true,
                  isDeleted: false,
                  code: code,
                  students: [],
                });
                console.log("Document written with ID: ", docRef.id);
                setStep(2);
              } catch (e) {
                console.error("Error adding document: ", e);
                alert('Ошибка при создании группы: ' + (e as Error).message);
              } 

        } else {
            alert('Название группы не может быть пустым');
        }
    }


    return (
        <div className="min-h-screen w-full montserrat-600 flex justify-center items-center flex-col">
            <div className="w-[500px] p-5 flex flex-col gap-5 items-center justify-center rounded-lg border-2 bordeer-grey-300 overflow-hidden">
        <AnimatePresence mode="wait">
        {step === 1 && (
            <motion.div
                key={1}
                initial={{ x: 200, opacity: 0, filter: "blur(8px)" }}
                animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
                exit={{ x: -200, opacity: 0, filter: "blur(8px)" }}
                transition={{
                  x: { type: "spring", stiffness: 120, damping: 12 },
                  opacity: { duration: 0.15 },
                  filter: { duration: 0.15 }
                }}
                className="w-full flex flex-col gap-5 items-center"
                style={{ filter: "blur(0px)" }}
            >
                <h1 className='text-2xl font-bold'>Создать группу</h1>
                <div className='flex flex-col gap-2 w-full'>
                    <Label>Название группы</Label>
                    <Input type='text' value={groupName} onChange={(e) => setGroupName(e.target.value)}/>
                    <Label>Описание группы</Label>
                    <Label className='text-sm text-gray-500'>Необязательно</Label>
                    <Input type='text' value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)}/>
                    <Button onClick={createGroup} className='flex items-center gap-1 cursor-pointer'>Далее <ArrowRight/></Button>
                </div>
                <Link className='text-sm text-gray-500' to='/'>Позже</Link>
            </motion.div>
        )}
        {step === 2 && (
            <motion.div
                key={2}
                initial={{ x: 200, opacity: 0, filter: "blur(8px)" }}
                animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
                exit={{ x: -200, opacity: 0, filter: "blur(8px)" }}
                transition={{
                  x: { type: "spring", stiffness: 120, damping: 12 },
                  opacity: { duration: 0.15 },
                  filter: { duration: 0.15 }
                }}
                className="w-full flex flex-col gap-5 items-center"
                style={{ filter: "blur(0px)" }}
            >
                <h1 className='text-2xl font-bold'>Ссылка на группу</h1> 
                <h1 className='text-sm text-gray-500'>Код группы: {groupCode}</h1>
                <QRCodeSVG value={groupCode}  width={200} height={200}/>
                <CopyButton text={groupCode} className='w-full'>Скопировать</CopyButton>
                <Button className='w-full cursor-pointer' onClick={() => navigate('/')}>Домой</Button>
            </motion.div>
        )}
        </AnimatePresence>
        </div>
        </div>
    )
}

export default CreateGroup;