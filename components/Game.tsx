
import React, { useState, useEffect, useCallback } from 'react';
import { ref, onValue, update, remove, get } from 'firebase/database';
import { db } from '../firebase';
import { UserInfo, Room, Player } from '../types';
import { ChevronLeft, Trophy, User as UserIcon, HelpCircle, Star } from 'lucide-react';

interface GameProps {
  roomId: string;
  user: UserInfo;
  onLeave: () => void;
}

const Game: React.FC<GameProps> = ({ roomId, user, onLeave }) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [localBoard, setLocalBoard] = useState<number[][]>([]);
  const [bingoCount, setBingoCount] = useState(0);

  // Initialize board for current player
  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`);
    
    // Check if player is already in room
    get(roomRef).then((snapshot) => {
      const data = snapshot.val();
      if (data && !data.players[user.uid]) {
        // Join room if not already there
        const updates: any = {};
        updates[`players/${user.uid}`] = {
          uid: user.uid,
          name: user.displayName || '익명친구',
          photoURL: user.photoURL,
          board: generateBoard(),
          lines: 0,
          isReady: true,
        };
        update(roomRef, updates);
      }
    });

    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRoom(data);
        if (data.players[user.uid]) {
          setLocalBoard(data.players[user.uid].board);
        }
      } else {
        onLeave();
      }
    });

    return () => unsubscribe();
  }, [roomId, user.uid, onLeave]);

  // Generate 5x5 random board (1-25)
  const generateBoard = () => {
    const nums = Array.from({ length: 25 }, (_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    const board: number[][] = [];
    for (let i = 0; i < 5; i++) {
      board.push(nums.slice(i * 5, i * 5 + 5));
    }
    return board;
  };

  // Bingo check logic
  const checkBingo = useCallback((picked: number[]) => {
    if (localBoard.length === 0) return 0;
    
    let count = 0;
    // Rows
    for (let r = 0; r < 5; r++) {
      if (localBoard[r].every(num => picked.includes(num))) count++;
    }
    // Cols
    for (let c = 0; c < 5; c++) {
      let full = true;
      for (let r = 0; r < 5; r++) {
        if (!picked.includes(localBoard[r][c])) {
          full = false;
          break;
        }
      }
      if (full) count++;
    }
    // Diagonals
    let diag1 = true;
    let diag2 = true;
    for (let i = 0; i < 5; i++) {
      if (!picked.includes(localBoard[i][i])) diag1 = false;
      if (!picked.includes(localBoard[i][4 - i])) diag2 = false;
    }
    if (diag1) count++;
    if (diag2) count++;

    return count;
  }, [localBoard]);

  // Update bingo lines whenever picked numbers change
  useEffect(() => {
    if (room && room.status === 'playing') {
      const lines = checkBingo(room.pickedNumbers || []);
      setBingoCount(lines);
      
      // Sync lines to database
      if (room.players[user.uid] && room.players[user.uid].lines !== lines) {
        const updates: any = {};
        updates[`players/${user.uid}/lines`] = lines;
        
        // Check for victory (5 lines)
        if (lines >= 5 && !room.winner) {
          updates['winner'] = user.uid;
          updates['status'] = 'finished';
        }
        
        update(ref(db, `rooms/${roomId}`), updates);
      }
    }
  }, [room?.pickedNumbers, room?.status, checkBingo, user.uid, roomId]);

  const handleStartGame = async () => {
    if (!room) return;
    const playerIds = Object.keys(room.players);
    if (playerIds.length < 2) {
      alert('최소 2명의 플레이어가 필요해요!');
      return;
    }

    await update(ref(db, `rooms/${roomId}`), {
      status: 'playing',
      currentTurn: room.hostId, // Host always starts
      pickedNumbers: [],
      winner: null
    });
  };

  const handlePickNumber = async (num: number) => {
    if (!room || room.status !== 'playing' || room.currentTurn !== user.uid) return;
    if (room.pickedNumbers?.includes(num)) return;

    const newPicked = [...(room.pickedNumbers || []), num];
    const playerIds = Object.keys(room.players);
    const currentIndex = playerIds.indexOf(user.uid);
    const nextTurn = playerIds[(currentIndex + 1) % playerIds.length];

    await update(ref(db, `rooms/${roomId}`), {
      pickedNumbers: newPicked,
      currentTurn: nextTurn
    });
  };

  const handleLeave = async () => {
    if (room) {
      const players = { ...room.players };
      delete players[user.uid];
      
      if (Object.keys(players).length === 0) {
        await remove(ref(db, `rooms/${roomId}`));
      } else {
        const updates: any = {};
        updates['players'] = players;
        if (room.hostId === user.uid) {
          updates['hostId'] = Object.keys(players)[0];
        }
        await update(ref(db, `rooms/${roomId}`), updates);
      }
    }
    onLeave();
  };

  if (!room) return null;

  return (
    <div className="min-h-screen bg-pink-50 flex flex-col items-center p-4">
      {/* Game Header */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-6">
        <button
          onClick={handleLeave}
          className="flex items-center gap-1 text-pink-500 font-bold hover:bg-white px-4 py-2 rounded-2xl transition-all"
        >
          <ChevronLeft size={24} />
          나가기
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-3xl font-extrabold text-pink-500 drop-shadow-sm">{room.name}</h1>
          <p className="text-gray-400 text-sm">참가 코드: {roomId.slice(-5)}</p>
        </div>
        <div className="w-24"></div> {/* Spacer */}
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Sidebar: Player List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-3xl p-6 shadow-xl border-4 border-white">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <UserIcon className="text-pink-400" />
              참가자 명단
            </h3>
            <div className="space-y-3">
              {/* Added explicit cast to Player[] for room.players values to fix 'unknown' type errors */}
              {(Object.values(room.players) as Player[]).map((p) => (
                <div key={p.uid} className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${
                  room.currentTurn === p.uid ? 'border-pink-300 bg-pink-50' : 'border-gray-50'
                }`}>
                  <div className="flex items-center gap-3">
                    <img src={p.photoURL || `https://picsum.photos/100/100?seed=${p.uid}`} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" alt="P" />
                    <div>
                      <p className="font-bold text-gray-700 text-sm">{p.name}{room.hostId === p.uid && ' 👑'}</p>
                      <p className="text-pink-500 text-xs font-bold">{p.lines} 빙고!</p>
                    </div>
                  </div>
                  {room.currentTurn === p.uid && (
                    <span className="text-xs bg-pink-500 text-white px-2 py-1 rounded-full animate-pulse font-bold">진행중</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {room.status === 'playing' && (
            <div className="bg-white rounded-3xl p-6 shadow-xl border-4 border-blue-100">
              <h3 className="text-xl font-bold text-blue-500 mb-2 flex items-center gap-2">
                <Star />
                내 빙고 현황
              </h3>
              <div className="flex items-end gap-2">
                <span className="text-5xl font-extrabold text-blue-600">{bingoCount}</span>
                <span className="text-xl font-bold text-gray-400 mb-1">/ 5 줄</span>
              </div>
              <div className="mt-4 w-full bg-blue-50 rounded-full h-4 overflow-hidden">
                <div 
                  className="bg-blue-400 h-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(100, (bingoCount / 5) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Middle: Game Board */}
        <div className="lg:col-span-2 space-y-4">
          {room.status === 'waiting' ? (
            <div className="bg-white rounded-[40px] p-12 shadow-2xl flex flex-col items-center justify-center border-4 border-dashed border-pink-200 min-h-[500px]">
              <div className="text-9xl mb-8 animate-bounce">🎨</div>
              <h2 className="text-4xl font-bold text-gray-800 mb-4 text-center">친구들을 기다리고 있어요!</h2>
              <p className="text-gray-400 mb-8 text-xl text-center">방장이 게임 시작 버튼을 누르면 빙고가 시작돼요!</p>
              
              {user.uid === room.hostId ? (
                <button
                  onClick={handleStartGame}
                  className="bg-pink-500 hover:bg-pink-600 text-white text-2xl font-bold px-12 py-5 rounded-3xl shadow-2xl transform hover:scale-105 active:scale-95 transition-all"
                >
                  빙고 시작하기! 🚀
                </button>
              ) : (
                <div className="flex items-center gap-2 text-pink-400 font-bold bg-pink-50 px-6 py-3 rounded-2xl">
                  <div className="w-3 h-3 bg-pink-400 rounded-full animate-ping"></div>
                  방장님이 시작하기를 기다리는 중...
                </div>
              )}
            </div>
          ) : room.status === 'playing' ? (
            <div className="bg-white rounded-[40px] p-8 shadow-2xl border-4 border-pink-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-700">
                  {room.currentTurn === user.uid 
                    ? <span className="text-blue-500 animate-pulse">👉 당신의 차례입니다! 숫자를 선택하세요!</span>
                    : <span className="text-gray-400">다른 친구가 고르는 중이에요... 🧐</span>
                  }
                </h2>
              </div>

              <div className="grid grid-cols-5 gap-3">
                {localBoard.map((row, rIdx) => 
                  row.map((num, cIdx) => {
                    const isPicked = room.pickedNumbers?.includes(num);
                    return (
                      <button
                        key={`${rIdx}-${cIdx}`}
                        disabled={room.currentTurn !== user.uid || isPicked}
                        onClick={() => handlePickNumber(num)}
                        className={`
                          aspect-square rounded-2xl md:rounded-3xl flex items-center justify-center text-xl md:text-3xl font-extrabold shadow-sm
                          bingo-cell-anim relative overflow-hidden
                          ${isPicked 
                            ? 'bg-pink-400 text-white shadow-inner scale-95 opacity-90' 
                            : room.currentTurn === user.uid 
                              ? 'bg-white border-4 border-blue-100 text-gray-700 hover:border-blue-300 hover:bg-blue-50' 
                              : 'bg-gray-50 border-4 border-gray-100 text-gray-300'
                          }
                        `}
                      >
                        {num}
                        {isPicked && <span className="absolute top-1 right-2 text-xs md:text-sm">⭐</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[40px] p-12 shadow-2xl flex flex-col items-center justify-center border-4 border-yellow-200 min-h-[500px]">
              <div className="relative mb-8">
                <Trophy size={120} className="text-yellow-400 animate-bounce" />
                <div className="absolute -top-4 -right-4 text-4xl">👑</div>
              </div>
              <h2 className="text-5xl font-bold text-gray-800 mb-2">승리 축하해요!</h2>
              <p className="text-2xl text-pink-500 font-bold mb-8">
                {room.players[room.winner!]?.name} 친구가 5줄 빙고를 먼저 완성했어요!
              </p>
              
              <div className="flex gap-4">
                <button
                  onClick={handleStartGame}
                  className="bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-4 rounded-3xl shadow-lg transform active:scale-95 transition-all"
                >
                  한 판 더 하기! 🔄
                </button>
                <button
                  onClick={handleLeave}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold px-8 py-4 rounded-3xl"
                >
                  로비로 돌아가기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Game;
