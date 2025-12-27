
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, update, remove, get, increment, onDisconnect } from 'firebase/database';
import { db } from '../firebase';
import { UserInfo, Room, Player, PairRecord } from '../types';
import { ChevronLeft, Trophy, User as UserIcon, Star, Sword, Share2, Check, Trash2 } from 'lucide-react';

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

  // 5x5 랜덤 보드 생성
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

  // 상대 전적 리스너
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

  // 방 데이터 및 접속자 관리 (Presence)
  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`);
    const playerRef = ref(db, `rooms/${roomId}/players/${user.uid}`);

    // 접속 시 플레이어 정보 등록 및 연결 끊김 시 자동 삭제 설정
    get(roomRef).then((snapshot) => {
      const data = snapshot.val();
      if (data) {
        const playerData = {
          uid: user.uid,
          name: user.displayName || '익명친구',
          photoURL: user.photoURL,
          board: data.players?.[user.uid]?.board || generateBoard(),
          lines: data.players?.[user.uid]?.lines || 0,
          isReady: true,
        };
        
        const updates: any = {};
        updates[`players/${user.uid}`] = playerData;
        updates['lastActivity'] = Date.now();
        update(roomRef, updates);

        // 브라우저 종료 시 플레이어 목록에서 자동 삭제
        onDisconnect(playerRef).remove();
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
        onLeave();
      }
    });

    return () => {
      unsubscribe();
      // 컴포넌트 언마운트(로비 이동 등) 시 플레이어 목록에서 즉시 삭제
      remove(playerRef);
    };
  }, [roomId, user.uid, onLeave, generateBoard]);

  // 빙고 체크 로직
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

  // 빙고 점수 실시간 업데이트
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

  // 게임 종료 시 승수 업데이트
  useEffect(() => {
    if (room?.status === 'finished' && room.winner && !hasUpdatedStats.current) {
      hasUpdatedStats.current = true;
      if (user.uid === room.hostId) {
        const pids = Object.keys(room.players);
        pids.forEach(pid => {
          update(ref(db, `users/${pid}`), { totalGames: increment(1), wins: pid === room.winner ? increment(1) : increment(0) });
        });
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

  const playersArr = Object.values(room.players || {}) as Player[];

  return (
    <div className="h-screen flex flex-col bg-pink-50 overflow-hidden">
      {showShareToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-6 py-2 rounded-full shadow-2xl z-50 flex items-center gap-2 animate-bounce">
          <Check size={18} /> 초대 링크가 복사되었어요!
        </div>
      )}

      {/* Header: Compact */}
      <header className="flex justify-between items-center px-4 py-2 bg-white/80 backdrop-blur-sm border-b border-pink-100 shrink-0">
        <button onClick={onLeave} className="p-1 text-pink-500 font-bold hover:bg-pink-100 rounded-xl transition-all">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-black text-pink-500 truncate max-w-[200px] mx-auto">{room.name}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={handleShareLink} className="p-2 text-blue-400 hover:bg-blue-50 rounded-xl transition-colors">
            <Share2 size={20} />
          </button>
          {user.uid === room.hostId && (
            <button onClick={handleDeleteRoom} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors">
              <Trash2 size={20} />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0">
        {/* Left Section: Participants (Compressed) */}
        <aside className="lg:w-64 flex flex-col gap-3 shrink-0 min-h-0 overflow-hidden">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-pink-100 flex-1 overflow-y-auto">
            <h3 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2">
              <UserIcon size={16} className="text-pink-400" /> 접속 친구 ({playersArr.length})
            </h3>
            <div className="space-y-2">
              {playersArr.map((p) => {
                const vs = vsRecords[p.uid];
                return (
                  <div key={p.uid} className={`p-2 rounded-xl border-2 transition-all ${room.currentTurn === p.uid && room.status === 'playing' ? 'border-pink-300 bg-pink-50 shadow-sm' : 'border-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      <img src={p.photoURL || `https://picsum.photos/80/80?seed=${p.uid}`} className="w-8 h-8 rounded-full border border-white" alt="P" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-700 text-xs truncate">{p.name}{room.hostId === p.uid && ' 👑'}</p>
                        <p className="text-pink-500 text-[10px] font-black">{p.lines || 0} 빙고!</p>
                      </div>
                      {room.currentTurn === p.uid && room.status === 'playing' && <div className="w-2 h-2 bg-pink-500 rounded-full animate-ping" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {room.status === 'playing' && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-blue-100 shrink-0">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-xs font-bold text-blue-400 mb-1 flex items-center gap-1"><Star size={12} /> 내 빙고</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-blue-600">{bingoCount}</span>
                    <span className="text-xs font-bold text-gray-400">/ 5 줄</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 w-full bg-blue-50 rounded-full h-2 overflow-hidden">
                <div className="bg-blue-400 h-full transition-all duration-500" style={{ width: `${Math.min(100, (bingoCount / 5) * 100)}%` }} />
              </div>
            </div>
          )}
        </aside>

        {/* Center Section: Bingo Board (Large) */}
        <section className="flex-1 flex flex-col min-h-0">
          {room.status === 'waiting' ? (
            <div className="bg-white rounded-[32px] flex-1 flex flex-col items-center justify-center border-4 border-dashed border-pink-100 shadow-sm p-8">
              <div className="text-7xl mb-6 animate-bounce">🎈</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">친구들을 기다리고 있어요!</h2>
              <div className="flex flex-col items-center gap-4">
                {user.uid === room.hostId ? (
                  <button onClick={handleStartGame} className="bg-pink-500 hover:bg-pink-600 text-white text-xl font-bold px-8 py-3 rounded-2xl shadow-lg transform hover:scale-105 active:scale-95 transition-all">빙고 시작하기! 🚀</button>
                ) : (
                  <p className="text-pink-400 font-bold bg-pink-50 px-4 py-2 rounded-xl animate-pulse">방장님이 시작하기를 기다리는 중...</p>
                )}
                <button onClick={handleShareLink} className="text-blue-400 text-sm font-bold flex items-center gap-1 hover:underline"><Share2 size={16} /> 친구 초대 링크 보내기</button>
              </div>
            </div>
          ) : room.status === 'playing' ? (
            <div className="bg-white rounded-[32px] flex-1 flex flex-col p-4 shadow-sm border border-pink-100 min-h-0">
              <div className="mb-3 flex justify-between items-center shrink-0">
                <h2 className="text-lg font-bold">
                  {room.currentTurn === user.uid 
                    ? <span className="text-blue-500 animate-pulse">✨ 내 차례! 숫자를 골라주세요</span> 
                    : <span className="text-gray-400">상대방의 선택을 기다리는 중...</span>}
                </h2>
                <div className="text-xs font-bold text-gray-400 px-3 py-1 bg-gray-50 rounded-lg">남은 칸: {25 - (room.pickedNumbers?.length || 0)}</div>
              </div>
              
              <div className="flex-1 flex items-center justify-center min-h-0">
                <div className="grid grid-cols-5 gap-1.5 md:gap-2 w-full max-w-[500px] aspect-square">
                  {localBoard.map((row, rIdx) => row.map((num, cIdx) => (
                    <button 
                      key={`${rIdx}-${cIdx}`} 
                      disabled={room.currentTurn !== user.uid || room.pickedNumbers?.includes(num)} 
                      onClick={() => handlePickNumber(num)} 
                      className={`aspect-square rounded-xl md:rounded-2xl flex items-center justify-center text-lg md:text-3xl font-black shadow-sm bingo-cell-anim relative overflow-hidden transition-all border-2 ${
                        room.pickedNumbers?.includes(num) 
                          ? 'bg-pink-400 text-white border-pink-400 shadow-inner scale-95 opacity-90' 
                          : room.currentTurn === user.uid 
                            ? 'bg-white border-blue-100 text-gray-700 hover:border-blue-300 hover:bg-blue-50' 
                            : 'bg-gray-50 border-gray-100 text-gray-300'
                      }`}
                    >
                      {num}
                      {room.pickedNumbers?.includes(num) && <Star size={12} className="absolute top-1 right-1 text-white opacity-50" fill="currentColor" />}
                    </button>
                  )))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[32px] flex-1 flex flex-col items-center justify-center border-4 border-yellow-200 shadow-xl p-8 overflow-y-auto">
              <div className="relative mb-6">
                <Trophy size={80} className="text-yellow-400 animate-bounce" />
                <div className="absolute -top-2 -right-2 text-3xl">👑</div>
              </div>
              <h2 className="text-3xl font-black text-gray-800 mb-1">빙고 완성!</h2>
              <p className="text-xl text-pink-500 font-bold mb-6 text-center">{room.players?.[room.winner!]?.name} 친구가 이겼어요! 🎉</p>
              <div className="flex gap-3">
                {user.uid === room.hostId && <button onClick={handleStartGame} className="bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-3 rounded-2xl shadow-md transition-all">한 판 더 하기! 🔄</button>}
                <button onClick={onLeave} className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold px-6 py-3 rounded-2xl">로비로 이동</button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Game;
