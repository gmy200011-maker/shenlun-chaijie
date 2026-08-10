import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.error || "登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ink-50 via-white to-brand-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-700 text-white text-2xl font-bold mb-4 font-serif shadow-lg">
            申
          </div>
          <h1 className="text-2xl font-bold text-ink-900 ink-title">申论拆解工具</h1>
          <p className="text-sm text-ink-500 mt-2">浙江宣传文章分析与申论素材积累</p>
        </div>

        <div className="card p-8">
          <h2 className="text-lg font-semibold text-ink-900 mb-6 ink-title">登录</h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-seal-50 border border-seal-200 text-sm text-seal-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">用户名</label>
              <input
                type="text" value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field" placeholder="请输入用户名"
                autoComplete="username" required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">密码</label>
              <input
                type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field" placeholder="请输入密码"
                autoComplete="current-password" required
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  登录中...
                </>
              ) : "登录"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-ink-500">
            还没有账号？{" "}
            <Link to="/register" className="text-brand-600 hover:text-brand-800 font-medium">立即注册</Link>
          </div>
        </div>
        <p className="text-center text-xs text-ink-400 mt-6">数据保存在本地，请妥善保管账号信息</p>
      </div>
    </div>
  );
}
