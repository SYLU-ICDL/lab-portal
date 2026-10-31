import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const normalizedBase =
  'const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;';

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    throw new Error(`找不到文件: ${rel}\n请把本脚本放到 lab-portal 项目根目录后再运行。`);
  }
  return { file, text: fs.readFileSync(file, "utf8") };
}

function write(file, text) {
  fs.writeFileSync(file, text, "utf8");
}

function replaceOnce(text, oldText, newText, rel, label) {
  if (text.includes(newText)) {
    return text;
  }
  if (!text.includes(oldText)) {
    throw new Error(`${rel}: 未找到预期内容（${label}），为避免误改已停止。`);
  }
  return text.replace(oldText, newText);
}

function patchSimpleBase(rel) {
  const { file, text } = read(rel);
  const updated = replaceOnce(
    text,
    "const base = import.meta.env.BASE_URL;",
    normalizedBase,
    rel,
    "BASE_URL"
  );
  write(file, updated);
  console.log(`✓ ${rel}`);
}

function patchDocumentPage(rel, importLine) {
  const { file, text } = read(rel);
  let updated = text;

  // Astro frontmatter: add a normalized base for template hrefs.
  if (!updated.includes(`${importLine}\n${normalizedBase}`)) {
    updated = replaceOnce(
      updated,
      `${importLine}\n---`,
      `${importLine}\n${normalizedBase}\n---`,
      rel,
      "frontmatter base"
    );
  }

  // Template link.
  updated = updated.replace(
    'href={`${import.meta.env.BASE_URL}documents`}',
    'href={`${base}documents`}'
  );

  // Browser script base.
  updated = updated.replace(
    "const base = import.meta.env.BASE_URL;",
    normalizedBase
  );

  write(file, updated);
  console.log(`✓ ${rel}`);
}

try {
  patchSimpleBase("src/layouts/BaseLayout.astro");
  patchSimpleBase("src/pages/login.astro");
  patchSimpleBase("src/pages/verify.astro");
  patchSimpleBase("src/pages/documents.astro");

  patchDocumentPage(
    "src/pages/documents/edit.astro",
    'import BaseLayout from "../../layouts/BaseLayout.astro";'
  );
  patchDocumentPage(
    "src/pages/documents/view.astro",
    'import BaseLayout from "../../layouts/BaseLayout.astro";'
  );

  console.log("");
  console.log("修复完成。");
  console.log("现在请运行: npm run build");
  console.log("然后 Commit + Push 到 main，GitHub Pages 会自动重新部署。");
} catch (error) {
  console.error("");
  console.error("修复未完成：");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
