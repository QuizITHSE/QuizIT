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



LOBBIES = []
USERS = {

}

class User:
    def __init__(self, ws_id, user_id, user_info):
        print(user_info)
        self.ws_id = ws_id
        self.username = f"{user_info["name"]} {user_info["lastName"]}"
        self.teacher = user_info["isTeacher"]
        self.user_id = user_id


class Lobby:
    def __init__(self, host, quiz, game_id):
        self.host = host
        self.quiz = quiz
        self.game_id = game_id
        self.players = []


    def connect(self, user: User):
        db.collection("games").document(self.game_id).update({
            "players": firestore.ArrayUnion(user.user_id)
        })

    async def broadcast(self, message):
        for el in self.players:
            await el.ws_id.send(message)


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
        return doc_ref.id


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
                game = create_game(user_obj["user"], message.get("group"))
                quiz = fetch_quiz(message.get("quiz"))
                user_obj["lobby"] = Lobby(user_obj["user"], quiz, game)
                await websocket.send(f"done! room code: {game}")
                await websocket.send(f"quiz questions: {quiz["questions"]}")







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