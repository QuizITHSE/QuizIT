import random
import string
from array import ArrayType

import websockets
import asyncio
import json
import datetime
from google.cloud import firestore
from google.oauth2 import service_account

creds = service_account.Credentials.from_service_account_file(
    "quizit-57a37-firebase-adminsdk-fbsvc-fd321561cc.json"
)
db = firestore.Client(credentials=creds, project=creds.project_id)

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






class Player:
    def __init__(self, ws_id, username="guest"):
        self.username = username
        self.websockets_id = ws_id
        self.uuid = None
        self.current_level = 0
        self.lobby = None

    def __eq__(self, other):
        return self.websockets_id == other

    def __str__(self):
        return str(self.websockets_id)


class Lobby_old:
    def __init__(self, player_1, player_2=None):
        self.player_1: Player = player_1
        self.player_2: Player = player_2
        self.code = generate_room_code(6)
        self.capacity = 1
        self.round_p1 = 0
        self.round_p2 = 0
        self.attempts_1 = 0
        self.attempts_2 = 0
        self.words = []
        self.start_time = None

    def generate_words(self):
        with open("words.txt") as f:
            words = [word.rstrip("\n") for word in f.readlines()]
            self.words = random.sample(words, 5)


    async def broadcast(self, message):
        await self.player_1.websockets_id.send(message)
        await self.player_2.websockets_id.send(message)

async def next_round(lobby, cur_round, player):
    await asyncio.sleep(5)
    if player == 1 and lobby.round_p1 == cur_round:
        lobby.round_p1 += 1
        await lobby.player_1.websockets_id.send("5 secs has passed! Moving to the next round.")
        await lobby.player_1.websockets_id.send(f"Starting round: {lobby.round_p1}")
        if lobby.round_p1 < 4:
            asyncio.create_task(next_round(lobby, lobby.round_p1, 1))
        else:
            await lobby.broadcast(f"game is done for player: {player}!")
    elif player == 2 and lobby.round_p2 == cur_round:
        if lobby.round_p2 == cur_round:
            lobby.round_p2 += 1
            await lobby.player_2.websockets_id.send("5 secs has passed! Moving to the next round.")
            await lobby.player_2.websockets_id.send(f"Starting round: {lobby.round_p1}")
            if lobby.round_p2 < 4:
                asyncio.create_task(next_round(lobby, lobby.round_p2, 2))
            else:
                await lobby.broadcast(f"game is done for player: {player}!")





class User:
    def __init__(self, ws_id, user_id, user_info):
        print(user_info)
        self.ws_id = ws_id
        self.username = f"{user_info["name"]} {user_info["lastName"]}"
        self.teacher = user_info["isTeacher"]
        self.user_id = user_id


class Lobby:
    def __init__(self, host, quiz, game_id, code):
        self.host = host
        self.quiz = quiz
        self.game_id = game_id
        self.players_ids = []
        self.players = []
        self.score_board = {}
        self.code = code
        self.started = False
        self.currently_round = False
        self.current_question = -1
        self.answers = []



    def __eq__(self, other):
        return self.code

    async def connect(self, user: User):
        self.players_ids.append(user.user_id)
        self.players.append(user)
        self.score_board[user.user_id] = [user.username, 0]
        db.collection("games").document(self.game_id).update({
            "players": firestore.ArrayUnion(self.players_ids)
        })
        await self.host.ws_id.send(json.dumps({"players": [el.username for el in self.players]}))

    async def broadcast(self, message):
        for el in self.players:
            await el.ws_id.send(message)

    async def start_game(self):
        self.currently_round = True
        self.started = True
        self.current_question += 1
        question_obj = self.quiz["questions"][self.current_question]
        del question_obj["correct"]
        await self.host.ws_id.send(json.dumps(question_obj))
        await self.broadcast(json.dumps(question_obj))
        asyncio.create_task(on_question_timer_end(self.current_question, self, self.quiz["questions"][self.current_question]))

    async def save_answer(self, user: User, answer):
        self.answers.append({"user": user, "answer": answer})
        await self.host.send(json.dumps(json.dumps({"answers": len(self.answers)})))
        await user.ws_id.send("Saved! Waiting for end of round....")
        #TODO: remove the +1 only for testing
        if len(self.answers) == len(self.players) + 30:
            self.current_question += 1
            self.currently_round = False
            #TODO: next round handling


    async def serve_next(self):
        self.current_question += 1
        self.currently_round = False


async def on_question_timer_end(dispatch_round_number, lobby: Lobby, question):
    #TODO: remove only for debug
    #await asyncio.sleep(question["timeLimit"])
    await asyncio.sleep(30)
    lobby.currently_round = False
    info_for_host = {"right": 0, "wrong": 0, "by_answer": {}}
    for i in range(len(lobby.quiz["questions"][lobby.current_question]["options"])):
        info_for_host["by_answer"][i] = 0
    if lobby.current_question == dispatch_round_number:
        for answer_info in lobby.answers:
            info_for_host["by_answer"][answer_info["answer"]] += 1
            if answer_info["answer"] == lobby.quiz[lobby.current_question]["answer"]:
                await answer_info["user"].send(json.dumps({"correct": True}))
                info_for_host["right"] += 1
                #TODO: update score
            else:
                await answer_info["user"].send(json.dumps({"correct": False}))
    await lobby.host.ws_id.send(json.dumps(info_for_host))




LOBBIES = []
USERS = {}

def create_game(user: User, group_id):
    game_code = generate_unique_game_code(6)
    write_result, doc_ref = db.collection("games").add({
        "host": user.user_id, 
        "players": [], 
        "group_id": group_id, 
        "active": True, 
        "code": game_code
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
    await websocket.send("WELCOME! you have to auth first though...")
    USERS[websocket] = {"auth": False, "user": None, "lobby": None}
    print(USERS)
    try:
        # Handle incoming messages
        async for message in websocket:
            user_obj = USERS[websocket]
            message = json.loads(message)


            if user_obj["auth"] is False:
                await websocket.send("trying to auth you ahh")
                user = get_user_info(message["user_id"])
                if user:
                    user_obj["auth"] = True
                    user_obj["user"] = User(websocket, message["user_id"], user)
                    await websocket.send(f"yeah wsg wats the haps {user["name"]}")
                else:
                    await websocket.close(code=1008, reason="you ain't no hacker BYE!")

            if user_obj["user"].teacher and message.get("quiz") and not user_obj["lobby"]:
                await websocket.send("creating...")
                code, game_id = create_game(user_obj["user"], message.get("group"))
                quiz = fetch_quiz(message.get("quiz"))
                user_obj["lobby"] = Lobby(user_obj["user"], quiz, game_id, code)
                LOBBIES.append(user_obj["lobby"])
                await websocket.send(f"done! room code: {code}")
                await websocket.send(f"quiz questions: {quiz["questions"]}")
                print(LOBBIES)
                print(USERS)
            if message.get("code") and not user_obj["lobby"]:
                await websocket.send("joining...")
                lobby_index = LOBBIES.index(message.get("code"))
                await LOBBIES[lobby_index].connect(user_obj["user"])
                user_obj["lobby"] = LOBBIES[lobby_index]
                await websocket.send("Joined! Waiting for start")
                print(LOBBIES[lobby_index].quiz["title"])

            if message.get("start") and user_obj["lobby"].host == user_obj["user"]:
                await user_obj["lobby"].start_game()

            print(message, user_obj)

            if message.get("answer") and user_obj["lobby"]:
                await user_obj["lobby"].save_answer(user_obj["user"], message.get("answer"))




    except websockets.exceptions.ConnectionClosed:
        # Log when the client disconnects
        print(f"Connection closed: {websocket.remote_address}")


async def main():
    """Main entry point for the WebSocket server."""
    start_server = await websockets.serve(main_handler, "localhost", 8765)
    print("WebSocket server started on ws://localhost:8765")
    await start_server.wait_closed()

# Use asyncio.run() to start the event loop
if __name__ == "__main__":
    asyncio.run(main())