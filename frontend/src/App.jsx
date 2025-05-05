import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import Login        from "./pages/Login";
import Dashboard    from "./pages/Dashboard";
import { useAuth }  from "./store/authStore";
import SignUp       from "./pages/SignUp";

const qc = new QueryClient();

function Private({ children }) {
  const user = useAuth((s) => s.user);
  return user ? children : <Navigate to="/" />;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/"          element={<Login />} />
          <Route path="/signup"    element={<SignUp />} />
          <Route path="/dashboard" element={<Private><Dashboard/></Private>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
