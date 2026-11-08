import {
  useCompanionPreferences,
  setCompanionPreference,
} from "../stores/companionStore";
export function CompanionSettings() {
  const preferences = useCompanionPreferences();
  return (
    <section className="max-w-xl space-y-5">
      <h2 className="text-2xl">小猫陪伴</h2>
      <p className="text-sm leading-6 text-[#a5b49a]">
        让小猫陪你浏览。加载进度始终保留；关闭小猫后会使用普通进度面板。
      </p>
      {(
        [
          ["visible", "显示小猫"],
          ["automatic", "偶尔主动说话"],
          ["ai", "使用 AI 生成陪伴短句"],
        ] as const
      ).map(([key, label]) => (
        <label
          key={key}
          className="flex items-center justify-between gap-4 rounded-xl border border-white/10 p-4"
        >
          <span>{label}</span>
          <input
            type="checkbox"
            checked={preferences[key]}
            onChange={(e) => setCompanionPreference(key, e.target.checked)}
            className="h-5 w-5 accent-[#b8d69a]"
          />
        </label>
      ))}
      <p className="text-sm leading-6 text-[#a5b49a]">
        AI
        复用已配置的模型，最多每两分钟尝试一次，可能产生额外费用。仅发送已提交的主题摘要、标题、浏览模式和互动事件；没有模型配置或请求失败时使用本地台词。
      </p>
    </section>
  );
}
