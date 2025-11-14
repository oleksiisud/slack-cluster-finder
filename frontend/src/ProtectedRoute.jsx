import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from './AuthContext';

export default function ProtectedRoute() {
    const {session} = useAuth();
    return session ? <Outlet /> : <Navigate to="log-in" replace/>
}