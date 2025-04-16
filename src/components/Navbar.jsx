import { useAuth } from '../context/AuthContext';

function Navbar() {
  const { currentUser, logout } = useAuth();

  return (
    <nav className="bg-blue-600 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <a href="/" className="text-xl font-bold">InterviewAce</a>
        
        <div className="space-x-4">
          {currentUser ? (
            <>
              <span>{currentUser.email}</span>
              <button 
                onClick={logout}
                className="px-4 py-1 bg-blue-700 rounded hover:bg-blue-800"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <a href="/login" className="px-4 py-1 bg-blue-700 rounded hover:bg-blue-800">Login</a>
              <a href="/signup" className="px-4 py-1 bg-blue-700 rounded hover:bg-blue-800">Signup</a>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
