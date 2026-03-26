import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import RoomSelector from "./RoomSelector";
import Chat from "./Chat";
import AdminDashboard from "./AdminDashboard";
import { ThemeProvider } from "./ThemeContext";

function App() {
  const [username, setUsername] = useState(
    () => localStorage.getItem("slang_username") || ""
  );

  const handleSetUsername = (name) => {
    setUsername(name);
    localStorage.setItem("slang_username", name);
  };

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={<RoomSelector username={username} onSetUsername={handleSetUsername} />}
          />
          <Route
            path="/room/:roomId"
            element={
              username
                ? <Chat username={username} />
                : <Navigate to="/" replace />
            }
          />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
