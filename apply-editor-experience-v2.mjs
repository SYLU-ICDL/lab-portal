import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function file(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    throw new Error(`找不到 ${rel}。请确认脚本在 lab-portal 项目根目录运行。`);
  }
  return p;
}

function replaceOnce(rel, from, to, label) {
  const p = file(rel);
  let text = fs.readFileSync(p, "utf8");

  if (text.includes(to)) {
    console.log(`✓ ${rel}: ${label} 已存在，跳过`);
    return;
  }

  if (!text.includes(from)) {
    throw new Error(`${rel}: 找不到“${label}”的预期位置。请确认项目已经是最新版本。`);
  }

  text = text.replace(from, to);
  fs.writeFileSync(p, text, "utf8");
  console.log(`✓ ${rel}: ${label}`);
}

function appendBeforeLastStyle(rel, marker, css) {
  const p = file(rel);
  let text = fs.readFileSync(p, "utf8");
  if (text.includes(marker)) {
    console.log(`✓ ${rel}: 样式已存在，跳过`);
    return;
  }

  const index = text.lastIndexOf("</style>");
  if (index < 0) throw new Error(`${rel}: 找不到 </style>。`);

  text = text.slice(0, index) + `\n${css}\n` + text.slice(index);
  fs.writeFileSync(p, text, "utf8");
  console.log(`✓ ${rel}: 编辑器/消息样式`);
}

// -----------------------------------------------------------------------------
// 1. Markdown 编辑器：双栏同步滚动
// -----------------------------------------------------------------------------
replaceOnce(
  "src/pages/documents/edit.astro",
  `\t\tlet uploadingAttachment = false;
\t\tconst attachmentObjectUrls = new Map<string, string>();
\t\tconst attachmentFetches = new Map<string, Promise<string | null>>();`,
  `\t\tlet uploadingAttachment = false;
\t\tlet syncingPaneScroll = false;
\t\tconst attachmentObjectUrls = new Map<string, string>();
\t\tconst attachmentFetches = new Map<string, Promise<string | null>>();

\t\tfunction paneScrollSyncEnabled() {
\t\t\treturn window.matchMedia("(min-width: 1051px)").matches;
\t\t}

\t\tfunction syncPaneScroll(
\t\t\tsource: HTMLElement,
\t\t\ttarget: HTMLElement
\t\t) {
\t\t\tif (!paneScrollSyncEnabled() || syncingPaneScroll) return;

\t\t\tconst sourceMax = Math.max(
\t\t\t\t0,
\t\t\t\tsource.scrollHeight - source.clientHeight
\t\t\t);
\t\t\tconst targetMax = Math.max(
\t\t\t\t0,
\t\t\t\ttarget.scrollHeight - target.clientHeight
\t\t\t);

\t\t\tconst ratio =
\t\t\t\tsourceMax > 0
\t\t\t\t\t? Math.min(1, Math.max(0, source.scrollTop / sourceMax))
\t\t\t\t\t: 0;

\t\t\tsyncingPaneScroll = true;
\t\t\ttarget.scrollTop = ratio * targetMax;

\t\t\twindow.requestAnimationFrame(() => {
\t\t\t\tsyncingPaneScroll = false;
\t\t\t});
\t\t}`,
  "同步滚动逻辑"
);

replaceOnce(
  "src/pages/documents/edit.astro",
  `\t\t\tvoid hydrateProtectedImages(preview, path);
\t\t}`,
  `\t\t\tvoid hydrateProtectedImages(preview, path);

\t\t\tif (editor && paneScrollSyncEnabled()) {
\t\t\t\twindow.requestAnimationFrame(() => {
\t\t\t\t\tsyncPaneScroll(editor, preview);
\t\t\t\t});
\t\t\t}
\t\t}`,
  "预览刷新后保持滚动位置"
);

replaceOnce(
  "src/pages/documents/edit.astro",
  `\t\tsaveButton?.addEventListener("click", openSaveDialog);`,
  `\t\teditor?.addEventListener("scroll", () => {
\t\t\tif (preview) syncPaneScroll(editor, preview);
\t\t});

\t\tpreview?.addEventListener("scroll", () => {
\t\t\tif (editor) syncPaneScroll(preview, editor);
\t\t});

\t\twindow.addEventListener("resize", () => {
\t\t\tif (editor && preview && paneScrollSyncEnabled()) {
\t\t\t\tsyncPaneScroll(editor, preview);
\t\t\t}
\t\t});

\t\tsaveButton?.addEventListener("click", openSaveDialog);`,
  "双向滚动事件"
);

appendBeforeLastStyle(
  "src/pages/documents/edit.astro",
  "/* SYLU-ICDL editor workspace v2 */",
  `\t\t/* SYLU-ICDL editor workspace v2 */
\t\t.editor-page > .container {
\t\t\twidth: min(96vw, 1680px);
\t\t\tmax-width: none;
\t\t}

\t\t.editor-grid {
\t\t\theight: clamp(660px, calc(100vh - 250px), 900px);
\t\t\tmin-height: 0;
\t\t}

\t\t.editor-pane,
\t\t.preview-pane {
\t\t\tmin-height: 0;
\t\t\toverflow: hidden;
\t\t}

\t\t.markdown-editor {
\t\t\theight: 100%;
\t\t\tmin-height: 0;
\t\t\tresize: none;
\t\t\toverflow-y: auto;
\t\t\tscrollbar-width: none;
\t\t\toverscroll-behavior: contain;
\t\t}

\t\t.markdown-editor::-webkit-scrollbar,
\t\t.preview-body::-webkit-scrollbar {
\t\t\tdisplay: none;
\t\t\twidth: 0;
\t\t\theight: 0;
\t\t}

\t\t.preview-body {
\t\t\tmin-height: 0;
\t\t\tflex: 1;
\t\t\toverflow-y: auto;
\t\t\tscrollbar-width: none;
\t\t\toverscroll-behavior: contain;
\t\t}

\t\t@media (max-width: 1050px) {
\t\t\t.editor-page > .container {
\t\t\t\twidth: min(94vw, 980px);
\t\t\t}

\t\t\t.editor-grid {
\t\t\t\theight: auto;
\t\t\t\tmin-height: 0;
\t\t\t}

\t\t\t.editor-pane,
\t\t\t.preview-pane {
\t\t\t\toverflow: visible;
\t\t\t}

\t\t\t.markdown-editor {
\t\t\t\tmin-height: 560px;
\t\t\t\theight: auto;
\t\t\t\toverflow-y: auto;
\t\t\t\tscrollbar-width: auto;
\t\t\t}

\t\t\t.markdown-editor::-webkit-scrollbar {
\t\t\t\tdisplay: initial;
\t\t\t\twidth: auto;
\t\t\t}

\t\t\t.preview-body {
\t\t\t\toverflow-y: visible;
\t\t\t}
\t\t}`
);

// -----------------------------------------------------------------------------
// 2. 编辑页：消息中心收成方形按钮；打开后恢复完整宽度
// -----------------------------------------------------------------------------
replaceOnce(
  "src/components/LabChatWidget.astro",
  `  const root = document.querySelector<HTMLElement>("#lab-chat-root");
  const panel = document.querySelector<HTMLElement>("#lab-chat-panel");`,
  `  const root = document.querySelector<HTMLElement>("#lab-chat-root");
  const panel = document.querySelector<HTMLElement>("#lab-chat-panel");

  const compactForEditor =
    window.location.pathname.includes("/documents/edit");

  if (compactForEditor) {
    root?.classList.add("is-editor-compact");
  }`,
  "编辑页紧凑消息模式"
);

replaceOnce(
  "src/components/LabChatWidget.astro",
  `  async function openPanel() {
    panelOpen = true;
    if (panel) panel.hidden = false;
    launcher?.classList.add("is-open");`,
  `  async function openPanel() {
    panelOpen = true;
    root?.classList.add("is-panel-open");
    if (panel) panel.hidden = false;
    launcher?.classList.add("is-open");`,
  "消息窗口展开状态"
);

replaceOnce(
  "src/components/LabChatWidget.astro",
  `  function closePanel() {
    panelOpen = false;
    if (panel) panel.hidden = true;
    launcher?.classList.remove("is-open");`,
  `  function closePanel() {
    panelOpen = false;
    root?.classList.remove("is-panel-open");
    if (panel) panel.hidden = true;
    launcher?.classList.remove("is-open");`,
  "消息窗口收起状态"
);

appendBeforeLastStyle(
  "src/components/LabChatWidget.astro",
  "/* SYLU-ICDL editor compact chat v2 */",
  `  /* SYLU-ICDL editor compact chat v2 */
  .lab-chat-root.is-editor-compact:not(.is-panel-open) {
    width: 58px;
    gap: 8px;
  }

  .lab-chat-root.is-editor-compact:not(.is-panel-open) .lab-chat-launcher {
    width: 58px;
    min-width: 58px;
    height: 58px;
    min-height: 58px;
    justify-content: center;
    padding: 7px;
    gap: 0;
    border-radius: 16px;
    border-color: #d7dfeb;
    box-shadow: 0 10px 28px rgba(31,46,76,.16);
  }

  .lab-chat-root.is-editor-compact:not(.is-panel-open) .lab-chat-launcher-copy {
    display: none;
  }

  .lab-chat-root.is-editor-compact:not(.is-panel-open) .lab-chat-launcher-icon {
    width: 42px;
    height: 42px;
    border-radius: 12px;
  }

  .lab-chat-root.is-editor-compact:not(.is-panel-open) .lab-chat-unread {
    top: -7px;
    right: -7px;
  }

  .lab-chat-root.is-editor-compact:not(.is-panel-open) .lab-review-alert {
    width: 58px;
    min-height: 46px;
    justify-content: center;
    border-radius: 13px;
  }

  .lab-chat-root.is-editor-compact:not(.is-panel-open) .lab-review-alert a {
    justify-content: center;
    padding: 10px 7px;
    gap: 0;
  }

  .lab-chat-root.is-editor-compact:not(.is-panel-open) .lab-review-alert a > span {
    display: none;
  }

  .lab-chat-root.is-editor-compact:not(.is-panel-open) .lab-review-alert a strong {
    min-width: 26px;
    height: 26px;
  }

  .lab-chat-root.is-editor-compact:not(.is-panel-open) .lab-review-alert > button {
    display: none;
  }

  .lab-chat-root.is-editor-compact.is-panel-open {
    width: min(460px, calc(100vw - 44px));
  }

  @media (max-width: 620px) {
    .lab-chat-root.is-editor-compact:not(.is-panel-open) {
      left: 10px;
      right: auto;
      width: 54px;
    }

    .lab-chat-root.is-editor-compact:not(.is-panel-open) .lab-chat-launcher {
      width: 54px;
      min-width: 54px;
      height: 54px;
      min-height: 54px;
      padding: 6px;
    }

    .lab-chat-root.is-editor-compact.is-panel-open {
      left: 10px;
      right: 10px;
      width: auto;
    }
  }`
);

console.log("");
console.log("编辑体验 v2 已应用。");
console.log("下一步请运行：npm run build");
