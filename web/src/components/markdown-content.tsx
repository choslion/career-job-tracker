import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

function SafeLink({ href, children, ...props }: ComponentPropsWithoutRef<"a">) {
  const external = href?.startsWith("http://") || href?.startsWith("https://");
  return (
    <a
      {...props}
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

export function normalizeInlineBullets(source: string): string {
  let inCodeFence = false;
  return source
    .split("\n")
    .map((line) => {
      if (line.trimStart().startsWith("```")) {
        inCodeFence = !inCodeFence;
        return line;
      }
      if (inCodeFence || !/[•●▪]/.test(line)) return line;

      const parts = line.split(/\s*[•●▪]\s*/);
      const introduction = parts.shift()?.trim() ?? "";
      const items = parts.map((item) => item.trim()).filter(Boolean);
      if (items.length === 0) return introduction;
      const list = items.map((item) => `- ${item}`).join("\n");
      return introduction ? `${introduction}\n\n${list}` : list;
    })
    .join("\n");
}

export function MarkdownContent({ source }: { source: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        skipHtml
        components={{ a: SafeLink }}
      >
        {normalizeInlineBullets(source)}
      </ReactMarkdown>
    </div>
  );
}
