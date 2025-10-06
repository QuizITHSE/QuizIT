#!/usr/bin/env python3
"""
Скрипт для конвертации Firebase ключа в переменную окружения
Использование: python get_firebase_env.py
"""

import json
import os

def get_firebase_env_var():
    """Читает Firebase ключ и возвращает строку для переменной окружения"""
    
    # Путь к Firebase ключу
    firebase_key_path = "Back/quizit-57a37-firebase-adminsdk-fbsvc-fd321561cc.json"
    
    if not os.path.exists(firebase_key_path):
        print(f"❌ Файл {firebase_key_path} не найден!")
        print("Убедитесь, что вы запускаете скрипт из корневой директории проекта")
        return None
    
    try:
        # Читаем JSON файл
        with open(firebase_key_path, 'r', encoding='utf-8') as f:
            firebase_data = json.load(f)
        
        # Конвертируем в строку
        firebase_json_string = json.dumps(firebase_data, separators=(',', ':'))
        
        print("✅ Firebase ключ успешно прочитан!")
        print("\n📋 Добавьте эту переменную окружения в вашу платформу хостинга:")
        print(f"FIREBASE_CREDENTIALS_JSON={firebase_json_string}")
        
        print("\n💡 Или скопируйте только значение (без FIREBASE_CREDENTIALS_JSON=):")
        print(firebase_json_string)
        
        return firebase_json_string
        
    except json.JSONDecodeError as e:
        print(f"❌ Ошибка при чтении JSON файла: {e}")
        return None
    except Exception as e:
        print(f"❌ Неожиданная ошибка: {e}")
        return None

if __name__ == "__main__":
    get_firebase_env_var()
