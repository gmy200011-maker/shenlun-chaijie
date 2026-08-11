import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { safeText } from "../utils/safeText";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("两次输入的密码不一致"); return; }
    if (password.length < 6) { setError("密码长度不能少于6位"); return; }
    setLoading(true);
    try {
      await register(username, password);
      navigate("/");
    } catch (err: any) {
      // Log the raw payload so we can see the real server response in devtools.
      console.error("[Register] 注册失败，原始错误：", err?.response?.data || err);
      const raw = err?.response?.data?.error || err?.response?.data?.message || "注册失败，请重试";
      setError(safeText(raw));
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
          <h1 className="text-2xl font-bold text-ink-900 ink-title">创建账号</h1>
          <p className="text-sm text-ink-500 mt-2">注册后即可使用文章拆解和素材积累功能</p>
        </div>

        <div className="card p-8">
          <h2 className="text-lg font-semibold text-ink-900 mb-6 ink-title">注册</h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-seal-50 border border-seal-200 text-sm text-seal-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">用户名</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                className="input-field" placeholder="2-20个字符" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">密码</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="input-field" placeholder="至少6位" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">确认密码</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field" placeholder="再次输入密码" required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  注册中...
                </>
              ) : "注册"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-ink-500">
            已有账号？{" "}
            <Link to="/login" className="text-brand-600 hover:text-brand-800 font-medium">返回登录</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
