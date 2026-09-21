export type MenuKey = "scan" | "preview" | "history" | "settings";

interface MenuItem {
  key: MenuKey;
  icon: string;
  label: string;
}

const MENU_ITEMS: MenuItem[] = [
  { key: "scan", icon: "\u{1F5A5}️", label: "바탕화면 분석" },
  { key: "preview", icon: "\u{1F441}️", label: "정리 미리보기" },
  { key: "history", icon: "\u{1F553}", label: "정리 기록" },
  { key: "settings", icon: "⚙️", label: "설정" },
];

interface SidebarProps {
  active: MenuKey;
  onSelect: (key: MenuKey) => void;
  backendMode: "tauri" | "mock";
}

export function Sidebar({ active, onSelect, backendMode }: SidebarProps) {
  return (
    <nav className="sidebar" aria-label="주 메뉴">
      <div className="sidebar-brand">
        <span className="sidebar-brand-icon" aria-hidden="true">{"\u{1F9F9}"}</span>
        <span className="sidebar-brand-text">Desktop Organizer</span>
      </div>
      <ul className="sidebar-menu">
        {MENU_ITEMS.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className={`sidebar-menu-item${active === item.key ? " active" : ""}`}
              onClick={() => onSelect(item.key)}
              aria-current={active === item.key ? "page" : undefined}
            >
              <span className="menu-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="sidebar-footer">
        <span className={`mode-badge mode-badge--${backendMode}`}>
          {backendMode === "tauri" ? "실제 파일 시스템" : "Mock 데모 모드"}
        </span>
      </div>
    </nav>
  );
}
