import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [shopName, setShopName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check auth status on load
    fetch("/api/auth/check")
      .then((res) => res.json())
      .then((data) => {
        setIsAuthenticated(data.authenticated);
        if (data.shopName) setShopName(data.shopName);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleLogin = (name) => {
    setIsAuthenticated(true);
    if (name) setShopName(name);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setIsAuthenticated(false);
    setShopName("");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            !isAuthenticated ? (
              <Login onLogin={handleLogin} />
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/register"
          element={!isAuthenticated ? <Register /> : <Navigate to="/" />}
        />
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Dashboard onLogout={handleLogout} shopName={shopName} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
