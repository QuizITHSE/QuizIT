import random
import string
import os
from array import ArrayType

import websockets
import asyncio
import json
import datetime
from google.cloud import firestore
from google.oauth2 import service_account

def get_firestore_client():
    # Look for Firebase key file in order of priority
    # 1. Check environment variable
    firebase_key_path = os.getenv('FIREBASE_KEY_PATH')
    if firebase_key_path and os.path.exists(firebase_key_path):
        creds = service_account.Credentials.from_service_account_file(firebase_key_path)
        return firestore.Client(credentials=creds, project=creds.project_id)
    
    # 2. Check default location in app directory
    default_firebase_key = "quizit-57a37-firebase-adminsdk-fbsvc-fd321561cc.json"
    if os.path.exists(default_firebase_key):
        print(f"Using local Firebase key file: {default_firebase_key}")
        creds = service_account.Credentials.from_service_account_file(default_firebase_key)
        return firestore.Client(credentials=creds, project=creds.project_id)
    
    # 3. Try default credentials (for GCP environments)
    try:
        print("Using default Firebase credentials")
        return firestore.Client()
    except Exception as e:
        print(f"Error initializing Firebase: {e}")
        print("Please provide Firebase key file via FIREBASE_KEY_PATH or place it in the app directory")
        raise

db = get_firestore_client()

def generate_room_code(length: int) -> str:
    """
    Generates a random string consisting only of digits (0-9) of a given length.
    """
    if length <= 0:
        return ""
    digits = string.digits  # '0123456789'
    code = "".join(random.choices(digits, k=length))
    while code in [lobby.code for lobby in LOBBIES]:
        code = "".join(random.choices(digits, k=length))
    return code


def generate_unique_game_code(length: int = 6) -> str:
    if length <= 0:
        return ""
    
    characters = string.ascii_uppercase + string.digits
    
    while True:
        code = "".join(random.choices(characters, k=length))
        
        games_ref = db.collection("games")
        query = games_ref.where("code", "==", code).limit(1)
        docs = query.get()
        
        if not docs:
            return code


def get_user_info(user_id):
    doc = db.collection("users").document(user_id).get()
    if doc.exists:
        return doc.to_dict()
    else:
        return None



class User:
    def __init__(self, ws_id, user_id, user_info):
        print(user_info)
        self.ws_id = ws_id
        self.username = f"{user_info['name']} {user_info['lastName']}"
        self.teacher = user_info["isTeacher"]
        self.user_id = user_id


class Lobby:
    def __init__(self, host, quiz, game_id, code, game_type=None):
        self.host = host
        self.quiz = quiz
        self.game_id = game_id
        self.players_ids = []
        self.players = []
        self.score_board = {}
        self.code = code
        self.started = False
        self.currently_round = False
        self.finished = False  # Track if game has been completed
        self.current_question = -1
        self.answers = []
        self.results = {}  # Store final results for each student
        self.game_type = game_type or {}  # Game mode: normal, lockdown, or tab_tracking
        self.tab_switches = {}  # Track tab switches for each user {user_id: count}
        self.user_answers = {}  # Track all answers for each user {user_id: [{question_num, answer, correct, points}]}



    def __eq__(self, other):
        return self.code

    async def connect(self, user: User):
        self.players_ids.append(user.user_id)
        self.players.append(user)
        self.score_board[user.user_id] = [user.username, 0]
        self.tab_switches[user.user_id] = 0  # Initialize tab switch counter
        self.user_answers[user.user_id] = []  # Initialize answers list for user
        db.collection("games").document(self.game_id).update({
            "players": firestore.ArrayUnion(self.players_ids)
        })
        await self.host.ws_id.send(json.dumps({"players": [el.username for el in self.players]}))

    async def broadcast(self, message):
        for el in self.players:
            await el.ws_id.send(message)

    async def start_game(self):
        print(self.quiz)
        self.currently_round = True
        self.started = True
        self.current_question += 1
        question_obj = self.quiz["questions"][self.current_question].copy()
        question_points = question_obj.get("point", 1)
        del question_obj["correct"]
        
        # Add points info to question object
        question_obj["points"] = question_points
        
        await self.host.ws_id.send(json.dumps(question_obj))
        await self.broadcast(json.dumps(question_obj))
        asyncio.create_task(on_question_timer_end(self.current_question, self, self.quiz["questions"][self.current_question]))

    async def save_answer(self, user: User, answer):
        if not self.currently_round:
            await user.ws_id.send(json.dumps({"type": "error", "message": "Round is not active!"}))
            return
        
        # Check if user already answered this question
        for existing_answer in self.answers:
            if existing_answer["user"].user_id == user.user_id:
                await user.ws_id.send(json.dumps({"type": "error", "message": "You already answered this question!"}))
                return
        
        self.answers.append({"user": user, "answer": answer})
        
        # Check if answer is correct and update score immediately
        current_q = self.quiz["questions"][self.current_question]
        question_type = current_q.get("type", "single")
        
        # For text questions, get the correct answer from textAnswer field
        if question_type == "text":
            correct_answer = current_q.get("textAnswer", current_q.get("correct", ""))
            is_correct = str(answer).strip().lower() == str(correct_answer).strip().lower()
        else:
            correct_answer = current_q["correct"]
            is_correct = answer == correct_answer
            
        question_points = current_q.get("point", 1)
        points_earned = question_points if is_correct else 0
        
        if is_correct:
            self.score_board[user.user_id][1] += question_points
            await user.ws_id.send(json.dumps({"correct": True, "points_earned": question_points}))
        else:
            await user.ws_id.send(json.dumps({"correct": False, "points_earned": 0}))
        
        # Store the answer details for this user
        answer_record = {
            "question_number": self.current_question,
            "question_text": current_q.get("question", ""),
            "question_type": current_q.get("type", "single"),
            "options": current_q.get("options", []),
            "user_answer": answer,
            "correct_answer": correct_answer,
            "is_correct": is_correct,
            "points_earned": points_earned,
            "possible_points": question_points,
            "explanation": current_q.get("explanation", "")
        }
        self.user_answers[user.user_id].append(answer_record)
        print(f"📝 Recorded answer for {user.username} on Q{self.current_question}: {'✓' if is_correct else '✗'} ({points_earned}/{question_points} pts)")
        
        # Send updated scoreboard to all players immediately
        await self.broadcast(json.dumps({"type": "scoreboard", "data": self.score_board}))
        
        await self.host.ws_id.send(json.dumps({"answers": len(self.answers)}))
        await user.ws_id.send(json.dumps({"type": "answer_saved", "message": "Saved! Waiting for end of round...."}))
        
        # Check if everyone has answered
        if len(self.answers) == len(self.players):
            await self.finish_round()

    async def finish_round(self):
        """Finish current round and send results to all players"""
        self.currently_round = False
        info_for_host = {"right": 0, "wrong": 0, "by_answer": {}}
        
        current_q = self.quiz["questions"][self.current_question]
        question_type = current_q.get("type", "single")
        
        # For text questions, get the correct answer from textAnswer field
        if question_type == "text":
            correct_answer = current_q.get("textAnswer", current_q.get("correct", ""))
        else:
            correct_answer = current_q["correct"]
        
        # Initialize answer counts (skip for text questions)
        if question_type != "text":
            for i in range(len(self.quiz["questions"][self.current_question]["options"])):
                info_for_host["by_answer"][i] = 0
        
        # Process all answers for statistics and send correct/incorrect to players
        for answer_info in self.answers:
            answer = answer_info["answer"]
            # Handle both single answers and multiple choice answers
            if isinstance(answer, list):
                # For multiple choice, we'll count each selected option
                for selected_answer in answer:
                    if selected_answer in info_for_host["by_answer"]:
                        info_for_host["by_answer"][selected_answer] += 1
            else:
                # For single choice answers
                if answer in info_for_host["by_answer"]:
                    info_for_host["by_answer"][answer] += 1
            
            # Check if answer is correct and send to player
            if question_type == "text":
                is_correct = str(answer).strip().lower() == str(correct_answer).strip().lower()
            else:
                is_correct = answer == correct_answer
                
            if is_correct:
                info_for_host["right"] += 1

        # Calculate wrong answers
        info_for_host["wrong"] = len(self.answers) - info_for_host["right"]
        
        # Add question points info for host
        question_points = self.quiz["questions"][self.current_question].get("point", 1)
        info_for_host["question_points"] = question_points
        info_for_host["total_possible_points"] = question_points * len(self.players)
        info_for_host["total_earned_points"] = info_for_host["right"] * question_points
        
        # Send results to host
        await self.host.ws_id.send(json.dumps({"type": "round_results", "data": info_for_host}))
        
        # Send round results with answer correctness and scoreboard to all players
        answered_user_ids = set()
        for answer_info in self.answers:
            answer = answer_info["answer"]
            # Check correctness using appropriate method for question type
            if question_type == "text":
                is_correct = str(answer).strip().lower() == str(correct_answer).strip().lower()
            else:
                is_correct = answer == correct_answer
            answered_user_ids.add(answer_info["user"].user_id)
            
            await answer_info["user"].ws_id.send(json.dumps({
                "type": "round_ended",
                "correct": is_correct,
                "scoreboard": self.score_board,
                "question_points": question_points
            }))
        
        # Notify players who did not answer in time and record missed answers
        for player in self.players:
            if player.user_id not in answered_user_ids:
                await player.ws_id.send(json.dumps({
                    "type": "round_ended",
                    "correct": False,
                    "missed": True,
                    "message": "Время вышло! Вы не успели ответить на вопрос.",
                    "scoreboard": self.score_board,
                    "question_points": question_points
                }))
                
                # Record missed answer
                current_q = self.quiz["questions"][self.current_question]
                question_type = current_q.get("type", "single")
                # Get correct answer using appropriate field for question type
                if question_type == "text":
                    correct_answer = current_q.get("textAnswer", current_q.get("correct", ""))
                else:
                    correct_answer = current_q["correct"]
                    
                answer_record = {
                    "question_number": self.current_question,
                    "question_text": current_q.get("question", ""),
                    "question_type": current_q.get("type", "single"),
                    "options": current_q.get("options", []),
                    "user_answer": None,
                    "correct_answer": correct_answer,
                    "is_correct": False,
                    "points_earned": 0,
                    "possible_points": question_points,
                    "missed": True,
                    "explanation": current_q.get("explanation", "")
                }
                self.user_answers[player.user_id].append(answer_record)
                print(f"⏱️ Recorded MISSED answer for {player.username} on Q{self.current_question}")
        
        # Clear answers for next question
        self.answers = []

    async def start_next_round(self):
        """Start the next round (only called by host)"""
        if self.current_question >= len(self.quiz["questions"]) - 1:
            # This is the last question, don't auto-finish game
            await self.host.ws_id.send(json.dumps({"type": "last_question_completed", "message": "All questions completed! Use 'show_results' to view final results."}))
            return
        
        self.current_question += 1
        self.currently_round = True
        question_obj = self.quiz["questions"][self.current_question].copy()
        question_points = question_obj.get("point", 1)
        del question_obj["correct"]
        
        # Add points info to question object
        question_obj["points"] = question_points
        
        await self.host.ws_id.send(json.dumps(question_obj))
        await self.broadcast(json.dumps(question_obj))
        asyncio.create_task(on_question_timer_end(self.current_question, self, self.quiz["questions"][self.current_question]))

    async def finish_game(self):
        """Finish the game and send final results"""
        self.finished = True  # Mark game as finished
        
        # Sort players by score (descending order)
        sorted_players = sorted(self.score_board.items(), key=lambda x: x[1][1], reverse=True)
        
        # Create leaderboard with placements
        leaderboard = []
        for place, (user_id, [username, score]) in enumerate(sorted_players, 1):
            leaderboard.append({
                "place": place,
                "username": username,
                "score": score,
                "user_id": user_id,
                "tab_switches": self.tab_switches.get(user_id, 0)
            })
        
        # Populate results object for each student with their score info
        for user_id, [username, score] in self.score_board.items():
            placement = next((p["place"] for p in leaderboard if p["user_id"] == user_id), len(leaderboard))
            
            # Calculate answer statistics
            user_answer_list = self.user_answers.get(user_id, [])
            correct_count = sum(1 for ans in user_answer_list if ans.get("is_correct", False))
            missed_count = sum(1 for ans in user_answer_list if ans.get("missed", False))
            wrong_count = len(user_answer_list) - correct_count - missed_count
            
            self.results[user_id] = {
                "user_id": user_id,
                "username": username,
                "score": score,
                "placement": placement,
                "total_questions": len(self.quiz["questions"]),
                "total_players": len(leaderboard),
                "tab_switches": self.tab_switches.get(user_id, 0),
                "answers": user_answer_list,
                "correct_answers": correct_count,
                "wrong_answers": wrong_count,
                "missed_answers": missed_count
            }
        
        # Send individual placement to each player
        for player in self.players:
            player_placement = next((p for p in leaderboard if p["user_id"] == player.user_id), None)
            if player_placement:
                await player.ws_id.send(json.dumps({
                    "type": "game_finished",
                    "placement": player_placement["place"],
                    "score": player_placement["score"],
                    "total_players": len(leaderboard)
                }))
        
        # Send full leaderboard to host (include tab switches if tracking was enabled)
        await self.host.ws_id.send(json.dumps({
            "type": "game_finished",
            "leaderboard": leaderboard,
            "total_questions": len(self.quiz["questions"]),
            "total_players": len(leaderboard),
            "game_mode": self.game_type.get("mode", "normal")
        }))
        
        # Mark game as inactive and finished in Firebase
        try:
            db.collection("games").document(self.game_id).update({
                "active": False,
                "game_finished": True,
                "finished_at": firestore.SERVER_TIMESTAMP,
                "final_results": leaderboard,
                "game_mode": self.game_type.get("mode", "normal")
            })
            
            # Save individual student results to subcollection
            for user_id, result_data in self.results.items():
                db.collection("games").document(self.game_id).collection("results").document(user_id).set(result_data)
                answers_count = len(result_data.get("answers", []))
                print(f"  ✓ Saved results for {result_data['username']}: {answers_count} answers recorded")
            
            print(f"Game {self.game_id} marked as inactive and finished in Firebase")
            print(f"Student results saved to /games/{self.game_id}/results/")
        except Exception as e:
            print(f"Error updating Firebase: {e}")

    async def serve_next(self):
        self.current_question += 1
        self.currently_round = False


async def on_question_timer_end(dispatch_round_number, lobby: Lobby, question):
    await asyncio.sleep(question["timeLimit"])
    
    # Only finish round if timer expired and round is still active
    if lobby.currently_round and lobby.current_question == dispatch_round_number:
        await lobby.finish_round()
        
        # Check if this was the last question
        if lobby.current_question >= len(lobby.quiz["questions"]) - 1:
            # Last question completed, wait for host to show results
            await lobby.host.ws_id.send(json.dumps({"type": "last_question_completed", "message": "All questions completed! Use 'show_results' to view final results."}))




LOBBIES = []
USERS = {}

async def cleanup_user(websocket):
    """Clean up user data when WebSocket connection is closed"""
    if websocket in USERS:
        user_obj = USERS[websocket]
        user = user_obj.get("user")
        lobby = user_obj.get("lobby")
        
        if user and lobby:
            # Check if this is the host disconnecting
            is_host = lobby.host == user
            
            # Remove user from lobby
            if user in lobby.players:
                lobby.players.remove(user)
                if user.user_id in lobby.players_ids:
                    lobby.players_ids.remove(user.user_id)
                if user.user_id in lobby.score_board:
                    del lobby.score_board[user.user_id]
                if user.user_id in lobby.tab_switches:
                    del lobby.tab_switches[user.user_id]
                if user.user_id in lobby.user_answers:
                    del lobby.user_answers[user.user_id]
            
            # Handle host disconnection
            if is_host:
                # If host disconnects, end the game for all players
                if lobby.players:
                    await lobby.broadcast(json.dumps({
                        "type": "host_disconnected", 
                        "message": "Host has left the game. The game is ending.",
                        "username": user.username
                    }))
                
                # Check if game was finished or not
                if lobby.finished:
                    # Game was completed - keep results in Firebase, just remove from local LOBBIES
                    print(f"✅ Game {lobby.game_id} was completed. Keeping results in Firebase.")
                else:
                    # Game was not completed - delete from Firebase
                    try:
                        # First, check if there are any results subcollection documents to delete
                        results_ref = db.collection("games").document(lobby.game_id).collection("results")
                        results_docs = results_ref.stream()
                        deleted_results = 0
                        for doc in results_docs:
                            doc.reference.delete()
                            deleted_results += 1
                        
                        if deleted_results > 0:
                            print(f"Deleted {deleted_results} result documents from game {lobby.game_id}")
                        
                        # Delete the main game document
                        db.collection("games").document(lobby.game_id).delete()
                        print(f"🗑️ Deleted incomplete game {lobby.game_id} from Firebase due to host disconnection")
                    except Exception as e:
                        print(f"❌ Error deleting game from Firebase: {e}")
                
                # Remove lobby from LOBBIES (always, whether finished or not)
                if lobby in LOBBIES:
                    LOBBIES.remove(lobby)
                    print(f"Removed lobby from memory: {lobby.code}")
            else:
                # Regular player disconnection
                if lobby.players:  # If there are still players left
                    await lobby.broadcast(json.dumps({
                        "type": "player_disconnected", 
                        "message": f"{user.username} has left the game",
                        "username": user.username
                    }))
                    
                    # Update players list for host
                    if lobby.host and lobby.host.ws_id:
                        await lobby.host.ws_id.send(json.dumps({
                            "type": "players_updated",
                            "players": [player.username for player in lobby.players]
                        }))
                
                # If lobby is empty, remove it
                if not lobby.players:
                    if lobby in LOBBIES:
                        LOBBIES.remove(lobby)
                        print(f"Removed empty lobby: {lobby.code}")
        
        # Remove user from USERS
        del USERS[websocket]
        print(f"Cleaned up user data for: {websocket.remote_address}")

def create_game(user: User, group_id, game_type, quiz_id):
    game_code = generate_unique_game_code(6)
    write_result, doc_ref = db.collection("games").add({
        "host": user.user_id, 
        "players": [], 
        "group_id": group_id, 
        "active": True, 
        "game_finished": False,
        "code": game_code,
        "type": game_type,
        "quiz_id": quiz_id
    })
    if write_result:
        return game_code, doc_ref.id


def fetch_quiz(quiz_id):
    doc = db.collection("quizes").document(quiz_id).get()
    final = doc.to_dict().copy()
    final["questions"] = []
    for question in doc.to_dict()["questions"]:
        q_doc = db.collection("questions").document(question).get()
        final["questions"].append(q_doc.to_dict())
    return final


async def main_handler(websocket):
    """Main WebSocket handler."""
    # Log when a client connects
    print(f"New connection from: {websocket.remote_address}")
    await websocket.send(json.dumps({"type": "welcome", "message": "WELCOME! you have to auth first though..."}))
    USERS[websocket] = {"auth": False, "user": None, "lobby": None}
    print(USERS)
    try:
        # Handle incoming messages
        async for message in websocket:
            user_obj = USERS[websocket]
            message = json.loads(message)


            if user_obj["auth"] is False:
                await websocket.send(json.dumps({"type": "auth_attempt", "message": "trying to auth you ahh"}))
                user = get_user_info(message["user_id"])
                if user:
                    user_obj["auth"] = True
                    user_obj["user"] = User(websocket, message["user_id"], user)
                    await websocket.send(json.dumps({"type": "auth_success", "message": f"yeah wsg wats the haps {user['name']}"}))
                else:
                    await websocket.close(code=1008, reason="you ain't no hacker BYE!")

            if user_obj["user"].teacher and "quiz" in message and not user_obj["lobby"]:
                await websocket.send(json.dumps({"type": "creating_game", "message": "creating..."}))
                game_type = message.get("game_type", {})
                quiz_id = message.get("quiz")
                code, game_id = create_game(user_obj["user"], message.get("group"), game_type, quiz_id)
                print(code, game_id)
                quiz = fetch_quiz(quiz_id)
                user_obj["lobby"] = Lobby(user_obj["user"], quiz, game_id, code, game_type)
                LOBBIES.append(user_obj["lobby"])
                await websocket.send(json.dumps({"type": "game_created", "message": f"done! room code: {code}", "code": code}))
                await websocket.send(json.dumps({"type": "quiz_info", "message": f"quiz questions: {quiz['questions']}", "questions": quiz["questions"]}))
                print(LOBBIES)
                print(USERS)

            if "code" in message and not user_obj["lobby"]:
                await websocket.send(json.dumps({"type": "joining", "message": "joining..."}))
                
                # Find lobby by code
                target_lobby = None
                for lobby in LOBBIES:
                    if lobby.code == message.get("code"):
                        target_lobby = lobby
                        break
                
                if target_lobby:
                    await target_lobby.connect(user_obj["user"])
                    user_obj["lobby"] = target_lobby
                    await websocket.send(json.dumps({
                        "type": "joined", 
                        "message": "Joined! Waiting for start", 
                        "game_settings": {
                            "mode": target_lobby.game_type.get("mode", "normal"),
                            "disable_copy": target_lobby.game_type.get("disable_copy", False)
                        }
                    }))
                    print(target_lobby.quiz["title"])
                else:
                    await websocket.send(json.dumps({"type": "error", "message": "Invalid room code!"}))

            if "start" in message and user_obj["lobby"].host == user_obj["user"]:
                await user_obj["lobby"].start_game()

            if "next" in message and user_obj["lobby"].host == user_obj["user"]:
                await user_obj["lobby"].start_next_round()

            if "show_results" in message and user_obj["lobby"].host == user_obj["user"]:
                await user_obj["lobby"].finish_game()

            print(f"📨 Received message: {message}")
            print(f"👤 User object state: auth={user_obj.get('auth')}, has_user={bool(user_obj.get('user'))}, has_lobby={bool(user_obj.get('lobby'))}")
            
            if "answer" in message and user_obj.get("lobby"):
                print("saving answer")
                await user_obj["lobby"].save_answer(user_obj["user"], message.get("answer"))
            
            # Handle tab switch reports
            if "report" in message:
                print(f"🔍 Report detected in message: {message.get('report')}")
                
                if not user_obj.get("lobby"):
                    print(f"⚠️ User has no lobby")
                elif not user_obj.get("user"):
                    print(f"⚠️ User not authenticated")
                elif message.get("report") != "switched_tabs":
                    print(f"⚠️ Unknown report type: {message.get('report')}")
                else:
                    print(f"🚨 PROCESSING TAB SWITCH REPORT from {user_obj['user'].username}")
                    lobby = user_obj["lobby"]
                    user = user_obj["user"]
                    game_mode = lobby.game_type.get("mode", "normal")
                    print(f"🎮 Game mode: {game_mode}")
                    
                    if game_mode == "tab_tracking":
                        # Track tab switches
                        if user.user_id in lobby.tab_switches:
                            lobby.tab_switches[user.user_id] += 1
                        else:
                            lobby.tab_switches[user.user_id] = 1
                        
                        print(f"📊 Tab switch recorded for {user.username}: {lobby.tab_switches[user.user_id]} times")
                        
                        # Notify host about tab switch
                        try:
                            await lobby.host.ws_id.send(json.dumps({
                                "type": "tab_switch_report",
                                "username": user.username,
                                "user_id": user.user_id,
                                "total_switches": lobby.tab_switches[user.user_id]
                            }))
                            print(f"✅ Notification sent to host")
                        except Exception as e:
                            print(f"❌ Error notifying host: {e}")
                        
                        # Acknowledge to the student
                        try:
                            await user.ws_id.send(json.dumps({
                                "type": "tab_switch_recorded",
                                "message": "Переключение вкладки зафиксировано"
                            }))
                            print(f"✅ Acknowledgment sent to student")
                        except Exception as e:
                            print(f"❌ Error acknowledging student: {e}")
                    
                    elif game_mode == "lockdown":
                        # Remove player in lockdown mode
                        print(f"🔒 LOCKDOWN VIOLATION: Removing {user.username} from game")
                        
                        # Notify the player they are being removed
                        try:
                            await user.ws_id.send(json.dumps({
                                "type": "kicked",
                                "reason": "lockdown_violation",
                                "message": "Вы были удалены из игры за нарушение режима блокировки (выход из полноэкранного режима)"
                            }))
                        except Exception as e:
                            print(f"❌ Error notifying kicked player: {e}")
                        
                        # Notify host about the violation
                        try:
                            await lobby.host.ws_id.send(json.dumps({
                                "type": "player_kicked",
                                "username": user.username,
                                "user_id": user.user_id,
                                "reason": "Нарушение режима блокировки"
                            }))
                        except Exception as e:
                            print(f"❌ Error notifying host: {e}")
                        
                        # Remove from lobby
                        if user in lobby.players:
                            lobby.players.remove(user)
                        if user.user_id in lobby.players_ids:
                            lobby.players_ids.remove(user.user_id)
                        if user.user_id in lobby.score_board:
                            del lobby.score_board[user.user_id]
                        if user.user_id in lobby.tab_switches:
                            del lobby.tab_switches[user.user_id]
                        if user.user_id in lobby.user_answers:
                            del lobby.user_answers[user.user_id]
                        
                        print(f"🗑️ Removed {user.username} from lobby data structures")
                        
                        # Notify remaining players
                        try:
                            await lobby.broadcast(json.dumps({
                                "type": "player_removed",
                                "username": user.username,
                                "reason": "Нарушение режима блокировки"
                            }))
                        except Exception as e:
                            print(f"❌ Error broadcasting removal: {e}")
                        
                        # Update host's player list
                        try:
                            await lobby.host.ws_id.send(json.dumps({
                                "type": "players_updated",
                                "players": [player.username for player in lobby.players]
                            }))
                        except Exception as e:
                            print(f"❌ Error updating host player list: {e}")
                        
                        # Close the user's connection
                        try:
                            await websocket.close(code=1008, reason="Lockdown mode violation")
                            print(f"🔌 Closed websocket connection")
                        except Exception as e:
                            print(f"❌ Error closing websocket: {e}")
                        
                        # Clean up user data
                        if websocket in USERS:
                            del USERS[websocket]
                            print(f"🗑️ Cleaned up user data from USERS dict")
                    
                    else:
                        print(f"⚠️ Game mode '{game_mode}' does not require tracking")




    except (websockets.exceptions.ConnectionClosed, websockets.exceptions.WebSocketException, Exception) as e:
        # Log when the client disconnects with error
        print(f"Connection closed with error: {websocket.remote_address}, reason: {e}")
    finally:
        # Always clean up user data when connection closes (normal or error)
        print(f"Cleaning up connection: {websocket.remote_address}")
        await cleanup_user(websocket)


async def main():
    """Main entry point for the WebSocket server."""
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 8765))
    
    start_server = await websockets.serve(main_handler, host, port)
    print(f"WebSocket server started on ws://{host}:{port}")
    await start_server.wait_closed()

# Use asyncio.run() to start the event loop
if __name__ == "__main__":
    asyncio.run(main())