import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    throw new Error(`找不到 ${rel}，请确认脚本位于 lab-portal 项目根目录。`);
  }
  return fs.readFileSync(file, "utf8");
}

function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, "utf8");
  console.log(`✓ ${rel}`);
}

function replaceOnce(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) {
    throw new Error(`无法应用 ${label}：当前源码与预期不一致。`);
  }
  return text.replace(from, to);
}

// =========================
// 编辑页：粘贴上传 + 私有附件预览
// =========================
{
  const rel = "src/pages/documents/edit.astro";
  let text = read(rel);

  text = replaceOnce(
    text,
    `\t\t\t\t<section class="editor-pane">\n\t\t\t\t\t<div class="pane-title">正文</div>\n\n\t\t\t\t\t<textarea`,
    `\t\t\t\t<section class="editor-pane">\n\t\t\t\t\t<div class="pane-title">正文</div>\n\n\t\t\t\t\t<div class="attachment-paste-hint">\n\t\t\t\t\t\t<div>\n\t\t\t\t\t\t\t<strong>支持直接粘贴图片</strong>\n\t\t\t\t\t\t\t<span>复制截图或图片后，在正文中按 Ctrl + V 即可插入。</span>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t\t<span id="attachment-upload-state" class="attachment-upload-state"></span>\n\t\t\t\t\t</div>\n\n\t\t\t\t\t<textarea`,
    "编辑器图片粘贴提示"
  );

  text = replaceOnce(
    text,
    `\t\tconst backLink =\n\t\t\tdocument.querySelector<HTMLAnchorElement>("#back-to-reader");\n`,
    `\t\tconst backLink =\n\t\t\tdocument.querySelector<HTMLAnchorElement>("#back-to-reader");\n\t\tconst attachmentUploadState =\n\t\t\tdocument.querySelector<HTMLElement>("#attachment-upload-state");\n`,
    "附件状态节点"
  );

  text = replaceOnce(
    text,
    `\t\tlet originalMarkdown = "";\n\t\tlet saving = false;\n`,
    `\t\tlet originalMarkdown = "";\n\t\tlet saving = false;\n\t\tlet uploadingAttachment = false;\n\t\tconst attachmentObjectUrls = new Map<string, string>();\n\t\tconst attachmentFetches = new Map<string, Promise<string | null>>();\n`,
    "附件运行状态"
  );

  text = replaceOnce(
    text,
    `\t\tfunction render(markdown: string) {\n\t\t\tif (!preview) return;\n\n\t\t\tconst html = marked.parse(markdown);\n\n\t\t\tpreview.innerHTML = DOMPurify.sanitize(\n\t\t\t\thtml as string,\n\t\t\t\t{ USE_PROFILES: { html: true } }\n\t\t\t);\n\t\t}\n`,
    `\t\tfunction resolveAttachmentRepositoryPath(src: string, documentPath: string) {\n\t\t\tif (!src || !documentPath) return null;\n\t\t\tif (/^(?:https?:|data:|blob:|\\/\\/)/i.test(src)) return null;\n\n\t\t\tlet clean = src.split("#")[0].split("?")[0];\n\t\t\ttry { clean = decodeURIComponent(clean); } catch {}\n\t\t\tclean = clean.replace(/\\\\/g, "/");\n\t\t\tif (!clean.includes("_attachments/")) return null;\n\n\t\t\tconst stack = documentPath.split("/").slice(0, -1);\n\t\t\tfor (const segment of clean.split("/")) {\n\t\t\t\tif (!segment || segment === ".") continue;\n\t\t\t\tif (segment === "..") {\n\t\t\t\t\tif (stack.length > 1) stack.pop();\n\t\t\t\t\tcontinue;\n\t\t\t\t}\n\t\t\t\tstack.push(segment);\n\t\t\t}\n\n\t\t\tconst resolved = stack.join("/");\n\t\t\treturn resolved.includes("/_attachments/") ? resolved : null;\n\t\t}\n\n\t\tasync function attachmentObjectUrl(repositoryPath: string) {\n\t\t\tconst cached = attachmentObjectUrls.get(repositoryPath);\n\t\t\tif (cached) return cached;\n\n\t\t\tconst pending = attachmentFetches.get(repositoryPath);\n\t\t\tif (pending) return pending;\n\n\t\t\tconst task = (async () => {\n\t\t\t\tconst session = getSessionToken();\n\t\t\t\tif (!session) return null;\n\n\t\t\t\tconst url = new URL(\`\${AUTH_WORKER}/api/documents/attachment\`);\n\t\t\t\turl.searchParams.set("path", repositoryPath);\n\n\t\t\t\tconst response = await fetch(url.toString(), {\n\t\t\t\t\theaders: { Authorization: \`Bearer \${session}\` },\n\t\t\t\t\tcache: "no-store",\n\t\t\t\t});\n\n\t\t\t\tif (!response.ok) return null;\n\t\t\t\tconst blob = await response.blob();\n\t\t\t\tconst objectUrl = URL.createObjectURL(blob);\n\t\t\t\tattachmentObjectUrls.set(repositoryPath, objectUrl);\n\t\t\t\treturn objectUrl;\n\t\t\t})().finally(() => attachmentFetches.delete(repositoryPath));\n\n\t\t\tattachmentFetches.set(repositoryPath, task);\n\t\t\treturn task;\n\t\t}\n\n\t\tasync function hydrateProtectedImages(container: HTMLElement, documentPath: string) {\n\t\t\tconst images = Array.from(container.querySelectorAll<HTMLImageElement>("img"));\n\n\t\t\tawait Promise.all(images.map(async (image) => {\n\t\t\t\tconst raw = image.getAttribute("src") || "";\n\t\t\t\tconst repositoryPath = resolveAttachmentRepositoryPath(raw, documentPath);\n\t\t\t\tif (!repositoryPath) return;\n\n\t\t\t\timage.classList.add("attachment-loading");\n\t\t\t\tconst objectUrl = await attachmentObjectUrl(repositoryPath);\n\t\t\t\timage.classList.remove("attachment-loading");\n\n\t\t\t\tif (objectUrl && image.isConnected) {\n\t\t\t\t\timage.src = objectUrl;\n\t\t\t\t} else if (image.isConnected) {\n\t\t\t\t\timage.classList.add("attachment-load-error");\n\t\t\t\t\timage.alt = image.alt || "图片暂时无法加载";\n\t\t\t\t}\n\t\t\t}));\n\t\t}\n\n\t\tfunction render(markdown: string) {\n\t\t\tif (!preview) return;\n\n\t\t\tconst html = marked.parse(markdown);\n\n\t\t\tpreview.innerHTML = DOMPurify.sanitize(\n\t\t\t\thtml as string,\n\t\t\t\t{ USE_PROFILES: { html: true } }\n\t\t\t);\n\n\t\t\tvoid hydrateProtectedImages(preview, path);\n\t\t}\n`,
    "私有附件预览"
  );

  text = replaceOnce(
    text,
    `\t\teditor?.addEventListener("input", () => {\n`,
    `\t\tfunction setAttachmentState(message: string, type: "normal" | "error" = "normal") {\n\t\t\tif (!attachmentUploadState) return;\n\t\t\tattachmentUploadState.textContent = message;\n\t\t\tattachmentUploadState.classList.toggle("is-error", type === "error");\n\t\t}\n\n\t\tfunction fileToBase64(file: File) {\n\t\t\treturn new Promise<string>((resolve, reject) => {\n\t\t\t\tconst reader = new FileReader();\n\t\t\t\treader.onload = () => {\n\t\t\t\t\tconst value = String(reader.result || "");\n\t\t\t\t\tconst comma = value.indexOf(",");\n\t\t\t\t\tif (comma < 0) reject(new Error("无法读取图片内容。"));\n\t\t\t\t\telse resolve(value.slice(comma + 1));\n\t\t\t\t};\n\t\t\t\treader.onerror = () => reject(new Error("无法读取图片内容。"));\n\t\t\t\treader.readAsDataURL(file);\n\t\t\t});\n\t\t}\n\n\t\tfunction insertMarkdownAtCursor(markdown: string) {\n\t\t\tif (!editor) return;\n\t\t\tconst start = editor.selectionStart ?? editor.value.length;\n\t\t\tconst end = editor.selectionEnd ?? start;\n\t\t\tconst before = editor.value.slice(0, start);\n\t\t\tconst after = editor.value.slice(end);\n\t\t\tconst prefix = before && !before.endsWith("\\n") ? "\\n" : "";\n\t\t\tconst suffix = after && !after.startsWith("\\n") ? "\\n" : "";\n\t\t\tconst insertion = \`\${prefix}\${markdown}\${suffix}\`;\n\n\t\t\teditor.value = before + insertion + after;\n\t\t\tconst next = before.length + insertion.length;\n\t\t\teditor.selectionStart = next;\n\t\t\teditor.selectionEnd = next;\n\t\t\teditor.dispatchEvent(new Event("input", { bubbles: true }));\n\t\t}\n\n\t\tasync function uploadPastedImage(file: File) {\n\t\t\tconst session = getSessionToken();\n\t\t\tif (!session) throw new Error("登录状态已失效，请重新登录。");\n\n\t\t\tconst supported = new Set([\n\t\t\t\t"image/png",\n\t\t\t\t"image/jpeg",\n\t\t\t\t"image/webp",\n\t\t\t\t"image/gif",\n\t\t\t]);\n\n\t\t\tif (!supported.has(file.type)) {\n\t\t\t\tthrow new Error("暂时支持 PNG、JPG、WebP 和 GIF 图片。");\n\t\t\t}\n\n\t\t\tif (file.size > 5 * 1024 * 1024) {\n\t\t\t\tthrow new Error("单张图片不能超过 5 MB。");\n\t\t\t}\n\n\t\t\tconst base64 = await fileToBase64(file);\n\t\t\tconst response = await fetch(\`\${AUTH_WORKER}/api/documents/attachments\`, {\n\t\t\t\tmethod: "POST",\n\t\t\t\theaders: {\n\t\t\t\t\tAuthorization: \`Bearer \${session}\`,\n\t\t\t\t\t"Content-Type": "application/json",\n\t\t\t\t},\n\t\t\t\tbody: JSON.stringify({\n\t\t\t\t\tdocumentPath: path,\n\t\t\t\t\tmimeType: file.type,\n\t\t\t\t\tbase64,\n\t\t\t\t}),\n\t\t\t});\n\n\t\t\tif (response.status === 401) {\n\t\t\t\tclearSession();\n\t\t\t\twindow.location.reload();\n\t\t\t\tthrow new Error("登录状态已失效。");\n\t\t\t}\n\n\t\t\tconst data = await response.json();\n\t\t\tif (!response.ok) {\n\t\t\t\tthrow new Error(data.message || "图片上传失败。");\n\t\t\t}\n\n\t\t\treturn data;\n\t\t}\n\n\t\teditor?.addEventListener("paste", async (event) => {\n\t\t\tconst files = Array.from(event.clipboardData?.items || [])\n\t\t\t\t.filter((item) => item.kind === "file" && item.type.startsWith("image/"))\n\t\t\t\t.map((item) => item.getAsFile())\n\t\t\t\t.filter((file): file is File => Boolean(file));\n\n\t\t\tif (files.length === 0) return;\n\t\t\tevent.preventDefault();\n\n\t\t\tif (uploadingAttachment || !editor) return;\n\t\t\tuploadingAttachment = true;\n\t\t\teditor.readOnly = true;\n\t\t\tclearMessage();\n\n\t\t\ttry {\n\t\t\t\tfor (let index = 0; index < files.length; index++) {\n\t\t\t\t\tsetAttachmentState(\`正在上传图片 \${index + 1}/\${files.length}…\`);\n\t\t\t\t\tconst data = await uploadPastedImage(files[index]);\n\t\t\t\t\tinsertMarkdownAtCursor(\`![图片](\${data.relativePath})\`);\n\t\t\t\t}\n\t\t\t\tsetAttachmentState(files.length > 1 ? \`已插入 \${files.length} 张图片\` : "图片已插入");\n\t\t\t} catch (error) {\n\t\t\t\tconsole.error(error);\n\t\t\t\tconst message = error instanceof Error ? error.message : "图片上传失败。";\n\t\t\t\tsetAttachmentState(message, "error");\n\t\t\t\tsetMessage(message, "error");\n\t\t\t} finally {\n\t\t\t\tuploadingAttachment = false;\n\t\t\t\teditor.readOnly = false;\n\t\t\t\teditor.focus();\n\t\t\t}\n\t\t});\n\n\t\teditor?.addEventListener("input", () => {\n`,
    "粘贴图片上传逻辑"
  );

  text = replaceOnce(
    text,
    `\t\tload();\n\t</script>`,
    `\t\twindow.addEventListener("beforeunload", () => {\n\t\t\tfor (const objectUrl of attachmentObjectUrls.values()) {\n\t\t\t\tURL.revokeObjectURL(objectUrl);\n\t\t\t}\n\t\t});\n\n\t\tload();\n\t</script>`,
    "释放附件 Blob URL"
  );

  text = replaceOnce(
    text,
    `\t\t.markdown-editor {\n`,
    `\t\t.attachment-paste-hint {\n\t\t\tdisplay: flex;\n\t\t\talign-items: center;\n\t\t\tjustify-content: space-between;\n\t\t\tgap: 16px;\n\t\t\tmargin: 0 0 10px;\n\t\t\tpadding: 10px 12px;\n\t\t\tborder: 1px solid #e3e8f0;\n\t\t\tborder-radius: 10px;\n\t\t\tbackground: #f8faff;\n\t\t\tcolor: #69768a;\n\t\t\tfont-size: 11px;\n\t\t\tline-height: 1.55;\n\t\t}\n\n\t\t.attachment-paste-hint > div {\n\t\t\tdisplay: flex;\n\t\t\tmin-width: 0;\n\t\t\tflex-direction: column;\n\t\t\tgap: 2px;\n\t\t}\n\n\t\t.attachment-paste-hint strong {\n\t\t\tcolor: #44536a;\n\t\t\tfont-size: 12px;\n\t\t}\n\n\t\t.attachment-upload-state {\n\t\t\tflex: 0 0 auto;\n\t\t\tcolor: #4c6fd5;\n\t\t\tfont-weight: 750;\n\t\t}\n\n\t\t.attachment-upload-state.is-error {\n\t\t\tcolor: #b44747;\n\t\t}\n\n\t\t.markdown-body img.attachment-loading {\n\t\t\topacity: .45;\n\t\t}\n\n\t\t.markdown-body img.attachment-load-error {\n\t\t\topacity: .35;\n\t\t\tfilter: grayscale(1);\n\t\t}\n\n\t\t.markdown-editor {\n`,
    "附件 UI 样式"
  );

  write(rel, text);
}

// =========================
// 阅读页：通过 Worker 读取私有图片
// =========================
{
  const rel = "src/pages/documents/view.astro";
  let text = read(rel);

  text = replaceOnce(
    text,
    `\t\tconst base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : \`\${import.meta.env.BASE_URL}/\`;\n`,
    `\t\tconst base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : \`\${import.meta.env.BASE_URL}/\`;\n\t\tconst attachmentObjectUrls = new Map<string, string>();\n\t\tconst attachmentFetches = new Map<string, Promise<string | null>>();\n`,
    "阅读页附件缓存"
  );

  text = replaceOnce(
    text,
    `\t\tfunction createTableOfContents() {\n`,
    `\t\tfunction resolveAttachmentRepositoryPath(src: string, documentPath: string) {\n\t\t\tif (!src || !documentPath) return null;\n\t\t\tif (/^(?:https?:|data:|blob:|\\/\\/)/i.test(src)) return null;\n\n\t\t\tlet clean = src.split("#")[0].split("?")[0];\n\t\t\ttry { clean = decodeURIComponent(clean); } catch {}\n\t\t\tclean = clean.replace(/\\\\/g, "/");\n\t\t\tif (!clean.includes("_attachments/")) return null;\n\n\t\t\tconst stack = documentPath.split("/").slice(0, -1);\n\t\t\tfor (const segment of clean.split("/")) {\n\t\t\t\tif (!segment || segment === ".") continue;\n\t\t\t\tif (segment === "..") {\n\t\t\t\t\tif (stack.length > 1) stack.pop();\n\t\t\t\t\tcontinue;\n\t\t\t\t}\n\t\t\t\tstack.push(segment);\n\t\t\t}\n\n\t\t\tconst resolved = stack.join("/");\n\t\t\treturn resolved.includes("/_attachments/") ? resolved : null;\n\t\t}\n\n\t\tasync function attachmentObjectUrl(repositoryPath: string) {\n\t\t\tconst cached = attachmentObjectUrls.get(repositoryPath);\n\t\t\tif (cached) return cached;\n\n\t\t\tconst pending = attachmentFetches.get(repositoryPath);\n\t\t\tif (pending) return pending;\n\n\t\t\tconst task = (async () => {\n\t\t\t\tconst session = getSessionToken();\n\t\t\t\tif (!session) return null;\n\n\t\t\t\tconst url = new URL(\`\${AUTH_WORKER}/api/documents/attachment\`);\n\t\t\t\turl.searchParams.set("path", repositoryPath);\n\n\t\t\t\tconst response = await fetch(url.toString(), {\n\t\t\t\t\theaders: { Authorization: \`Bearer \${session}\` },\n\t\t\t\t\tcache: "no-store",\n\t\t\t\t});\n\n\t\t\t\tif (!response.ok) return null;\n\t\t\t\tconst blob = await response.blob();\n\t\t\t\tconst objectUrl = URL.createObjectURL(blob);\n\t\t\t\tattachmentObjectUrls.set(repositoryPath, objectUrl);\n\t\t\t\treturn objectUrl;\n\t\t\t})().finally(() => attachmentFetches.delete(repositoryPath));\n\n\t\t\tattachmentFetches.set(repositoryPath, task);\n\t\t\treturn task;\n\t\t}\n\n\t\tasync function hydrateProtectedImages(container: HTMLElement, documentPath: string) {\n\t\t\tconst images = Array.from(container.querySelectorAll<HTMLImageElement>("img"));\n\n\t\t\tawait Promise.all(images.map(async (image) => {\n\t\t\t\tconst raw = image.getAttribute("src") || "";\n\t\t\t\tconst repositoryPath = resolveAttachmentRepositoryPath(raw, documentPath);\n\t\t\t\tif (!repositoryPath) return;\n\n\t\t\t\timage.classList.add("attachment-loading");\n\t\t\t\tconst objectUrl = await attachmentObjectUrl(repositoryPath);\n\t\t\t\timage.classList.remove("attachment-loading");\n\n\t\t\t\tif (objectUrl && image.isConnected) {\n\t\t\t\t\timage.src = objectUrl;\n\t\t\t\t} else if (image.isConnected) {\n\t\t\t\t\timage.classList.add("attachment-load-error");\n\t\t\t\t\timage.alt = image.alt || "图片暂时无法加载";\n\t\t\t\t}\n\t\t\t}));\n\t\t}\n\n\t\tfunction createTableOfContents() {\n`,
    "阅读页私有附件读取"
  );

  text = replaceOnce(
    text,
    `\t\t\t\t\tfor (\n\t\t\t\t\t\tconst link of content.querySelectorAll<HTMLAnchorElement>(\n\t\t\t\t\t\t\t"a"\n\t\t\t\t\t\t)\n\t\t\t\t\t) {\n\t\t\t\t\t\tif (\n\t\t\t\t\t\t\tlink.hostname &&\n\t\t\t\t\t\t\tlink.hostname !==\n\t\t\t\t\t\t\t\twindow.location.hostname\n\t\t\t\t\t\t) {\n\t\t\t\t\t\t\tlink.target = "_blank";\n\t\t\t\t\t\t\tlink.rel =\n\t\t\t\t\t\t\t\t"noopener noreferrer";\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\n\t\t\t\tcreateTableOfContents();`,
    `\t\t\t\t\tfor (\n\t\t\t\t\t\tconst link of content.querySelectorAll<HTMLAnchorElement>(\n\t\t\t\t\t\t\t"a"\n\t\t\t\t\t\t)\n\t\t\t\t\t) {\n\t\t\t\t\t\tif (\n\t\t\t\t\t\t\tlink.hostname &&\n\t\t\t\t\t\t\tlink.hostname !==\n\t\t\t\t\t\t\t\twindow.location.hostname\n\t\t\t\t\t\t) {\n\t\t\t\t\t\t\tlink.target = "_blank";\n\t\t\t\t\t\t\tlink.rel =\n\t\t\t\t\t\t\t\t"noopener noreferrer";\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\n\t\t\t\t\tawait hydrateProtectedImages(content, data.path);\n\t\t\t\t}\n\n\t\t\t\tcreateTableOfContents();`,
    "阅读页图片水合"
  );

  text = replaceOnce(
    text,
    `\t\tloadDocument();\n\t</script>`,
    `\t\twindow.addEventListener("beforeunload", () => {\n\t\t\tfor (const objectUrl of attachmentObjectUrls.values()) {\n\t\t\t\tURL.revokeObjectURL(objectUrl);\n\t\t\t}\n\t\t});\n\n\t\tloadDocument();\n\t</script>`,
    "阅读页释放 Blob URL"
  );

  text = replaceOnce(
    text,
    `\t\t.markdown-body img {\n`,
    `\t\t.markdown-body img.attachment-loading {\n\t\t\topacity: .45;\n\t\t}\n\n\t\t.markdown-body img.attachment-load-error {\n\t\t\topacity: .35;\n\t\t\tfilter: grayscale(1);\n\t\t}\n\n\t\t.markdown-body img {\n`,
    "阅读页附件状态样式"
  );

  write(rel, text);
}

console.log("");
console.log("文档图片附件功能已应用。");
console.log("下一步请运行：npm run build");
