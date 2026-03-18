import { useState } from "react";
import Home from "./pages/Home";
import Chat from "./pages/Chat";

export default function App() {
  const [page, setPage] = useState("home"); // "home" | "chat"
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");

  if (page === "chat") {
    return <Chat roomId={roomId} username={username} />;
  }
  return <Home setPage={setPage} setRoomId={setRoomId} setUsername={setUsername} />;
}