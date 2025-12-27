
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, update, remove, get, increment } from 'firebase/database';
import { db } from '../firebase';
import { UserInfo, Room, Player, PairRecord } from '../types';
import { ChevronLeft, Trophy, User as UserIcon, HelpCircle, Star, Sword, Share2, Check, Trash2 } from 'lucide-react';

interface GameProps {
  roomId: string;
  user: UserInfo;
  onLeave: () => void;
}

const Game: React.FC<GameProps> = ({ roomId, user, onLeave }) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [localBoard, setLocalBoard] = useState<number[][]>([]);
  const [bingoCount, setBingoCount] = useState(0);
  const [vsRecords, setVsRecords] = useState<Record<string, PairRecord>>({});
  const [showShareToast, setShowShareToast] = useState(false);
  const hasUpdatedStats = useRef(false);

  // Generate 5x5 random board (1-25)
  const generateBoard = useCallback(() => {
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
  }, []);

  useEffect(() => {
    if (!room?.players) return;
    const playerIds = Object.keys(room.players).filter(pid => pid !== user.uid);
    const unsubscribes = playerIds.map(pid => {
      const [u1, u2] = [user.uid, pid].sort();
      const vsRef = ref(db, `pairings/${u1}_${u2}`);
      return onValue(vsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const myWins = data[user.uid] || 0;
          const total = data.total || 0;
          setVsRecords(prev => ({ ...prev, [pid]: { wins: myWins, total: total } }));
        }
      });
    });
    return () => unsubscribes.forEach(unsub => unsub());
  }, [room?.players, user.uid]);

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`);
    get(roomRef).then((snapshot) => {
      const data = snapshot.val();
      if (data) {
        if (!data.players || !data.players[user.uid]) {
          const updates: any = {};
          updates[`players/${user.uid}`] = {
            uid: user.uid,
            name: user.displayName || '익명친구',
            photoURL: user.photoURL,
            board: generateBoard(),
            lines: 0,
            isReady: true,
          };
          updates['lastActivity'] = Date.now();
          update(roomRef, updates);
        } else if (!data.players[user.uid].board || data.players[user.uid].board.length === 0) {
          const updates: any = {};
          updates[`players/${user.uid}/board`] = generateBoard();
          updates['lastActivity'] = Date.now();
          update(roomRef, updates);
        } else {
          update(roomRef, { lastActivity: Date.now() });
        }
      }
    });

    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRoom(data);
        if (data.players?.[user.uid]?.board) {
          setLocalBoard(data.players[user.uid].board);
        }
        if (data.status === 'playing') {
          hasUpdatedStats.current = false;
        }
      } else {
        // If the room data is null, it means the room was deleted
        onLeave();
      }
    });
    return () => unsubscribe();
  }, [roomId, user.uid, onLeave, generateBoard]);

  const checkBingo = useCallback((picked: number[]) => {
    if (!localBoard || localBoard.length < 5) return 0;
    let count = 0;
    const pickedSet = new Set(picked || []);
    for (let r = 0; r < 5; r++) { if (localBoard[r] && localBoard[r].every(num => pickedSet.has(num))) count++; }
    for (let c = 0; c < 5; c++) {
      let full = true;
      for (let r = 0; r < 5; r++) { if (!localBoard[r] || !pickedSet.has(localBoard[r][c])) { full = false; break; } }
      if (full) count++;
    }
    let d1 = true, d2 = true;
    for (let i = 0; i < 5; i++) {
      if (!localBoard[i] || !pickedSet.has(localBoard[i][i])) d1 = false;
      if (!localBoard[i] || !pickedSet.has(localBoard[i][4 - i])) d2 = false;
    }
    if (d1) count++; if (d2) count++;
    return count;
  }, [localBoard]);

  useEffect(() => {
    if (room && room.status === 'playing' && localBoard.length > 0) {
      const lines = checkBingo(room.pickedNumbers || []);
      setBingoCount(lines);
      if (room.players?.[user.uid] && room.players[user.uid].lines !== lines) {
        const updates: any = {};
        updates[`players/${user.uid}/lines`] = lines;
        if (lines >= 5 && !room.winner) { updates['winner'] = user.uid; updates['status'] = 'finished'; }
        updates['lastActivity'] = Date.now();
        update(ref(db, `rooms/${roomId}`), updates);
      }
    }
  }, [room?.pickedNumbers, room?.status, checkBingo, user.uid, roomId, localBoard]);

  useEffect(() => {
    if (room?.status === 'finished' && room.winner && !hasUpdatedStats.current) {
      hasUpdatedStats.current = true;
      if (user.uid === room.hostId) {
        const pids = Object.keys(room.players);
        pids.forEach(pid => {
          update(ref(db, `users/${pid}`), { totalGames: increment(1), wins: pid === room.winner ? increment(1) : increment(0) });
        });
        for (let i = 0; i < pids.length; i++) {
          for (let j = i + 1; j < pids.length; j++) {
            const [u1, u2] = [pids[i], pids[j]].sort();
            const pairRef = ref(db, `pairings/${u1}_${u2}`);
            const up: any = { total: increment(1) };
            if (pids[i] === room.winner) up[pids[i]] = increment(1);
            if (pids[j] === room.winner) up[pids[j]] = increment(1);
            update(pairRef, up);
          }
        }
      }
    }
  }, [room?.status, room?.winner, room?.players, room?.hostId, user.uid]);

  const handleStartGame = async () => {
    if (!room) return;
    if (Object.keys(room.players || {}).length < 2) { alert('최소 2명의 플레이어가 필요해요!'); return; }
    await update(ref(db, `rooms/${roomId}`), { status: 'playing', currentTurn: room.hostId, pickedNumbers: [], winner: null, lastActivity: Date.now() });
  };

  const handlePickNumber = async (num: number) => {
    if (!room || room.status !== 'playing' || room.currentTurn !== user.uid || room.pickedNumbers?.includes(num)) return;
    const newPicked = [...(room.pickedNumbers || []), num];
    const pids = Object.keys(room.players || {});
    const nextTurn = pids[(pids.indexOf(user.uid) + 1) % pids.length];
    await update(ref(db, `rooms/${roomId}`), { pickedNumbers: newPicked, currentTurn: nextTurn, lastActivity: Date.now() });
  };

  const handleShareLink = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: '마법의 빙고나라', text: `빙고 한 판 어때요? ${room?.name} 방에 초대합니다!`, url: shareUrl });
      } catch (err) { console.debug('Sharing failed', err); }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 2000);
      } catch (err) { alert('링크 복사에 실패했어요: ' + shareUrl); }
    }
  };

  const handleDeleteRoom = async () => {
    if (window.confirm('정말로 이 방을 삭제할까요? 모든 진행 데이터가 사라져요! 😢')) {
      await remove(ref(db, `rooms/${roomId}`));
      onLeave();
    }
  };

  if (!room) return null;

  return (
    <div className="min-h-screen bg-pink-50 flex flex-col items-center p-4">
      {showShareToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-2 animate-bounce">
          <Check size={20} />
          초대 링크가 복사되었어요!
        </div>
      )}

      <div className="w-full max-w-4xl flex justify-between items-center mb-6">
        <button onClick={onLeave} className="flex items-center gap-1 text-pink-500 font-bold hover:bg-white px-4 py-2 rounded-2xl transition-all">
          <ChevronLeft size={24} /> 돌아가기
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-3xl font-extrabold text-pink-500 drop-shadow-sm">{room.name}</h1>
          <p className="text-gray-400 text-sm">참가 코드: {roomId.slice(-5)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleShareLink} className="bg-white p-3 rounded-2xl text-blue-400 hover:bg-blue-50 shadow-sm border border-blue-50 transition-colors">
            <Share2 size={24} />
          </button>
          {user.uid === room.hostId && (
            <button onClick={handleDeleteRoom} className="bg-white p-3 rounded-2xl text-red-400 hover:bg-red-50 shadow-sm border border-red-50 transition-colors">
              <Trash2 size={24} />
            </button>
          )}
        </div>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-3xl p-6 shadow-xl border-4 border-white">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><UserIcon className="text-pink-400" />참가자 명단</h3>
            <div className="space-y-3">
              {(Object.values(room.players || {}) as Player[]).map((p) => {
                const vs = vsRecords[p.uid];
                return (
                  <div key={p.uid} className={`flex flex-col p-3 rounded-2xl border-2 transition-all ${room.currentTurn === p.uid && room.status === 'playing' ? 'border-pink-300 bg-pink-50' : 'border-gray-50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img src={p.photoURL || `https://picsum.photos/100/100?seed=${p.uid}`} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" alt="P" />
                        <div>
                          <p className="font-bold text-gray-700 text-sm">{p.name}{room.hostId === p.uid && ' 👑'}</p>
                          <p className="text-pink-500 text-xs font-bold">{p.lines || 0} 빙고!</p>
                        </div>
                      </div>
                      {room.currentTurn === p.uid && room.status === 'playing' && <span className="text-xs bg-pink-500 text-white px-2 py-1 rounded-full animate-pulse font-bold">진행중</span>}
                    </div>
                    {p.uid !== user.uid && (
                      <div className="mt-2 ml-13 flex items-center gap-2">
                        <span className="bg-blue-50 text-blue-500 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1">
                          <Sword size={10} />상대전적: {vs ? `${vs.wins}승 ${vs.total - vs.wins}패` : '첫 대결!'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {room.status === 'playing' && (
            <div className="bg-white rounded-3xl p-6 shadow-xl border-4 border-blue-100">
              <h3 className="text-xl font-bold text-blue-500 mb-2 flex items-center gap-2"><Star />내 빙고 현황</h3>
              <div className="flex items-end gap-2"><span className="text-5xl font-extrabold text-blue-600">{bingoCount}</span><span className="text-xl font-bold text-gray-400 mb-1">/ 5 줄</span></div>
              <div className="mt-4 w-full bg-blue-50 rounded-full h-4 overflow-hidden">
                <div className="bg-blue-400 h-full transition-all duration-500 ease-out" style={{ width: `${Math.min(100, (bingoCount / 5) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {room.status === 'waiting' ? (
            <div className="bg-white rounded-[40px] p-12 shadow-2xl flex flex-col items-center justify-center border-4 border-dashed border-pink-200 min-h-[500px]">
              <div className="text-9xl mb-8 animate-bounce">🎨</div>
              <h2 className="text-4xl font-bold text-gray-800 mb-4 text-center">친구들을 기다리고 있어요!</h2>
              <div className="flex gap-4 mb-8">
                {user.uid === room.hostId ? (
                  <button onClick={handleStartGame} className="bg-pink-500 hover:bg-pink-600 text-white text-2xl font-bold px-12 py-5 rounded-3xl shadow-2xl transform hover:scale-105 active:scale-95 transition-all">빙고 시작하기! 🚀</button>
                ) : (
                  <div className="flex items-center gap-2 text-pink-400 font-bold bg-pink-50 px-6 py-3 rounded-2xl"><div className="w-3 h-3 bg-pink-400 rounded-full animate-ping"></div>방장님이 시작하기를 기다리는 중...</div>
                )}
              </div>
              <button onClick={handleShareLink} className="text-blue-500 flex items-center gap-2 hover:underline font-bold"><Share2 size={20} /> 친구 초대 링크 보내기</button>
            </div>
          ) : room.status === 'playing' ? (
            <div className="bg-white rounded-[40px] p-8 shadow-2xl border-4 border-pink-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-700">{room.currentTurn === user.uid ? <span className="text-blue-500 animate-pulse">👉 당신의 차례입니다!</span> : <span className="text-gray-400">다른 친구가 고르는 중이에요... 🧐</span>}</h2>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {localBoard.map((row, rIdx) => row.map((num, cIdx) => (
                  <button key={`${rIdx}-${cIdx}`} disabled={room.currentTurn !== user.uid || room.pickedNumbers?.includes(num)} onClick={() => handlePickNumber(num)} className={`aspect-square rounded-2xl md:rounded-3xl flex items-center justify-center text-xl md:text-3xl font-extrabold shadow-sm bingo-cell-anim relative overflow-hidden ${room.pickedNumbers?.includes(num) ? 'bg-pink-400 text-white shadow-inner scale-95 opacity-90' : room.currentTurn === user.uid ? 'bg-white border-4 border-blue-100 text-gray-700 hover:border-blue-300 hover:bg-blue-50' : 'bg-gray-50 border-4 border-gray-100 text-gray-300'}`}>
                    {num}{room.pickedNumbers?.includes(num) && <span className="absolute top-1 right-2 text-xs md:text-sm">⭐</span>}
                  </button>
                )))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[40px] p-12 shadow-2xl flex flex-col items-center justify-center border-4 border-yellow-200 min-h-[500px]">
              <div className="relative mb-8"><Trophy size={120} className="text-yellow-400 animate-bounce" /><div className="absolute -top-4 -right-4 text-4xl">👑</div></div>
              <h2 className="text-5xl font-bold text-gray-800 mb-2">승리 축하해요!</h2>
              <p className="text-2xl text-pink-500 font-bold mb-8">{room.players?.[room.winner!]?.name} 친구가 이겼어요!</p>
              <div className="flex gap-4">
                {user.uid === room.hostId && <button onClick={handleStartGame} className="bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-4 rounded-3xl shadow-lg transform active:scale-95 transition-all">한 판 더 하기! 🔄</button>}
                <button onClick={onLeave} className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold px-8 py-4 rounded-3xl">로비로 돌아가기</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Game;
