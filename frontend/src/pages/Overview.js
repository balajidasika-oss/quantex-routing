import React from "react";
import Home from "./Home";
import Dashboard from "../components/Dashboard";

export default function Overview({ userRole = "DISPATCHER", onNavigate = () => {} }) {
  return (
    <div className="space-y-8">
      <Home onNavigate={onNavigate} />
      <Dashboard userRole={userRole} onNavigate={onNavigate} />
    </div>
  );
}
