
import React, { useState, useEffect } from 'react';
import { ref, onValue, push, set } from 'firebase/database';
import { db, auth } from '../firebase';
import { UserInfo, Room } from '../types';
import { PlusCircle, LogOut, Users, PlayCircle } from 'lucide-react';

interface LobbyProps {
  user: UserInfo;
  onJoinRoom: (roomId: string) => void;
}

const Lobby: React.FC<LobbyProps> = ({ user, onJoinRoom }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

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
    const roomsRef = ref(db, 'rooms');
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const roomList = Object.keys(data).map((key) => ({
          ...data[key],
          id: key,
        }));
        // Sort by newest first
        setRooms(roomList.sort((a, b) => b.createdAt - a.createdAt));
      } else {
        setRooms([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    const roomsRef = ref(db, 'rooms');
    const newRoomRef = push(roomsRef);
    const roomId = newRoomRef.key;

    if (roomId) {
      const roomData: Partial<Room> = {
        name: newRoomName,
        hostId: user.uid,
        status: 'waiting',
        currentTurn: user.uid,
        pickedNumbers: [],
        winner: null,
        createdAt: Date.now(),
        players: {
          [user.uid]: {
            uid: user.uid,
            name: user.displayName || '익명친구',
            photoURL: user.photoURL,
            board: generateBoard(), // Generate board immediately for host
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

  const handleLogout = () => {
    auth.signOut();
  };

  return (
    <div className="min-h-screen bg-pink-50 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <img src={user.photoURL || `https://picsum.photos/100/100?seed=${user.uid}`} className="w-16 h-16 rounded-full border-4 border-white shadow-md" alt="Avatar" />
          <div>
            <h2 className="text-2xl font-bold text-gray-800">안녕, {user.displayName}! ✨</h2>
            <p className="text-pink-400">오늘은 어떤 친구와 빙고를 할까요?</p>
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

      {/* Room List */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-4 border-dashed border-pink-100 text-gray-400">
            <span className="text-6xl mb-4">🎈</span>
            <p className="text-xl">참여할 수 있는 방이 없어요. 새로운 방을 만들어보세요!</p>
          </div>
        ) : (
          rooms.map((room) => (
            <div key={room.id} className="bg-white rounded-3xl p-6 shadow-xl border-2 border-pink-50 hover:border-pink-200 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-1">{room.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Users size={16} />
                    <span>참가자 {Object.keys(room.players || {}).length}명</span>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                  room.status === 'waiting' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}>
                  {room.status === 'waiting' ? '대기 중' : '진행 중'}
                </div>
              </div>
              
              <button
                disabled={room.status !== 'waiting'}
                onClick={() => onJoinRoom(room.id)}
                className={`w-full font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transform active:scale-95 transition-all ${
                  room.status === 'waiting' 
                    ? 'bg-blue-400 hover:bg-blue-500 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <PlayCircle size={20} />
                입장하기
              </button>
            </div>
          ))
        )}
      </div>

      {/* Create Room Modal */}
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
