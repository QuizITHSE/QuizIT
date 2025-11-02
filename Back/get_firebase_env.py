#!/usr/bin/env python3
"""
Скрипт для конвертации Firebase ключа в отдельные переменные окружения
Использование: python get_firebase_env.py
"""

import json
import os
import base64

def get_firebase_env_vars():
    """Читает Firebase ключ и возвращает отдельные переменные окружения"""
    
    # Путь к Firebase ключу
    firebase_key_path = "quizit-57a37-firebase-adminsdk-fbsvc-fd321561cc.json"
    
    if not os.path.exists(firebase_key_path):
        print(f"❌ Файл {firebase_key_path} не найден!")
        print("Убедитесь, что вы запускаете скрипт из директории Back/")
        return None
    
    try:
        # Читаем JSON файл
        with open(firebase_key_path, 'r', encoding='utf-8') as f:
            firebase_data = json.load(f)
        
        print("✅ Firebase ключ успешно прочитан!")
        print("\n📋 Добавьте эти переменные окружения в вашу платформу хостинга:\n")
        
        # Кодируем длинные значения в base64 чтобы уложиться в лимит
        for key, value in firebase_data.items():
            value_str = str(value) if value else ""
            
            # Для private_key и других длинных значений используем base64
            if len(value_str) > 200:
                encoded = base64.b64encode(value_str.encode('utf-8')).decode('utf-8')
                print(f"FIREBASE_{key.upper()}_B64={encoded}")
            else:
                print(f"FIREBASE_{key.upper()}={value_str}")
        
        print("\n" + "="*80)
        print("📝 Альтернативный вариант: JSON строка (может быть слишком длинной):")
        print("="*80)
        firebase_json_string = json.dumps(firebase_data, separators=(',', ':'))
        if len(firebase_json_string) <= 255:
            print(f"\nFIREBASE_CREDENTIALS_JSON={firebase_json_string}")
        else:
            print(f"\n⚠️  JSON слишком длинный ({len(firebase_json_string)} символов)")
            print("Используйте base64 кодированные переменные выше")
        
        return firebase_data
        
    except json.JSONDecodeError as e:
        print(f"❌ Ошибка при чтении JSON файла: {e}")
        return None
    except Exception as e:
        print(f"❌ Неожиданная ошибка: {e}")
        return None

if __name__ == "__main__":
    get_firebase_env_vars()
