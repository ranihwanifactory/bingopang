
import React, { useState, useEffect } from 'react';
import { ref, onValue, push, set, remove, update } from 'firebase/database';
import { db, auth } from '../firebase';
import { UserInfo, Room, UserStats } from '../types';
import { PlusCircle, LogOut, Users, PlayCircle, Trophy, Medal, Crown, Trash2 } from 'lucide-react';

interface LobbyProps {
  user: UserInfo;
  onJoinRoom: (roomId: string) => void;
}

const Lobby: React.FC<LobbyProps> = ({ user, onJoinRoom }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [rankings, setRankings] = useState<UserStats[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [activeTab, setActiveTab] = useState<'rooms' | 'ranking'>('rooms');

  // Helper function to generate 5x5 random board (1-25)
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

  useEffect(() => {
    // Rooms listener
    const roomsRef = ref(db, 'rooms');
    const roomsUnsubscribe = onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const now = Date.now();
        const ROOM_EXPIRY_MS = 24 * 60 * 60 * 1000; 
        const roomList: Room[] = [];
        Object.keys(data).forEach((key) => {
          const room = data[key];
          const lastActive = room.lastActivity || room.createdAt;
          if (now - lastActive > ROOM_EXPIRY_MS) {
            remove(ref(db, `rooms/${key}`));
          } else {
            roomList.push({ ...room, id: key });
          }
        });
        setRooms(roomList.sort((a, b) => b.createdAt - a.createdAt));
      } else {
        setRooms([]);
      }
    });

    // Rankings listener
    const usersRef = ref(db, 'users');
    const rankingsUnsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const userList: UserStats[] = Object.keys(data).map(uid => ({
          uid,
          ...data[uid]
        }));
        setRankings(userList.sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          const rateA = a.totalGames > 0 ? a.wins / a.totalGames : 0;
          const rateB = b.totalGames > 0 ? b.wins / b.totalGames : 0;
          return rateB - rateA;
        }).slice(0, 10));
      }
    });

    if (user) {
      update(ref(db, `users/${user.uid}`), {
        name: user.displayName || '익명친구',
        photoURL: user.photoURL || `https://picsum.photos/100/100?seed=${user.uid}`
      });
    }

    return () => {
      roomsUnsubscribe();
      rankingsUnsubscribe();
    };
  }, [user]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    const roomsRef = ref(db, 'rooms');
    const newRoomRef = push(roomsRef);
    const roomId = newRoomRef.key;

    if (roomId) {
      const now = Date.now();
      const roomData: Partial<Room> = {
        name: newRoomName,
        hostId: user.uid,
        status: 'waiting',
        currentTurn: user.uid,
        pickedNumbers: [],
        winner: null,
        createdAt: now,
        lastActivity: now,
        players: {
          [user.uid]: {
            uid: user.uid,
            name: user.displayName || '익명친구',
            photoURL: user.photoURL,
            board: generateBoard(),
            lines: 0,
            isReady: true,
          }
        }
      };

      await set(newRoomRef, roomData);
      setIsCreating(false);
      setNewRoomName('');
      onJoinRoom(roomId);
    }
  };

  const handleDeleteRoom = async (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    if (window.confirm('정말로 이 방을 삭제할까요? 모든 진행 데이터가 사라져요! 😢')) {
      await remove(ref(db, `rooms/${roomId}`));
    }
  };

  const handleLogout = () => {
    auth.signOut();
  };

  return (
    <div className="min-h-screen bg-pink-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <img src={user.photoURL || `https://picsum.photos/100/100?seed=${user.uid}`} className="w-16 h-16 rounded-full border-4 border-white shadow-md" alt="Avatar" />
          <div>
            <h2 className="text-2xl font-bold text-gray-800">안녕, {user.displayName}! ✨</h2>
            <p className="text-pink-400">오늘은 누가 빙고왕이 될까요?</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsCreating(true)}
            className="bg-pink-500 hover:bg-pink-600 text-white font-bold px-6 py-3 rounded-2xl shadow-lg flex items-center gap-2 transform active:scale-95 transition-all"
          >
            <PlusCircle size={20} />
            방 만들기
          </button>
          <button
            onClick={handleLogout}
            className="bg-white hover:bg-gray-100 text-gray-600 font-bold px-6 py-3 rounded-2xl shadow-sm border-2 border-gray-100 flex items-center gap-2 transform active:scale-95 transition-all"
          >
            <LogOut size={20} />
            로그아웃
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto flex gap-4 mb-8">
        <button
          onClick={() => setActiveTab('rooms')}
          className={`px-8 py-3 rounded-2xl font-bold transition-all ${
            activeTab === 'rooms' ? 'bg-pink-500 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-pink-100'
          }`}
        >
          게임 목록
        </button>
        <button
          onClick={() => setActiveTab('ranking')}
          className={`px-8 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 ${
            activeTab === 'ranking' ? 'bg-yellow-400 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-yellow-100'
          }`}
        >
          <Trophy size={20} />
          빙고 랭킹
        </button>
      </div>

      {activeTab === 'rooms' ? (
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-4 border-dashed border-pink-100 text-gray-400">
              <span className="text-6xl mb-4">🎈</span>
              <p className="text-xl">참여할 수 있는 방이 없어요. 새로운 방을 만들어보세요!</p>
            </div>
          ) : (
            rooms.map((room) => (
              <div key={room.id} className="bg-white rounded-3xl p-6 shadow-xl border-2 border-pink-50 hover:border-pink-200 transition-all group relative">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-1">{room.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Users size={16} />
                      <span>참가자 {Object.keys(room.players || {}).length}명</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                      room.status === 'waiting' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {room.status === 'waiting' ? '대기 중' : '진행 중'}
                    </div>
                    {room.hostId === user.uid && (
                      <button 
                        onClick={(e) => handleDeleteRoom(e, room.id)}
                        className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                        title="방 삭제"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
                
                <button
                  disabled={room.status !== 'waiting' && !room.players?.[user.uid]}
                  onClick={() => onJoinRoom(room.id)}
                  className={`w-full font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transform active:scale-95 transition-all ${
                    (room.status === 'waiting' || !!room.players?.[user.uid])
                      ? 'bg-blue-400 hover:bg-blue-500 text-white shadow-md' 
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <PlayCircle size={20} />
                  {!!room.players?.[user.uid] ? '재접속하기' : '입장하기'}
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="max-w-4xl mx-auto bg-white rounded-[40px] p-8 shadow-2xl border-4 border-yellow-100">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold text-yellow-500 flex items-center justify-center gap-2">
              <Crown className="text-yellow-400" />
              마법의 빙고나라 명예의 전당
            </h2>
            <p className="text-gray-400">최고의 빙고 실력자들을 확인해보세요!</p>
          </div>
          
          <div className="space-y-4">
            {rankings.length === 0 ? (
              <p className="text-center text-gray-400 py-10">아직 등록된 랭커가 없어요.</p>
            ) : (
              rankings.map((rk, index) => (
                <div key={rk.uid} className={`flex items-center justify-between p-4 rounded-3xl border-2 transition-all ${
                  index === 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-100'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 text-center font-bold text-xl">
                      {index === 0 ? <Medal className="text-yellow-500 mx-auto" /> : 
                       index === 1 ? <Medal className="text-gray-400 mx-auto" /> :
                       index === 2 ? <Medal className="text-amber-600 mx-auto" /> : 
                       (index + 1)}
                    </div>
                    <img src={rk.photoURL || `https://picsum.photos/100/100?seed=${rk.uid}`} className="w-12 h-12 rounded-full border-2 border-white shadow-sm" alt="P" />
                    <div>
                      <p className="font-bold text-gray-800">{rk.name} {rk.uid === user.uid && <span className="text-xs text-pink-400 ml-1">(나)</span>}</p>
                      <p className="text-xs text-gray-400">{rk.totalGames || 0}전 {rk.wins || 0}승</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-yellow-600">{rk.wins || 0}승</p>
                    <p className="text-xs font-bold text-yellow-400">
                      승률: {rk.totalGames > 0 ? Math.round((rk.wins / rk.totalGames) * 100) : 0}%
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {isCreating && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm border-4 border-pink-200 shadow-2xl">
            <h2 className="text-2xl font-bold text-pink-500 mb-6 flex items-center gap-2">
              <PlusCircle />
              새로운 방 만들기
            </h2>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-2">방 이름</label>
                <input
                  autoFocus
                  type="text"
                  placeholder="예: 즐거운 숫자놀이"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full px-5 py-3 rounded-2xl border-2 border-pink-100 focus:border-pink-300 focus:outline-none transition-colors"
                  maxLength={15}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold py-3 rounded-2xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 rounded-2xl shadow-lg"
                >
                  만들기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Lobby;
