import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ProtectedRoute, PublicOnlyRoute } from "@/routes/guards";
import WelcomePage from "@/pages/WelcomePage";
import AuthPage from "@/pages/AuthPage";
import MessagesPage from "@/pages/MessagesPage";
import ChatPage from "@/pages/ChatPage";
import ProfilePage from "@/pages/ProfilePage";
import FriendProfilePage from "@/pages/FriendProfilePage";
import DiscoverPage from "@/pages/DiscoverPage";
import CameraPage from "@/pages/CameraPage";
import StoryViewerPage from "@/pages/StoryViewerPage";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/welcome" element={<WelcomePage />} />

          <Route element={<PublicOnlyRoute />}>
            <Route path="/auth" element={<AuthPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:conversationId" element={<ChatPage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/camera" element={<CameraPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/u/:userId" element={<FriendProfilePage />} />
            <Route path="/stories/:userId" element={<StoryViewerPage />} />
          </Route>

          <Route path="/" element={<Navigate to="/welcome" replace />} />
          <Route path="*" element={<Navigate to="/welcome" replace />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
