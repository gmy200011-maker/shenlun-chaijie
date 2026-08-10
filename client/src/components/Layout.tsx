import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const navItems = [
  { path: "/", label: "数据看板", icon: "📊" },
  { path: "/analyze", label: "文章拆解", icon: "✍️" },
  { path: "/articles", label: "历史记录", icon: "📚" },
  { path: "/materials", label: "素材案例库", icon: "🗂️" },
  { path: "/interview", label: "面试题目库", icon: "🎯" },
  { path: "/quotes", label: "金句库", icon: "💎" },
  { path: "/solutions", label: "解决方法库", icon: "💡" },
  { path: "/settings", label: "设置", icon: "⚙️" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-ink-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white/80 backdrop-blur-sm border-r border-ink-200/60 flex flex-col shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-ink-200/60">
          <div className="w-9 h-9 rounded-lg bg-brand-700 flex items-center justify-center text-white font-bold text-lg font-serif">
            申
          </div>
          <div>
            <div className="text-sm font-semibold text-ink-900 ink-title">申论拆解</div>
            <div className="text-xs text-ink-400">文章拆解利器</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-brand-100 text-brand-800"
                    : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-ink-200/60">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold">
              {user?.username?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink-900 truncate">{user?.username}</div>
            </div>
            <button
              onClick={handleLogout}
              className="text-ink-400 hover:text-seal-500 transition-colors"
              title="退出登录"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
