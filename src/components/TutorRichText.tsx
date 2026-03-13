type TutorRichTextProps = {
  content: string;
  className?: string;
};

function renderInlineStrong(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={idx} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    return <span key={idx}>{part}</span>;
  });
}

export default function TutorRichText({ content, className = "" }: TutorRichTextProps) {
  const lines = content.split("\n");

  return (
    <div className={`space-y-2 text-sm leading-relaxed ${className}`}>
      {lines.map((rawLine, index) => {
        const line = rawLine.trim();

        if (!line) {
          return <div key={index} className="h-1" />;
        }

        const isHeading = line.startsWith("**") && line.endsWith("**") && line.length > 4;
        if (isHeading) {
          return (
            <h4 key={index} className="text-base font-semibold text-foreground mt-2">
              {line.slice(2, -2)}
            </h4>
          );
        }

        const isBullet = line.startsWith("* ") || line.startsWith("- ");
        if (isBullet) {
          return (
            <div key={index} className="flex items-start gap-2 text-foreground/95">
              <span className="mt-1.75 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
              <p>{renderInlineStrong(line.slice(2).trim())}</p>
            </div>
          );
        }

        const isNumbered = /^\d+\.\s/.test(line);
        if (isNumbered) {
          const [prefix, ...rest] = line.split(" ");
          return (
            <div key={index} className="flex items-start gap-2 text-foreground/95">
              <span className="font-semibold text-accent min-w-6">{prefix}</span>
              <p>{renderInlineStrong(rest.join(" "))}</p>
            </div>
          );
        }

        return (
          <p key={index} className="text-foreground/95">
            {renderInlineStrong(line)}
          </p>
        );
      })}
    </div>
  );
}
