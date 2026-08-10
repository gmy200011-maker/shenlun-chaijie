import { useEffect, useState } from "react";
import { settingsApi } from "../api";
import type { Settings, ApiProfile } from "../types";

const presetModels: { name: string; baseUrl: string; model: string }[] = [
  { name: "WorkBuddy", baseUrl: "https://api.workbuddy.cn/v1", model: "workbuddy-pro" },
  { name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { name: "通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  { name: "月之暗面", baseUrl: "https://api.moonshot.cn/v1", model: "kimi-k2.6" },
  { name: "智谱GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  { name: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({ profiles: [], activeProfileId: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKeys, setShowKeys] = useState(false);

  useEffect(() => {
    settingsApi
      .get()
      .then((data) => {
        // Defensive: handle legacy single-key response (should be migrated by server)
        if (!data.profiles) {
          const legacy = data as any;
          setSettings({
            profiles: [
              {
                id: "legacy",
                name: "默认配置",
                apiBaseUrl: legacy.apiBaseUrl || "https://api.deepseek.com/v1",
                apiKey: legacy.apiKey || "",
                model: legacy.model || "deepseek-chat",
              },
            ],
            activeProfileId: "legacy",
          });
        } else {
          setSettings({ profiles: data.profiles || [], activeProfileId: data.activeProfileId || "" });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await settingsApi.update(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const addPreset = (preset: (typeof presetModels)[0]) => {
    setSettings((prev) => {
      const existing = prev.profiles.find((p) => p.id === preset.name);
      if (existing) {
        return { ...prev, activeProfileId: preset.name };
      }
      const profile: ApiProfile = {
        id: preset.name,
        name: preset.name,
        apiBaseUrl: preset.baseUrl,
        apiKey: "",
        model: preset.model,
      };
      return {
        profiles: [...prev.profiles, profile],
        activeProfileId: profile.id,
      };
    });
  };

  const addBlank = () => {
    const id = `custom-${Date.now()}`;
    const profile: ApiProfile = {
      id,
      name: "自定义配置",
      apiBaseUrl: "",
      apiKey: "",
      model: "",
    };
    setSettings((prev) => ({
      profiles: [...prev.profiles, profile],
      activeProfileId: id,
    }));
  };

  const updateProfile = (id: string, patch: Partial<ApiProfile>) => {
    setSettings((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  };

  const setActive = (id: string) => {
    setSettings((prev) => ({ ...prev, activeProfileId: id }));
  };

  const removeProfile = (id: string) => {
    setSettings((prev) => {
      const profiles = prev.profiles.filter((p) => p.id !== id);
      const activeProfileId =
        prev.activeProfileId === id ? (profiles[0] ? profiles[0].id : "") : prev.activeProfileId;
      return { profiles, activeProfileId };
    });
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900 ink-title">设置</h1>
        <p className="text-sm text-ink-500 mt-1">
          可保存多个服务商/模型的 API 配置，各自独立保留密钥，拆解时选用其中一份
        </p>
      </div>

      {/* Add provider */}
      <div className="card p-6 mb-5">
        <h2 className="text-sm font-semibold text-ink-900 mb-3 ink-title">添加服务商配置</h2>
        <div className="flex flex-wrap gap-2">
          {presetModels.map((preset) => (
            <button
              key={preset.name}
              onClick={() => addPreset(preset)}
              className="px-3.5 py-2 rounded-lg text-sm font-medium border border-ink-200 bg-white text-ink-600 hover:bg-ink-50 transition-all"
            >
              + {preset.name}
            </button>
          ))}
          <button
            onClick={addBlank}
            className="px-3.5 py-2 rounded-lg text-sm font-medium border border-dashed border-brand-300 text-brand-600 bg-brand-50/40 hover:bg-brand-50 transition-all"
          >
            + 自定义
          </button>
        </div>
      </div>

      {/* Profiles list */}
      {settings.profiles.length === 0 && (
        <div className="card p-8 text-center text-sm text-ink-400 mb-5">
          还没有任何配置，点击上方服务商添加一份吧
        </div>
      )}

      <div className="space-y-4">
        {settings.profiles.map((p) => {
          const isActive = p.id === settings.activeProfileId;
          return (
            <div
              key={p.id}
              className={`card p-6 border-2 transition-all ${
                isActive ? "border-brand-400 bg-brand-50/30" : "border-ink-200/60"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => updateProfile(p.id, { name: e.target.value })}
                    className="input-field !py-1.5 !w-44 font-medium"
                    placeholder="配置名称"
                  />
                  {isActive && (
                    <span className="badge bg-brand-600 text-white">使用中</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!isActive && (
                    <button
                      onClick={() => setActive(p.id)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-brand-200 text-brand-600 hover:bg-brand-50 transition-colors"
                    >
                      设为使用
                    </button>
                  )}
                  {settings.profiles.length > 1 && (
                    <button
                      onClick={() => removeProfile(p.id)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-seal-200 text-seal-600 hover:bg-seal-50 transition-colors"
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">API Base URL</label>
                  <input
                    type="text"
                    value={p.apiBaseUrl}
                    onChange={(e) => updateProfile(p.id, { apiBaseUrl: e.target.value })}
                    className="input-field !py-2"
                    placeholder="https://api.deepseek.com/v1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">模型名称</label>
                  <input
                    type="text"
                    value={p.model}
                    onChange={(e) => updateProfile(p.id, { model: e.target.value })}
                    className="input-field !py-2"
                    placeholder="deepseek-chat"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-ink-600 mb-1">API Key</label>
                  <div className="relative">
                    <input
                      type={showKeys ? "text" : "password"}
                      value={p.apiKey}
                      onChange={(e) => updateProfile(p.id, { apiKey: e.target.value })}
                      className="input-field !py-2 pr-12"
                      placeholder="sk-..."
                    />
                    <button
                      onClick={() => setShowKeys((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 text-xs"
                      type="button"
                    >
                      {showKeys ? "隐藏" : "显示"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Save */}
      <div className="flex items-center gap-4 mt-6">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? "保存中..." : "保存设置"}
        </button>
        {saved && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            保存成功
          </span>
        )}
      </div>

      {/* Help */}
      <div className="card p-5 mt-6 bg-brand-50/50 border-brand-100">
        <h3 className="text-sm font-semibold text-ink-900 mb-2 ink-title">💡 使用说明</h3>
        <ul className="text-sm text-ink-600 space-y-1.5 list-disc list-inside">
          <li>可同时保存多份配置（不同服务商或同一服务商的不同模型），每份的密钥独立保存</li>
          <li>点击某份配置上的「设为使用」即可在拆解时选用它，其余配置保留不丢</li>
          <li>本工具支持所有兼容 OpenAI 接口格式的 AI 服务商</li>
          <li>API Key 仅保存在本地服务端，不会上传到任何第三方</li>
          <li>拆解一篇文章大约消耗 2000-3000 tokens</li>
        </ul>
      </div>
    </div>
  );
}
